import Foundation
import Testing
@testable import BoopCore

final class RitmusClientTests {
    let stub = StubTransport()
    let dir = temporaryDirectory()
    let date = "2026-11-10"
    deinit { try? FileManager.default.removeItem(at: dir) }

    var ritmus: RitmusClient {
        RitmusClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), audioDirectory: dir)
    }

    func item(_ kind: OutboxKind, _ payload: some Encodable, id: UUID = UUID()) -> OutboxItem {
        OutboxItem(id: id, kind: kind, date: date, capturedAt: at(16, 2), payload: RitmusPayload.encode(payload))
    }

    func body(_ n: Int = 0, op: String) throws -> [String: Any] {
        let sent = stub.sent.filter { $0.op == op }
        let text = try #require(sent[n].body)
        return try #require(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
    }

    static let checkInOK = #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","date":"2026-11-10","slotTime":"10:00","state":"done","savedAt":"2026-11-10T15:02:00Z"}"#
    static let closeOK = #"{"date":"2026-11-10","closedAt":"2026-11-10T20:30:00Z","planGoals":[],"source":"boop"}"#
    static let journalOK = #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","occurredOn":"2026-11-10","text":"x","source":"boop","createdAt":"2026-11-10T20:31:00Z"}"#
    static let focusOK = #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","focusDate":"2026-11-10","text":"Séta"}"#

    @Test func checkInRequestCarriesCapturedAtSlotAndSnapshot() async throws {
        stub.on("saveCheckIn", .json(200, Self.checkInOK))
        let snap = CheckInSnapshotValue(hrBpm: 78, hrAt: at(16, 0), hrvMs: 38, hrvAt: at(14, 0), hrvUsualMs: 50, steps: 7420,
                                        sleepMinutes: 400, source: "com.apple.health.watch")
        let payload = CheckInPayload(slot: "10:00", values: ["energy": 6, "mood": 7, "day": 8], pain: false,
                                     askedItems: ["energy", "mood", "day"], adaptiveItem: "day", quickExit: true,
                                     note: "jó nap", snapshot: snap)
        let result = await ritmus.send(item(.checkIn, payload))
        #expect(result == .sent(nil))
        let b = try body(op: "saveCheckIn")
        #expect(b["date"] as? String == date)
        #expect(b["slotTime"] as? String == "10:00")
        #expect(b["state"] as? String == "done")
        #expect(b["capturedAt"] as? String == "2026-11-10T15:02:00Z")
        #expect(b["energy"] as? Int == 6 && b["mood"] as? Int == 7)
        #expect(b["dayRating"] as? Int == 8)   // wire item `day`
        #expect(b["askedItems"] as? [String] == ["energy", "mood", "day"])
        #expect(b["adaptiveItem"] as? String == "day")
        #expect(b["quickExit"] as? Bool == true)
        #expect(b["note"] as? String == "jó nap")
        let s = try #require(b["snapshot"] as? [String: Any])
        #expect(s["hrBpm"] as? Int == 78 && s["steps"] as? Int == 7420 && s["sleepMinutes"] as? Int == 400)
        #expect(s["hrvUsualMs"] as? Double == 50)
        #expect(s["computedBy"] as? String == "phone")
        #expect(s["stepsIsDayTotal"] as? Bool == false)
        #expect(s["source"] as? String == "com.apple.health.watch")
    }

    @Test func emptySnapshotIsNotSent() async throws {
        stub.on("saveCheckIn", .json(200, Self.checkInOK))
        _ = await ritmus.send(item(.checkIn, CheckInPayload(slot: "06:30", values: ["energy": 5], snapshot: CheckInSnapshotValue())))
        #expect(try body(op: "saveCheckIn")["snapshot"] == nil)
    }

    @Test func checkInNoteResendsTheWholeSlotKeepingCapturedAt() async throws {
        stub.on("saveCheckIn", .json(200, Self.checkInOK))
        let result = await ritmus.send(item(.checkInNote, CheckInPayload(slot: "14:00", values: ["energy": 4], note: "fáradt")))
        #expect(result == .sent(nil))
        let b = try body(op: "saveCheckIn")
        #expect(b["slotTime"] as? String == "14:00" && b["energy"] as? Int == 4 && b["note"] as? String == "fáradt")
        #expect(b["capturedAt"] as? String == "2026-11-10T15:02:00Z")
    }

    @Test func evening20NeverSentByCheckIn() async {
        let result = await ritmus.send(item(.checkIn, CheckInPayload(slot: "20:00", values: ["energy": 5])))
        guard case .failed = result else { Issue.record("expected failed, got \(result)"); return }
        #expect(stub.ops.isEmpty)
    }

    @Test func focusCarriesClientRef() async throws {
        stub.on("addFocus", .json(200, Self.focusOK))
        let id = UUID()
        let result = await ritmus.send(item(.goal, GoalPayload(text: "Séta"), id: id))
        guard case .sent(let data?) = result else { Issue.record("expected sent with body, got \(result)"); return }
        #expect(String(decoding: data, as: UTF8.self).contains("0b6f3c1e-1111-4a2b-9c3d-222233334444"))
        let b = try body(op: "addFocus")
        #expect(b["clientRef"] as? String == id.uuidString)
        #expect(b["date"] as? String == date && b["text"] as? String == "Séta")
    }

    @Test func removeFocusUsesServerIdAndGoneIsDone() async {
        let focus = UUID()
        stub.on("removeFocus", .status(204)); stub.on("removeFocus", .json(404, #"[{"code":"INTENTION_FOCUS_NOT_FOUND","type":"REQUEST"}]"#))
        #expect(await ritmus.send(item(.goalRemove, GoalRemovePayload(focusId: focus))) == .sent(nil))
        #expect(stub.sent[0].path.hasSuffix("/api/intention/focus/\(focus.uuidString.lowercased())"))
        #expect(await ritmus.send(item(.goalRemove, GoalRemovePayload(focusId: focus))) == .sent(nil))   // already gone
    }

    @Test func journalIsSourceBoopWithClientRef() async throws {
        stub.on("createJournalEntry", .json(201, Self.journalOK))
        let id = UUID()
        #expect(await ritmus.send(item(.journal, JournalPayload(text: "Jó nap volt"), id: id)) == .sent(nil))
        let b = try body(op: "createJournalEntry")
        #expect(b["source"] as? String == "boop" && b["clientRef"] as? String == id.uuidString)
        #expect(b["occurredOn"] as? String == date && b["text"] as? String == "Jó nap volt")
    }

    @Test func dayCloseThenJournalThenRelink() async throws {
        stub.on("putDayClose", .json(200, Self.closeOK)); stub.on("putDayClose", .json(200, Self.closeOK))
        stub.on("createJournalEntry", .json(201, Self.journalOK))
        let closeRef = UUID(), journalRef = UUID()
        let goals = [PlanGoalPayload(id: "g1", title: "Edzés", result: "kész", met: true)]
        let close = DayClosePayload(eveningEnergy: 6, dayRating: 4, goalText: "Séta", goalOutcome: "done", planGoals: goals)
        let relink = DayClosePayload(clientRef: closeRef, eveningEnergy: 6, dayRating: 4, goalText: "Séta", goalOutcome: "done",
                                     planGoals: goals, journalClientRef: journalRef)
        let r = ritmus
        #expect(await r.send(item(.dayClose, close, id: closeRef)) == .sent(nil))
        #expect(await r.send(item(.journal, JournalPayload(text: "Jó nap"), id: journalRef)) == .sent(nil))
        #expect(await r.send(item(.dayClose, relink)) == .sent(nil))
        #expect(stub.ops == ["putDayClose", "createJournalEntry", "putDayClose"])
        let first = try body(0, op: "putDayClose"), second = try body(1, op: "putDayClose")
        #expect(first["clientRef"] as? String == closeRef.uuidString && first["journalClientRef"] == nil)
        #expect(second["clientRef"] as? String == closeRef.uuidString)
        #expect(second["journalClientRef"] as? String == journalRef.uuidString)
        #expect(first["dayRating"] as? Int == 4 && first["goalOutcome"] as? String == "done")
        #expect(first["capturedAt"] as? String == "2026-11-10T15:02:00Z")
        #expect((first["planGoals"] as? [[String: Any]])?.first?["title"] as? String == "Edzés")
        #expect(stub.sent[0].path.hasSuffix("/api/day-close/2026-11-10"))
    }

    @Test func serverErrorMapsToRetryOrFailed() async {
        struct Boom: Error {}
        let cases: [(StubTransport.Reply, OutboxSendResult)] = [
            (.status(500), .retryLater), (.status(503), .retryLater), (.status(409), .retryLater), (.status(429), .retryLater),
            (.status(401), .retryLater), (.fail(URLError(.notConnectedToInternet)), .retryLater), (.fail(Boom()), .retryLater),
            (.status(400), .failed("HTTP 400")), (.status(422), .failed("HTTP 422")), (.status(404), .failed("HTTP 404")),
        ]
        for (reply, expected) in cases {
            let t = StubTransport()
            t.on("createJournalEntry", reply)
            let r = RitmusClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: t), audioDirectory: dir)
            #expect(await r.send(item(.journal, JournalPayload(text: "x"))) == expected, "\(reply)")
        }
    }

    @Test func documentedErrorsMapToo() async {
        stub.on("saveCheckIn", .json(400, #"[{"type":"FIELD","code":"VALIDATION_INVALID_VALUE","fieldName":"date"}]"#))
        stub.on("addFocus", .json(409, #"[{"type":"REQUEST","code":"INTENTION_FOCUS_CAP"}]"#))
        stub.on("createJournalEntry", .json(409, #"[{"type":"REQUEST","code":"X"}]"#))
        #expect(await ritmus.send(item(.checkIn, CheckInPayload(slot: "10:00", values: [:]))) == .failed("HTTP 400"))
        #expect(await ritmus.send(item(.goal, GoalPayload(text: "x"))) == .failed("INTENTION_FOCUS_CAP"))
        #expect(await ritmus.send(item(.journal, JournalPayload(text: "x"))) == .retryLater)   // other 409s retry
    }

    @Test func goalWithUnreadable2xxBodyIsRetried() async {
        stub.on("addFocus", .json(200, #"{"nope":true}"#))
        #expect(await ritmus.send(item(.goal, GoalPayload(text: "x"))) == .retryLater)
    }

    @Test func voiceTranscribesThenJournalsThenDeletesAudio() async throws {
        let audio = dir.appendingPathComponent("memo.m4a")
        try Data("fake-audio".utf8).write(to: audio)
        stub.on("transcribeVoiceNote", .json(200, #"{"text":"Ma jó volt"}"#))
        stub.on("createJournalEntry", .json(201, Self.journalOK))
        let id = UUID()
        let result = await ritmus.send(item(.voice, VoicePayload(fileName: "memo.m4a"), id: id))
        guard case .sent(let data?) = result else { Issue.record("expected sent, got \(result)"); return }
        #expect(RitmusPayload.decode(VoiceTranscript.self, from: data)?.text == "Ma jó volt")
        #expect(stub.ops == ["transcribeVoiceNote", "createJournalEntry"])
        let b = try body(op: "createJournalEntry")
        #expect(b["text"] as? String == "Ma jó volt" && b["clientRef"] as? String == id.uuidString && b["source"] as? String == "boop")
        let upload = try #require(stub.sent[0].body)
        #expect(upload.contains("fake-audio") && upload.lowercased().contains("audio/mp4"))
        #expect(!FileManager.default.fileExists(atPath: audio.path))
    }

    @Test func voiceKeepsAudioWhenJournalFailsAndDoesNotTranscribeTwice() async throws {
        let audio = dir.appendingPathComponent("memo.m4a")
        try Data("fake-audio".utf8).write(to: audio)
        stub.on("transcribeVoiceNote", .json(200, #"{"text":"Ma jó volt"}"#))
        stub.on("createJournalEntry", .status(500)); stub.on("createJournalEntry", .json(201, Self.journalOK))
        let r = ritmus
        let voice = item(.voice, VoicePayload(fileName: "memo.m4a"))
        #expect(await r.send(voice) == .retryLater)
        #expect(FileManager.default.fileExists(atPath: audio.path))
        guard case .sent = await r.send(voice) else { Issue.record("second send should succeed"); return }
        #expect(stub.ops == ["transcribeVoiceNote", "createJournalEntry", "createJournalEntry"])
        #expect(!FileManager.default.fileExists(atPath: audio.path))
    }

    @Test func voiceWithMissingOrSilentAudioFailsAndKeepsItem() async throws {
        #expect(await ritmus.send(item(.voice, VoicePayload(fileName: "gone.m4a"))) == .failed("audio file missing"))
        try Data("x".utf8).write(to: dir.appendingPathComponent("quiet.m4a"))
        stub.on("transcribeVoiceNote", .json(200, #"{"text":""}"#))
        #expect(await ritmus.send(item(.voice, VoicePayload(fileName: "quiet.m4a"))) == .failed("no speech in the recording"))
        #expect(FileManager.default.fileExists(atPath: dir.appendingPathComponent("quiet.m4a").path))
    }

    @Test func chatQuestionCreatesBoopConversationThenSends() async throws {
        let conv = UUID()
        stub.on("createConversation", .json(201, #"{"id":"\#(conv.uuidString)","startedAt":"2026-11-10T15:02:00Z"}"#))
        stub.on("sendMessage", .json(200, #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","role":"assistant","content":"Szia!","createdAt":"2026-11-10T15:02:05Z","tools":[],"refs":[],"recalled":[],"degraded":false}"#))
        let result = await ritmus.send(item(.chatQuestion, ChatQuestionPayload(text: "Mi a terv?")))
        guard case .sent(let data?) = result else { Issue.record("expected sent, got \(result)"); return }
        let reply = try #require(RitmusPayload.decode(ChatReply.self, from: data))
        #expect(reply.conversationId == conv && reply.content == "Szia!")
        #expect(try body(op: "createConversation")["channel"] as? String == "boop")
        #expect(try body(op: "sendMessage")["content"] as? String == "Mi a terv?")
        #expect(stub.sent[1].path.contains(conv.uuidString.lowercased()))
    }

    @Test func chatQuestionInExistingConversationSkipsCreate() async {
        let conv = UUID()
        stub.on("sendMessage", .json(200, #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","role":"assistant","content":"Rendben","createdAt":"2026-11-10T15:02:05Z","tools":[],"refs":[],"recalled":[],"degraded":false}"#))
        _ = await ritmus.send(item(.chatQuestion, ChatQuestionPayload(conversationId: conv, text: "Még valami")))
        #expect(stub.ops == ["sendMessage"])
    }

    // MARK: fetches

    @Test func fetchDayBuildsTheServerLedger() async throws {
        stub.on("listCheckInsForDay", .json(200, #"[{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","date":"2026-11-10","slotTime":"10:00","state":"done","energy":6,"mood":7,"dayRating":8,"pain":false,"askedItems":["energy","mood"],"quickExit":true,"note":"jó","savedAt":"2026-11-10T11:40:00Z"},{"id":"1b6f3c1e-1111-4a2b-9c3d-222233334444","date":"2026-11-10","slotTime":"14:00","state":"pending","savedAt":"2026-11-10T12:00:00Z"}]"#))
        stub.on("getIntentionDay", .json(200, "{\"date\":\"2026-11-10\",\"foci\":[\(Self.focusOK)],\"focusCap\":1}"))
        stub.on("getDayClose", .json(200, #"{"date":"2026-11-10","closedAt":"2026-11-10T20:30:00Z","eveningEnergy":6,"dayRating":4,"goalText":"Séta","goalOutcome":"done","planGoals":[],"source":"boop"}"#))
        let day = try await ritmus.fetchDay(date)
        #expect(day.date == date)
        #expect(day.checkIns.count == 1)   // the pending placeholder row is not a check-in
        let c = try #require(day.checkIns.first)
        #expect(c.slot == "10:00" && c.values == ["energy": 6, "mood": 7, "day": 8] && c.quickExit && c.note == "jó" && !c.pending)
        #expect(c.pain == false && c.askedItems == ["energy", "mood"])
        #expect(day.goal?.text == "Séta" && day.goal?.pending == false)
        #expect(day.close?.dayRating == 4 && day.close?.goalOutcome == "done" && day.close?.eveningEnergy == 6)
    }

    @Test func fetchDayWithoutCloseIsOpen() async throws {
        stub.on("listCheckInsForDay", .json(200, "[]"))
        stub.on("getIntentionDay", .json(200, #"{"date":"2026-11-10","foci":[],"focusCap":1}"#))
        stub.on("getDayClose", .json(404, #"[{"type":"REQUEST","code":"DAY_CLOSE_NOT_FOUND"}]"#))
        let day = try await ritmus.fetchDay(date)
        #expect(day.close == nil && day.goal == nil && day.checkIns.isEmpty)
    }

    @Test func fetchDayOfflineThrowsOffline() async {
        stub.on("listCheckInsForDay", .fail(URLError(.notConnectedToInternet)))
        await #expect(throws: RitmusFetchError.offline) { try await ritmus.fetchDay(date) }
    }

    @Test func fetchPlansCoversAllThreeSlots() async throws {
        stub.on("getCheckInPlan", .json(200, #"{"items":[],"adaptive":{"id":"rested","label":"Kipihentség","question":"?","kind":"SCALE","why":"Rég kérdeztem.","reason":"NEED"}}"#))
        stub.on("getCheckInPlan", .json(200, #"{"items":[]}"#))
        stub.on("getCheckInPlan", .json(200, #"{"items":[],"adaptive":{"id":"hunger","label":"Éhség","question":"?","kind":"SCALE","why":"Délután éhes vagy.","reason":"RANDOM"}}"#))
        let plans = try await ritmus.fetchPlans(date)
        #expect(plans["06:30"] == CheckInPlanLite(slot: "06:30", adaptiveItem: "rested", adaptiveWhy: "Rég kérdeztem."))
        #expect(plans["10:00"] == CheckInPlanLite(slot: "10:00", adaptiveItem: nil, adaptiveWhy: nil))
        #expect(plans["14:00"]?.adaptiveItem == "hunger")
        #expect(stub.sent.map(\.path).allSatisfy { $0.contains("slotTime=") && $0.contains("date=2026-11-10") })
    }

    @Test @MainActor func refreshPlansCachesInTheLedgerStore() async throws {
        for _ in 0..<3 { stub.on("getCheckInPlan", .json(200, #"{"items":[]}"#)) }
        let store = LedgerStore(directory: dir.appendingPathComponent("ledger"))
        try await ritmus.refreshPlans(date, into: store)
        #expect(Set(store.ledger(for: date).plans.keys) == ["06:30", "10:00", "14:00"])
    }

    @Test func lineReturnsTheSentenceAnd503IsUnavailable() async throws {
        stub.on("generateDayCloseLine", .json(200, #"{"line":"Szép nap volt."}"#))
        #expect(try await ritmus.line(date) == "Szép nap volt.")
        stub.on("generateDayCloseLine", .json(503, #"[{"type":"REQUEST","code":"LLM_UNAVAILABLE"}]"#))
        await #expect(throws: RitmusFetchError.unavailable) { try await ritmus.line(date) }
    }

    @Test func checkInLineSendsTheSlot() async throws {
        stub.on("generateCheckInLine", .json(200, #"{"line":"Köszi."}"#))
        #expect(try await ritmus.checkInLine(date, slot: "14:00") == "Köszi.")
        #expect(try body(op: "generateCheckInLine")["slot"] as? String == "14:00")
    }
}
