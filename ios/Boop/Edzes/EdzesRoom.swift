import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The Edzés room (B5)

// **The page is the shared area-page kit's, not ours** (`NKAreaPage`, step 3 of the shell
// programme): the head, the area's own bottom bar and its tabs all come from the kit, and this
// file only composes the blocks inside them.
//
// What this file adds is the data only the training API has: the real warmup/working split
// with the engine's per-set targets and its own reasoning, which muscles today's session
// loads, and where he is in the eight-week block.
//
// Three rules hold every line here:
//   • **No invented number.** Where the server said nothing, the screen says so, and a cached
//     answer always carries its age. There is no 0 standing in for "we do not know".
//   • **Nothing explains itself twice.** The engine's own sentence rides on the exercise it is
//     about (owner, 2026-11-17: „a mai edzés és az eligazítás kb ugyanaz") — there is no
//     second list repeating it, and anything worth saying on Ma goes through the wall's
//     `WallSource`, not onto a card surface here.
//   • **Every carousel has dots under it**, so a row that continues says so (owner, 2026-11-17).

/// Which tab of the room is open. The labels are the owner's (`Terv` became `Blokk` on 2026-11-16, then
/// **`Mezociklus`** on 2026-11-26) and they live **here, once**: `AreaRoom`'s tab set reads the same constants.
enum EdzesTab: String, CaseIterable {
    case ma = "Ma", blokk = "Mezociklus", gyakorlatok = "Gyakorlatok", elozmenyek = "Előzmények"
}

/// A sub-page of the room, opened from a card.
enum EdzesPage: Identifiable, Equatable {
    case blockLoad
    /// The block builder and the weekly review (mezo-r36n9.83, `ios/Boop/EdzesTerv/`).
    case builder, review
    /// The new-block flow (mezo-r36n9.113, `ios/Boop/EdzesTerv/UjBlokk/`). Its model rides on the item (as the year
    /// cover's does): a model kept in separate state could be read as nil by a cover built in the same update.
    case newBlock(NewBlockCover)

    var id: String {
        switch self {
        case .blockLoad: "blockLoad"
        case .builder: "builder"
        case .review: "review"
        case .newBlock(let cover): "newBlock-\(cover.id)"
        }
    }

    static func == (a: EdzesPage, b: EdzesPage) -> Bool { a.id == b.id }
}

/// Edzés as its own app, the way Étel is: its own data, on the shared page.
struct EdzesRoom: View {
    @Environment(\.dismiss) private var dismiss
    /// Set when the home screen's ring opened this room with no navigation stack around it.
    @Environment(\.closeRoom) private var closeRoom
    @Environment(\.openDestination) private var openDestination
    @Environment(\.trainClient) private var train
    @Environment(\.planClient) private var plan
    @Environment(\.serverCache) private var cache
    @Environment(\.workoutFolder) private var workoutFolder
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @Environment(MorningStore.self) private var morning: MorningStore?
    /// The season overview: its training days are the new block's days (mezo-r36n9.113).
    @Environment(EvadStore.self) private var evad: EvadStore?
    /// Évad › Terv's year strip opens this room on the Éves terv (`mezo-r36n9.196`): taken once.
    @Environment(\.roomEntry) private var roomEntry
    @State private var tookEntry = false
    @SceneStorage("edzes.tab") private var selected: String = EdzesTab.ma.rawValue
    @Environment(\.dynamicTypeSize) private var typeSize
    /// The week's day cards grow with the text size, so a day's name is never cut at the largest sizes.
    @ScaledMetric(relativeTo: .body) private var dayCardHeight: CGFloat = 150
    @State private var store: EdzesStore?
    @State private var toast: String?
    @State private var page: EdzesPage?
    /// This week's proposal for the Blokk tab's entrance card (mezo-r36n9.83).
    @State private var weekReview: WeekReviewModel?
    /// The builder, loaded in the background when the room opens, so it opens without a spinner (owner, 2026-11-19).
    @State private var builder: BlockBuilderModel?
    /// The Éves terv on screen (mezo-r36n9.113, `ios/Boop/EdzesTerv/EvesTerv/`): its own cover, the model riding on
    /// the item — a model kept in separate state was read as nil by a cover built in the same update.
    @State private var yearPlan: YearPlanCover?
    /// The year plan behind the Ma tab's Következik card; the card reads only a freshly loaded plan (`freshPlan`).
    @State private var year: YearPlanModel?
    /// The builder and the review zoom out of the button / card that opened them.
    @Namespace private var planZoom
    /// Which of the workout's own surfaces is up. The session itself lives in the store, so
    /// closing the player („kis méretre") leaves the workout running.
    @State private var phase: WorkoutPhase = .hidden
    /// The workout whose finish already went out when the ceremony opened — so its kcal can arrive while he looks at
    /// it — and must not be sent twice.
    @State private var finishSent: UUID?
    /// DEBUG only: the kcal `-previewEdzesCeremony` shows, standing in for the server's answer.
    @State private var previewEnergy: WorkoutEnergy?
    /// The day of the week the Blokk tab's carousel is showing.
    @State private var blockDay: String?
    /// The missions he let go of on the briefing screen. Kept here so the choice survives that screen closing
    /// and reopening before he starts.
    @State private var released: Set<UUID> = []
    /// „Mi van a termemben" (mezo-r36n9.66), from the Beállítások action. The workout player presents its own copy.
    @State private var showGym = false
    /// „Pihenő vége" (what rings when the rest ends on a locked phone).
    @State private var showRestEnd = false
    /// „Melyik napot csinálod ma?" (mezo-r36n9.163).
    @State private var showOtherDays = false
    /// The Ma hero's page 1, measured — the pager takes its height, so no state leaves an empty band (spike glitch).
    @State private var maFrontHeight: CGFloat = 240
    /// Page 2 (the body map) needs at least this much.
    @ScaledMetric(relativeTo: .body) private var maLoadMinHeight: CGFloat = 180
    /// Every mezociklus — the Mezociklus tab's card actions, tiles and pages (mezo-r36n9.177).
    @State private var mezo: MezociklusokModel?
    @State private var mezoFlow = MezoFlowState()

    /// `hidden` is not „no workout": the session may well be running, minimised.
    private enum WorkoutPhase { case hidden, briefing, playing, ceremony, result }

    init(tab: EdzesTab = .ma) {
        #if DEBUG
        let preview = UserDefaults.standard.string(forKey: "edzesTab").flatMap(EdzesTab.init(rawValue:))
        _selected = SceneStorage(wrappedValue: (preview ?? tab).rawValue, "edzes.tab")
        #else
        _selected = SceneStorage(wrappedValue: tab.rawValue, "edzes.tab")
        #endif
    }

    private let hue = Hue.mozgas
    private var brief: Brief? { morning?.brief }
    private var workout: TodayWorkout? { store?.today?.value }
    private var block: BlockPlan? { store?.block?.value }

