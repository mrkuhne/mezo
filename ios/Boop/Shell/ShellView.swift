import SwiftUI
import BoopCore
import BoopDesign

/// The four places of the spine, in bar order: Ma · Évad · Napló · Boop (Évad was Terv; its key stays `terv`).
enum ShellTab: Int, CaseIterable {
    case ma, terv, naplo, boop

    var storageKey: String { ["ma", "terv", "naplo", "boop"][rawValue] }
    init?(key: String) { guard let t = Self.allCases.first(where: { $0.storageKey == key }) else { return nil }; self = t }
    /// What the scene storage held: the new keys map to themselves, anything else (the old domain names) lands on Ma.
    static func restored(_ raw: String) -> ShellTab { ShellTab(key: raw) ?? .ma }
    /// The colour world the place paints until its page reports another.
    var defaultHue: Hue { [.forma, evadHue, .alvas, .forma][rawValue] }
}

/// Lets a page send the owner to another place of the spine, as if he had tapped the bar (the day page's
/// "Kérdezd meg Boopot" row goes to Boop).
private struct OpenPlaceKey: EnvironmentKey { static let defaultValue: @MainActor @Sendable (ShellTab) -> Void = { _ in } }
extension EnvironmentValues {
    var openPlace: @MainActor @Sendable (ShellTab) -> Void {
        get { self[OpenPlaceKey.self] }
        set { self[OpenPlaceKey.self] = newValue }
    }
}

/// Tells the shell that a page has a room (a domain drill-down) open over it: the bar steps aside until it closes.
private struct SetRoomOpenKey: EnvironmentKey { static let defaultValue: @MainActor @Sendable (Bool) -> Void = { _ in } }
extension EnvironmentValues {
    var setRoomOpen: @MainActor @Sendable (Bool) -> Void {
        get { self[SetRoomOpenKey.self] }
        set { self[SetRoomOpenKey.self] = newValue }
    }
}

/// One sky per place in bar order: what the page last reported, else its default colour world.
func shellPanels(_ skies: [ShellTab: NKBackdrop]) -> [NKBackdrop] {
    ShellTab.allCases.map { skies[$0] ?? NKBackdrop(hue: $0.defaultHue, heroHeight: 560, scrollY: 0) }
}

