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

/// "Kedd · november 10." over the day page — the day it is about, said the way the spike says it. An unreadable
/// date leaves the line out rather than printing a half-date.
func dayHeadline(_ ymd: String) -> String {
    dayLine(ymd)?.replacingOccurrences(of: ",", with: " ·") ?? ""
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
    /// Opened from the home screen's ring with that area's room already on screen (nil = the plain page).
    let initialRoom: Hue?
    /// The way back to the home screen's ring: the title row's left slot becomes a back button, and closing the
    /// room the ring opened returns there instead of leaving Ma bare. nil = Ma is the place's own root.
    let onHome: (@MainActor @Sendable () -> Void)?
    let below: (MaiContext) -> Below
    let drill: (Hue, MaiContext) -> Drill
    let sheets: (MaiContext) -> Sheets

    init(brief: Brief, initialRoom: Hue? = nil, onHome: (@MainActor @Sendable () -> Void)? = nil,
         @ViewBuilder below: @escaping (MaiContext) -> Below,
         @ViewBuilder drill: @escaping (Hue, MaiContext) -> Drill, sheets: @escaping (MaiContext) -> Sheets) {
        self.brief = brief; self.initialRoom = initialRoom; self.onHome = onHome
        self.below = below; self.drill = drill; self.sheets = sheets
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
    @Environment(\.openMeal) private var openMeal
    @Environment(\.foodClient) private var food
    /// B3: the hero's check-in pill opens the full-screen check-in (the evening one, the close).
    @Environment(RitmusRouter.self) private var router: RitmusRouter?
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?

    private var copy: MaiCopy { maiCopy(brief, metricKey(for: selected)) }
    private var now: Date { _ = clockTick; return BoopClock.now() }
    private var evening: Bool { isEvening(now) }
    private var phase: DayPhase { DayPhase.at(now) }
    /// Evening's dusk or kímélő's calm over the page; nil = the selected orb's own sky.
    private var sky: NKSky? { maiSky(evening: evening, recovery: brief.day.recovery != nil) }
    private var action: LensAction? {
        let a = heroAction(Lens.action(for: metricKey(for: selected), brief: brief, now: now, evening: evening),
                           day: ritmus.map { $0.ledger.ledger(for: $0.day(of: now)) }, now: now, calendar: ritmus?.calendar ?? .current)
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
        Group {
            if let initialRoom, let onHome {
                // Opened straight from the home screen's ring: the room IS the page. No navigation stack, so its back
                // button cannot slide it off sideways — the ring simply fades back in over it.
                drill(initialRoom, ctx)
                    .environment(\.closeRoom, onHome)
                    .onAppear { setRoomOpen(true) }
            } else {
                NavigationStack(path: $path) {
                    // A short head, not a screenful: the day's own picture ("Mai nap") has to be visible without
                    // scrolling, the way the spike shows it.
                    NKTabPage(hue: selected, sky: sky, heroHeight: 330,
                              compact: NKCompact(palette: selected.orb, title: phase.name, value: clockLabel(now),
                                                 // no score in the capsule either: it left the home with
                                                 // the hero's number (decision #13)
                                                 line: c.headline)) {
                        hero(c)
                    } content: {
                        below(ctx)
                    }
                    .toolbar(.hidden, for: .navigationBar)
                    // the shell's painted landscape shows through the stack
                    .containerBackground(.clear, for: .navigation)
                    .navigationDestination(for: Hue.self) { h in drill(h, ctx) }
                }
            }
        }
        .modifier(sheets(ctx))
        .onChange(of: path.isEmpty) { _, empty in setRoomOpen(!empty) }
        .onAppear { if initialRoom == nil { setRoomOpen(!path.isEmpty) } }
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

    /// The title row, the day's date and the wordmark (the Élet spike's head, owner 2026-11-16).
    ///
    /// The **phase strip is gone**: Reggel · Napközben · Este were a switch for something he scrolls anyway, and
    /// he chose one scroll with headings instead. The **row of mini orbs is gone too** (L0/b): the ring is the
    /// app's entrance, so a second menu here would be the same menu twice.
    @ViewBuilder private var header: some View {
        NKTitleRow(bellCount: 0, onBell: { show(soonToast("Értesítések")) }, onPlus: nil, onAvatar: openAccount,
                   onBack: onHome)
            .padding(.top, 54)
        Text(dayHeadline(brief.date))
            .nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.75))
            .padding(.top, 14)
        Text("boop")
            .font(.custom(Lagy.outfitFamily, size: 33).weight(.light)).tracking(4.5)
            .foregroundStyle(.white)
            .padding(.top, 10)
            .accessibilityHidden(true)
        Rectangle()
            .fill(LinearGradient(colors: [.white.opacity(0), .white.opacity(0.22), .white.opacity(0)],
                                 startPoint: .leading, endPoint: .trailing))
            .frame(height: 0.8)
            .padding(.horizontal, 44)
            .padding(.top, 12)
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

    /// The day page's head (the Élet spike): the title row, the date, the wordmark — and then the page itself.
    /// The big rising orb, its caps, the 42 pt verdict and the sentence left with the owner's 2026-11-16 call:
    /// the orb is the ring's job now, and Boop's morning words live in *A reggeli összefoglaló*.
    ///
    /// The **lens action row stays**: it is the only home of the breathing exercise, the bedtime reminder and
    /// *Hallgatom*. It sits as one quiet row under the wordmark.
    private func hero(_ c: MaiCopy) -> some View {
        VStack(spacing: 0) {
            header
            if let r = brief.day.recovery {
                KimeloBanner(recovery: r) { show(soonToast("Kilépés a kímélő módból")) }
                    .padding(.top, 14)
            }
            if breathing {
                Text(inhale ? MaiText.inhale : MaiText.exhale)
                    .nkFont(28, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center)
                    .padding(.top, 16).contentTransition(.opacity)
                    .animation(.easeInOut(duration: 0.6), value: inhale)
                Text(MaiText.breathLine)
                    .nkFont(15).lineSpacing(4).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 30).padding(.top, 8)
            }
            LensActionRow(hue: selected, action: action, breathing: breathing, sessionTitle: brief.day.session?.title,
                          motion: motion, muted: voice?.muted ?? false,
                          onPrimary: primary, onMenu: { show(soonToast($0)) }, onChip: quick,
                          onSpeak: speak, onToggleMute: { voice?.muted.toggle() })
                .nkHeroEnd()       // the compact capsule arrives as this row slides under the top bar
                .padding(.top, 18)
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

    /// Fuel's quick actions: the composer, a coffee to compute, or water straight onto the day.
    private func quick(_ chip: FuelChip) {
        switch chip.action {
        case .compose: openMeal(MealStart())
        case .coffee: openMeal(MealStart(entrance: .text, text: "kávé"))
        case .water(let ml):
            guard let food else { show("Most nem tudom elküldeni"); return }
            Task { @MainActor in
                do {
                    try await food.water(ml: ml, date: BoopClock.now(), clientRef: UUID(), capturedAt: Date())
                    show("Víz +\(ml) ml")
                } catch {
                    show("Nem sikerült elküldeni — próbáld újra")
                }
            }
        }
    }

    private func primary() {
        if breathing { stopBreath(); return }
        guard let action else { speak(); return }
        switch action.kind {
        case .breath: startBreath()
        case .bedtime: toggleReminder()
        case .photo: openMeal(MealStart(entrance: .photo))
        case .checkin: router?.open(.checkin)
        case .eveningCheckin: router?.open(.este)
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
