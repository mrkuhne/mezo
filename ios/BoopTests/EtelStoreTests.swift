import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing
import BoopCore
@testable import Boop

/// A request body with the encoder's layout (spaces, line breaks) taken out, keys sorted, so tests can match `"key":"value"`.
func compactJSON(_ body: String) -> String {
    guard let data = body.data(using: .utf8), let obj = try? JSONSerialization.jsonObject(with: data),
          let out = try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys, .withoutEscapingSlashes]) else { return body }
    return String(decoding: out, as: UTF8.self)
}

/// Answers each operation from a handler, records every request (operation id and body).
final class ScriptedTransport: ClientTransport, @unchecked Sendable {
    typealias Handler = @Sendable (String) async throws -> (Int, String)
    private let lock = NSLock()
    private var handlers: [String: Handler] = [:]
    private(set) var sent: [(op: String, body: String)] = []
    private(set) var paths: [(op: String, path: String)] = []
    func pathsOf(_ op: String) -> [String] { lock.withLock { paths.filter { $0.op == op }.map(\.path) } }

    func on(_ op: String, _ h: @escaping Handler) { lock.withLock { handlers[op] = h } }
    func on(_ op: String, _ code: Int, _ json: String = "") { on(op) { _ in (code, json) } }
    func count(_ op: String) -> Int { lock.withLock { sent.filter { $0.op == op }.count } }
    func bodies(_ op: String) -> [String] { lock.withLock { sent.filter { $0.op == op }.map(\.body) } }
    /// A request body with the encoder's layout (spaces, line breaks) taken out, so tests can match `"key":"value"`.
    func compactBodies(_ op: String) -> [String] { bodies(op).map(compactJSON) }

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        var text = ""
        if let body { text = String(decoding: try await Data(collecting: body, upTo: 1 << 20), as: UTF8.self) }
        let h = lock.withLock { sent.append((operationID, text)); paths.append((operationID, request.path ?? "")); return handlers[operationID] }
        guard let h else { return (HTTPResponse(status: .init(code: 500)), nil) }
        let (code, json) = try await h(text)
        var f = HTTPFields(); f[.contentType] = "application/json"
        return (HTTPResponse(status: .init(code: code), headerFields: f), json.isEmpty ? nil : HTTPBody(json))
    }
}

/// A sender that never delivers: the queued item stays.
private struct RetryingSender: OutboxSender {
    func send(_ item: OutboxItem) async -> OutboxSendResult { .offline }
}

@MainActor
struct EtelStoreTests {
    let transport = ScriptedTransport()
    let mealA = "5b0e8a52-1c3d-4e0e-9a52-7d9d4c1a0b01", mealB = "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c02"
    let item = "dd805c3a-94b5-4080-9c3a-5f7fce9c8d09", pantry = "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c99"
    let intake1 = "22249a7e-d8f9-44c4-9a7e-93b03cd0c12e"

    private func meal(_ id: String, photo: Bool) -> String {
        #"{"id":"\#(id)","slot":"lunch","loggedAt":"2026-11-13T12:40:00+01:00","mealDate":"2026-11-13","title":"Étel","macros":{"kcal":500,"p":30,"c":50,"f":15},"score":{"value":0.8},"items":[],"hasPhoto":\#(photo)}"#
    }