/// The four places in the floating bar, the "+" beside it, and one painted landscape behind them all: switching
/// slides it toward the tapped place while the skies blend, the page cross-fades over it, and the bar's capsule
/// glides to the new icon. The capture and account sheets are presented here, at page level.
struct ShellView: View {
    let me: Me
    @SceneStorage("tab") private var tabKey = "ma"
    /// The switch in flight: the place we came from, which side the new one sits on, and how far along (0 → 1).
    @State private var fromTab = ShellTab.ma
    @State private var direction: CGFloat = 1
    @State private var progress: Double = 1
    /// Last sky each place asked for (Ma re-colours with its orbs); unseen places use their default.
    @State private var skies: [ShellTab: NKBackdrop] = [:]
    @State private var capturing = false
    @State private var account = false
    /// The daily loop's full-screen covers (B3): Ma's rows, the lens pill, "+" and the notifications ask for them.
    @State private var router = RitmusRouter.shared
    /// The cover the "+" sheet asked for; it opens once the sheet has gone (two presentations never overlap).
    @State private var coverAfterCapture: RitmusCover?
    /// The Emlékeztető door the "+" sheet asked for (opens once that sheet has gone).
    @State private var reminderAfterCapture = false
    /// A reminder's notification tapped while a sheet was up: the page opens after that sheet has gone.
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
    /// The area the "+" sheet asked to open ("Edzés indítása"): Ma, then the ring opens that room.
    @State private var areaAfterCapture: Hue?
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    /// The day's brief: Boop's own goals and the bedtime target for the close.
    @Environment(MorningStore.self) private var morning: MorningStore?
    @Environment(\.trainClient) private var train
    @Environment(PenzStore.self) private var penz: PenzStore?
    @State private var toast: String?
    /// A room is open over the page: the bar is hidden.
    @State private var roomOpen = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var tab: ShellTab { ShellTab.restored(tabKey) }

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
            case .reminder: reminderAfterCapture = true
            }
        } else {
            switch pick {
            case .cover(let cover): router.open(cover)
            case .meal: meal = pick.mealStart
            case .penzExpense: penzCapture = true
            case .quick(let kind): quick = kind
            case .area(let hue): select(.ma); router.openRoom(hue)
            case .reminder: router.openNewReminder()
            }
        }
    }

    /// The cover a sheet made wait opens as soon as that sheet is gone.
    private func openCoverAfterSheet() {
        if let cover = coverAfterCapture { coverAfterCapture = nil; router.open(cover) }
        if let start = mealAfterCapture { mealAfterCapture = nil; meal = start }
        if penzAfterCapture { penzAfterCapture = false; penzCapture = true }
        if let q = quickAfterCapture { quickAfterCapture = nil; quick = q }
        if let hue = areaAfterCapture { areaAfterCapture = nil; select(.ma); router.openRoom(hue) }
        if reminderAfterCapture { reminderAfterCapture = false; router.openNewReminder() }
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
        ZStack(alignment: .bottom) {
            NKBackdropPanorama(from: sky(fromTab), to: sky(tab), direction: direction, progress: progress,
                               travel: reduceMotion ? 0 : 0.5)
            ZStack {
                page(tab)
                    .id(tab)
                    .onPreferenceChange(NKBackdropKey.self) { [tab] sky in if let sky { skies[tab] = sky } }
                    // The old page leaves quickly and the new one arrives just after, so text never doubles up.
                    .transition(.asymmetric(insertion: .opacity.animation(.easeOut(duration: 0.5).delay(0.3)),
                                            removal: .opacity.animation(.easeIn(duration: 0.22))))
            }
            .environment(\.nkBackdropHosted, true)
            .environment(router)
            .environment(\.setRoomOpen, { open in withAnimation(.smooth(duration: 0.35)) { roomOpen = open } })
            .environment(\.kezdolapHomeReset, homeReset)
            NKSpineBar(selected: Binding(get: { tab.rawValue }, set: { select(ShellTab(rawValue: $0) ?? .ma) }),
                       onPlus: { capturing = true })
                .offset(y: roomOpen ? 140 : 0)
                .opacity(roomOpen ? 0 : 1)
                .allowsHitTesting(!roomOpen)
                .accessibilityHidden(roomOpen)
        }
        .environment(\.openAccount, { account = true })
        .environment(\.openPlace, { select($0) })
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
            fromTab = tab
            #if DEBUG
            // Simulator review: `-previewTab ma|terv|naplo|boop` opens that place, `-previewOpen capture|account` a sheet,
            // `-previewOpen checkin|checkinDone` the check-in (its first item / its payoff), `-previewOpen este` the close.
            // `-reminders page|edit|edit-linked|denied`, `-previewMaReminders YES`: the Emlékeztetők screens on sample reminders.
            if ReminderPreviewSeed.wanted {
                ReminderPreviewSeed.seed()
                if ReminderPreviewSeed.opensPage { router.openReminders() }
            }
            if let t = UserDefaults.standard.string(forKey: "previewTab").flatMap(ShellTab.init(key:)) { tabKey = t.storageKey; fromTab = t }
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
        // `-previewScroll 900` opens the pages scrolled; `-previewSwitch terv|naplo|boop` switches to that place
        // after 3 s and back to Ma 3 s later (records the backdrop slide + blend without taps).
        .environment(\.nkInitialScrollY, UserDefaults.standard.object(forKey: "previewScroll") == nil
                     ? nil : CGFloat(UserDefaults.standard.double(forKey: "previewScroll")))
        .task {
            guard let to = UserDefaults.standard.string(forKey: "previewSwitch").flatMap(ShellTab.init(key:)) else { return }
            try? await Task.sleep(for: .seconds(3)); select(to)
            try? await Task.sleep(for: .seconds(3)); select(.ma)
        }
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

    /// Bumped when the bar's "Ma" is tapped while Ma is already the place: the home screen's ring comes back.
    @State private var homeReset = 0

    @ViewBuilder private func page(_ tab: ShellTab) -> some View {
        switch tab {
        case .ma: KezdolapView()
        case .terv: EvadPage()
        case .naplo: NaploView()
        case .boop: BoopTabView()
        }
    }

    private func sky(_ tab: ShellTab) -> NKBackdrop { shellPanels(skies)[tab.rawValue] }

    /// The old land starts from where it is now (no jump), then the blend runs to the new one.
    private func select(_ new: ShellTab) {
        // "Ma" tapped while Ma is already the place: back to the home screen's ring.
        guard new != tab else { if new == .ma { homeReset += 1 }; return }
        var still = Transaction(); still.disablesAnimations = true
        withTransaction(still) {
            fromTab = tab
            direction = new.rawValue >= tab.rawValue ? 1 : -1
            progress = 0
        }
        DispatchQueue.main.async {
            withAnimation(.smooth(duration: 0.95)) {
                tabKey = new.storageKey
                progress = 1
            }
        }
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
