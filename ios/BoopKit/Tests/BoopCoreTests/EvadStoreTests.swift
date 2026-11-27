import Foundation
import Testing
@testable import BoopCore

@Suite("Évad — the store")
@MainActor
struct EvadStoreTests {
    final class Clock: @unchecked Sendable { var now = Date(timeIntervalSince1970: 1_795_089_600) }

    static func tempDir() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("evad-cache-\(UUID().uuidString)")
    }

    @Test func overviewFallsBackToCache() async throws {
        let dir = Self.tempDir()
        let clock = Clock()
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let online = StubTransport()
        online.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        let first = EvadStore(client: EvadClient(raw: EvadClientTests.raw(online)), cache: cache)
        await first.load()
        #expect(first.overview?.head.week == 7 && !first.offline && first.overviewAge == nil)

        clock.now = clock.now.addingTimeInterval(5 * 3600)
        let offline = StubTransport()
        offline.on("getSeasonOverview", .fail(URLError(.notConnectedToInternet)))
        let later = EvadStore(client: EvadClient(raw: EvadClientTests.raw(offline)), cache: cache)
        await later.load()
        #expect(later.overview?.head.title == "Őszi fogyás")
        #expect(later.offline && later.problem == nil)
        #expect(later.overviewAge.map { abs($0 - 5 * 3600) < 1 } == true)
        #expect(later.ageText == "5 órás adat")
    }

    @Test func offlineWithoutCacheSaysSo() async {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .fail(URLError(.notConnectedToInternet)))
        let store = EvadStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await store.load()
        #expect(store.overview == nil && store.problem == .offline && !store.empty)
    }

    @Test func noSeasonIsTheEmptyStateNotAFailure() async {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(404, #"{"messages":[{"code":"NOT_FOUND"}]}"#))
        let store = EvadStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await store.load()
        #expect(store.empty && store.problem == nil && store.overview == nil)
    }

    @Test func startCreatesActivatesAndReReads() async throws {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(404, "{}"))
        stub.on("createSeason", .json(201, EvadFixtures.seasonJSON))
        stub.on("activateSeason", .json(200, EvadFixtures.seasonJSON))
        stub.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        let store = EvadStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await store.load()
        try await store.start(EvadClientTests.draft)
        #expect(!store.empty && store.overview != nil)
        #expect(stub.ops == ["getSeasonOverview", "createSeason", "activateSeason", "getSeasonOverview"])
    }

    @Test func startRetryAfterActivateFailureDoesNotCreateTwice() async throws {
        let stub = StubTransport()
        stub.on("createSeason", .json(201, EvadFixtures.seasonJSON))
        stub.on("activateSeason", .fail(URLError(.notConnectedToInternet)))
        stub.on("activateSeason", .json(200, EvadFixtures.seasonJSON))
        stub.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        let store = EvadStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await #expect(throws: PlanFetchError.offline) { try await store.start(EvadClientTests.draft) }
        try await store.start(EvadClientTests.draft)
        #expect(stub.ops == ["createSeason", "activateSeason", "activateSeason", "getSeasonOverview"],
                "the retry activates the season already created, it never creates a second one")
        #expect(stub.sent[2].path == "/api/seasons/s1/activate")
    }
}

/// This week's read behind the Évad orb (`mezo-r36n9.196`).
@Suite("Évad — this week")
@MainActor
struct EvadStoreWeekTests {
    static let weekJSON = #"""
    {"days":[{"date":"2026-11-23","judged":true,"excused":false,"excuse":null,"foodInBand":true,"sessionPlanned":true,"sessionDone":true,"sleepOk":true}],
     "summary":{"foodInBand":1,"foodJudged":2,"sessionsDone":1,"sessionsPlanned":1,"nightsOk":1,"nightsJudged":1,"excusedDays":0}}
    """#
    static let thursday = EvadWeekTests.date("2026-11-26T10:00")

    @Test func weekReadIsCachedAndServedOffline() async {
        let cache = ServerCache(directory: EvadStoreTests.tempDir())
        let online = StubTransport()
        online.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        online.on("getAdherence", .json(200, Self.weekJSON))
        let first = EvadStore(client: EvadClient(raw: EvadClientTests.raw(online)), cache: cache)
        await first.load()
        await first.loadWeek(now: Self.thursday, calendar: EvadWeekTests.budapest)
        #expect(online.sent.last?.path == "/api/seasons/adherence?from=2026-11-23&to=2026-11-25")
        #expect(first.weekScore == 83 && first.weekAge == nil)   // (0.5 + 1 + 1) / 3

        let offline = StubTransport()
        offline.on("getAdherence", .fail(URLError(.notConnectedToInternet)))
        let later = EvadStore(client: EvadClient(raw: EvadClientTests.raw(offline)), cache: cache)
        await later.loadWeek(now: Self.thursday, calendar: EvadWeekTests.budapest)
        #expect(later.week?.summary.foodJudged == 2 && later.weekAge != nil)
    }

    @Test func weekScoreIsNilWithoutSeason() async {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(404, "{}"))
        stub.on("getAdherence", .json(200, Self.weekJSON))
        let store = EvadStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await store.load()
        await store.loadWeek(now: Self.thursday, calendar: EvadWeekTests.budapest)
        #expect(store.week != nil && store.weekScore == nil)
    }

    /// A new week whose read fails (offline with no cache, or a server fault) never shows last week's number as this week's.
    @Test func newWeekFailureDropsLastWeek() async {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        stub.on("getAdherence", .json(200, Self.weekJSON))
        let store = EvadStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await store.load()
        await store.loadWeek(now: Self.thursday, calendar: EvadWeekTests.budapest)
        #expect(store.weekScore == 83)
        stub.on("getAdherence", .fail(URLError(.notConnectedToInternet)))
        await store.loadWeek(now: EvadWeekTests.date("2026-12-01T10:00"), calendar: EvadWeekTests.budapest)
        #expect(store.week == nil && store.weekScore == nil)
        // the same week failing keeps what is on screen
        stub.on("getAdherence", .json(200, Self.weekJSON))
        await store.loadWeek(now: EvadWeekTests.date("2026-12-02T10:00"), calendar: EvadWeekTests.budapest)
        stub.on("getAdherence", .json(500, "{}"))
        await store.loadWeek(now: EvadWeekTests.date("2026-12-03T10:00"), calendar: EvadWeekTests.budapest)
        #expect(store.weekScore == 83)
    }

    @Test func mondayMakesNoCall() async {
        let stub = StubTransport()
        let store = EvadStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await store.loadWeek(now: EvadWeekTests.date("2026-11-23T09:00"), calendar: EvadWeekTests.budapest)
        #expect(stub.sent.isEmpty && store.week == nil && store.weekScore == nil)
    }
}
