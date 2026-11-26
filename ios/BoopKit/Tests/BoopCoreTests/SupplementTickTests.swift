import Foundation
import Testing
@testable import BoopCore

/// The one-way supplement tick (`mezo-r36n9.172`): the derived key, the per-user taken file, the sender.
final class SupplementTickTests {
    let stub = StubTransport()
    let dir = temporaryDirectory()
    deinit { try? FileManager.default.removeItem(at: dir) }
    var file: URL { dir.appendingPathComponent("supplements-taken.json") }

    private let pantry = "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c02"
    private let intake = "22249a7e-d8f9-44c4-9a7e-93b03cd0c12e"

    private func ritmus(taken: SupplementTakenStore?) -> RitmusClient {
        RitmusClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), audioDirectory: dir, supplementTaken: taken)
    }

    private func item(day: String = "2026-11-13", daypart: String = "morning") -> OutboxItem {
        OutboxItem(kind: .supplementTick, date: day, capturedAt: Date(timeIntervalSince1970: 1_795_089_600),
                   payload: RitmusPayload.encode(SupplementTickPayload(day: day, daypart: daypart)))
    }

    private func scriptProtocol() {
        stub.on("getProtocol", .json(200, #"{"active":{"id":"cc7f5b29-83a4-4f7f-8b29-4e6ebd8b7c08","version":1,"builtAt":"2026-11-01T06:00:00Z","status":"active","items":[{"id":"dd805c3a-94b5-4080-9c3a-5f7fce9c8d09","pantryItemId":"\#(pantry)","slotKey":"morning","pinned":false,"placementSource":"rule"}]},"history":[]}"#))
    }

    @Test func refIsStableAcrossCalls() {
        // SHA-256 of "etel-supplements|2026-11-13|morning", first 16 bytes — what the old app function returned.
        #expect(supplementRef(day: "2026-11-13", daypart: "morning") == UUID(uuidString: "7D9D2476-E11C-CF53-541B-AC4DE6EE5D3E"))
        #expect(supplementRef(day: "2026-11-13", daypart: "morning") == supplementRef(day: "2026-11-13", daypart: "morning"))
        #expect(supplementRef(day: "2026-11-13", daypart: "morning") != supplementRef(day: "2026-11-13", daypart: "evening"))
        #expect(supplementRef(day: "2026-11-13", daypart: "morning") != supplementRef(day: "2026-11-14", daypart: "morning"))
    }

    @Test func queuedTickIsTakenAtOnce() {
        let store = SupplementTakenStore(fileURL: file)
        store.markTaken(day: "2026-11-13", daypart: "morning", ids: nil)
        #expect(store.taken(day: "2026-11-13") == ["morning": []])
        // and a second instance on the same file (the next launch) sees it
        #expect(SupplementTakenStore(fileURL: file).taken(day: "2026-11-13") == ["morning": []])
    }

    @Test func markTakenNeverUntakes() {
        let store = SupplementTakenStore(fileURL: file)
        let id = UUID(uuidString: intake)!
        store.markTaken(day: "2026-11-13", daypart: "morning", ids: [id])
        store.markTaken(day: "2026-11-13", daypart: "morning", ids: nil)       // a later queued tick keeps the known ids
        #expect(store.taken(day: "2026-11-13")["morning"] == [id])
        store.undo(day: "2026-11-13", daypart: "morning")                         // only the explicit undo removes
        #expect(store.taken(day: "2026-11-13").isEmpty)
    }

    @Test func daysOlderThanFourteenArePrunedOnWrite() {
        let store = SupplementTakenStore(fileURL: file)
        store.markTaken(day: "2026-11-01", daypart: "morning", ids: nil)
        store.markTaken(day: "2026-11-20", daypart: "morning", ids: nil)
        #expect(store.taken(day: "2026-11-01").isEmpty)
        #expect(store.taken(day: "2026-11-20") == ["morning": []])
    }

    @Test func senderSendsWithTheDerivedRef() async throws {
        scriptProtocol()
        stub.on("logIntake", .json(201, #"{"id":"\#(intake)","pantryItemId":"\#(pantry)","takenAt":"2026-11-13T07:30:00Z","takenDate":"2026-11-13"}"#))
        let store = SupplementTakenStore(fileURL: file)
        #expect(await ritmus(taken: store).send(item()) == .sent(nil))
        let body = try #require(stub.sent.first { $0.op == "logIntake" }?.body)
        let sent = try #require(JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any])
        let expected = FoodClient.derivedRef(supplementRef(day: "2026-11-13", daypart: "morning"), "dd805c3a-94b5-4080-9c3a-5f7fce9c8d09")
        #expect((sent["clientRef"] as? String)?.lowercased() == expected.uuidString.lowercased())
        // the delivered ids reach the taken file, for the room's undo
        #expect(store.taken(day: "2026-11-13")["morning"] == [UUID(uuidString: intake)!])
    }

    @Test func offlineStaysQueued() async {
        stub.on("getProtocol", .fail(URLError(.notConnectedToInternet)))
        let store = SupplementTakenStore(fileURL: file)
        store.markTaken(day: "2026-11-13", daypart: "morning", ids: nil)
        #expect(await ritmus(taken: store).send(item()) == .offline)
        #expect(store.taken(day: "2026-11-13") == ["morning": []])               // still taken, ids still unknown
    }

    @Test func eachTickStandsInItsDaypartChain() {
        let a = item(), b = item(daypart: "evening")
        #expect(Outbox.group(of: a).key == "supplement|2026-11-13|morning" && !Outbox.group(of: a).waits)
        #expect(Outbox.group(of: b).key == "supplement|2026-11-13|evening")
    }

    @Test func migrationReadsTheOldKeyOnce() throws {
        let defaults = try #require(UserDefaults(suiteName: "supplement-tick-\(UUID().uuidString)"))
        let id = UUID(uuidString: intake)!
        defaults.set(["morning": [id.uuidString], "evening": []], forKey: "etel.takenIds.2026-11-13")
        let store = SupplementTakenStore(fileURL: file)
        store.migrateLegacy(day: "2026-11-13", defaults: defaults)
        #expect(store.taken(day: "2026-11-13") == ["morning": [id], "evening": []])
        #expect(defaults.object(forKey: "etel.takenIds.2026-11-13") == nil)       // removed: never read twice
        store.undo(day: "2026-11-13", daypart: "evening")
        store.migrateLegacy(day: "2026-11-13", defaults: defaults)                // nothing left to read
        #expect(store.taken(day: "2026-11-13") == ["morning": [id]])
    }
}