    var body: some View {
        let c = brief.map { maiCopy($0, .mozgas) }
        NKAreaPage(hue: hue, name: areaName(hue), eyebrow: areaEyebrow(hue, tab: selected),
                   level: c?.score.map { Double($0) / 100 }, display: c?.score.map { "\($0)" },
                   headline: c?.headline ?? "Még gyűjtöm a mai képet",
                   sentence: c?.sentence ?? "Amint megvan a mai terved, itt fog állni.",
                   photo: areaPhoto(hue), glyph: areaGlyph(hue),
                   tabs: tabs, selectedTab: $selected,
                   actions: [NKAreaAction(glyph: "search-ink", label: "Keresés") { toast = soonToast("Keresés · Edzés") },
                             NKAreaAction(glyph: "repeat-deep", label: "Beállítások") { showGym = true },
                             NKAreaAction(glyph: "bell-cream", label: "Pihenő vége") { showRestEnd = true }],
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } },
                   onAsk: { openDestination(.chat) }) {
            content
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
        .nkToast($toast)
        .sheet(isPresented: $showRestEnd) {
            if let key = ReminderHub.userKey {
                RestEndSheet(hue: hue, userKey: key, onChanged: { Task { await ReminderHub.restEnd?.modeChanged() } })
                    .presentationBackground(NK.ground).presentationCornerRadius(34).presentationDragIndicator(.visible)
            }
        }
        .sheet(isPresented: $showGym) {
            if let store {
                GymSheet(store: store, hue: hue)
                    .presentationBackground(NK.ground).presentationCornerRadius(34).presentationDragIndicator(.visible)
            }
        }
        // The per-user folders are built when the session signs in, which can land a render
        // after this room first appears — so the store is pointed at it whenever it arrives,
        // not once in `.task`. Without this a workout in progress was never written down.
        .onChange(of: workoutFolder, initial: true) { store?.attach(folder: workoutFolder) }
        // The sub-page is presented at page level (boop-ios.md §9) and over a room the ring
        // opened with no navigation stack under it.
        .fullScreenCover(item: $page) { p in
            switch p {
            case .blockLoad:
                if let block { BlockLoadPage(block: block, hue: hue, age: store?.blockAgeText) { page = nil } }
            case .builder:
                if let plan {
                    BlockBuilderPage(model: builder ?? BlockBuilderModel(client: plan), lockedDay: openWorkoutDay,
                                     onNewBlock: { openNewBlock() }) {
                        page = nil
                        // Today's plan first: a day he just edited must reach the started workout (owner, 2026-11-23).
                        Task { await store?.load(force: true); await store?.loadBlock(); await weekReview?.load(); await prepareBuilder(fresh: true) }
                    }
                    .navigationTransition(.zoom(sourceID: PlanZoom.builder, in: planZoom))
                }
            case .newBlock(let cover):
                if let plan {
                    UjBlokkFlow(model: cover.model,
                                onClose: { page = nil },
                                onCreated: { minutes in
                                    // The builder re-reads and picks up the planned block; it may still be thrown away. The
                                    // same model is re-armed (a cover's content keeps the model it was first built with).
                                    let model = builder ?? BlockBuilderModel(client: plan)
                                    builder = model
                                    model.justCreated = true
                                    model.minutesTarget = minutes
                                    page = .builder
                                    Task { await model.load(); await store?.loadBlock(); await weekReview?.load() }
                                },
                                onOpenSeason: { note in
                                    page = nil
                                    if let note { toast = note }
                                    openDestination(.room(RoomEntry(.evad)))
                                })
                }
            case .review:
                if let weekReview {
                    WeekReviewDeck(model: weekReview) { page = nil; Task { await weekReview.load() } }
                        .navigationTransition(.zoom(sourceID: PlanZoom.review, in: planZoom))
                }
            }
        }
        .fullScreenCover(item: $yearPlan) { cover in
            EvesTervPage(model: cover.model) { yearPlan = nil }
        }
        .mezoFlow($mezoFlow, model: mezo, plan: plan, hue: hue, toast: $toast) { Task { await refreshAfterMezo() } }
        // The year may have moved on behind a cover (a block started from the card, an edit on the map): read it again.
        .onChange(of: page) { _, now in if now == nil { Task { await year?.load() } } }
        .onChange(of: yearPlan?.id) { _, now in if now == nil { Task { await year?.load() } } }
        .fullScreenCover(isPresented: Binding(get: { phase == .briefing && workout != nil },
                                              set: { if !$0 { phase = .hidden } })) {
            if let w = workout {
                WorkoutBriefing(workout: w, missions: store?.missions ?? [], hue: hue,
                                dayLine: briefingDayLine, released: $released, running: running,
                                onClose: { phase = running ? .playing : .hidden },
                                onStart: { running ? phase = .playing : beginWorkout() })
            }
        }
        .fullScreenCover(isPresented: Binding(get: { phase == .playing && store?.session != nil },
                                              set: { if !$0 { phase = .hidden } })) {
            if let store, store.session != nil {
                WorkoutPlayer(session: Binding(get: { store.session ?? WorkoutSession(TodayWorkout()) },
                                               set: { store.update($0) }),
                              hue: hue,
                              photos: exercisePhotos,
                              catalog: store.catalog,
                              records: store.records,
                              onMinimise: { phase = .hidden },
                              onFinish: { phase = .ceremony; sendFinish() },
                              onLogged: { exerciseId, set in enqueueSet(exerciseId, set) },
                              onEdited: { exerciseId, set in enqueueEdit(exerciseId, set) },
                              onNote: { exerciseId, note in enqueueNote(exerciseId, note) },
                              onExerciseDone: { exerciseId, feedback in enqueueFeedback(exerciseId, feedback) },
                              onSkipped: { exerciseId in enqueueSkip(exerciseId) },
                              onSwap: { id, replacement, wholeBlock in
                                  await store.swapExercise(id, for: replacement, forWholeBlock: wholeBlock)
                              },
                              // Looking at today's plan again mid-workout: the briefing goes over the
                              // player and the session keeps running underneath.
                              onBriefing: { phase = .briefing },
                              swap: SwapActions(
                                  gym: { store.gym },
                                  discomforted: { store.discomforts.contains($0) },
                                  substitutes: { await store.substitutes(for: $0) },
                                  markMissing: { await store.markMissing($0) },
                                  undoMissing: { await store.undoMissing($0) },
                                  setDiscomfort: { on, id in await store.setDiscomfort(on, exerciseId: id) }),
                              gymSheet: { AnyView(GymSheet(store: store, hue: hue)) })
            }
        }
        .fullScreenCover(isPresented: Binding(get: { phase == .ceremony && store?.session != nil },
                                              // The finish has already gone out: closing the ceremony any way ends it.
                                              set: { if !$0 { finishWorkout() } })) {
            if let store, let session = store.session {
                WorkoutCeremony(session: session, hue: hue, energy: previewEnergy ?? store.energy(for: session),
                                onDone: { finishWorkout() },
                                onNote: { toast = soonToast("Edzés jegyzet") })
            }
        }
        // The day's result, looked at again from the „megvolt" card (mezo-r36n9.147).
        .fullScreenCover(isPresented: Binding(get: { phase == .result && store?.finishedToday != nil },
                                              set: { if !$0 { phase = .hidden } })) {
            if let store, let finished = store.finished, let session = store.finishedToday {
                WorkoutCeremony(session: session, hue: hue, energy: store.energy(for: session),
                                onDone: { phase = .hidden }, onNote: {}, finishedAt: finished.finishedAt)
            }
        }
        // A workout's start or finish reached the server: today and the brief re-read, so the card says what the
        // server now knows.
        .onChange(of: ritmus?.edzesTick) {
            Task {
                await store?.load(force: true)
                if phase != .ceremony { store?.endIfFinishedOnServer() }
                await loadWeek(); await morning?.load(date: Date())
            }
        }
        .sheet(isPresented: $showOtherDays) {
            OtherDaySheet(choices: otherDays, hue: hue) { id in
                showOtherDays = false
                Task { if let message = await store?.pick(id) { toast = message } }
            }
            .presentationDetents([.medium, .large])
            .presentationBackground(NK.ground).presentationCornerRadius(34).presentationDragIndicator(.visible)
        }
        .task {
            if !tookEntry, let e = roomEntry, e.hue == .mozgas, e.sub == "evesterv" { tookEntry = true; openYearPlan() }
            if store == nil { store = EdzesStore(client: train, cache: cache, folder: workoutFolder) }
            await store?.load()
            // The app closed while the ceremony was open: the finish had gone out, so the server's word ends it here.
            if phase != .ceremony { store?.endIfFinishedOnServer() }
            await loadWeek()
            await store?.loadRecords()
            await store?.loadBlock()
            // The catalog is only needed by the swap sheet, but it is one cached read and the gym is exactly
            // where the network is not: better here than at the moment a machine turns out to be occupied.
            await store?.loadCatalog()
            // What his gym lacks, so the swap sheet's chip opens lit when it should.
            await store?.loadGym()
            #if DEBUG
            // `-previewEdzesGym YES` (mezo-r36n9.66): straight onto „Mi van a termemben".
            if UserDefaults.standard.bool(forKey: "previewEdzesGym") { showGym = true }
            // `-previewEdzesRestEnd YES` (mezo-r36n9.172): straight onto „Pihenő vége".
            if UserDefaults.standard.bool(forKey: "previewEdzesRestEnd") { showRestEnd = true }
            // `-previewOtherDay sheet|pick` (mezo-r36n9.163): „Melyik napot csinálod ma?" open, or its first day picked.
            switch UserDefaults.standard.string(forKey: "previewOtherDay") {
            case "sheet": await store?.loadBlock(); showOtherDays = true
            case "pick": await store?.loadBlock(); if let first = otherDays.first { _ = await store?.pick(first.id) }
            default: break
            }
            // `-previewEdzesSwap YES` (mezo-r36n9.66): straight into the player, which opens the swap sheet;
            // `-previewEdzesPlayer YES` (mezo-r36n9.147): straight into the player on its lifting screen.
            if UserDefaults.standard.bool(forKey: "previewEdzesSwap") || UserDefaults.standard.bool(forKey: "previewEdzesPlayer") {
                if store?.session != nil { phase = .playing } else if workout != nil { beginWorkout() }
            }
            // `-previewEdzesBriefing YES` (mezo-r36n9.197.5): straight onto today's briefing.
            if UserDefaults.standard.bool(forKey: "previewEdzesBriefing"), workout != nil { phase = .briefing }
            // `-previewEdzesCeremony estimate|watch|none` (mezo-r36n9.170): the closing ceremony with its kcal line —
            // the estimate, the watch's figure, or none at all (offline / no body data). Nothing is sent.
            if let mode = UserDefaults.standard.string(forKey: "previewEdzesCeremony") {
                if store?.session == nil, workout != nil { beginWorkout() }
                switch mode {
                case "estimate": previewEnergy = WorkoutEnergy(kcal: 380, source: .estimate)
                case "watch": previewEnergy = WorkoutEnergy(kcal: 412, source: .watch)
                default: previewEnergy = nil
                }
                finishSent = store?.session?.ref
                phase = .ceremony
            }
            #endif
            if weekReview == nil, let plan { weekReview = WeekReviewModel(client: plan) }
            if year == nil, let plan { year = YearPlanModel(client: plan, cache: cache) }
            if mezo == nil, let plan { mezo = MezociklusokModel(client: plan, cache: cache) }
            async let preload: Void = prepareBuilder(fresh: false)
            async let yearLoad: Void = loadYear()
            async let mezoLoad: Void = loadMezo()
            await weekReview?.load()
            await preload
            await yearLoad
            await mezoLoad
            if blockDay == nil { blockDay = block?.days.first(where: \.isCurrent)?.day ?? block?.days.first?.day }
        }
    }

    /// Opens the new-block flow on the season's training days (read from the Évad overview, cached when offline);
    /// `prefill` when it starts a year block (the Következik card's „Indítás").
    private func openNewBlock(prefill: YearBlockPrefill? = nil) {
        guard let plan else { return }
        Task {
            await evad?.load()
            page = .newBlock(NewBlockCover(model: NewBlockModel(client: plan,
                                                                seasonGymDays: evad?.overview?.pillars.block.gymDays,
                                                                prefill: prefill)))
        }
    }

    private func loadYear() async { await year?.load() }
    private func loadMezo() async { await mezo?.load() }

    /// A mezociklus started, restarted, closed or edited: today, the block, the week and the year re-read.
    private func refreshAfterMezo() async {
        await store?.load(force: true)
        await store?.loadBlock()
        await weekReview?.load()
        await prepareBuilder(fresh: true)
        await year?.load()
        await mezo?.load()
        if blockDay == nil || block?.days.contains(where: { $0.day == blockDay }) != true {
            blockDay = block?.days.first(where: \.isCurrent)?.day ?? block?.days.first?.day
        }
    }

    /// The running one's card, for an action on it. Loaded on demand when the list has not arrived yet; offline the
    /// toast says why nothing happens.
    private func withRunning(_ act: @escaping (MezoCard) -> Void) {
        Task {
            if mezo?.groups.running == nil { await mezo?.load() }
            if let reason = mezoOfflineReason { toast = reason; return }
            if let running = mezo?.groups.running { act(running) }
            else { toast = mezo?.lastError ?? "A futó mezociklusodat most nem érem el." }
        }
    }

    private var mezoOfflineReason: String? {
        mezo?.offline == true ? "Most nem érem el a szervert — net nélkül nem tudod újraindítani vagy lezárni." : nil
    }

    /// The Következik card: only for a plan just read from the server, and only while it names a next block.
    @ViewBuilder private var kovetkezik: some View {
        if let year, let fresh = year.freshPlan, let content = KovetkezikContent(plan: fresh, today: kovetkezikToday()) {
            KovetkezikCard(content: content, hue: hue,
                           onStart: { openNewBlock(prefill: year.prefill(for: content.block, today: Date())) },
                           onYear: { openYearPlan() })
        }
    }

    /// Opens the Éves terv: the map, or the empty state that leads to creating one. A fresh model each time, so the map
    /// never opens on a stale plan from an earlier visit (the model falls back to the cached copy with its age).
    private func openYearPlan() {
        guard let plan else { return }
        yearPlan = YearPlanCover(model: YearPlanModel(client: plan, cache: cache))
    }

    /// Loads the builder's block, catalog and evaluation ahead of the tap. `fresh` starts over after the builder closed
    /// (what he saved is now the server's).
    private func prepareBuilder(fresh: Bool) async {
        guard let plan else { return }
        let failed: Bool = { if case .failed = builder?.phase { true } else { false } }()
        if fresh || builder == nil || failed { builder = BlockBuilderModel(client: plan) }
        if builder?.phase == .loading { await builder?.load() }
    }

    /// The tab set and the badge are the page's own, unchanged: a session planned for today and
    /// not yet done is the one thing the bar marks.
    private var tabs: [NKAreaTab] {
        let pending = (brief?.day.session != nil && brief?.day.session?.done != true) ? 1 : 0
        return EdzesTab.allCases.map { NKAreaTab($0.rawValue, badge: $0 == .ma ? pending : 0) }
    }

    @ViewBuilder private var content: some View {
        switch EdzesTab(rawValue: selected) ?? .ma {
        case .ma: ma
        case .blokk: blokk
        case .gyakorlatok: gyakorlatok
        case .elozmenyek: elozmenyek
        }
    }

    // MARK: - Ma

    /// The Ma tab in the redesign's rank (spec 2026-11-27 §5.3, mezo-r36n9.197.3; order #129): the day's hero, the
    /// Következik card under it, then one glass card per unit — today's exercises, where he is in the block, the
    /// area's doors — and the ask row.
    @ViewBuilder private var ma: some View {
        maHero
        kovetkezik
        exercises
        timeline
        NKSectionCard("Az Edzés terület", hue: hue) { menu }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a mai edzésről") { openDestination(.chat) }
    }

    /// Which day the hero talks about — the old card's branch order, now a tested decision.
    private var maKind: MaHeroKind {
        let another: Bool = {
            guard let w = workout, w.title != nil, let i = store?.todayIndex else { return false }
            return isAnotherDay(w, todayIndex: i)
        }()
        return MaHeroKind.resolve(anotherDay: another,
                                  briefSession: brief?.day.session != nil,
                                  briefDone: brief?.day.session?.done ?? false,
                                  planWorkout: workout.map { !$0.isRestDay && $0.title != nil } ?? false,
                                  restDay: workout?.isRestDay ?? false,
                                  doneToday: store?.doneToday ?? false)
    }

    /// **A mai edzés** — page 1 is the day (label, title, time, three numbers, the one button, the quiet links),
    /// page 2 the day's load on the body. Rest and „no plan" days have one page.
    private var maHero: some View {
        let kind = maKind
        let load = maLoadPage
        let pages = [AnyView(maFront(kind))] + (kind.pages(hasLoad: load != nil) > 1 ? [load!] : [])
        // Page 1 is measured, so a day without a running workout has no empty band under its links (spike glitch).
        let height = pages.count > 1 ? max(maFrontHeight, maLoadMinHeight) : maFrontHeight
        return NKPagedHero(pages: pages, height: height)
    }

    private func maFront(_ kind: MaHeroKind) -> some View {
        let primary = MaHeroPrimary.resolve(kind, running: running, hasResult: store?.finishedToday != nil)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text(maLabel(kind).uppercased())
                    .nkFont(10, .medium, design: .monospaced).tracking(1.4)
                    .foregroundStyle(hue.glow)
                if runningProgress != nil {
                    Text("FUT").nkFont(9, .semibold, design: .monospaced).tracking(1.2)
                        .foregroundStyle(NK.ground)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Capsule().fill(hue.glow))
                }
                Spacer(minLength: 0)
                let taken = max(0, (store?.missions.count ?? 0) - released.count)
                if taken > 0, kind == .today || kind == .potlas {
                    HStack(spacing: 4) {
                        NKGlyph("star-sun", NK.gold, size: 12)
                        Text("\(taken) küldetés").nkFont(10, .medium, design: .monospaced).foregroundStyle(NK.gold)
                    }
                }
            }
            maBody(kind)
            if let progress = runningProgress {
                VStack(alignment: .leading, spacing: 5) {
                    NKLevelBar(level: progress, hue: hue)
                    Text("\(Int((progress * 100).rounded()))% megvan")
                        .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                }
            }
            switch primary {
            case .start, .resume:
                NKCardActions(primary: NKCardAction(primary == .resume ? "Folytatom" : "Indítás", glyph: "bolt.fill") {
                    startOrResume()
                }, primaryStyle: .hue(hue))
            case .result:
                NKCardActions(primary: NKCardAction("Megnézem a mai eredményt", glyph: "medal.fill") { phase = .result })
            case .none:
                EmptyView()
            }
            if kind == .potlas, store?.session == nil, store?.pickedDay != nil {
                maLink("Mégis a mai napot csinálom") {
                    released = []
                    Task { _ = await store?.pick(nil) }
                }
            }
            // A done day offers no other day, whichever side (the brief or the history) knew it first.
            if canPickOtherDay, kind != .done {
                maLink("Másik napot csinálok ma") { showOtherDays = true }
            }
        }
        .padding(.horizontal, 18)
        .fixedSize(horizontal: false, vertical: true)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { maFrontHeight = $0 }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func maLabel(_ kind: MaHeroKind) -> String {
        switch kind {
        case .potlas: "pótlás"
        case .done: "megvolt"
        case .today, .rest, .none: "ma"
        }
    }

    /// Title, the time line and the three numbers — or the rest day's / the brief's own words.
    @ViewBuilder private func maBody(_ kind: MaHeroKind) -> some View {
        switch kind {
        case .today, .potlas, .done:
            let own = brief?.day.session?.title ?? workout?.title ?? ""
            let title = kind == .potlas ? (workout?.title ?? own) : kind == .done ? doneTitle(own) : own
            maTitle(title)
            if let line = maTimeLine(kind) { maLine(line) }
            maStats(edzesSummary(workout, brief: kind == .potlas ? nil : brief))
        case .rest:
            maTitle("Pihenőnap")
            maLine(store?.todayIndex.flatMap { maNextSessionLine(days: block?.days ?? [], todayIndex: $0) }
                   ?? "A mezociklusod szerint ma nincs edzés.")
        case .none:
            if let c = brief.map({ maiCopy($0, .mozgas) }) {
                maTitle(c.headline)
                maLine(c.sentence)
            } else if store?.problem != nil {
                NKNoFreshData("A mai edzésterved most nem érem el")
            } else if store?.today == nil {
                // The first answer has not come yet: a calm line, never a verdict.
                maLine("Betöltöm a mai edzésedet…")
            } else {
                maTitle("Ma nincs edzés")
                maLine("Nincs futó mezociklusod, ami mára edzést tervezne.")
            }
        }
    }

    /// „17:30" for today, „keddi nap, ma pótolod" for a picked day.
    private func maTimeLine(_ kind: MaHeroKind) -> String? {
        if kind == .potlas {
            let other = workout?.dayLabel.flatMap(TrainWeekdays.index(of:)).map(TrainWeekdays.adjective) ?? "másik"
            return "\(other) nap, ma pótolod"
        }
        return brief?.day.session?.time ?? brief?.day.session?.plannedTime ?? workout?.dayLabel
    }

    private func maTitle(_ text: String) -> some View {
        Text(text).nkFont(27, design: .serif).foregroundStyle(.white)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func maLine(_ text: String) -> some View {
        Text(text).nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.6))
            .fixedSize(horizontal: false, vertical: true)
    }

    /// perc · gyakorlat · éles sorozat — side by side, one under the other at the accessibility sizes, so no word is
    /// cut („gyakorl", „éles" in the spike at XXXL).
    @ViewBuilder private func maStats(_ s: EdzesSummary) -> some View {
        let items: [(String, String)] = [(s.minutes.map { "\($0)" } ?? "–", "perc"),
                                         (s.exercises.map { "\($0)" } ?? "–", "gyakorlat"),
                                         (s.workingSets.map { "\($0)" } ?? "–", "éles sorozat")]
        let stat = { (item: (String, String)) in
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(item.0).font(.nkNumber(26)).foregroundStyle(.white).monospacedDigit()
                Text(item.1).nkFont(12).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityElement(children: .combine)
        }
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 6) { ForEach(items, id: \.1) { stat($0) } }
        } else {
            HStack(alignment: .top, spacing: 16) {
                ForEach(items, id: \.1) { stat($0).frame(maxWidth: .infinity, alignment: .leading) }
            }
            .padding(.vertical, 2)
        }
    }

    /// A quiet text link inside the hero (#129: „Másik napot csinálok ma" under the button, no second glass).
    private func maLink(_ text: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(text).nkFont(14, .medium).foregroundStyle(.white.opacity(0.75))
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.4))
            }
            .frame(maxWidth: .infinity, minHeight: 40)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// On a done day the card names what was done: another weekday's workout done today says its own title
    /// (mezo-r36n9.163); today's own keeps the brief's words.
    private func doneTitle(_ own: String) -> String {
        guard let store, let i = store.todayIndex else { return own }
        let todays = block?.days.first(where: { TrainWeekdays.index(of: $0.day) == i })?.id
        if let other = store.doneTodayTemplate, let title = store.doneTodayTitle {
            return other != todays ? title : own
        }
        // The history has not answered yet (just finished, or offline): the phone's own finished workout.
        if store.finishedToday != nil, let other = store.finished?.session.templateSessionId, other != todays,
           let day = block?.days.first(where: { $0.id == other }) {
            return day.type
        }
        return own
    }

    /// The week's other open training days (mezo-r36n9.163), once the week's done days are known.
    private var otherDays: [OtherDayChoice] {
        guard let b = block, let i = store?.todayIndex, let done = store?.weekDone else { return [] }
        return otherDayChoices(days: b.days, todayIndex: i, done: done)
    }

    /// Offered while nothing runs, today is not done yet and no other day is picked — also on a rest day.
    private var canPickOtherDay: Bool {
        guard let store, store.session == nil, store.pickedDay == nil, !store.trainedToday else { return false }
        if let w = workout, let i = store.todayIndex, isAnotherDay(w, todayIndex: i) { return false }
        return !otherDays.isEmpty
    }

    /// The week's done days and the queued Napló bookings, for the ticks and the other-day sheet.
    private func loadWeek() async {
        var queued: [WorkoutAsPlannedPayload] = []
        if let ritmus { queued = asPlannedBookings(in: await ritmus.outbox.queue) }
        await store?.loadWeek(queued: queued)
    }

    /// **A mai terhelés** — the hero's page 2: which muscles today's session works, on the body, and each muscle with
    /// the working sets it gets. The heat is today's working sets, read against the hardest-worked muscle. nil when
    /// the day has no muscles to show.
    private var maLoadPage: AnyView? {
        let heat = edzesBodyHeat(workout)
        guard !heat.isEmpty else { return nil }
        return AnyView(VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("A MAI TERHELÉS").nkFont(10, .medium, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
                Spacer(minLength: 0)
                if let age = store?.ageText {
                    Text(age).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                }
            }
            // At the accessibility sizes the rows go under the body, full width, so a name never breaks mid-word.
            let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 16))
                                                      : AnyLayout(HStackLayout(alignment: .top, spacing: 16))
            layout {
                NKBodyMap(heat, hue: hue).frame(maxHeight: 200)
                VStack(spacing: 10) {
                    ForEach(muscleLoadRows, id: \.muscle) { row in
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(row.muscle.capitalizedFirst).nkFont(13).foregroundStyle(.white.opacity(0.85))
                                    .lineLimit(1).minimumScaleFactor(0.6)
                                NKLevelBar(level: row.level, hue: hue)
                            }
                            Text("\(row.sets)").nkFont(15, .medium, design: .monospaced)
                                .foregroundStyle(.white.opacity(0.7)).fixedSize()
                        }
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading))
    }

    /// Today's muscles with the working sets each one gets, hardest first — grouped by **the name he reads**,
    /// not by the database key. The catalog splits a muscle into parts (`back-wide`, `back-mid`), and a list
    /// that says „Hát 4 / Hát 3" reads as a bug, which it was.
    private var muscleLoadRows: [(muscle: String, sets: Int, level: Double)] {
        guard let w = workout else { return [] }
        var sets: [String: Int] = [:]
        for e in w.exercises {
            let working = e.sets.filter { $0.kind == .working }.count
            sets[muscleName(e.muscle), default: 0] += working > 0 ? working : e.workingCount
        }
        guard let top = sets.values.max(), top > 0 else { return [] }
        return sets.sorted { ($0.value, $1.key) > ($1.value, $0.key) }
            .prefix(5)
            .map { (muscle: $0.key, sets: $0.value, level: Double($0.value) / Double(top)) }
    }

    /// **Hol tartasz** — the block's weeks as the small arc (the Mezociklus hero's graphic), the week he is in lit;
    /// the whole card opens the Mezociklus tab.
    @ViewBuilder private var timeline: some View {
        let weeks = edzesTimeline(block)
        if !weeks.isEmpty, let b = block {
            NKSectionCard("Hol tartasz", hue: hue, trailing: .chevron, onOpen: { selected = EdzesTab.blokk.rawValue }) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("\(b.shortTitle) · \(b.currentWeek). hét \(mezoOf(b.weeks))")
                        .nkFont(15, .semibold).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    EdzesWeeksArc(weeks: weeks, hue: hue, compact: true)
                }
            }
            .accessibilityHint("A mezociklus fül")
        }
    }

    /// **A mai gyakorlatok** — the session's exercises, one card each, swipeable, inside the card.
    @ViewBuilder private var exercises: some View {
        if let w = workout, !w.exercises.isEmpty {
            NKSectionCard("A mai gyakorlatok", hue: hue, trailing: .text("\(w.exercises.count) gyakorlat")) {
                NKCarousel(w.exercises, hue: hue, height: 190) { e in
                    ExerciseCard(exercise: e, hue: hue, done: isDone(e))
                }
            }
        } else if let e = brief?.day.session?.exercises, !e.isEmpty {
            // Offline with no cache: the brief still knows the names and the set counts.
            NKSectionCard("A mai gyakorlatok", hue: hue, trailing: store?.ageText.map { .text($0) } ?? .none) {
                NKRowList(e.map { x in
                    NKAreaRow(glyph: "dumbbell-ink", title: x.name, sub: "\(x.sets) sorozat",
                              state: brief?.day.session?.done == true ? .done : .normal)
                }, hue: hue)
            }
        } else if store?.problem != nil, maKind != .none {
            NKSectionCard("A mai gyakorlatok", hue: hue) { NKNoFreshData("A mai edzésterved most nem érem el") }
        }
    }

    // MARK: - The workout itself

    /// True while a session is open, whether the player is on screen or minimised.
    private var running: Bool { store?.session != nil }

    /// Today's workout while it is open (started, not finished — on the server or only on the phone yet): the block
    /// builder keeps that day read-only (mezo-r36n9.116).
    private var openWorkoutDay: BlockBuilderModel.LockedDay? {
        guard let w = workout, running || w.open?.status == .active else { return nil }
        return .init(dayId: (w.open?.templateSessionId ?? w.templateSessionId)?.uuidString, weekday: w.dayLabel)
    }

    /// „Indítás" when nothing is running, „Folytatom" when something is. Starting also tells
    /// the server — through the outbox, so a basement gym changes nothing.
    private func startOrResume() {
        guard let store else { return }
        // A workout already running goes straight back to the player: the briefing is the screen before the
        // first set, not a gate he has to pass twice.
        if store.session != nil { phase = .playing; return }
        guard workout?.isRestDay == false || workout?.templateSessionId != nil else {
            toast = "Ma nincs mit elkezdeni — a mezociklusod szerint pihenőnap."
            return
        }
        guard workout != nil else {
            toast = "A mai edzéstervet nem érem el, így nem tudom elindítani."
            return
        }
        if store.doneToday {
            toast = "A mai edzés már megvolt — a szerver nem indít belőle másodikat."
            return
        }
        // A fresh read of today's plan rides along: the briefing shows it as it lands, and a plan that lands after
        // the start is merged into the running session (`EdzesStore.load`, mezo-r36n9.147).
        Task { await store.load(force: true) }
        phase = .briefing
    }

    /// „Indulás" on the briefing: the workout begins, with the missions he let go of taken back to last
    /// week's own numbers.
    private func beginWorkout() {
        guard let store else { return }
        if let item = store.startWorkout(date: brief?.date ?? "", released: released) { enqueue(item) }
        guard store.session != nil else {
            toast = "A mai edzéstervet nem érem el, így nem tudom elindítani."
            return
        }
        phase = .playing
    }

    /// „ma 17:30 · 3. hét / 8" over the briefing's title — only the parts that are known.
    private var briefingDayLine: String? {
        let parts = [brief?.day.session?.time ?? brief?.day.session?.plannedTime,
                     workout?.dayLabel,
                     block.map { "\($0.currentWeek). hét / \($0.weeks)" }].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// Exercise name → its demo still, from today's plan first and the catalog after it. The player looks a
    /// picture up by name so a swapped-in row brings its own.
    private var exercisePhotos: [String: String] {
        var out: [String: String] = [:]
        for c in store?.catalog ?? [] where c.imageStartURL != nil {
            out[c.name.lowercased()] = c.imageStartURL
        }
        for e in workout?.exercises ?? [] where e.imageStartURL != nil {
            out[e.name.lowercased()] = e.imageStartURL
        }
        return out
    }

    /// How far he is through the running workout, 0…1 — nil when nothing is running.
    private var runningProgress: Double? {
        guard let s = store?.session, s.progress.total > 0 else { return nil }
        return Double(s.progress.done) / Double(s.progress.total)
    }

    /// The finish goes out **the moment the ceremony opens** (mezo-r36n9.170), not when he taps „Kész" on it: the
    /// server answers the session's kcal only for a finished workout, and the ceremony is where he reads it. The
    /// write is idempotent on the server and guarded here, so the ceremony's own close never sends it again.
    private func sendFinish() {
        guard let store, let session = store.session, finishSent != session.ref else { return }
        finishSent = session.ref
        let item = OutboxItem.workoutWrite(.workoutFinish,
                                           payload: TrainPayloadCodec.encode(WorkoutFinishPayload(workoutRef: session.ref)),
                                           workoutRef: session.ref, date: brief?.date ?? "", capturedAt: Date())
        // Queue first, then flush, in one task: the two must not race. When the server has it, `edzesTick` re-reads
        // the day, and the kcal arrives on the open ceremony.
        Task {
            if let ritmus {
                try? await ritmus.outbox.enqueue(item)
                ritmus.sendNow()
            }
        }
    }

    private func finishWorkout() {
        guard let store, store.session != nil else { phase = .hidden; return }
        sendFinish()
        store.endWorkout()
        phase = .hidden
        toast = "Edzés lezárva"
        // The day re-reads itself twice: at once (the phone's own „megvolt") and again when the server has it
        // (`edzesTick`) — so Ma never falls back to „Indítás" (owner, 2026-11-23).
        let morning = morning
        Task {
            await store.load(force: true)
            await loadWeek()
            await morning?.load(date: Date())
        }
    }

    private func enqueueSet(_ exerciseId: UUID, _ set: SessionSet) {
        guard let session = store?.session,
              let item = WorkoutLiveActions.setItem(session: session, exerciseId: exerciseId, set: set, date: brief?.date ?? "")
        else { return }
        enqueue(item)
    }

    /// A correction names the set by exercise and position: the set itself may still be in the queue, and the
    /// correction waits behind it there (same group), so the server's id for it exists by the time it is sent.
    private func enqueueEdit(_ exerciseId: UUID, _ set: SessionSet) {
        guard let session = store?.session, let exercise = session.exercises[exerciseId],
              let index = exercise.logged.firstIndex(where: { $0.id == set.id }) else { return }
        let payload = WorkoutSetEditPayload(workoutRef: session.ref, exerciseId: exerciseId, setIndex: index,
                                            weightKg: set.kg ?? 0, reps: set.reps, rir: set.rir)
        enqueue(.workoutWrite(.workoutSetEdit, payload: TrainPayloadCodec.encode(payload),
                              workoutRef: session.ref, date: brief?.date ?? "", capturedAt: Date()))
    }

    /// The exercise's own durable note (mezo-r36n9.147). It is addressed by the exercise, not the workout, so it
    /// needs no server workout id — but it rides in the workout's group so it goes out in order with the rest.
    private func enqueueNote(_ exerciseId: UUID, _ note: String?) {
        guard let session = store?.session else { return }
        let payload = WorkoutNotePayload(workoutRef: session.ref, exerciseId: exerciseId, note: note)
        enqueue(.workoutWrite(.workoutNote, payload: TrainPayloadCodec.encode(payload),
                              workoutRef: session.ref, date: brief?.date ?? "", capturedAt: Date()))
    }

    private func enqueueFeedback(_ exerciseId: UUID, _ feedback: ExerciseFeedback) {
        guard let session = store?.session else { return }
        let payload = WorkoutFeedbackPayload(workoutRef: session.ref, items: [
            .init(exerciseId: exerciseId, pump: feedback.pump, jointPain: feedback.jointPain,
                  workload: feedback.workload)])
        enqueue(.workoutWrite(.workoutFeedback, payload: TrainPayloadCodec.encode(payload),
                              workoutRef: session.ref, date: brief?.date ?? "", capturedAt: Date()))
    }

    private func enqueueSkip(_ exerciseId: UUID) {
        guard let session = store?.session else { return }
        let payload = WorkoutSkipExercisePayload(workoutRef: session.ref, exerciseId: exerciseId)
        enqueue(.workoutWrite(.workoutSkipExercise, payload: TrainPayloadCodec.encode(payload),
                              workoutRef: session.ref, date: brief?.date ?? "", capturedAt: Date()))
    }

    /// Every training write goes through the same queue as the rest of the app: it survives a
    /// basement, a relaunch and a flat battery, and it reaches the server in order.
    private func enqueue(_ item: OutboxItem) {
        guard let ritmus else { return }
        Task { try? await ritmus.outbox.enqueue(item) }
    }

    /// Done means the server has a logged set for it — not that the day is over.
    private func isDone(_ e: PlannedExercise) -> Bool {
        let sets = (workout?.open?.sets ?? []) + (workout?.completed?.sets ?? [])
        return sets.contains { $0.exerciseId == e.id && !$0.skipped }
    }

    /// The area's menu. „Blokk" is gone from it — it is one tap away in the bar below (owner,
    /// 2026-11-17) — and its place went to the one thing that had no way in at all.
    private var menu: some View {
        NKMenuGrid([
            NKMenuItem(glyph: "bolt-sun", name: running ? "Folytatom" : (store?.doneToday == true ? "Megvolt" : "Indítás"),
                       sub: running ? "Az edzés fut" : (store?.doneToday == true ? "A mai eredmény" : "Sorozatról sorozatra")) {
                if !running, store?.doneToday == true, store?.finishedToday != nil { phase = .result } else { startOrResume() }
            },
            NKMenuItem(glyph: "plus-ink", name: "Egyedi edzés", sub: "Saját összeállítás") { toast = soonToast("Egyedi edzés") },
            NKMenuItem(glyph: "dumbbell-ink", name: "Gyakorlatok", sub: "A saját súlyaiddal") { selected = EdzesTab.gyakorlatok.rawValue },
            NKMenuItem(glyph: "book-sage", name: "Előzmények", sub: "Minden eddigi edzés") { selected = EdzesTab.elozmenyek.rawValue },
        ] + (plan != nil ? [NKMenuItem(glyph: "sun-ink", name: "Éves terv", sub: "Az év mezociklusai, előre") { openYearPlan() }] : []),
        hue: hue)
    }

    // MARK: - Blokk

    /// The Mezociklus tab in the redesign's rank (spec 2026-11-27 §5.2, mezo-r36n9.197.2): the hero, the week's
    /// review entrance, then one glass card per unit — the week, the muscles — the two tiles and the ask row.
    @ViewBuilder private var blokk: some View {
        MezoHero(state: mezoHeroState, hue: hue, zoom: planZoom, offlineReason: mezoOfflineReason,
                 canCreate: plan != nil,
                 onEdit: { page = .builder },
                 onRestart: { withRunning { mezoFlow.sheet = .restart($0) } },
                 onClose: { withRunning { mezoFlow.sheet = .close($0) } },
                 onSaveTemplate: { withRunning { mezoFlow.saveRunning = $0 } },
                 onNew: { openNewBlock() },
                 onOpenPlanned: { mezoFlow.cover = .detail($0) })
        if let b = block {
            if let weekReview, plan != nil {
                WeekReviewEntrance(model: weekReview, hue: hue, zoom: planZoom, openReview: { page = .review })
            }
            weekCarousel(b)
            musclesCard(b)
        }
        mezoTiles
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot az edzéstervedről") { openDestination(.chat) }
    }

    private var mezoHeroState: MezoHeroState {
        MezoHeroState.resolve(block: block, firstAnswerArrived: store?.blockAnswered ?? true,
                              failure: store?.blockProblem == nil ? nil : "A mezociklusodat most nem érem el",
                              planned: mezo?.groups.upcoming.first)
    }

    /// Mezociklusaim · Éves terv — always there, whatever state the running one is in.
    @ViewBuilder private var mezoTiles: some View {
        if plan != nil {
            MezoTiles(hue: hue, groups: mezo?.groups ?? .empty, year: yearPlanValue,
                      onAll: { mezoFlow.cover = .list }, onYear: { openYearPlan() })
        }
    }

    private var yearPlanValue: WireYearPlan? {
        if case .ready(let p, _) = year?.phase { p } else { nil }
    }

    /// **Izmok ezen a héten** — this week's top muscles as slim bars; the whole card opens the page that breaks the
    /// block down muscle by muscle.
    private func musclesCard(_ b: BlockPlan) -> some View {
        let bands = muscleBands(b)
        let total = "\(blockWeekSummary(bands).total) szett"
        // At the largest text sizes the total moves under the head, so the card's name is not cut short.
        let big = typeSize.isAccessibilitySize
        let trailing: NKCardTrailing = b.muscles.isEmpty || big ? .chevron : .text(total)
        return NKSectionCard("Izmok ezen a héten", hue: hue, trailing: trailing, onOpen: { page = .blockLoad }) {
            if big, !b.muscles.isEmpty {
                Text("\(total) ezen a héten").nkFont(13).foregroundStyle(.white.opacity(0.6))
            }
            if b.muscles.isEmpty {
                Text("Az izomcsoportok bontása még nem érkezett meg.").nkFont(13).foregroundStyle(.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                EdzesMuscleBars(bands: bands, hue: hue)
            }
        }
        .accessibilityHint("Izomcsoportonkénti bontás")
    }

    /// **A heted** — the week's days as a carousel: pick a day, see what it asks for. It moved
    /// here from Ma (owner, 2026-11-17): Ma is today, the week is the block's business.
    private func weekCarousel(_ b: BlockPlan) -> some View {
        NKSectionCard("A heted", hue: hue, trailing: store?.blockAgeText.map { .text($0) } ?? .none) {
            if b.days.isEmpty {
                NKNoFreshData("A mezociklus napjai még nem érkeztek meg")
            } else {
                NKCarousel(b.days, hue: hue, height: min(dayCardHeight, 330)) { day in
                    DayCard(day: day, hue: hue, done: isDayDone(day), today: day.isCurrent)
                }
            }
        }
    }

    /// A day counts as done when this week has a finished session **of that template day**, whatever day it was
    /// done on (a Tuesday done on Wednesday ticks Tuesday, mezo-r36n9.163). Before the week's history answered,
    /// the dates the server marked done stand in.
    private func isDayDone(_ day: BlockDay) -> Bool {
        if let done = store?.weekDone, let id = day.id { return done.contains(id) }
        guard let done = workout?.weekDoneDates, !done.isEmpty, let b = brief else { return false }
        let names = ["Hét", "Ke", "Sze", "Csü", "Pé", "Szo", "Vas"]
        guard let index = names.firstIndex(where: { day.day.hasPrefix($0) }),
              let dates = weekDates(of: b.date), index < dates.count else { return false }
        return done.contains(dates[index])
    }

    /// The seven `yyyy-MM-dd` of the Monday–Sunday week `ymd` is in, in the device's calendar.
    private func weekDates(of ymd: String) -> [String]? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .autoupdatingCurrent
        cal.firstWeekday = 2
        let f = DateFormatter()
        f.calendar = cal; f.timeZone = cal.timeZone; f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        guard let date = f.date(from: ymd),
              let monday = cal.dateInterval(of: .weekOfYear, for: date)?.start else { return nil }
        return (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: monday).map(f.string(from:)) }
    }

    // MARK: - The two tabs their own stages fill

    @ViewBuilder private var gyakorlatok: some View {
        // §5.7 of the 2026-11-27 redesign: the message sits in a section card, nothing else.
        NKSectionCard("Gyakorlatok", hue: hue) {
            NKNotLiveYet(hue: hue, title: "A gyakorlataid",
                         line: "A súlyaid, a rekordjaid és minden gyakorlat egy helyen. Az edzés-szakasz hozza, a Watch-appal együtt.",
                         glass: false)
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot egy gyakorlatról") { openDestination(.chat) }
    }

    @ViewBuilder private var elozmenyek: some View {
        NKSectionCard("Előzmények", hue: hue) {
            NKNotLiveYet(hue: hue, title: "Az eddigi edzéseid",
                         line: "A telefon ma csak a mai napot látja az edzésekből. A teljes előzmény az edzés-szakasszal érkezik.",
                         glass: false)
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a fejlődésedről") { openDestination(.chat) }
    }
}

// MARK: - The cards

/// One exercise of today, as the owner asked for it in round 4: **its photograph, its muscle group and its
/// name — and nothing else.** The set plan, the target weight and the engine's sentence all moved to the
/// briefing screen, where he reads them before he starts; on Ma they were four lines he scrolled past.
private struct ExerciseCard: View {
    let exercise: PlannedExercise
    let hue: Hue
    let done: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                NKRemoteBanner(BoopConfig.mediaURL(exercise.imageStartURL), hue: hue, height: 112)
                if done {
                    NKDoneTick(hue: hue)
                        .padding(9)
                        .background(Circle().fill(.black.opacity(0.35)))
                        .padding(8)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(SubMuscles.name(exercise.muscle).uppercased())
                    .nkFont(10, .medium, design: .monospaced).tracking(1.2)
                    .foregroundStyle(hue.glow)
                Text(exercise.name)
                    .nkFont(19, design: .serif).foregroundStyle(.white)
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 14)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .nkInnerCard()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(exercise.name), \(SubMuscles.name(exercise.muscle))\(done ? ", megvan" : "")")
    }
}

