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
