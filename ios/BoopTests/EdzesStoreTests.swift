import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Edzés room's data (B5). What is tested here is the room's **honesty**: it shows the server's own numbers,
/// or it says it has none — there is no third case where a 0 stands in for "we do not know".
@MainActor
struct EdzesStoreTests {
    let transport = ScriptedTransport()
    let sessionId = "c1c2c3d4-0001-4a2b-9c3d-111122223333"
    let pressId = "c1c2c3d4-0002-4a2b-9c3d-111122223333"

    func directory() -> URL {
        let url = URL.temporaryDirectory.appendingPathComponent("edzes-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    func store(cache: ServerCache? = nil, at now: Date = Date()) -> EdzesStore {
        EdzesStore(client: TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)),
                   cache: cache, clock: { now })
    }

    var todayJSON: String {
        #"""
        {"templateSessionId":"\#(sessionId)","dayLabel":"Hét","title":"Pull Day","durationEst":62,
         "exercises":[{"id":"\#(pressId)","name":"Fekvenyomás","muscle":"chest","warmupSets":2,"workingSets":3,
          "repMin":6,"repMax":10,"targetRIR":2,"type":"compound","anchorWeightKg":77.5,
          "prescribedSets":[{"kind":"warmup","targetWeightKg":40,"targetReps":8},
                            {"kind":"warmup","targetWeightKg":60,"targetReps":5},
                            {"kind":"working","targetWeightKg":80,"targetReps":8,"targetRIR":2},
                            {"kind":"working","targetWeightKg":80,"targetReps":8,"targetRIR":2},
                            {"kind":"working","targetWeightKg":80,"targetReps":7,"targetRIR":1}],
          "rationale":"Múlt hét 8 × 77.5 kg (RIR 3) → +2.5 kg"}],
         "weekDoneDates":["2026-11-16"]}
        """#
    }

    @Test func fourTabsInOrder() {
        // The owner's labels, and the one place they live: „Terv" became „Blokk" on 2026-11-16.
        #expect(EdzesTab.allCases.map(\.rawValue) == ["Ma", "Blokk", "Gyakorlatok", "Előzmények"])
    }

    @Test func todaysPlanIsReadAndCached() async throws {
        let cache = ServerCache(directory: directory())
        transport.on("getTodayWorkout", 200, todayJSON)
        let s = store(cache: cache)
        await s.load()

        #expect(s.today?.value.title == "Pull Day")
        #expect(s.today?.value.exercises.first?.sets.count == 5)
        #expect(s.ageText == nil)              // straight from the server: no age to report
        #expect(s.problem == nil)
        // Written through, so the next launch without a network has something true to show.
        let hit = await cache.get(TodayWorkout.self, endpoint: "train/today",
                                  date: s.today.map { _ in dayKey(Date()) } ?? "", maxAge: 3600)
        #expect(hit?.value.title == "Pull Day")
    }

    @Test func emptyCacheOfflineSaysSoRatherThanRenderingZeroes() async throws {
        transport.on("getTodayWorkout") { _ in throw URLError(.notConnectedToInternet) }
        let s = store(cache: ServerCache(directory: directory()))
        await s.load()

        // Nothing to show and it says so — no plan, no invented session, no zeroes.
        #expect(s.today == nil)
        #expect(s.problem == .offline)
    }

    @Test func offlineFallsBackToTheCachedPlanWithItsAge() async throws {
        let dir = directory()
        let morning = Date(timeIntervalSince1970: 1_800_000_000)
        transport.on("getTodayWorkout", 200, todayJSON)
        await store(cache: ServerCache(directory: dir, clock: { morning }), at: morning).load()

        // Later the same day, with no network: the morning's plan, labelled with its age.
        let evening = morning.addingTimeInterval(8 * 3600)
        transport.on("getTodayWorkout") { _ in throw URLError(.notConnectedToInternet) }
        let s = store(cache: ServerCache(directory: dir, clock: { evening }), at: evening)
        await s.load()

        #expect(s.today?.value.title == "Pull Day")
        #expect(s.problem == nil)
        #expect(s.ageText == "8 órás terv")
    }

    @Test func staleCacheProducesALoudAgeString() {
        #expect(EdzesStore.ageText(2 * 86_400) == "2 napos terv")
        #expect(EdzesStore.ageText(5 * 3600) == "5 órás terv")
        // A fresh read is not news: under a quarter of an hour the room says nothing about age.
        #expect(EdzesStore.ageText(300) == nil)
        #expect(EdzesStore.ageText(nil) == nil)
    }

    @Test func aRefusalIsNotAnOldAnswer() async throws {
        let dir = directory()
        let morning = Date(timeIntervalSince1970: 1_800_000_000)
        transport.on("getTodayWorkout", 200, todayJSON)
        await store(cache: ServerCache(directory: dir, clock: { morning }), at: morning).load()

        // 401 is not "here is yesterday": it is a problem the room reports, so the cache is not consulted.
        transport.on("getTodayWorkout", 401, "[]")
        let s = store(cache: ServerCache(directory: dir, clock: { morning }), at: morning)
        await s.load()
        #expect(s.problem == .unauthorized)
        #expect(s.today == nil)
    }

    @Test func briefingLinesComeFromTheServerRationale() async throws {
        transport.on("getTodayWorkout", 200, todayJSON)
        let s = store()
        await s.load()

        let e = try #require(s.today?.value.exercises.first)
        #expect(e.rationale == "Múlt hét 8 × 77.5 kg (RIR 3) → +2.5 kg")
        // And with the engine off there is no sentence at all — the room writes none of its own.
        let plain = ScriptedTransport()
        plain.on("getTodayWorkout", 200,
                 #"{"exercises":[{"id":"\#(pressId)","name":"Fekvenyomás","muscle":"chest","warmupSets":2,"workingSets":3,"repMin":6,"repMax":10,"targetRIR":2,"type":"compound"}],"weekDoneDates":[]}"#)
        let bare = EdzesStore(client: TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: plain)),
                              cache: nil)
        await bare.load()
        let p = try #require(bare.today?.value.exercises.first)
        #expect(p.rationale == nil)
        #expect(p.sets.allSatisfy { $0.targetKg == nil })
        #expect(p.anchorKg == nil)
    }

    @Test func noClientMeansNothingToShow() async {
        let s = EdzesStore(client: nil, cache: nil)
        await s.load()
        #expect(s.today == nil)
        #expect(s.problem == .unauthorized)
    }

    /// `yyyy-MM-dd` the way the store keys the cache.
    func dayKey(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .autoupdatingCurrent
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}

/// The weight the way he reads it.
@MainActor
struct EdzesWeightTests {
    @Test func kilosReadTheHungarianWay() {
        #expect(nkKg(80) == "80 kg")
        #expect(nkKg(77.5) == "77,5 kg")
        #expect(nkKg(62.0) == "62 kg")
    }
}

/// What the Ma tab computes from today's plan. These are the numbers the owner reads off the
/// page, so each one has a rule about what it must NOT say when it does not know.
@MainActor
struct EdzesMaLogicTests {
    func exercise(_ name: String, muscle: String, warmups: Int, working: Int, kg: Double? = nil) -> PlannedExercise {
        let sets = (0..<warmups).map { _ in PrescribedSet(kind: .warmup, targetKg: kg.map { $0 * 0.6 }) }
            + (0..<working).map { _ in PrescribedSet(kind: .working, targetKg: kg, targetReps: 8) }
        return PlannedExercise(id: UUID(), name: name, muscle: muscle, type: .compound, sets: sets,
                               warmupCount: warmups, workingCount: working, repMin: 6, repMax: 10,
                               targetRIR: 2, anchorKg: kg)
    }

    @Test func theBodyMapCountsWorkingSetsOnly() {
        // A long warm-up is not load. Counting it would make an easy session look hard.
        let w = TodayWorkout(exercises: [exercise("Fekvenyomás", muscle: "chest", warmups: 5, working: 3),
                                         exercise("Evezés", muscle: "back", warmups: 0, working: 6)])
        let heat = edzesBodyHeat(w)
        let chest = heat.first { $0.muscle == "chest" }
        let back = heat.first { $0.muscle == "back" }
        // The back gets twice the working sets, so it is fully lit and the chest half of it.
        #expect(back?.level == 1)
        #expect(chest?.level == 0.5)
    }

    @Test func aRestDayLightsNothing() {
        #expect(edzesBodyHeat(TodayWorkout()).isEmpty)
        #expect(edzesBodyHeat(nil).isEmpty)
    }

    @Test func theSummaryLeavesOutWhatItDoesNotKnow() {
        // No plan at all: three dashes, not three zeroes.
        let empty = edzesSummary(nil, brief: nil)
        #expect(empty.exercises == nil && empty.workingSets == nil && empty.minutes == nil)

        let w = TodayWorkout(durationEst: 62,
                             exercises: [exercise("Fekvenyomás", muscle: "chest", warmups: 2, working: 3),
                                         exercise("Evezés", muscle: "back", warmups: 2, working: 3)])
        let s = edzesSummary(w, brief: nil)
        #expect(s.exercises == 2)
        #expect(s.workingSets == 6)      // the warmups are not sets he has to do heavy
        #expect(s.minutes == 62)
    }

    @Test func theTimelineMarksTheWeekHeIsInAndDrawsTheDeloadApart() {
        let block = BlockPlan(id: UUID(), title: "Ősz", shortTitle: "Ősz", status: "active",
                              startDate: "2026-11-01", endDate: "2026-12-27", weeks: 8, currentWeek: 3,
                              split: "5 napos", style: "hypertrophy",
                              phaseCurve: [.mev, .mav, .mav, .mrv, .deload, .mav, .mrv, .mrv])
        let weeks = edzesTimeline(block)
        #expect(weeks.count == 8)
        #expect(weeks.filter { $0.state == .current }.map(\.week) == [3])
        #expect(weeks.prefix(2).allSatisfy { $0.state == .past })
        #expect(weeks.suffix(5).allSatisfy { $0.state == .future })
        // The easy week is marked as itself — drawn apart so a dip never reads as a week missed.
        let deload = weeks.first { $0.isDeload }
        #expect(deload?.week == 5)
        #expect(deload?.phase == "Pihenőhét")
        // And it really is the lightest week on the row.
        #expect(deload?.load == weeks.map(\.load).min())
    }

    @Test func noBlockMeansNoTimeline() {
        #expect(edzesTimeline(nil).isEmpty)
    }

    @Test func muscleNamesAreTheOnesHeUses() {
        // The shared group names (mezo-r36n9.127), lower-case for running text.
        #expect(muscleName("chest") == "mell")
        #expect(muscleName("chest-upper") == "mell")
        #expect(muscleName("ham") == "combhajlító")
        #expect(muscleName("glute") == "far")
        #expect(muscleName("traps") == "hát")
        #expect(muscleName("core") == "törzs")
        #expect(muscleName("arms") == "kar")
        // An unknown key is passed through rather than renamed into something invented.
        #expect(muscleName("tibialis") == "tibialis")
    }
}

/// The reasoned swap's store side (mezo-r36n9.66): the gym is never overwritten blind, a refusal is taken back.
@MainActor
struct EdzesSwapTests {
    let transport = ScriptedTransport()

    func store(folder: URL? = nil) -> EdzesStore {
        EdzesStore(client: TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)),
                   cache: nil, folder: folder)
    }

    /// The server's gym profile, changed by its own PUTs and — in a test — by „another device".
    final class ServerGym: @unchecked Sendable {
        private let lock = NSLock()
        private var off: [String]
        private var puts = 0
        /// The 1-based PUT numbers the server refuses.
        let refuse: Set<Int>
        /// Refuses every PUT whose body names this kind — keyed by content, not by arrival order, so two racing
        /// taps get the same answer whichever reaches the server first (mezo-r36n9.128).
        let refuseNaming: String?
        init(off: [String], refuse: Set<Int> = [], refuseNaming: String? = nil) {
            self.off = off; self.refuse = refuse; self.refuseNaming = refuseNaming
        }
        var json: String { lock.withLock { Self.render(off) } }
        func elsewhere(_ kinds: [String]) { lock.withLock { off = kinds } }
        func put(_ body: String) -> (Int, String) {
            lock.withLock {
                puts += 1
                if refuse.contains(puts) { return (400, "") }
                if let refuseNaming, body.contains("\"\(refuseNaming)\"") { return (400, "") }
                let data = Data(body.utf8)
                let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
                off = obj?["offKinds"] as? [String] ?? []
                return (200, Self.render(off))
            }
        }
        static func render(_ off: [String]) -> String {
            #"{"offKinds":[\#(off.sorted().map { "\"\($0)\"" }.joined(separator: ","))],"missingExerciseIds":[]}"#
        }
    }

    func serve(_ server: ServerGym) {
        transport.on("getGymProfile") { _ in (200, server.json) }
        transport.on("putGymProfile") { body in server.put(body) }
    }

    @Test func everyWriteReReadsTheProfileSoAnotherDevicesEditSurvives() async {
        let server = ServerGym(off: ["barbell"])
        serve(server)
        let s = store()
        await s.loadGym()
        // Switched off on another device (or in an earlier run) after this store read the profile.
        server.elsewhere(["barbell", "smith"])
        #expect(await s.markMissing(.kind(.cable)) == nil)
        #expect(s.gym.offKinds == ["barbell", "cable", "smith"])
        #expect(transport.count("getGymProfile") == 2)
    }

    @Test func overlappingSavesLeaveTheStoreAsTheServerHasIt() async {
        // Tap A's PUT is refused, tap B's goes through: the store must end on the server's truth, not on a
        // snapshot from before A. The two taps race, so the refusal follows A's content (cable), not "the first
        // PUT" — whichever order they land in, A is refused and B stands (mezo-r36n9.128).
        // Raced 20 times, so either arrival order is exercised in one run.
        for _ in 0..<20 {
            let server = ServerGym(off: [], refuseNaming: "cable")
            serve(server)
            let s = store()
            async let a = s.markMissing(.kind(.cable))
            async let b = s.markMissing(.kind(.dumbbell))
            let (ra, rb) = await (a, b)
            #expect(ra != nil)
            #expect(rb == nil)
            #expect(s.gym.offKinds == ["dumbbell"])
            #expect(server.json.contains("dumbbell") && !server.json.contains("cable"))
        }
    }

    @Test func aRefusedUndoSaysSo() async {
        let server = ServerGym(off: ["cable"], refuse: [1])
        serve(server)
        let s = store()
        #expect(await s.undoMissing(.kind(.cable)) != nil)
        #expect(s.gym.offKinds == ["cable"])
    }

    @Test func nemEsikJolSurvivesARelaunch() async throws {
        let folder = URL.temporaryDirectory.appendingPathComponent("swap-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let session = "c1c2c3d4-0001-4a2b-9c3d-111122223333", row = "c1c2c3d4-0002-4a2b-9c3d-111122223333"
        transport.on("getTodayWorkout", 200, #"{"templateSessionId":"\#(session)","dayLabel":"Hét","title":"Pull","durationEst":40,"exercises":[{"id":"\#(row)","name":"Barbell Row","muscle":"back-mid","warmupSets":0,"workingSets":2,"repMin":8,"repMax":10,"targetRIR":2,"type":"compound"}],"weekDoneDates":[]}"#)
        transport.on("startWorkout", 201, #"{"id":"c1c2c3d4-0005-4a2b-9c3d-111122223333","templateSessionId":"\#(session)","date":"2026-11-19","status":"active","sets":[]}"#)
        transport.on("markExerciseDiscomfort", 204)
        transport.on("clearExerciseDiscomfort", 204)
        let first = store(folder: folder)
        await first.load()
        first.startWorkout(date: "2026-11-19")
        let id = UUID(uuidString: row)!
        #expect(await first.setDiscomfort(true, exerciseId: id))

        // The app relaunches: a new store reads the session file and the chip is still lit — and can be cleared.
        let second = store(folder: folder)
        #expect(second.discomforts == [id])
        await second.load()
        #expect(await second.setDiscomfort(false, exerciseId: id))
        #expect(store(folder: folder).discomforts.isEmpty)
    }

    @Test func noEquipmentNeverWritesOverAProfileItCouldNotRead() async {
        // The save replaces the whole profile: with the read failing, writing would wipe what he set elsewhere.
        transport.on("getGymProfile") { _ in throw URLError(.notConnectedToInternet) }
        transport.on("putGymProfile", 200, #"{"offKinds":["cable"],"missingExerciseIds":[]}"#)
        let s = store()
        let problem = await s.markMissing(.kind(.cable))
        #expect(problem != nil)
        #expect(transport.count("putGymProfile") == 0)
        #expect(s.gym == GymProfile())
    }

    @Test func noEquipmentKeepsWhatWasThereAndAddsTheKind() async {
        transport.on("getGymProfile", 200, #"{"offKinds":["barbell"],"missingExerciseIds":[]}"#)
        transport.on("putGymProfile") { body in (200, body) }
        let s = store()
        #expect(await s.markMissing(.kind(.cable)) == nil)
        #expect(s.gym.offKinds == ["barbell", "cable"])
        #expect(await s.undoMissing(.kind(.cable)) == nil)
        #expect(s.gym.offKinds == ["barbell"])
    }

    @Test func aRefusedSaveTakesTheChangeBack() async {
        transport.on("getGymProfile", 200, #"{"offKinds":[],"missingExerciseIds":[]}"#)
        transport.on("putGymProfile", 400)
        let s = store()
        #expect(await s.markMissing(.kind(.dumbbell)) != nil)
        #expect(s.gym == GymProfile())
    }

    @Test func theAskIsAQuestionNotASave() async {
        let s = store()
        #expect(await s.markMissing(.ask([.dumbbell, .bench])) == nil)
        #expect(transport.count("putGymProfile") == 0)
    }

    @Test func withoutARunningWorkoutThereIsNothingToSuggestOrRecord() async {
        let s = store()
        #expect(await s.substitutes(for: UUID()) == nil)
        #expect(await s.setDiscomfort(true, exerciseId: UUID()) == false)
        #expect(s.discomforts.isEmpty)
    }

    @Test func aBodyweightTopSetNeverReadsAsZeroKilos() {
        #expect(SwapSheet.lastText(kg: nil, reps: 12) == "12 ismétlés")
        #expect(SwapSheet.lastText(kg: 57.5, reps: 10) == "57,5 kg × 10")
        #expect(SwapSheet.typeName(.isolation) == "izolált")
    }
}

// MARK: - „Másik napot csinálok ma" (mezo-r36n9.163)

extension EdzesStoreTests {
    var tuesdayId: String { "c1c2c3d4-0009-4a2b-9c3d-111122223333" }
    var tuesdayJSON: String {
        #"{"templateSessionId":"\#(tuesdayId)","dayLabel":"Kedd","title":"Pull","exercises":[],"weekDoneDates":[]}"#
    }

    @Test func pickingAnotherDayLoadsThatDaysPlanAndKeepsItOnReload() async throws {
        let cache = ServerCache(directory: directory())
        transport.on("getTodayWorkout") { _ in (200, tuesdayJSON) }
        let s = store(cache: cache)
        let message = await s.pick(UUID(uuidString: tuesdayId))
        #expect(message == nil)
        #expect(s.pickedDay == UUID(uuidString: tuesdayId))
        #expect(s.today?.value.title == "Pull")
        await s.load(force: true)
        #expect(transport.pathsOf("getTodayWorkout").allSatisfy { $0.contains("templateSessionId=\(tuesdayId)") })
        // Another day's plan is not today's: the offline fallback must never show it as today's.
        let hit = await cache.get(TodayWorkout.self, endpoint: "train/today", date: dayKey(Date()), maxAge: 3600)
        #expect(hit == nil)
    }

    @Test func pickingOfflineSaysSoAndKeepsTodaysPlan() async throws {
        transport.on("getTodayWorkout", 200, todayJSON)
        let s = store()
        await s.load()
        transport.on("getTodayWorkout") { _ in throw URLError(.notConnectedToInternet) }
        let message = await s.pick(UUID(uuidString: tuesdayId))
        #expect(message == "Most nem érem el a szervert, a másik nap tervét nem tudom letölteni.")
        #expect(s.pickedDay == nil)
        #expect(s.today?.value.title == "Pull Day")
    }

    @Test func backToTodayDropsThePick() async throws {
        transport.on("getTodayWorkout") { _ in (200, tuesdayJSON) }
        let s = store()
        _ = await s.pick(UUID(uuidString: tuesdayId))
        transport.on("getTodayWorkout", 200, todayJSON)
        _ = await s.pick(nil)
        #expect(s.pickedDay == nil)
        #expect(s.today?.value.title == "Pull Day")
        #expect(transport.pathsOf("getTodayWorkout").last?.contains("templateSessionId") == false)
    }

    @Test func theWeeksDoneDaysAndTodaysDoneTitleComeFromTheHistory() async throws {
        let today = dayKey(Date())
        transport.on("listWorkouts", 200,
                     #"[{"id":"\#(UUID())","templateSessionId":"\#(tuesdayId)","date":"\#(today)","status":"completed","origin":"meso","title":"Pull"}]"#)
        let s = store()
        await s.loadWeek(queued: [])
        #expect(s.weekDone == [UUID(uuidString: tuesdayId)!])
        #expect(s.doneTodayTitle == "Pull")
    }
}

// MARK: - Review fixes (mezo-r36n9.163)

extension EdzesStoreTests {
    @Test func todaysDayDoneEarlierThisWeekIsDone() async throws {
        // He did Wednesday's day on Monday from the sheet: Wednesday's own plan comes back with that completion.
        let monday = NaploDays.week(containing: dayKey(Date())).from
        let done = #"{"id":"\#(UUID())","templateSessionId":"\#(sessionId)","date":"\#(monday)","status":"completed","sets":[]}"#
        transport.on("getTodayWorkout", 200,
                     #"{"templateSessionId":"\#(sessionId)","dayLabel":"Hét","title":"Pull Day","exercises":[],"completedWorkout":\#(done),"weekDoneDates":["\#(monday)"]}"#)
        let s = store()
        await s.load()
        #expect(s.doneToday)
        #expect(!s.trainedToday || dayKey(Date()) == monday)
    }

    @Test func aRunningOtherDaysWorkoutIsReloadedAsThatDayAfterTheRoomIsRebuilt() async throws {
        let folder = directory()
        transport.on("getTodayWorkout") { _ in (200, tuesdayJSON) }
        let first = EdzesStore(client: TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)),
                               cache: nil, folder: folder)
        _ = await first.pick(UUID(uuidString: tuesdayId))
        _ = first.startWorkout(date: dayKey(Date()))
        // The room closes and opens again: a fresh store, no pick in memory, the session on file.
        let again = EdzesStore(client: TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)),
                               cache: nil, folder: folder)
        await again.load()
        #expect(transport.pathsOf("getTodayWorkout").last?.contains("templateSessionId=\(tuesdayId)") == true)
        #expect(again.today?.value.title == "Pull")
    }

    @Test func anOtherDaysPlanIsCachedUnderItsOwnKeyForTheOfflineGym() async throws {
        let cache = ServerCache(directory: directory())
        let folder = directory()
        transport.on("getTodayWorkout") { _ in (200, tuesdayJSON) }
        let first = EdzesStore(client: TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)),
                               cache: cache, folder: folder)
        _ = await first.pick(UUID(uuidString: tuesdayId))
        _ = first.startWorkout(date: dayKey(Date()))
        transport.on("getTodayWorkout") { _ in throw URLError(.notConnectedToInternet) }
        let again = EdzesStore(client: TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)),
                               cache: cache, folder: folder)
        await again.load()
        #expect(again.today?.value.title == "Pull")
        #expect(await cache.get(TodayWorkout.self, endpoint: "train/today", date: dayKey(Date()), maxAge: 3600) == nil)
    }
}
