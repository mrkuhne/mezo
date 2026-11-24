import Foundation
import Testing
@testable import BoopCore

/// The as-planned booking over the wire (`mezo-r36n9.161`): the queued item's id is the server's idempotency key, the
/// typed overrides travel, a 201 is a delivery, and a 409 is a refusal that carries the server's own words.
@MainActor
struct TrainAsPlannedClientTests {
    let stub = StubTransport()
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    func train() -> TrainClient { TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), calendar: cal) }
    var six: Date { cal.date(from: DateComponents(year: 2026, month: 11, day: 23, hour: 18))! }
    func item(_ p: WorkoutAsPlannedPayload) -> OutboxItem {
        OutboxItem(kind: .workoutAsPlanned, date: p.date, capturedAt: p.startedAt, payload: TrainPayloadCodec.encode(p))
    }
    static let instanceJSON = #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","templateSessionId":"0b6f3c1e-2222-4a2b-9c3d-222233334444","date":"2026-11-23","status":"completed","sets":[],"medals":[],"startedAt":"2026-11-23T17:00:00Z","finishedAt":"2026-11-23T17:00:00Z"}"#

    @Test func aBookingIsSentWithItsIdAsClientRef() async throws {
        stub.on("completeWorkoutAsPlanned", .json(201, Self.instanceJSON))
        let exercise = UUID()
        let p = WorkoutAsPlannedPayload(templateSessionId: UUID(), date: "2026-11-23", startedAt: six,
                                        overrides: [.init(exerciseId: exercise, weightKg: 62.5)])
        let queued = item(p)
        let result = await train().send(queued)
        #expect(result == .sent(nil))
        let sent = try #require(stub.sent.first { $0.op == "completeWorkoutAsPlanned" })
        let text = try #require(sent.body)
        let body = try #require(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
        #expect((body["clientRef"] as? String)?.lowercased() == queued.id.uuidString.lowercased())
        #expect(body["date"] as? String == "2026-11-23")
        #expect((body["templateSessionId"] as? String)?.lowercased() == p.templateSessionId.uuidString.lowercased())
        let overrides = try #require(body["overrides"] as? [[String: Any]])
        #expect(overrides.count == 1)
        #expect((overrides[0]["exerciseId"] as? String)?.lowercased() == exercise.uuidString.lowercased())
        #expect(overrides[0]["weightKg"] as? Double == 62.5)
    }

    @Test func aConflictIsARefusalWithTheServersWords() async {
        stub.on("completeWorkoutAsPlanned", .json(409, #"[{"code":"TRAIN_DAY_DONE_THIS_WEEK","level":"ERROR","message":"Ezt az edzésnapot ezen a héten már teljesítetted.","type":"REQUEST"}]"#))
        let p = WorkoutAsPlannedPayload(templateSessionId: UUID(), date: "2026-11-23", startedAt: six, overrides: [])
        let result = await train().send(item(p))
        guard case .failed(let why) = result else { Issue.record("a 409 on the booking is final, not a retry: \(result)"); return }
        #expect(why.contains("héten"))
    }


    /// A template day the active block no longer has (rotated, ended) is a 404: final, and in the owner's words, never
    /// the server's code.
    @Test func aVanishedTemplateDayIsARefusalInTheOwnersWords() async {
        stub.on("completeWorkoutAsPlanned", .json(404, #"[{"code":"TRAIN_NOT_FOUND","level":"ERROR","message":"Not found","type":"REQUEST"}]"#))
        let p = WorkoutAsPlannedPayload(templateSessionId: UUID(), date: "2026-11-23", startedAt: six, overrides: [])
        let result = await train().send(item(p))
        guard case .failed(let why) = result else { Issue.record("a 404 on the booking is final, not a retry: \(result)"); return }
        #expect(why == "Ez a tervnap már nincs a mostani blokkodban.")
    }
}