/// One day of the block's week: what it is, what it works, and whether it is behind you.
private struct DayCard: View {
    let day: BlockDay
    let hue: Hue
    let done: Bool
    let today: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(day.day.uppercased())
                    .nkFont(11, .medium, design: .monospaced).tracking(1.4)
                    .foregroundStyle(today ? hue.glow : .white.opacity(0.5))
                if today {
                    Text("MA").nkFont(9, .semibold, design: .monospaced).tracking(1.2)
                        .foregroundStyle(NK.ground)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Capsule().fill(hue.glow))
                }
                Spacer(minLength: 0)
                if done { NKDoneTick(hue: hue) }
            }
            Text(day.type)
                .nkFont(19, design: .serif)
                .foregroundStyle(.white)
                .lineLimit(2)
            Text(day.muscle).nkFont(13).foregroundStyle(.white.opacity(0.62)).lineLimit(2)
            Spacer(minLength: 0)
            Text("\(day.exerciseCount) gyakorlat")
                .nkFont(12, design: .monospaced)
                .foregroundStyle(.white.opacity(0.5))
            if let note = day.note, !note.isEmpty {
                Text(note).nkFont(12).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // Inside the „A heted" card: the inner treatment, never a second glass; today's day ringed.
        .nkInnerCard()
        .overlay {
            if today {
                RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(hue.glow.opacity(0.7), lineWidth: 1.5)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The Éves terv cover's item: a fresh model per opening.
struct YearPlanCover: Identifiable {
    let id = UUID()
    let model: YearPlanModel
}

/// The new-block flow's item (`EdzesPage.newBlock`): a fresh model per opening, carried by the page itself.
struct NewBlockCover: Identifiable {
    let id = UUID()
    let model: NewBlockModel
}

// MARK: - Words

/// A muscle group the way he says it, lower-case for running text („hát", „mell", „comb") — the shared
/// `SubMuscles.groupName` (mezo-r36n9.127); `arms` is „kar", an unknown key stays as it is.
func muscleName(_ key: String) -> String {
    if key.lowercased() == "arms" { return "kar" }
    let name = SubMuscles.groupName(key)
    return name == "Egyéb" ? key : name.lowercased()
}

/// A weight the way he reads it: „80 kg", „77,5 kg" — a Hungarian decimal comma, and no „.0".
func nkKg(_ kg: Double) -> String {
    let whole = kg.rounded() == kg
    let text = whole ? String(Int(kg)) : String(format: "%.1f", kg).replacingOccurrences(of: ".", with: ",")
    return "\(text) kg"
}

// MARK: - The Ma hero's decisions (mezo-r36n9.197.3)

/// Which day the Ma hero talks about, in the order the old card decided it: another weekday picked for today wins
/// (until today is done), then the brief's session, then the training plan's own workout, then a rest day.
enum MaHeroKind: Equatable {
    case today, potlas, done, rest, none

    static func resolve(anotherDay: Bool, briefSession: Bool, briefDone: Bool, planWorkout: Bool, restDay: Bool,
                        doneToday: Bool) -> MaHeroKind {
        if anotherDay, !doneToday { return .potlas }
        if briefSession { return briefDone || doneToday ? .done : .today }
        if anotherDay || planWorkout { return doneToday ? .done : .today }
        if restDay { return .rest }
        return .none
    }

    /// Rest and „no plan" days have no load to show; nor does a day whose muscles have not arrived.
    func pages(hasLoad: Bool) -> Int {
        switch self {
        case .rest, .none: 1
        case .today, .potlas, .done: hasLoad ? 2 : 1
        }
    }
}

/// The hero's one button: start, continue, or — on a done day — the result, never a second start.
enum MaHeroPrimary: Equatable {
    case start, resume, result, none

    static func resolve(_ kind: MaHeroKind, running: Bool, hasResult: Bool) -> MaHeroPrimary {
        switch kind {
        case .rest, .none: return .none
        case .today, .potlas: return running ? .resume : .start
        case .done: return running ? .resume : hasResult ? .result : .none
        }
    }
}

/// The block's next training day after `todayIndex` (0 = Monday), wrapping to next week; a rest day (no exercises)
/// is never „the next session".
func maNextSession(days: [BlockDay], todayIndex: Int) -> BlockDay? {
    let indexed = days.filter { $0.exerciseCount > 0 }
        .compactMap { d in TrainWeekdays.index(of: d.day).map { (i: $0, day: d) } }
    return (indexed.filter { $0.i > todayIndex }.min { $0.i < $1.i } ?? indexed.min { $0.i < $1.i })?.day
}

/// „Következő: Alsó A · szerda" — the rest day's line.
func maNextSessionLine(days: [BlockDay], todayIndex: Int) -> String? {
    guard let next = maNextSession(days: days, todayIndex: todayIndex),
          let i = TrainWeekdays.index(of: next.day) else { return nil }
    return "Következő: \(next.type) · \(TrainWeekdays.name(i).lowercased())"
}
