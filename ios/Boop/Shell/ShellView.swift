import SwiftUI
import BoopCore
import BoopDesign

/// Tells the home screen that a page has a room (a domain drill-down) open over it.
private struct SetRoomOpenKey: EnvironmentKey { static let defaultValue: @MainActor @Sendable (Bool) -> Void = { _ in } }
extension EnvironmentValues {
    var setRoomOpen: @MainActor @Sendable (Bool) -> Void {
        get { self[SetRoomOpenKey.self] }
        set { self[SetRoomOpenKey.self] = newValue }
    }
}

/// The app's frame since the barless home (`mezo-r36n9.196`, decision #134): the home ring is the only root, every
/// room opens from it, and there is no bottom bar any more — the floating „+" lives on the ring. The capture, account
/// and daily-loop presentations are hung here, at page level (boop-ios.md §9).
struct ShellView: View {
    let me: Me
    /// The pre-barless place key: read once on launch (an old „Napló" lands in Nap › Napok, „Boop" in the chat,
    /// „Évad" in its room), then cleared — the ring is always where the app opens.
    @SceneStorage("tab") private var tabKey = ""
    @State private var capturing = false
    @State private var account = false
    /// The daily loop's full-screen covers (B3): Ma's rows, the lens pill, "+" and the notifications ask for them.
    @State private var router = RitmusRouter.shared
    /// The cover the "+" sheet asked for; it opens once the sheet has gone (two presentations never overlap).
    @State private var coverAfterCapture: RitmusCover?
    /// The Emlékeztetők page asked for while a sheet was up (the "+" sheet's Emlékeztető door, a reminder's notification
    /// tapped): it opens after that sheet has gone.
    @State private var reminderPageAfterSheet = false
    /// The meal composer the "+" sheet asked for (opens once the sheet has gone), and the one on screen.
    @State private var mealAfterCapture: MealStart?
    @State private var meal: MealStart?
    /// The cash expense sheet the "+" sheet asked for (opens once that sheet has gone), and whether it is up.
    @State private var penzAfterCapture = false
    @State private var penzCapture = false
    /// The quick log's own sheet the "+" sheet asked for (opens once that sheet has gone), and the one on screen.
    @State private var quickAfterCapture: QuickLog?
    @State private var quick: QuickLog?
    /// Simulator review: `-previewOpen megvolt` opens the Megvolt sheet for yesterday's preview template day (DEBUG).
    @State private var previewMegvolt = false
    /// Simulator review: `-previewOpen naploDay` opens yesterday's Napló day sheet from the shell (DEBUG).
    @State private var previewNaploDay = false
    /// The area the "+" sheet asked to open ("Edzés indítása"): the ring opens that room once the sheet is gone.
    @State private var areaAfterCapture: Hue?
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    /// The day's brief: Boop's own goals and the bedtime target for the close.
    @Environment(MorningStore.self) private var morning: MorningStore?
    @Environment(\.trainClient) private var train
    @Environment(PenzStore.self) private var penz: PenzStore?
    @State private var toast: String?

    /// What a pick asks for. From the "+" sheet it waits until that sheet is gone (two presentations never overlap);
    /// from a page (the home screen's quick doors) it opens at once.
    private func handle(_ pick: CapturePick, afterSheet: Bool) {
        if afterSheet {
            switch pick {
            case .cover(let cover): coverAfterCapture = cover
            case .meal: mealAfterCapture = pick.mealStart
            case .penzExpense: penzAfterCapture = true
            case .quick(let kind): quickAfterCapture = kind
            case .area(let hue): areaAfterCapture = hue
            case .reminder: reminderPageAfterSheet = true
            }
        } else {
            switch pick {
            case .cover(let cover): router.open(cover)
            case .meal: meal = pick.mealStart
            case .penzExpense: penzCapture = true
            case .quick(let kind): quick = kind
            case .area(let hue): router.go(.room(RoomEntry(hue)))
            case .reminder: router.openReminders()
            }
        }
    }

    /// The cover a sheet made wait opens as soon as that sheet is gone.
    private func openCoverAfterSheet() {
        if let cover = coverAfterCapture { coverAfterCapture = nil; router.open(cover) }
        if let start = mealAfterCapture { mealAfterCapture = nil; meal = start }
        if penzAfterCapture { penzAfterCapture = false; penzCapture = true }
        if let q = quickAfterCapture { quickAfterCapture = nil; quick = q }
        if let hue = areaAfterCapture { areaAfterCapture = nil; router.go(.room(RoomEntry(hue))) }
        if reminderPageAfterSheet { reminderPageAfterSheet = false; router.openReminders() }
    }

