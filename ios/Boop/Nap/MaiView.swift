import SwiftUI
import BoopCore
import BoopDesign

// MARK: - MetricKey ↔ Hue (BoopCore cannot import BoopDesign; same five cases, same order)

func hue(for key: MetricKey) -> Hue {
    switch key {
    case .forma: .forma
    case .alvas: .alvas
    case .mozgas: .mozgas
    case .fuel: .fuel
    case .pulzus: .pulzus
    }
}

func metricKey(for hue: Hue) -> MetricKey {
    switch hue {
    case .forma: .forma
    case .alvas: .alvas
    case .mozgas: .mozgas
    case .fuel: .fuel
    case .pulzus: .pulzus
    }
}

// MARK: - The words of one metric in the hero

/// `score == nil` = no data (or still learning): the orbs say "–", never 0, and the hero orb does not rise.
struct MaiCopy: Equatable {
    let name: String, caps: String, headline: String, sentence: String
    let score: Int?
    /// In the hero orb: the server's display ("7ó 12p", Pulzus in bpm).
    let orbDisplay: String
    let orbCaption: String?
    /// In the mini orb: the 0–100 score (Pulzus: bpm).
    let miniValue: String
}

func maiCopy(key: MetricKey, score: Int?, display: String, caption: String?, headline: String, sentence: String,
             learning: Bool) -> MaiCopy {
    let h = hue(for: key)
    let s = learning ? nil : score
    return MaiCopy(
        name: h.name, caps: h.name.uppercased(),
        headline: headline.isEmpty ? (learning ? "Még tanulom a ritmusod" : "Még nincs adat") : headline,
        sentence: sentence,
        score: s,
        orbDisplay: s == nil ? "–" : display,
        orbCaption: s == nil ? (learning ? MaiText.learning : nil) : caption,
        miniValue: s.map { key == .pulzus ? display : "\($0)" } ?? "–")
}

func maiCopy(_ brief: Brief, _ key: MetricKey) -> MaiCopy {
    let m = brief.metric(key)
    return maiCopy(key: key, score: m.score, display: m.display, caption: m.caption, headline: m.headline,
                   sentence: m.sentence, learning: brief.state == .learning)
}

/// The words of a brief that did not arrive (offline reuses the Nap offline state).
func morningProblemCopy(_ p: MorningProblem) -> NapCopy {
    if p == .offline { return napCopy(.offline) }
    return NapCopy(orb: "–", orbCaption: nil, caps: MaiText.problemCaps, title: MaiText.problemTitle,
                   sentence: MaiText.problemSentence, action: MaiText.retry)
}

// MARK: - The Nap tabs

enum NapTab {
    static let mai = "Mai", day = "A napom"
    static let all = ["Mai", "A napom", "Beszélgetés", "Rutin"]
    /// The tabs that have a page; the others answer "hamarosan".
    static let built: Set<String> = [mai, day]
}

// MARK: - The Mai hero (spec §5.1, §5.1a; spike AuraSunrise)

/// Nap · Mai with the morning brief: title row, tabs, five mini orbs, the selected metric rising as the sun, its verdict
/// and the lens action row. Tapping a mini orb re-colours the page. `below` is what follows the hero; it receives the
/// selected orb, Boop's voice and the page toast (`MaiContext`).
struct MaiView<Below: View>: View {
    let brief: Brief
    @ViewBuilder let below: (MaiContext) -> Below
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selected: Hue = MaiView.initialOrb
    @State private var motion = OrbMotion()
    @State private var voice: BoopVoice?
    @State private var breathing = false
    @State private var inhale = false
    @State private var breathTask: Task<Void, Never>?
    @State private var toast: String?
    /// The undo of the toast on screen (nil = a plain toast).
    @State private var undo: (() -> Void)?
    /// The Nap tab on screen: Mai or A napom (Beszélgetés and Rutin are "hamarosan").
    @State private var tab = MaiView.initialTab

