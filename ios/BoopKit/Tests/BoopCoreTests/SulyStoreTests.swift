import Foundation
import Testing
@testable import BoopCore

/// A Health reader that answers body samples from a script; everything else is empty.
final class StubHealthReader: HealthReader, @unchecked Sendable {
    var samples: [HealthMetric: [HealthSampleValue]] = [:]
    func sleepSamples(from: Date, to: Date) async throws -> [SleepSample] { [] }
    func sleepChanges(anchor: Data?, from: Date) async throws -> HealthChange<SleepSample> { HealthChange(added: [], deletedIds: [], anchor: Data()) }
    func dayTotals(from: Date, to: Date, calendar: Calendar) async throws -> [DayTotals] { [] }
    func workoutChanges(anchor: Data?, from: Date) async throws -> HealthChange<WorkoutSample> { HealthChange(added: [], deletedIds: [], anchor: Data()) }
    func sampleChanges(_ metric: HealthMetric, anchor: Data?, from: Date) async throws -> HealthChange<HealthSampleValue> { HealthChange(added: [], deletedIds: [], anchor: Data()) }
    func heartRateBuckets(from: Date, to: Date) async throws -> [HeartRateBucket] { [] }
    func heartRate(during intervals: [DateInterval]) async throws -> HeartRateStats? { nil }
    func readSamples(_ metric: HealthMetric, from: Date, to: Date) async throws -> [HealthSampleValue] { samples[metric] ?? [] }
}

/// The Súly store (`mezo-r36n9.158`): the season, the trend, the weigh-ins and the body samples as one read.
@Suite("Súly — the store")
@MainActor
struct SulyStoreTests {
    final class Clock: @unchecked Sendable { var now = Date(timeIntervalSince1970: 1_795_089_600) }

