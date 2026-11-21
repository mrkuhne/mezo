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

/// Which tab of the room is open. The labels are the owner's (`Terv` became **`Blokk`** on
/// 2026-11-16) and they live **here, once**: `AreaRoom`'s tab set reads the same constants.
enum EdzesTab: String, CaseIterable {
    case ma = "Ma", blokk = "Blokk", gyakorlatok = "Gyakorlatok", elozmenyek = "Előzmények"
}

/// A sub-page of the room, opened from a card.
enum EdzesPage: String, Identifiable {
    case blockLoad
    /// The block builder and the weekly review (mezo-r36n9.83, `ios/Boop/EdzesTerv/`).
    case builder, review
    /// The new-block flow (mezo-r36n9.113, `ios/Boop/EdzesTerv/UjBlokk/`).
    case newBlock
    var id: String { rawValue }
}

/// Edzés as its own app, the way Étel is: its own data, on the shared page.
struct EdzesRoom: View {
    @Environment(\.dismiss) private var dismiss
    /// Set when the home screen's ring opened this room with no navigation stack around it.
    @Environment(\.closeRoom) private var closeRoom
    @Environment(\.openPlace) private var openPlace
    @Environment(\.trainClient) private var train
    @Environment(\.planClient) private var plan
    @Environment(\.serverCache) private var cache
    @Environment(\.workoutFolder) private var workoutFolder
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @Environment(MorningStore.self) private var morning: MorningStore?
    /// The season overview: its training days are the new block's days (mezo-r36n9.113).
    @Environment(EvadStore.self) private var evad: EvadStore?
    @SceneStorage("edzes.tab") private var selected: String = EdzesTab.ma.rawValue
    @State private var store: EdzesStore?
    @State private var toast: String?
    @State private var page: EdzesPage?
    /// This week's proposal for the Blokk tab's entrance card (mezo-r36n9.83).
    @State private var weekReview: WeekReviewModel?
    /// The builder, loaded in the background when the room opens, so it opens without a spinner (owner, 2026-11-19).
    @State private var builder: BlockBuilderModel?
    /// The new-block intake on screen.
    @State private var newBlock: NewBlockModel?
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
    /// The day of the week the Blokk tab's carousel is showing.
    @State private var blockDay: String?
    /// The missions he let go of on the briefing screen. Kept here so the choice survives that screen closing
    /// and reopening before he starts.
    @State private var released: Set<UUID> = []
    /// „Mi van a termemben" (mezo-r36n9.66), from the Beállítások action. The workout player presents its own copy.
    @State private var showGym = false