    private func script(water: Double = 500, meals: [String]) {
        transport.on("getFuelDay", 200, #"{"date":"2026-11-13","targets":{"kcal":2400,"p":150,"c":260,"f":70,"water":2500},"consumed":{"kcal":0,"p":0,"c":0,"f":0,"water":\#(water)},"meals":[\#(meals.joined(separator: ","))],"skippedKcal":0}"#)
        transport.on("getFuelPlan", 200, #"{"date":"2026-11-13","windows":[],"remaining":{"kcal":2400,"p":150,"c":260,"f":70}}"#)
        transport.on("getMealCoachForDay", 200, #"{"verdicts":[]}"#)
        transport.on("getProtocol", 200, #"{"active":{"id":"cc7f5b29-83a4-4f7f-8b29-4e6ebd8b7c08","version":1,"builtAt":"2026-11-01T06:00:00Z","status":"active","items":[{"id":"\#(item)","pantryItemId":"\#(pantry)","slotKey":"morning","pinned":false,"placementSource":"rule"}]},"history":[]}"#)
        transport.on("getPantry", 200, #"{"ingredients":[],"imports":[],"suggestions":[],"stash":[{"id":"\#(pantry)","name":"D3","brand":null,"type":"supplement","category":null,"dose":"4000 NE","form":null,"protocol":"","timing":"","taken":false,"macros":{"kcal":0,"p":0,"c":0,"f":0},"catalogId":"\#(pantry)","catalogEditable":false}]}"#)
        transport.on("getMealPhoto") { _ in (404, "") }
    }

    private func loaded(water: Double = 500, meals: [String] = []) async -> EtelStore {
        script(water: water, meals: meals)
        let store = EtelStore()
        await store.load(food: FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)), now: Date())
        return store
    }

    @Test func aMealWithoutAPhotoNeverCostsAPhotoCall() async {
        let store = await loaded(meals: [meal(mealA, photo: false)])
        #expect(store.day?.meals.count == 1)
        #expect(transport.count("getMealPhoto") == 0)
        // and one that says it has one asks exactly once
        let withPhoto = EtelStore()
        script(meals: [meal(mealA, photo: false), meal(mealB, photo: true)])
        await withPhoto.load(food: FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)), now: Date())
        #expect(transport.count("getMealPhoto") == 1)
    }

    @Test func theLightReadSkipsTheDayTheCoachAndThePhotosAndRereadsWhatWasTaken() async {
        script(meals: [meal(mealA, photo: true)])
        let food = FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport))
        let now = Date()
        let day = food.ymd(now)
        let taken = SupplementTakenStore(fileURL: tempFile())
        let store = EtelStore(taken: taken)
        await store.load(food: food, now: now, extras: false)
        #expect(transport.count("getFuelDay") == 0 && transport.count("getMealCoachForDay") == 0 && transport.count("getMealPhoto") == 0)
        #expect(store.plan != nil && store.groups.count == 1 && store.taken.isEmpty)
        // the room (another store) ticks the group: it lands in the user's file; Ma's next light read must see it
        taken.markTaken(day: day, daypart: "morning", ids: [UUID()])
        await store.load(food: food, now: now, extras: false)
        #expect(store.taken == ["morning"])
        // and an untick there
        taken.undo(day: day, daypart: "morning")
        await store.load(food: food, now: now, extras: false)
        #expect(store.taken.isEmpty)
    }

    @Test func waterShowsAtOnceAndRollsBackWhenTheServerDoesNotTakeIt() async {
        let store = await loaded()
        transport.on("logWater", 500)
        let toast = await store.addWater(250)
        #expect(toast.contains("Nem sikerült"))
        #expect(store.day?.consumed.water == 500)
        transport.on("logWater", 201, #"{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","date":"2026-11-13","amountMl":250}"#)
        #expect(await store.addWater(250) == "Víz +250 ml")
        #expect(store.day?.consumed.water == 750)
    }

    @Test func aRetriedWaterTapKeepsItsKeySoALostAnswerIsNotCountedTwice() async {
        let store = await loaded()
        transport.on("logWater", 500)
        _ = await store.addWater(250)
        transport.on("logWater", 201, #"{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","date":"2026-11-13","amountMl":250}"#)
        _ = await store.addWater(250)
        _ = await store.addWater(250)                      // a new tap after a success is a new key
        func ref(_ b: String) -> String? { (try? JSONSerialization.jsonObject(with: Data(b.utf8)) as? [String: Any])?["clientRef"] as? String }
        let refs = transport.bodies("logWater").map(ref)
        #expect(refs.count == 3 && refs[0] != nil)
        #expect(refs[0] == refs[1])
        #expect(refs[1] != refs[2])
    }

    @Test func aRollbackLeavesAFreshlyReadDayAlone() async {
        let store = await loaded()
        let box = StoreBox(store)
        transport.on("logWater") { _ in
            // a refresh lands while the write is in flight, and the server has already counted it
            await box.refresh(transport: self.transport, water: 750)
            return (500, "")
        }
        _ = await store.addWater(250)
        #expect(store.day?.consumed.water == 750)
    }

    @Test func theTakenStateDoesNotCarryOverMidnight() async {
        func at(_ day: Int) -> Date {
            var cal = Calendar(identifier: .gregorian); cal.timeZone = .current
            return cal.date(from: DateComponents(year: 2031, month: 3, day: day, hour: 12))!
        }
        script(meals: [])
        let food = FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport))
        let store = EtelStore(taken: SupplementTakenStore(fileURL: tempFile()))
        await store.load(food: food, now: at(4))
        let group = SupplementGroup(key: "morning", label: "Reggel", count: 1, summary: "D3")
        transport.on("logIntake", 201, #"{"id":"\#(intake1)","pantryItemId":"\#(pantry)","takenAt":"2031-03-04T07:30:00Z","takenDate":"2031-03-04"}"#)
        _ = await store.toggle(group)
        #expect(store.isTaken(group))
        await store.load(food: food, now: at(4))                 // the same day: still taken
        #expect(store.isTaken(group))
        await store.load(food: food, now: at(5))                 // the next day: no entries, nothing taken
        #expect(!store.isTaken(group))
        await store.load(food: food, now: at(4))                 // back on the first day its saved ids return
        #expect(store.isTaken(group))
    }

    private func tempFile() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("etel-taken-\(UUID().uuidString)/supplements-taken.json")
    }

    @Test func roomUndoOfUnknownIdsSaysStillSending() async {
        script(meals: [])
        let taken = SupplementTakenStore(fileURL: tempFile())
        // the queued tick marks the group taken at once, with no ids yet
        let store = EtelStore(taken: taken, tick: { daypart, date in taken.markTaken(day: "2026-11-13", daypart: daypart, ids: nil) })
        await store.load(food: FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)), now: Date())
        let group = SupplementGroup(key: "morning", label: "Reggel", count: 3, summary: "D3")
        #expect(await store.toggle(group) == "Reggel: mind a 3 bevéve")
        #expect(store.isTaken(group) && transport.count("logIntake") == 0)       // went through the queue, not the client
        #expect(await store.toggle(group) == "Még küldöm — utána visszavonhatod")
        #expect(store.isTaken(group) && transport.count("deleteIntake") == 0)    // changes nothing
        // once the sender has filled the ids in, the same tap undoes
        taken.markTaken(day: store.ymd, daypart: "morning", ids: [UUID(uuidString: intake1)!])
        transport.on("deleteIntake", 204)
        #expect(await store.toggle(group) == "Visszavontam")
        #expect(!store.isTaken(group) && taken.taken(day: store.ymd).isEmpty)
    }

    @Test func roomTickAlsoTicksTheLinkedReminder() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("etel-tick-\(UUID().uuidString)")
        let now = Date(timeIntervalSince1970: 1_795_089_600)
        let env = RitmusEnvironment(ledgerDirectory: root.appendingPathComponent("ledger"),
                                    outboxDirectory: root.appendingPathComponent("outbox"),
                                    sender: RetryingSender(), line: { _, _ in "" },
                                    snapshot: { _ in CheckInSnapshotValue(hrBpm: 78, hrvMs: 38, hrvUsualMs: 50) }, plans: nil,
                                    clock: { now }, calendar: .current)
        let reminders = ReminderStore(fileURL: root.appendingPathComponent("reminders.json"))
        let linked = Reminder(title: "Reggeli kiegészítők", hour: 8, minute: 0, repeats: .daily, strength: .alarm,
                              link: .supplement(daypart: "morning"))
        let other = Reminder(title: "Este", hour: 21, minute: 0, repeats: .daily, link: .supplement(daypart: "evening"))
        reminders.upsert(linked); reminders.upsert(other)
        env.reminderStore = { reminders }
        let day = env.day(of: now)
        try await env.captureSupplementTick(daypart: "morning", at: now)
        #expect(reminders.file.done == ["\(linked.id.uuidString)|\(day)"])
        #expect(env.supplementTaken.taken(day: day) == ["morning": []])
        // a second tick of the same group queues nothing more
        try await env.captureSupplementTick(daypart: "morning", at: now)
        #expect(await env.outbox.pending.filter { $0.kind == .supplementTick }.count == 1)
    }

    @Test func alarmTickOnAnEarlierDayFilesItThereAndLeavesTodaysRing() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("etel-day-\(UUID().uuidString)")
        let now = Date(timeIntervalSince1970: 1_795_089_600)
        let env = RitmusEnvironment(ledgerDirectory: root.appendingPathComponent("ledger"),
                                    outboxDirectory: root.appendingPathComponent("outbox"),
                                    sender: RetryingSender(), line: { _, _ in "" },
                                    snapshot: { _ in CheckInSnapshotValue(hrBpm: 78, hrvMs: 38, hrvUsualMs: 50) }, plans: nil,
                                    clock: { now }, calendar: .current)
        let reminders = ReminderStore(fileURL: root.appendingPathComponent("reminders.json"))
        let linked = Reminder(title: "Reggeli", hour: 8, minute: 0, repeats: .daily, strength: .alarm, link: .supplement(daypart: "morning"))
        reminders.upsert(linked)
        env.reminderStore = { reminders }
        let yesterday = env.day(of: now.addingTimeInterval(-86_400))
        try await env.captureSupplementTick(daypart: "morning", at: now.addingTimeInterval(-86_400), day: yesterday)
        let queued = await env.outbox.pending.filter { $0.kind == .supplementTick }
        #expect(queued.map(\.date) == [yesterday])
        #expect(env.supplementTaken.taken(day: yesterday) == ["morning": []])
        #expect(env.supplementTaken.taken(day: env.day(of: now)).isEmpty)
        #expect(reminders.file.done == ["\(linked.id.uuidString)|\(yesterday)"])   // today's alarm still rings
    }

    @Test func undoUnticksTheLinkedReminder() async {
        script(meals: [])
        let taken = SupplementTakenStore(fileURL: tempFile())
        let reminders = ReminderStore(fileURL: FileManager.default.temporaryDirectory.appendingPathComponent("etel-undo-\(UUID().uuidString)/reminders.json"))
        let linked = Reminder(title: "Reggeli", hour: 8, minute: 0, repeats: .daily, strength: .alarm, link: .supplement(daypart: "morning"))
        reminders.upsert(linked)
        let store = EtelStore(taken: taken, tick: { daypart, _ in taken.markTaken(day: "2026-11-13", daypart: daypart, ids: nil) },
                              reminders: { reminders })
        await store.load(food: FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)), now: Date())
        let group = SupplementGroup(key: "morning", label: "Reggel", count: 1, summary: "D3")
        let key = "\(linked.id.uuidString)|\(store.ymd)"
        reminders.tick(key)                                    // the alarm was done
        _ = await store.toggle(group)
        taken.markTaken(day: store.ymd, daypart: "morning", ids: [UUID(uuidString: intake1)!])
        transport.on("deleteIntake", 204)
        #expect(await store.toggle(group) == "Visszavontam")
        #expect(!reminders.file.done.contains(key))            // the alarm may ring again
    }

    @Test func captureWithoutEnvThrows() async {
        func make() -> RitmusEnvironment {
            let root = FileManager.default.temporaryDirectory.appendingPathComponent("etel-gone-\(UUID().uuidString)")
            return RitmusEnvironment(ledgerDirectory: root.appendingPathComponent("ledger"),
                                     outboxDirectory: root.appendingPathComponent("outbox"),
                                     sender: RetryingSender(), line: { _, _ in "" },
                                     snapshot: { _ in CheckInSnapshotValue(hrBpm: 78, hrvMs: 38, hrvUsualMs: 50) }, plans: nil)
        }
        var env: RitmusEnvironment? = make()
        let capture = SupplementTickHub.captureClosure(for: env!)   // not bound: the hub is process-global
        env = nil
        await #expect(throws: SupplementTickError.self) { try await capture("morning", Date()) }
    }

    @Test func takingASupplementGroupRollsBackOnFailureAndUndoesOnSecondTap() async {
        let store = await loaded()
        let group = SupplementGroup(key: "morning", label: "Reggel", count: 1, summary: "D3")
        transport.on("logIntake", 500)
        #expect(await store.toggle(group).contains("Nem sikerült"))
        #expect(!store.isTaken(group))
        transport.on("logIntake", 201, #"{"id":"\#(intake1)","pantryItemId":"\#(pantry)","takenAt":"2026-11-13T07:30:00Z","takenDate":"2026-11-13"}"#)
        #expect(await store.toggle(group).contains("bevéve"))
        #expect(store.isTaken(group))
        // the second tap deletes the entry; a failed delete leaves it taken
        transport.on("deleteIntake", 500)
        #expect(await store.toggle(group).contains("Nem sikerült"))
        #expect(store.isTaken(group))
        transport.on("deleteIntake", 204)
        #expect(await store.toggle(group) == "Visszavontam")
        #expect(!store.isTaken(group))
        #expect(transport.count("deleteIntake") == 2)
    }
}

/// Lets a scripted handler (which is `@Sendable`) reach the main-actor store.
@MainActor final class StoreBox {
    let store: EtelStore
    init(_ s: EtelStore) { store = s }
    func refresh(transport: ScriptedTransport, water: Double) async {
        transport.on("getFuelDay", 200, #"{"date":"2026-11-13","targets":{"kcal":2400,"p":150,"c":260,"f":70,"water":2500},"consumed":{"kcal":0,"p":0,"c":0,"f":0,"water":\#(water)},"meals":[],"skippedKcal":0}"#)
        if let food = store.currentFood { await store.load(food: food, now: Date()) }
    }
}
