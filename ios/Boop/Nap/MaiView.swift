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

/// The metric behind a colour world. Pénz and Levél are colour worlds with **no metric** (L1/L4): nothing reads
/// a score for them, and the pages that paint them never ask for one — they fall back to Forma only so this stays
/// total, and `Hue.metrics` is the list to iterate when a metric is what you mean.
func metricKey(for hue: Hue) -> MetricKey {
    switch hue {
    case .forma, .penz, .level, .suly, .evad, .sport: .forma
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
    // "learning" is about Forma alone (`mezo-r36n9.152`): the other four keep the score the server sent.
    let s = visibleScore(score, key: key, learning: learning)
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
/// selected orb and the page toast (`MaiContext`).
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
         initialNapTab: NapTab = .ma,
         @ViewBuilder below: @escaping (MaiContext) -> Below,
         @ViewBuilder drill: @escaping (Hue, MaiContext) -> Drill, sheets: @escaping (MaiContext) -> Sheets) {
        self.brief = brief; self.initialRoom = initialRoom; self.onHome = onHome
        self.below = below; self.drill = drill; self.sheets = sheets
        _napTab = State(initialValue: initialNapTab)
    }

    /// The Nap room's tab on screen.
    @State private var napTab: NapTab
    /// The day opened from the Napok tab (its sheet hangs here, at page level).
    @State private var openDay: NapOpenDay?
    @Environment(\.openDestination) private var openDestination


    /// The rooms pushed over Ma (at most one in B2).
    @State private var path: [Hue] = MaiView.initialPath
    @Environment(\.setRoomOpen) private var setRoomOpen
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selected: Hue = MaiView.initialOrb
    @State private var motion = OrbMotion()
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
    @Environment(\.openMeal) private var openMeal
    @Environment(\.foodClient) private var food
    /// B3: the hero's check-in pill opens the full-screen check-in (the evening one, the close).
    @Environment(RitmusRouter.self) private var router: RitmusRouter?
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?

    private var now: Date { _ = clockTick; return BoopClock.now() }
    private var evening: Bool { isEvening(now) }
    private var phase: DayPhase { DayPhase.at(now) }
    private var context: MaiContext {
        MaiContext(hue: selected, motion: motion,
                   toast: { show($0) }, undoToast: { show($0, undo: $1) },
                   now: now, evening: evening, reminder: reminder, toggleReminder: toggleReminder,
                   drill: { openRoom($0) })
    }

    var body: some View {
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
                    // The Nap room (decision #135): a ring room like every other — Ma is the day page the centre
                    // used to open, Napok the last 14 days (the old Napló place).
                    NapRoomPage(brief: brief, tab: $napTab, onBack: onHome,
                                onAsk: { openDestination(.chat) }) {
                        if let r = brief.day.recovery {
                            KimeloBanner(recovery: r) { show(soonToast("Kilépés a kímélő módból")) }
                        }
                        below(ctx)
                    } napok: {
                        NapokTab { openDay = NapOpenDay(id: $0) }
                    }
                    .toolbar(.hidden, for: .navigationBar)
                    .containerBackground(.clear, for: .navigation)
                    .navigationDestination(for: Hue.self) { h in drill(h, ctx) }
                }
            }
        }
        .modifier(sheets(ctx))
        .sheet(item: $openDay) { day in
            if let ritmus {
                NaploDayDetail(env: ritmus, date: day.id)
                    .presentationDetents([.large]).presentationBackground(NK.ground).presentationCornerRadius(34)
                    .presentationDragIndicator(.visible)
            }
        }
        .onChange(of: path.isEmpty) { _, empty in setRoomOpen(!empty) }
        .onAppear { if initialRoom == nil { setRoomOpen(!path.isEmpty) } }
        .nkToast($toast, action: undo == nil ? nil : (toastAction ?? SessionText.undo)) { undo?(); undo = nil }
        .background { ModeClock { clockTick += 1 } }
        .onDisappear { motion.stop(); setRoomOpen(false) }
        .onChange(of: phase) { _, p in shownPhase = p }
        // a new brief may move the bedtime: the reminder follows (and turns off if notifications were withdrawn)
        // … and so does a change of the bedtime switch or lead on the Emlékeztetők page
        .task(id: BedtimeRefreshKey(target: reminderTarget(brief), settings: ReminderHub.store?.file.builtIn ?? BoopReminderSettings())) {
            await reminder.refresh(target: reminderTarget(brief))
        }
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
        path.append(h)
    }

    private func show(_ text: String, undo: (() -> Void)? = nil, action: String? = nil) {
        self.undo = undo
        toastAction = action
        toast = text
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

}
