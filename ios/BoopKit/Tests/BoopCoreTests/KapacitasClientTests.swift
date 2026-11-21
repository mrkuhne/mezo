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
}