    /// Alvás's bedtime reminder (local notification), shared with the bedtime card below.
    @State private var reminder = BedtimeReminder()
    /// Bumped at each evening/day boundary and on return to the foreground, so the mode is re-read live.
    @State private var clockTick = 0
    /// The label of the toast's action (nil = "Visszavonom" when there is an undo).
    @State private var toastAction: String?
    @Environment(\.openURL) private var openURL

    private var copy: MaiCopy { maiCopy(brief, metricKey(for: selected)) }
    private var now: Date { _ = clockTick; return BoopClock.now() }
    private var evening: Bool { isEvening(now) }
    /// Evening's dusk or kímélő's calm over the page; nil = the selected orb's own sky.
    private var sky: NKSky? { maiSky(evening: evening, recovery: brief.day.recovery != nil) }
    private var action: LensAction? {
        let a = Lens.action(for: metricKey(for: selected), brief: brief, now: now, evening: evening)
        // the reminder is on: the pill says when it rings (a tap turns it off)
        if let a, a.kind == .bedtime, reminder.isOn, let time = reminder.time {
            return LensAction(glyph: a.glyph, title: reminderPillTitle(time), kind: .bedtime)
        }
        return a
    }

    var body: some View {
        let c = copy
        Group {
            if tab == NapTab.day {
                ANapomView(brief: brief, now: now, evening: evening, sky: sky) { header }
            } else {
                NKTabPage(hue: selected, sky: sky, heroHeight: nil,
                          compact: NKCompact(palette: selected.orb, title: c.name, value: c.orbDisplay, line: c.headline)) {
                    hero(c)
                } content: {
                    below(MaiContext(hue: selected, motion: motion, voice: voice, speak: speak,
                                     toast: { show($0) }, undoToast: { show($0, undo: $1) },
                                     now: now, evening: evening, reminder: reminder, toggleReminder: toggleReminder))
                }
            }
        }
        .nkToast($toast, action: undo == nil ? nil : (toastAction ?? SessionText.undo)) { undo?(); undo = nil }
        .background { ModeClock { clockTick += 1 } }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: inhale) { _, _ in breathing }
        .onAppear { if voice == nil { voice = BoopVoice() } }
        .onDisappear { motion.stop(); stopBreath(); voice?.stop() }
        .onChange(of: selected) { stopBreath(); voice?.stop() }
        .onChange(of: tab) { stopBreath(); voice?.stop() }
        .onChange(of: voice?.isSpeaking ?? false) { _, talking in motion.talking = talking }
        .onChange(of: voice?.shown ?? "") { _, _ in if voice?.isSpeaking == true { motion.kick() } }
        // a new brief may move the bedtime: the reminder follows (and turns off if notifications were withdrawn)
        .task(id: reminderTarget(brief)) { await reminder.refresh(target: reminderTarget(brief)) }
    }

    /// The title row and the Nap tabs, shared by Mai and A napom.
    @ViewBuilder private var header: some View {
        NKTitleRow(bellCount: 0, onBell: { show(soonToast("Értesítések")) }, onPlus: { show(soonToast("Gyors hozzáadás")) },
                   onAvatar: { show(soonToast("Beállítások")) })
            .padding(.top, 54)
        NKTabStrip(tabs: NapTab.all,
                   selected: Binding(get: { tab }, set: { t in
                       if NapTab.built.contains(t) { tab = t } else { show(soonToast(t)) }
                   }),
                   dot: morning ? NapTab.day : nil)
            .padding(.top, 10)
    }

    /// Simulator review: `-previewOrb alvas` opens on that orb (Hue name, lower case, no accents).
    private static var initialOrb: Hue {
        #if DEBUG
        let names = ["forma", "alvas", "mozgas", "fuel", "pulzus"]
        if let n = UserDefaults.standard.string(forKey: "previewOrb"), let i = names.firstIndex(of: n), let h = Hue(rawValue: i) { return h }
        #endif
        return .forma
    }

    private static var initialTab: String {
        #if DEBUG
        if UserDefaults.standard.string(forKey: "previewTab") == "napom" { return NapTab.day }
        #endif
        return NapTab.mai
    }

    private func hero(_ c: MaiCopy) -> some View {
        VStack(spacing: 0) {
            header
            if let r = brief.day.recovery {
                KimeloBanner(recovery: r) { show(soonToast("Kilépés a kímélő módból")) }
                    .padding(.top, 14)
            }
            MiniOrbRow(items: Hue.allCases.map { ($0, maiCopy(brief, metricKey(for: $0)).miniValue) },
                       selected: $selected, motion: motion)
                .padding(.vertical, 8).padding(.top, 10)
            RisingOrb(hue: selected, score: c.score, display: c.orbDisplay, caption: c.orbCaption, motion: motion,
                      orbScale: breathing && !reduceMotion ? (inhale ? 1.22 : 0.84) : 1)
                .frame(height: 290).padding(.bottom, 18)
            Text(c.caps).nkFont(14, .semibold).tracking(2.6).foregroundStyle(.white.opacity(0.85)).padding(.top, 4)
                .contentTransition(.opacity)
            Text(breathing ? (inhale ? MaiText.inhale : MaiText.exhale) : c.headline)
                .nkFont(42, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center)
                .lineLimit(2).minimumScaleFactor(0.7).padding(.horizontal, 20).padding(.top, 10)
                .contentTransition(.opacity)
                .animation(.easeInOut(duration: 0.6), value: inhale)
            Text(breathing ? MaiText.breathLine : c.sentence)
                .nkFont(17).lineSpacing(4).multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 30).padding(.top, 10)
                .frame(minHeight: 96, alignment: .top)
                .contentTransition(.opacity)
            LensActionRow(hue: selected, action: action, breathing: breathing, sessionTitle: brief.day.session?.title,
                          motion: motion, muted: voice?.muted ?? false,
                          onPrimary: primary, onMenu: { show(soonToast($0)) }, onChip: { show(soonToast($0.title)) },
                          onSpeak: speak, onToggleMute: { voice?.muted.toggle() })
                .nkHeroEnd()       // the compact capsule arrives as this row slides under the top bar
                .padding(.top, 4)
            Spacer(minLength: 0)
        }
        // Never squeeze the hero (labels would shrink); a tall hero pushes the cards down instead.
        .fixedSize(horizontal: false, vertical: true)
    }

    private func show(_ text: String, undo: (() -> Void)? = nil, action: String? = nil) {
        self.undo = undo
        toastAction = action
        toast = text
    }

    private var morning: Bool { (5..<12).contains(Calendar.current.component(.hour, from: now)) }

    private func primary() {
        if breathing { stopBreath(); return }
        guard let action else { speak(); return }
        switch action.kind {
        case .breath: startBreath()
        case .bedtime: toggleReminder()
        default: show(soonToast(soonName(action.kind)))
        }
    }

    /// First tap asks for notifications and sets the reminder; the next one turns it off.
    private func toggleReminder() {
        Task { @MainActor in
            guard let reply = await reminder.toggle(target: reminderTarget(brief)) else { return }   // a tap still running
            if reply.opensSettings, let url = URL(string: UIApplication.openSettingsURLString) {
                show(reply.text, undo: { openURL(url) }, action: BedtimeText.settings)
            } else {
                show(reply.text)
            }
        }
    }

    private func speak() {
        voice?.speak(segments: brief.brief, reduceMotion: reduceMotion)
    }

    /// Pulzus: the orb breathes, four seconds in, four out, and stops by itself after a minute.
    private func startBreath() {
        breathTask?.cancel()
        breathing = true
        inhale = false
        let anim: Animation? = reduceMotion ? nil : .easeInOut(duration: 4)
        breathTask = Task { @MainActor in
            for _ in 0..<15 {
                withAnimation(anim) { inhale.toggle() }
                try? await Task.sleep(for: .seconds(4))
                if Task.isCancelled { return }
            }
            show(MaiText.breathEnded)
            stopBreath()
        }
    }

    private func stopBreath() {
        breathTask?.cancel(); breathTask = nil
        guard breathing else { return }
        withAnimation(.easeInOut(duration: 0.8)) { breathing = false; inhale = false }
    }
}