    static func tempDir() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("suly-cache-\(UUID().uuidString)")
    }

    static func sample(_ metric: HealthMetric, _ value: Double, daysAgo: Int, now: Date) -> HealthSampleValue {
        let t = now.addingTimeInterval(-Double(daysAgo) * 86_400)
        return HealthSampleValue(uuid: UUID(), metric: metric, start: t, end: t, value: value, sourceName: "Feelfit",
                                 sourceBundle: "com.feelfit", device: nil)
    }

    private func store(_ stub: StubTransport, health: StubHealthReader? = nil, cache: ServerCache? = nil, clock: Clock = Clock()) -> SulyStore {
        let raw = SulyClientTests.raw(stub)
        return SulyStore(evad: EvadClient(raw: raw), client: SulyClient(raw: raw), health: health, cache: cache, clock: { clock.now })
    }

    @Test func scoreComesFromTheTrendAndTheSeason() async throws {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))   // planned −0.4 kg/week, cut
        stub.on("getWeightTrend", .json(200, SulyClientTests.trendJSON))        // last 4 weeks −0.42
        stub.on("listWeightLogs", .json(200, SulyClientTests.logsJSON))
        stub.on("getBiometricProfile", .json(200, #"{"heightCm":180}"#))
        let s = store(stub)
        await s.load()
        #expect(s.snapshot?.season?.head.trajectory == "cut")
        #expect(s.course == .cut)
        // 0.42 / 0.4 = 1.05 → a twentieth faster → 97.5 → 98
        #expect(s.score == 98)
        #expect(s.head.headline == "Pályán vagy a súlycélhoz")
        #expect(s.snapshot?.logs.count == 2 && s.problem == nil && !s.offline)
    }

    @Test func noSeasonIsHonest() async throws {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(404, #"{"messages":[{"code":"NOT_FOUND"}]}"#))
        stub.on("getWeightTrend", .json(200, SulyClientTests.trendJSON))
        stub.on("listWeightLogs", .json(200, "[]"))
        stub.on("getBiometricProfile", .json(200, "{}"))
        let s = store(stub)
        await s.load()
        #expect(s.snapshot?.season == nil && s.snapshot?.trend?.latestTrendKg == 84.6)
        #expect(s.score == nil && s.head.headline == "Nincs évad" && s.problem == nil)
    }

    @Test func insufficientDataIsNil() async throws {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        stub.on("getWeightTrend", .json(200, #"{"ewmaSeries":[],"latestTrendKg":84.6,"last4wRateKgPerWeek":-0.4,"dataSufficiency":"none"}"#))
        stub.on("listWeightLogs", .json(200, "[]"))
        stub.on("getBiometricProfile", .json(200, "{}"))
        let s = store(stub)
        await s.load()
        #expect(s.score == nil)
    }

    @Test func offlineServesTheCache() async throws {
        let dir = Self.tempDir()
        let clock = Clock()
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let online = StubTransport()
        online.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        online.on("getWeightTrend", .json(200, SulyClientTests.trendJSON))
        online.on("listWeightLogs", .json(200, SulyClientTests.logsJSON))
        online.on("getBiometricProfile", .json(200, #"{"heightCm":180}"#))
        let first = store(online, cache: cache, clock: clock)
        await first.load()
        #expect(first.score == 98 && !first.offline && first.age == nil)

        clock.now = clock.now.addingTimeInterval(5 * 3600)
        let offline = StubTransport()
        offline.on("getSeasonOverview", .fail(URLError(.notConnectedToInternet)))
        offline.on("getWeightTrend", .fail(URLError(.notConnectedToInternet)))
        offline.on("listWeightLogs", .fail(URLError(.notConnectedToInternet)))
        offline.on("getBiometricProfile", .fail(URLError(.notConnectedToInternet)))
        let later = store(offline, cache: cache, clock: clock)
        await later.load()
        #expect(later.score == 98 && later.offline && later.problem == nil)
        #expect(later.age.map { abs($0 - 5 * 3600) < 1 } == true)
        #expect(later.ageText == "5 órás adat")
    }

    @Test func offlineWithoutCacheSaysSo() async {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .fail(URLError(.notConnectedToInternet)))
        stub.on("getWeightTrend", .fail(URLError(.notConnectedToInternet)))
        stub.on("listWeightLogs", .fail(URLError(.notConnectedToInternet)))
        stub.on("getBiometricProfile", .fail(URLError(.notConnectedToInternet)))
        let s = store(stub)
        await s.load()
        #expect(s.snapshot == nil && s.problem == .offline)
    }

    @Test func heightComesFromTheProfileAndGivesTheBmi() async throws {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        stub.on("getWeightTrend", .json(200, SulyClientTests.trendJSON))
        stub.on("listWeightLogs", .json(200, "[]"))
        stub.on("getBiometricProfile", .json(200, #"{"heightCm":180}"#))
        let s = store(stub)
        await s.load()
        #expect(s.snapshot?.heightCm == 180)
        #expect(s.bmi == 26.1)   // 84.6 kg trend, 1.80 m
    }

    @Test func aFailedProfileIsJustNoHeight() async throws {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        stub.on("getWeightTrend", .json(200, SulyClientTests.trendJSON))
        stub.on("listWeightLogs", .json(200, "[]"))
        stub.on("getBiometricProfile", .status(500))
        let s = store(stub)
        await s.load()
        #expect(s.snapshot != nil && s.problem == nil && s.snapshot?.heightCm == nil && s.bmi == nil)
    }

    @Test func bodySamplesAreReadFromHealth() async throws {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(404, "{}"))
        stub.on("getWeightTrend", .json(200, SulyClientTests.trendJSON))
        stub.on("listWeightLogs", .json(200, "[]"))
        stub.on("getBiometricProfile", .json(200, "{}"))
        let clock = Clock()
        let health = StubHealthReader()
        health.samples[.bodyFatPct] = [Self.sample(.bodyFatPct, 0.221, daysAgo: 20, now: clock.now),
                                       Self.sample(.bodyFatPct, 0.214, daysAgo: 1, now: clock.now)]
        health.samples[.leanBodyMass] = [Self.sample(.leanBodyMass, 62.8, daysAgo: 1, now: clock.now)]
        let s = store(stub, health: health, clock: clock)
        await s.load()
        // Health reports body fat as a fraction; the store keeps percent.
        #expect(s.snapshot?.fatPct.map(\.value) == [22.1, 21.4])
        #expect(s.snapshot?.leanKg.last?.value == 62.8)
        #expect(s.snapshot?.fatPct.last?.source == "Feelfit")
    }
}