    /// `hidden` is not „no workout": the session may well be running, minimised.
    private enum WorkoutPhase { case hidden, briefing, playing, ceremony }

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
                             NKAreaAction(glyph: "repeat-deep", label: "Beállítások") { showGym = true }],
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } },
                   onAsk: { openPlace(.boop) }) {
            content
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
        .nkToast($toast)
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
                        Task { await store?.loadBlock(); await weekReview?.load(); await prepareBuilder(fresh: true) }
                    }
                    .navigationTransition(.zoom(sourceID: PlanZoom.builder, in: planZoom))
                }
            case .newBlock:
                if let newBlock, let plan {
                    UjBlokkFlow(model: newBlock,
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
                                    openPlace(.terv)
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
                              onFinish: { phase = .ceremony },
                              onLogged: { exerciseId, set in enqueueSet(exerciseId, set) },
                              onEdited: { exerciseId, set in enqueueEdit(exerciseId, set) },
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
                                              set: { if !$0 { phase = .hidden } })) {
            if let store, let session = store.session {
                WorkoutCeremony(session: session, hue: hue,
                                onDone: { finishWorkout() },
                                onNote: { toast = soonToast("Edzés jegyzet") })
            }
        }
        .task {
            if store == nil { store = EdzesStore(client: train, cache: cache, folder: workoutFolder) }
            await store?.load()
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
            // `-previewEdzesSwap YES` (mezo-r36n9.66): straight into the player, which opens the swap sheet.
            if UserDefaults.standard.bool(forKey: "previewEdzesSwap") {
                if store?.session != nil { phase = .playing } else if workout != nil { beginWorkout() }
            }
            #endif
            if weekReview == nil, let plan { weekReview = WeekReviewModel(client: plan) }
            if year == nil, let plan { year = YearPlanModel(client: plan, cache: cache) }
            async let preload: Void = prepareBuilder(fresh: false)
            async let yearLoad: Void = loadYear()
            await weekReview?.load()
            await preload
            await yearLoad
            if blockDay == nil { blockDay = block?.days.first(where: \.isCurrent)?.day ?? block?.days.first?.day }
        }
    }

    /// Opens the new-block flow on the season's training days (read from the Évad overview, cached when offline);
    /// `prefill` when it starts a year block (the Következik card's „Indítás").
    private func openNewBlock(prefill: YearBlockPrefill? = nil) {
        guard let plan else { return }
        Task {
            await evad?.load()
            newBlock = NewBlockModel(client: plan, seasonGymDays: evad?.overview?.pillars.block.gymDays, prefill: prefill)
            page = .newBlock
        }
    }

    private func loadYear() async { await year?.load() }

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

    @ViewBuilder private var ma: some View {
        kovetkezik
        highlight
        todaysLoad
        timeline
        exercises
        NKBare("AZ EDZÉS TERÜLET", hue: hue) { menu }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a mai edzésről") { openPlace(.boop) }
    }

    /// Today's session in a sentence. The brief's own title and time stay the source — it is
    /// what the rest of the app says about today.
    @ViewBuilder private var highlight: some View {
        if let s = brief?.day.session {
            TodaySessionCard(label: s.done ? "megvolt" : "ma", title: s.title, sub: highlightSub,
                             hue: hue, done: s.done, progress: runningProgress,
                             missions: store?.missions.count ?? 0, released: released.count,
                             action: (s.done && store?.session == nil) ? nil : { startOrResume() })
        } else if let w = workout, !w.isRestDay, let title = w.title {
            // The brief has no session but the training plan does (a day started across
            // midnight, or a brief that has not caught up): the plan is the honest thing.
            TodaySessionCard(label: "ma", title: title, sub: highlightSub, hue: hue, done: false,
                             progress: runningProgress, missions: store?.missions.count ?? 0,
                             released: released.count, action: { startOrResume() })
        } else if let w = workout, w.isRestDay {
            NKHighlight(hue: hue, label: "ma", text: "Ma nincs edzés", sub: "A blokkod szerint ez pihenőnap.")
        } else if let c = brief.map({ maiCopy($0, .mozgas) }) {
            NKHighlight(hue: hue, label: "ma", text: c.headline, sub: c.sentence)
        }
    }

    /// „17:30 · 60 perc · 5 gyakorlat · 18 sorozat" — each part only when it is known.
    private var highlightSub: String {
        let s = edzesSummary(workout, brief: brief)
        return [brief?.day.session?.time ?? brief?.day.session?.plannedTime ?? workout?.dayLabel,
                s.minutes.map { "\($0) perc" },
                s.exercises.map { "\($0) gyakorlat" },
                s.workingSets.map { "\($0) sorozat" }]
            .compactMap { $0 }.joined(separator: " · ")
    }

    /// **A mai terhelés** — which muscles today's session works, on the body, with the day's
    /// three numbers beside it. The body is the one in the web app, from the same upstream
    /// artwork; the heat is today's working sets, read against the hardest-worked muscle.
    @ViewBuilder private var todaysLoad: some View {
        let heat = edzesBodyHeat(workout)
        if !heat.isEmpty {
            let s = edzesSummary(workout, brief: brief)
            NKBare("A MAI TERHELÉS", hue: hue, trailing: store?.ageText) {
                VStack(spacing: 16) {
                    // The three numbers run the whole width — the kit's own row, so they sit
                    // exactly as they do on every other page.
                    NKStatRow([
                        NKStat(value: s.exercises.map { "\($0)" }, label: "gyakorlat", hot: true),
                        NKStat(value: s.workingSets.map { "\($0)" }, label: "éles sorozat"),
                        NKStat(value: s.minutes.map { "\($0)" }, unit: "perc", label: "körülbelül"),
                    ], hue: hue)
                    HStack(alignment: .top, spacing: 16) {
                        NKBodyMap(heat, hue: hue)
                            .frame(maxHeight: 180)
                        // And the muscles themselves, each with what it gets today, filling
                        // the rest of the row instead of leaving a hole on the right.
                        VStack(spacing: 10) {
                            ForEach(muscleLoadRows, id: \.muscle) { row in
                                HStack(spacing: 10) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(row.muscle.capitalizedFirst)
                                            .nkFont(13).foregroundStyle(.white.opacity(0.85))
                                        NKLevelBar(level: row.level, hue: hue)
                                    }
                                    Text("\(row.sets)")
                                        .nkFont(15, .medium, design: .monospaced)
                                        .foregroundStyle(.white.opacity(0.7))
                                        .frame(width: 22, alignment: .trailing)
                                }
                            }
                            Spacer(minLength: 0)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
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

    /// **Hol tartasz a blokkban** — the eight weeks as time, their height as difficulty, the
    /// week he is in lit and named.
    @ViewBuilder private var timeline: some View {
        let weeks = edzesTimeline(block)
        if !weeks.isEmpty, let b = block {
            NKBare("HOL TARTASZ", hue: hue, trailing: store?.blockAgeText) {
                NKBlockTimeline(weeks, hue: hue,
                                caption: "\(b.weeks) hetes blokk · \(b.currentWeek). hét · \(b.shortTitle)")
            }
        }
    }

    /// The session's exercises, one card each, swipeable — **with the engine's own sentence on
    /// the card it is about**. There is no separate „eligazítás" list: it was the same thing
    /// said twice.
    @ViewBuilder private var exercises: some View {
        if let w = workout, !w.exercises.isEmpty {
            NKBare("A MAI EDZÉS", hue: hue, trailing: store?.ageText) {
                NKCarousel(w.exercises, hue: hue, height: 190) { e in
                    ExerciseCard(exercise: e, hue: hue, done: isDone(e))
                }
            }
        } else if let e = brief?.day.session?.exercises, !e.isEmpty {
            // Offline with no cache: the brief still knows the names and the set counts.
            NKBare("A MAI EDZÉS", hue: hue, trailing: store?.ageText) {
                NKRowList(e.map { x in
                    NKAreaRow(glyph: "dumbbell-ink", title: x.name, sub: "\(x.sets) sorozat",
                              state: brief?.day.session?.done == true ? .done : .normal)
                }, hue: hue)
            }
        } else if store?.problem != nil {
            NKBare("A MAI EDZÉS", hue: hue) { NKNoFreshData("A mai edzésterved most nem érem el") }
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
            toast = "Ma nincs mit elkezdeni — a blokkod szerint pihenőnap."
            return
        }
        guard workout != nil else {
            toast = "A mai edzéstervet nem érem el, így nem tudom elindítani."
            return
        }
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

    private func finishWorkout() {
        guard let store, let session = store.session else { return }
        enqueue(.workoutWrite(.workoutFinish,
                              payload: TrainPayloadCodec.encode(WorkoutFinishPayload(workoutRef: session.ref)),
                              workoutRef: session.ref, date: brief?.date ?? "", capturedAt: Date()))
        store.endWorkout()
        phase = .hidden
        toast = "Edzés lezárva"
    }

    private func enqueueSet(_ exerciseId: UUID, _ set: SessionSet) {
        guard let session = store?.session, let exercise = session.exercises[exerciseId] else { return }
        // The set's own place in the exercise, found by id: a technique set is appended only when its last step
        // is done, and a skip or a switch can be what finishes it.
        let index = exercise.logged.firstIndex { $0.id == set.id } ?? max(0, exercise.logged.count - 1)
        let plan = exercise.plan(at: index)
        let payload = WorkoutSetPayload(
            workoutRef: session.ref, exerciseId: exerciseId,
            setIndex: index,
            weightKg: set.kg ?? 0, reps: set.reps, rir: set.rir, kind: set.kind,
            targetWeightKg: plan?.targetKg, targetReps: plan?.targetReps,
            technique: set.technique?.rawValue, legs: set.legs?.map(WorkoutLegPayload.init))
        enqueue(.workoutWrite(.workoutSet, payload: TrainPayloadCodec.encode(payload),
                              workoutRef: session.ref, date: brief?.date ?? "", capturedAt: set.at))
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
            NKMenuItem(glyph: "bolt-sun", name: running ? "Folytatom" : "Indítás",
                       sub: running ? "Az edzés fut" : "Sorozatról sorozatra") { startOrResume() },
            NKMenuItem(glyph: "plus-ink", name: "Egyedi edzés", sub: "Saját összeállítás") { toast = soonToast("Egyedi edzés") },
            NKMenuItem(glyph: "dumbbell-ink", name: "Gyakorlatok", sub: "A saját súlyaiddal") { selected = EdzesTab.gyakorlatok.rawValue },
            NKMenuItem(glyph: "book-sage", name: "Előzmények", sub: "Minden eddigi edzés") { selected = EdzesTab.elozmenyek.rawValue },
        ] + (plan != nil ? [NKMenuItem(glyph: "sun-ink", name: "Éves terv", sub: "Az év blokkjai, előre") { openYearPlan() }] : []),
        hue: hue)
    }

    // MARK: - Blokk

    @ViewBuilder private var blokk: some View {
        if let b = block {
            if let weekReview, plan != nil {
                WeekReviewEntrance(model: weekReview, hue: hue, zoom: planZoom,
                                   openReview: { page = .review }, openBuilder: { page = .builder })
            }
            blockLoadCard(b)
            yearPlanRow
            weekCarousel(b)
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot az edzéstervedről") { openPlace(.boop) }
        } else if store?.blockProblem != nil {
            NKBare("A BLOKKOD", hue: hue) { NKNoFreshData("A blokkodat most nem érem el") }
            yearPlanRow
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot az edzéstervedről") { openPlace(.boop) }
        } else {
            NKNotLiveYet(hue: hue, title: "Nincs futó blokkod",
                         line: "Amint elindítasz egy nyolchetes blokkot, itt fog állni, hányadik hetén jársz, mit hoz a hét, és melyik izomcsoport mennyit kap.")
            if plan != nil {
                Button { openNewBlock() } label: {
                    Text("Új blokk").nkFont(16, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 28).frame(minHeight: 52).background(Capsule().fill(.white))
                }
                .buttonStyle(PressStyle())
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
            }
            yearPlanRow
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot az edzéstervedről") { openPlace(.boop) }
        }
    }

    /// The whole block's load in one card: the weeks, and what the muscles get. Tapping it
    /// opens the page that breaks it down muscle by muscle.
    private func blockLoadCard(_ b: BlockPlan) -> some View {
        NKBare("A BLOKK TERHELÉSE", hue: hue, trailing: store?.blockAgeText) {
            Button { page = .blockLoad } label: {
                VStack(alignment: .leading, spacing: 14) {
                    NKBlockTimeline(edzesTimeline(b), hue: hue,
                                    caption: "\(b.weeks) hetes blokk · \(b.currentWeek). hét · \(b.split)")
                    HStack(spacing: 10) {
                        Text(muscleSummary(b))
                            .nkFont(13).foregroundStyle(.white.opacity(0.7))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.45))
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint("Izomcsoportonkénti bontás")
        }
    }

    /// The way into the Éves terv from the Blokk tab: one row under the block's load.
    @ViewBuilder private var yearPlanRow: some View {
        if plan != nil {
            NKBare("AZ ÉVES TERV", hue: hue) {
                Button { openYearPlan() } label: {
                    HStack(spacing: 10) {
                        Text("Melyik blokk mikor jön, és mire figyel")
                            .nkFont(13).foregroundStyle(.white.opacity(0.7))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.45))
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Éves terv")
                .accessibilityHint("Melyik blokk mikor jön, és mire figyel")
            }
        }
    }

    /// The same sentence the load page opens with, so the card and the page agree.
    private func muscleSummary(_ b: BlockPlan) -> String {
        guard !b.muscles.isEmpty else { return "Az izomcsoportok bontása még nem érkezett meg." }
        let summary = blockWeekSummary(muscleBands(b))
        return "\(summary.total) szett ezen a héten · \(summary.muscles) izomcsoport"
    }

    /// **A heted** — the week's days as a carousel: pick a day, see what it asks for. It moved
    /// here from Ma (owner, 2026-11-17): Ma is today, the week is the block's business.
    private func weekCarousel(_ b: BlockPlan) -> some View {
        NKBare("A HETED", hue: hue, trailing: store?.blockAgeText) {
            if b.days.isEmpty {
                NKNoFreshData("A blokk napjai még nem érkeztek meg")
            } else {
                NKCarousel(b.days, hue: hue, height: 150) { day in
                    DayCard(day: day, hue: hue, done: isDayDone(day), today: day.isCurrent)
                }
            }
        }
    }

    /// A day counts as done when this week has a finished session on it.
    private func isDayDone(_ day: BlockDay) -> Bool {
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
        NKNotLiveYet(hue: hue, title: "A gyakorlataid",
                     line: "A súlyaid, a rekordjaid és minden gyakorlat egy helyen. Az edzés-szakasz hozza, a Watch-appal együtt.")
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot egy gyakorlatról") { openPlace(.boop) }
    }

    @ViewBuilder private var elozmenyek: some View {
        NKNotLiveYet(hue: hue, title: "Az eddigi edzéseid",
                     line: "A telefon ma csak a mai napot látja az edzésekből. A teljes előzmény az edzés-szakasszal érkezik.")
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a fejlődésedről") { openPlace(.boop) }
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
        .nkGlass()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(exercise.name), \(SubMuscles.name(exercise.muscle))\(done ? ", megvan" : "")")
    }
}

/// Today's session at the top of Ma: what it is, **the one button that starts or continues it**, and — once
/// it is running — how far he is in it (owner, 2026-11-17).
private struct TodaySessionCard: View {
    let label: String
    let title: String
    let sub: String
    let hue: Hue
    let done: Bool
    /// 0…1 while a workout is running, nil otherwise.
    let progress: Double?
    let missions: Int
    let released: Int
    let action: (() -> Void)?

    private var takenMissions: Int { max(0, missions - released) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text(label.uppercased())
                    .nkFont(10, .medium, design: .monospaced).tracking(1.4)
                    .foregroundStyle(hue.glow)
                if progress != nil {
                    Text("FUT").nkFont(9, .semibold, design: .monospaced).tracking(1.2)
                        .foregroundStyle(NK.ground)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Capsule().fill(hue.glow))
                }
                Spacer(minLength: 0)
                if takenMissions > 0 {
                    HStack(spacing: 4) {
                        NKGlyph("star-sun", NK.gold, size: 12)
                        Text("\(takenMissions) küldetés").nkFont(10, .medium, design: .monospaced)
                            .foregroundStyle(NK.gold)
                    }
                }
            }
            Text(title).nkFont(27, design: .serif).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            if !sub.isEmpty {
                Text(sub).nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let progress {
                VStack(alignment: .leading, spacing: 5) {
                    NKLevelBar(level: progress, hue: hue)
                    Text("\(Int((progress * 100).rounded()))% megvan")
                        .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                }
            }
            if let action {
                Button(action: action) {
                    HStack(spacing: 8) {
                        NKGlyph("bolt-ink", NK.ground, size: 16)
                        Text(progress != nil ? "Folytatom" : "Indítás")
                            .nkFont(16, .semibold).foregroundStyle(NK.ground)
                    }
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Capsule().fill(hue.glow))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
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
        .nkGlass()
        .accessibilityElement(children: .combine)
    }
}

/// The Éves terv cover's item: a fresh model per opening.
struct YearPlanCover: Identifiable {
    let id = UUID()
    let model: YearPlanModel
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
