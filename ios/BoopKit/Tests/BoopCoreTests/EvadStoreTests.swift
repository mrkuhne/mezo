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
}
