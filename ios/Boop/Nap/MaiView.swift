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

// MARK: - The Mai hero (spec §5.1, §5.1a; spike AuraSunrise)

/// Nap · Mai with the morning brief: title row, tabs, five mini orbs, the selected metric rising as the sun, its verdict
/// and the lens action row. Tapping a mini orb re-colours the page. `below` is what follows the hero.
struct MaiView<Below: View>: View {
    let brief: Brief
    @ViewBuilder let below: () -> Below
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selected: Hue = .forma
    @State private var motion = OrbMotion()
    @State private var voice: BoopVoice?
    @State private var breathing = false
    @State private var inhale = false
    @State private var breathTask: Task<Void, Never>?
    @State private var toast: String?

    private var copy: MaiCopy { maiCopy(brief, metricKey(for: selected)) }
    // Evening (hour ≥ 18) arrives with Task 14.
    private var action: LensAction? { Lens.action(for: metricKey(for: selected), brief: brief, now: Date(), evening: false) }

    var body: some View {
        let c = copy
        NKTabPage(hue: selected, heroHeight: nil,
                  compact: NKCompact(palette: selected.orb, title: c.name, value: c.orbDisplay, line: c.headline)) {
            hero(c)
        } content: {
            below()
        }
        .nkToast($toast)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: inhale) { _, _ in breathing }
        .onAppear { if voice == nil { voice = BoopVoice() } }
        .onDisappear { motion.stop(); stopBreath(); voice?.stop() }
        .onChange(of: selected) { stopBreath() }
        .onChange(of: voice?.isSpeaking ?? false) { _, talking in motion.talking = talking }
        .onChange(of: voice?.shown ?? "") { _, _ in if voice?.isSpeaking == true { motion.kick() } }
    }

    private func hero(_ c: MaiCopy) -> some View {
        VStack(spacing: 0) {
            NKTitleRow(bellCount: 0, onBell: { toast = soonToast("Értesítések") }, onPlus: { toast = soonToast("Gyors hozzáadás") },
                       onAvatar: { toast = soonToast("Beállítások") })
                .padding(.top, 54)
            NKTabStrip(tabs: ["Mai", "A napom", "Beszélgetés", "Rutin"],
                       selected: Binding(get: { "Mai" }, set: { if $0 != "Mai" { toast = soonToast($0) } }),
                       dot: morning ? "A napom" : nil)
                .padding(.top, 10)
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
                          onPrimary: primary, onMenu: { toast = soonToast($0) }, onChip: { toast = soonToast($0.title) },
                          onSpeak: speak, onToggleMute: { voice?.muted.toggle() })
                .padding(.top, 4)
            Spacer(minLength: 0)
        }
        // Never squeeze the hero (labels would shrink); a tall hero pushes the cards down instead.
        .fixedSize(horizontal: false, vertical: true)
    }

    private var morning: Bool { (5..<12).contains(Calendar.current.component(.hour, from: Date())) }

    private func primary() {
        if breathing { stopBreath(); return }
        guard let action else { speak(); return }
        if action.kind == .breath { startBreath() } else { toast = soonToast(soonName(action.kind)) }
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
            toast = MaiText.breathEnded
            stopBreath()
        }
    }

    private func stopBreath() {
        breathTask?.cancel(); breathTask = nil
        guard breathing else { return }
        withAnimation(.easeInOut(duration: 0.8)) { breathing = false; inhale = false }
    }
}
