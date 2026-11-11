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

/// "13:40" for the compact capsule.
func clockLabel(_ date: Date, calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.hour, .minute], from: date)
    return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
}

// MARK: - The Mai hero (spec §5.1, §5.1a; spike AuraSunrise)

/// Ma with the morning brief: title row, the phase strip (Reggel · Napközben · Este), five mini orbs, the selected metric rising as the sun, its verdict
/// and the lens action row. Tapping a mini orb re-colours the page; tapping a phase scrolls to its section. `below` is what follows the hero; it receives the
/// selected orb, Boop's voice and the page toast (`MaiContext`).
///
/// The page sits in a navigation stack: an orb's room (`drill`) is pushed over it from the lens strip's door, the big
/// orb and the timeline's stations; the shell hides its bar while a room is open. The toast and the page-level sheets
/// (`sheets`, boop-ios.md §9) hang outside the stack, so they reach Ma and every room.
struct MaiView<Below: View, Drill: View, Sheets: ViewModifier>: View {
    let brief: Brief
    let below: (MaiContext) -> Below
    let drill: (Hue, MaiContext) -> Drill
    let sheets: (MaiContext) -> Sheets

    init(brief: Brief, @ViewBuilder below: @escaping (MaiContext) -> Below,
         @ViewBuilder drill: @escaping (Hue, MaiContext) -> Drill, sheets: @escaping (MaiContext) -> Sheets) {
        self.brief = brief; self.below = below; self.drill = drill; self.sheets = sheets
    }

    /// The rooms pushed over Ma (at most one in B2).
    @State private var path: [Hue] = MaiView.initialPath
    @Environment(\.setRoomOpen) private var setRoomOpen
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
    /// The phase the strip shows as selected (a tap scrolls there); starts on the clock's phase.
    @State private var shownPhase = DayPhase.at(BoopClock.now())

    /// Alvás's bedtime reminder (local notification), shared with the bedtime card below.
    @State private var reminder = BedtimeReminder()
    /// Bumped at each evening/day boundary and on return to the foreground, so the mode is re-read live.
    @State private var clockTick = 0
    /// The label of the toast's action (nil = "Visszavonom" when there is an undo).
    @State private var toastAction: String?
    @Environment(\.openURL) private var openURL
    @Environment(\.openAccount) private var openAccount

    private var copy: MaiCopy { maiCopy(brief, metricKey(for: selected)) }
    private var now: Date { _ = clockTick; return BoopClock.now() }
    private var evening: Bool { isEvening(now) }
    private var phase: DayPhase { DayPhase.at(now) }
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

    private var context: MaiContext {
        MaiContext(hue: selected, motion: motion, voice: voice, speak: speak,
                   toast: { show($0) }, undoToast: { show($0, undo: $1) },
                   now: now, evening: evening, reminder: reminder, toggleReminder: toggleReminder,
                   drill: { openRoom($0) })
    }

    var body: some View {
        let c = copy
        let ctx = context
        NavigationStack(path: $path) {
            // The phase strip scrolls the page's own scroll view to a section (ScrollViewReader reaches the ScrollView
            // inside NKTabPage; each section carries an invisible anchor above its title, `phaseAnchor`).
            ScrollViewReader { proxy in
                NKTabPage(hue: selected, sky: sky, heroHeight: nil,
                          compact: NKCompact(palette: selected.orb, title: phase.name, value: clockLabel(now),
                                             line: "\(c.name) \(c.miniValue)")) {
                    hero(c, proxy: proxy)
                } content: {
                    below(ctx)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            // the shell's painted landscape shows through the stack
            .containerBackground(.clear, for: .navigation)
            .navigationDestination(for: Hue.self) { h in drill(h, ctx) }
        }
        .modifier(sheets(ctx))
        .onChange(of: path.isEmpty) { _, empty in setRoomOpen(!empty) }
        .onAppear { setRoomOpen(!path.isEmpty) }
        .nkToast($toast, action: undo == nil ? nil : (toastAction ?? SessionText.undo)) { undo?(); undo = nil }
        .background { ModeClock { clockTick += 1 } }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: inhale) { _, _ in breathing }
        .onAppear { if voice == nil { voice = BoopVoice() } }
        .onDisappear { motion.stop(); stopBreath(); voice?.stop(); setRoomOpen(false) }
        .onChange(of: selected) { stopBreath(); voice?.stop() }
        .onChange(of: phase) { _, p in shownPhase = p }
        .onChange(of: voice?.isSpeaking ?? false) { _, talking in motion.talking = talking }
        .onChange(of: voice?.shown ?? "") { _, _ in if voice?.isSpeaking == true { motion.kick() } }
        // a new brief may move the bedtime: the reminder follows (and turns off if notifications were withdrawn)
        .task(id: reminderTarget(brief)) { await reminder.refresh(target: reminderTarget(brief)) }
    }

    /// The title row and the phase strip; the clock's phase carries the dot, a tap scrolls to that section.
    @ViewBuilder private func header(_ proxy: ScrollViewProxy) -> some View {
        NKTitleRow(bellCount: 0, onBell: { show(soonToast("Értesítések")) }, onPlus: nil, onAvatar: openAccount)
            .padding(.top, 54)
        NKTabStrip(tabs: DayPhase.allCases.map(\.name),
                   selected: Binding(get: { shownPhase.name }, set: { name in
                       guard let p = DayPhase.allCases.first(where: { $0.name == name }) else { return }
                       shownPhase = p
                       withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.5)) { proxy.scrollTo(phaseSectionId(p), anchor: .top) }
                   }),
                   dot: phase.name)
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

    /// Simulator review: `-previewDrill alvas` opens Ma with that orb's room pushed.
    private static var initialPath: [Hue] {
        #if DEBUG
        let names = ["forma", "alvas", "mozgas", "fuel", "pulzus"]
        if let n = UserDefaults.standard.string(forKey: "previewDrill"), let i = names.firstIndex(of: n), let h = Hue(rawValue: i) { return [h] }
        #endif
        return []
    }

    private func openRoom(_ h: Hue) {
        guard path.isEmpty else { return }
        stopBreath()
        path.append(h)
    }

    private func hero(_ c: MaiCopy, proxy: ScrollViewProxy) -> some View {
        VStack(spacing: 0) {
            header(proxy)
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
                // the big orb is a door to its room (the ripple still plays)
                .simultaneousGesture(TapGesture().onEnded { if !breathing { openRoom(selected) } })
                .accessibilityElement(children: .combine)
                .accessibilityHint("\(c.name) részletesen")
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { openRoom(selected) }
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
