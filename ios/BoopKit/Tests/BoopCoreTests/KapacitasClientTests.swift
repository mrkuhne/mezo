import Foundation
import Testing
@testable import BoopCore

/// B7 K2 Task 9 (`mezo-r36n9.17`): the event label goes out as a PUT with the key in the body (device ids carry '/').
struct KapacitasClientTests {
    static func client(_ stub: StubTransport) -> KapacitasClient {
        KapacitasClient(raw: RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" }))
    }

    @Test func feedbackSendsEffect() async throws {
        let stub = StubTransport()
        stub.on("putCapacityEventFeedback", .status(204))
        try await Self.client(stub).feedback(eventKey: "cal-ABC/123:x", effect: "feeds")
        #expect(stub.sent.count == 1)
        let s = stub.sent[0]
        #expect(s.path == "/api/capacity/event-feedback")
        #expect(s.auth == "Bearer tok")
        #expect(s.body == #"{"effect":"feeds","eventKey":"cal-ABC\/123:x"}"#)
    }

    @Test func feedbackEnumAndRefusal() async {
        let stub = StubTransport()
        stub.on("putCapacityEventFeedback", .json(400, #"{"messages":[{"code":"VALIDATION_INVALID_VALUE"}]}"#))
        await #expect(throws: PlanFetchError.rejected("VALIDATION_INVALID_VALUE")) {
            try await Self.client(stub).feedback(eventKey: "k", effect: KapacitasEffect.drains)
        }
        #expect(stub.sent.first?.body?.contains(#""effect":"drains""#) == true)
        #expect(KapacitasEffect.allCases.map(\.label) == ["Merít", "Semleges", "Feltölt"])
    }

    static let seasonJSON = #"""
    {"weeks":[{"week":1,"load":4.2,"recovery":5.0,"planned":false,"over":false,"trainingOnly":false},
              {"week":7,"load":6.1,"recovery":5.2,"planned":false,"over":true,"trainingOnly":false},
              {"week":8,"load":3.0,"planned":true,"over":false,"trainingOnly":true}],
     "nowWeek":7,"stats":{"overloadedDays4w":2,"moves":11,"movesGood":8},"headline":"A terhed gyorsabban nő."}
    """#

    @Test func seasonDecodesTrainingOnly() async throws {
        let stub = StubTransport()
        stub.on("getCapacitySeason", .json(200, Self.seasonJSON))
        let s = try await Self.client(stub).season()
        #expect(stub.sent[0].path == "/api/capacity/season")
        #expect(s.nowWeek == 7 && s.weeks.count == 3 && s.stats.movesGood == 8)
        #expect(s.weeks[1].over && s.weeks[1].recovery == 5.2)
        #expect(s.weeks[2].trainingOnly && s.weeks[2].planned && s.weeks[2].recovery == nil)
        #expect(s.headline == "A terhed gyorsabban nő.")
    }

    @Test func seasonWithoutActiveSeasonIsNotFound() async {
        let stub = StubTransport()
        stub.on("getCapacitySeason", .status(404))
        await #expect(throws: PlanFetchError.notFound) { _ = try await Self.client(stub).season() }
    }

    @MainActor @Test func storeFallsBackToCacheAndHidesOn404() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("kap-cache-\(UUID().uuidString)")
        final class Clock: @unchecked Sendable { var now = Date(timeIntervalSince1970: 1_795_089_600) }
        let clock = Clock()
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let online = StubTransport()
        online.on("getCapacitySeason", .json(200, Self.seasonJSON))
        let first = KapacitasStore(client: Self.client(online), cache: cache)
        await first.load()
        #expect(first.season?.nowWeek == 7 && !first.offline && first.ageText == nil)

        clock.now = clock.now.addingTimeInterval(5 * 3600)
        let off = StubTransport()
        off.on("getCapacitySeason", .fail(URLError(.notConnectedToInternet)))
        let later = KapacitasStore(client: Self.client(off), cache: cache)
        await later.load()
        #expect(later.season?.stats.moves == 11 && later.offline && later.ageText == "5 órás adat")

        let none = StubTransport()
        none.on("getCapacitySeason", .status(404))
        let empty = KapacitasStore(client: Self.client(none), cache: cache)
        await empty.load()
        #expect(empty.season == nil && !empty.offline)

        let noCache = StubTransport()
        noCache.on("getCapacitySeason", .fail(URLError(.notConnectedToInternet)))
        let bare = KapacitasStore(client: Self.client(noCache), cache: nil)
        await bare.load()
        #expect(bare.season == nil)
    }
}
