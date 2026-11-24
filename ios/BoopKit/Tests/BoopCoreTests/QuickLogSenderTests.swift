import Foundation
import Testing
@testable import BoopCore

/// The two new outbox kinds of the quick log (`mezo-r36n9.154`): a weight and a manual night go out as the server's
/// own requests, stand alone in the queue, and a refused one does not hold anything back.
final class QuickLogSenderTests {
    let stub = StubTransport()
    let dir = temporaryDirectory()
    deinit { try? FileManager.default.removeItem(at: dir) }

    var ritmus: RitmusClient {
        RitmusClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), audioDirectory: dir)
    }

    func body(op: String) throws -> [String: Any] {
        let sent = stub.sent.filter { $0.op == op }
        let text = try #require(sent.last?.body)
        return try #require(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
    }

    @Test func weightGoesOutAsTheWeightLog() async throws {
        stub.on("logWeight", .json(201, #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","date":"2026-11-24","weightKg":81.4}"#))
        let item = OutboxItem(kind: .weightLog, date: "2026-11-24", capturedAt: Date(),
                              payload: RitmusPayload.encode(WeightLogPayload(date: "2026-11-24", weightKg: 81.4)))
        #expect(await ritmus.send(item) == .sent(nil))
        let b = try body(op: "logWeight")
        #expect(b["date"] as? String == "2026-11-24")
        #expect(b["weightKg"] as? Double == 81.4)
    }

    @Test func nightGoesOutAsTheSleepLog() async throws {
        stub.on("logSleep", .json(201, #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","date":"2026-11-24","durationH":7.58}"#))
        let payload = SleepLogPayload(date: "2026-11-24", bedtime: "23:10", wakeup: "06:45", durationH: 7.58, quality: 7)
        let item = OutboxItem(kind: .sleepLog, date: "2026-11-24", capturedAt: Date(), payload: RitmusPayload.encode(payload))
        #expect(await ritmus.send(item) == .sent(nil))
        let b = try body(op: "logSleep")
        #expect(b["bedtime"] as? String == "23:10" && b["wakeup"] as? String == "06:45")
        #expect(b["durationH"] as? Double == 7.58 && b["quality"] as? Int == 7)
    }

    @Test func refusedWeightIsRefusedNotRetried() async throws {
        stub.on("logWeight", .json(400, #"[{"message":"Ellenőrizd a súlyt."}]"#))
        let item = OutboxItem(kind: .weightLog, date: "2026-11-24", capturedAt: Date(),
                              payload: RitmusPayload.encode(WeightLogPayload(date: "2026-11-24", weightKg: 0)))
        let result = await ritmus.send(item)
        if case .failed = result {} else { Issue.record("expected a refusal, got \(result)") }
    }

    @Test func eachQuickWriteStandsAloneInTheQueue() {
        let w = OutboxItem(kind: .weightLog, date: "2026-11-24", capturedAt: Date(), payload: Data())
        let s = OutboxItem(kind: .sleepLog, date: "2026-11-24", capturedAt: Date(), payload: Data())
        #expect(Outbox.group(of: w).key == "weight|\(w.id.uuidString)" && !Outbox.group(of: w).waits)
        #expect(Outbox.group(of: s).key == "sleep|\(s.id.uuidString)" && !Outbox.group(of: s).waits)
    }
}