    /// The quick log's own sheets (`mezo-r36n9.154`); each closes itself with the toast to show.
    @ViewBuilder private func quickSheet(_ kind: QuickLog) -> some View {
        let done: (String?) -> Void = { text in quick = nil; if let text { toast = text } }
        switch kind {
        case .water: WaterSheet(onDone: done)
        case .supplements: SupplementsSheet(onDone: done)
        case .sport: SportSheet(onDone: done)
        case .weight: WeightSheet(onDone: done)
        case .sleep: SleepLogSheet(onDone: done)
        case .journal: JournalSheet(onDone: done)
        }
    }

    var body: some View {
        KezdolapView()
            .environment(router)
        .environment(\.openAccount, { account = true })
        .environment(\.openDestination, { router.go($0) })
        .environment(\.openMeal, { meal = $0 })
        .environment(\.openCapture, { capturing = true })
        .nkToast($toast)
        .preferredColorScheme(.dark)
        // page-level presentations (boop-ios.md §9)
        .environment(\.openPick, { handle($0, afterSheet: false) })
        .sheet(isPresented: $capturing, onDismiss: openCoverAfterSheet) {
            CaptureSheet { pick in
                handle(pick, afterSheet: true)
                capturing = false
            }
                .presentationDetents([.height(760), .large])
                .presentationBackground(NK.ground)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $meal) { start in
            MealComposerSheet(start: start) { text in
                meal = nil
                if let text { toast = text }
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $penzCapture) {
            PenzCaptureSheet { done in penzCapture = false; if let done { toast = done } }
                .task { await penz?.load() }
                .penzSheetStyle([.large])
        }
        .sheet(item: $quick) { kind in
            quickSheet(kind).penzSheetStyle([.large])
        }
        .sheet(isPresented: $previewNaploDay) {
            if let ritmus, let y = ritmus.calendar.date(byAdding: .day, value: -1, to: ritmus.clock()) {
                NaploDayDetail(env: ritmus, date: ritmus.day(of: y))
                    .presentationDetents([.large]).presentationBackground(NK.ground).presentationCornerRadius(34).presentationDragIndicator(.visible)
            }
        }
        .sheet(isPresented: $previewMegvolt) {
            let y = ritmus.flatMap { env in env.calendar.date(byAdding: .day, value: -1, to: env.clock()).map { env.day(of: $0) } } ?? ""
            WorkoutAsPlannedSheet(templateSessionId: nil, date: y, title: "Edzés", train: train) { done in previewMegvolt = false; if let done { toast = done } }
                .penzSheetStyle([.large])
        }
        .sheet(isPresented: $account, onDismiss: openCoverAfterSheet) {
            AccountSheet(me: me)
                .presentationDetents([.medium, .large])
                .presentationBackground(NK.ground)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
        // The page reads the router's flag here, so the cover presents when anything below asks for it.
        .fullScreenCover(item: Binding(get: { [cover = router.cover] in cover }, set: { router.cover = $0 })) { cover in
            switch cover {
            case .checkin:
                if let ritmus {
                    CheckinView(env: ritmus, catchUp: Self.previewCatchUp(ritmus)) { router.close() }
                } else {
                    coverFallback(hue: .mozgas)
                }
            case .este:
                if let ritmus {
                    EsteView(env: ritmus, brief: morning?.brief) { router.close() }
                } else {
                    coverFallback(hue: .pulzus)
                }
            }
        }
        // The Emlékeztetők page (a reminder's notification, Ma's „Mind”) and the new-reminder sheet (the "+" door).
        .fullScreenCover(isPresented: Binding(get: { [r = router.reminders] in r == .page }, set: { if !$0 { router.reminders = nil } })) {
            EmlekeztetokPage { router.reminders = nil }
        }
        .sheet(isPresented: Binding(get: { [r = router.reminders] in r == .new }, set: { if !$0 { router.reminders = nil } })) {
            if let store = ReminderHub.store {
                ReminderEditSheet(draft: ReminderDraft(), store: store) { router.reminders = nil }
                    .presentationDetents([.large])
                    .presentationBackground(NK.ground)
                    .presentationCornerRadius(34)
                    .presentationDragIndicator(.visible)
            }
        }
        // A notification tap while the "+" or account sheet is up: the sheet goes first, then the cover (two
        // presentations never overlap).
        .onChange(of: router.cover) { _, asked in
            guard let asked, capturing || account else { return }
            coverAfterCapture = asked
            router.cover = nil
            capturing = false
            account = false
        }
        .onChange(of: router.reminders) { _, asked in
            guard asked == .page, capturing || account else { return }
            router.reminders = nil
            capturing = false
            account = false
            reminderPageAfterSheet = true
        }
        .onAppear {
            // An old stored place (before the barless home) opens its room once; then the ring is the start again.
            let restored = homeDestination(restored: tabKey)
            if restored != .home { router.go(restored) }
            tabKey = ""
            #if DEBUG
            // Simulator review: `-previewOpen capture|account` opens a sheet,
            // `-previewOpen checkin|checkinDone` the check-in (its first item / its payoff), `-previewOpen este` the close.
            // `-reminders page|edit|edit-linked|denied`, `-previewMaReminders YES`: the Emlékeztetők screens on sample reminders.
            if ReminderPreviewSeed.wanted {
                ReminderPreviewSeed.seed()
                if ReminderPreviewSeed.opensPage { router.openReminders() }
            }
            switch UserDefaults.standard.string(forKey: "previewOpen") {
            case "capture": capturing = true
            case "meal": meal = MealStart()
            case "drink": meal = MealStart(entrance: .drink)
            case "megvolt": previewMegvolt = true
            case "naploDay": previewNaploDay = true
            case "barcode": meal = MealStart(entrance: .barcode)
            case "mealText": meal = MealStart(entrance: .text, text: "csirkemell rizzsel és brokkolival")
            case "account": account = true
            case "penzCapture": penzCapture = true
            // `-previewOpen water|supplements|sport|weight|sleep|journal`: one quick-log sheet.
            case let raw? where QuickLog(rawValue: raw) != nil: quick = QuickLog(rawValue: raw)
            case "checkin", "checkinDone": router.open(.checkin)
            case "reminderNew": router.openNewReminder()
            case "este", "esteDone": router.open(.este)
            default: break
            }
            #endif
        }
        #if DEBUG
        // `-previewScroll 900` opens the pages scrolled.
        .environment(\.nkInitialScrollY, UserDefaults.standard.object(forKey: "previewScroll") == nil
                     ? nil : CGFloat(UserDefaults.standard.double(forKey: "previewScroll")))
        #endif
    }

    /// Simulator review: `-previewCatchup YES` opens the check-in as yesterday's missed dél (DEBUG only).
    private static func previewCatchUp(_ ritmus: RitmusEnvironment) -> CheckinFlow.CatchUp? {
        #if DEBUG
        guard UserDefaults.standard.bool(forKey: "previewCatchup"),
              let y = ritmus.calendar.date(byAdding: .day, value: -1, to: ritmus.clock()) else { return nil }
        return .init(date: ritmus.day(of: y), moment: .delben)
        #else
        return nil
        #endif
    }

    /// No daily loop yet (signing in or out): never an empty cover, always a way back.
    private func coverFallback(hue: Hue) -> some View {
        ZStack(alignment: .topLeading) {
            NKGround(hue: hue)
            Button { router.close() } label: {
                Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
            }
            .buttonStyle(.plain).accessibilityLabel("Bezárom")
            .padding(.leading, 16).padding(.top, 8)
        }
        .preferredColorScheme(.dark)
    }

}

/// "hétfő, 06:50" from the device clock, Hungarian.
func hungarianNow(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "hu_HU")
    f.dateFormat = "EEEE, HH:mm"
    return f.string(from: date)
}

/// Time-of-day greeting: reggel 5–10, napközben 10–18, este 18–5.
func greeting(_ date: Date = Date(), calendar: Calendar = .current) -> String {
    switch calendar.component(.hour, from: date) {
    case 5..<10: "Jó reggelt"
    case 10..<18: "Szép napot"
    default: "Jó estét"
    }
}

/// "12,4" — one decimal, Hungarian comma.
func hungarianKg(_ kg: Double) -> String { String(format: "%.1f", locale: Locale(identifier: "hu_HU"), kg) }
