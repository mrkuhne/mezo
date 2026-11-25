import Foundation
import Testing
@testable import BoopCore

/// B7 K3 Task 19 (`mezo-r36n9.17`): the Átrendezés week in the store — cache fallback, the offline accept through the
/// outbox (one clientRef, never two moves), undo, and the stale accept that refreshes the week.
@MainActor
struct KapacitasStoreTests {
    static let monday = "2026-11-23"
    static let proposalId = "11111111-2222-4333-8444-555555555555"

    static func weekJSON(status: String = "open", adjustments: String = "[]", proposals: String? = nil) -> String {
        let p = proposals ?? #"""
        [{"id":"\#(proposalId)","kind":"MOVE_SESSION_DAY","day":"2026-11-26","status":"\#(status)",
          "title":"A lábnapot tedd át szombatra","move":"csütörtök 18:00 → szombat 10:00",
          "effectLines":["A csütörtök túl sokból szorosra enyhül"],"why":["Csütörtökön sok a megbeszélés"],
          "effects":[{"label":"Csütörtök terhe","before":"túl sok","after":"szoros","favours":1}],
          "steps":[{"kind":"MOVE_SESSION_DAY","payload":{"fromDate":"2026-11-26","toDate":"2026-11-28"}}],
          "touchedDays":["2026-11-26","2026-11-28"],"decidedAt":null}]
        """#
        return #"""
        {"monday":"\#(monday)","days":[{"date":"2026-11-23","verdict":"rendben","label":"rendben","ratio":0.7,"calendarKnown":true},
          {"date":"2026-11-26","verdict":"tulSok","label":"túl sok","ratio":1.12,"calendarKnown":true}],
         "proposals":\#(p),"adjustments":\#(adjustments),"patterns":[]}
        """#
    }

    static func client(_ stub: StubTransport) -> KapacitasClient { KapacitasClientTests.client(stub) }
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" })
    }
    static func tempDir(_ tag: String) -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("kap-\(tag)-\(UUID().uuidString)")
    }

    @Test func weekFallsBackToCache() async throws {
        final class Clock: @unchecked Sendable { var now = Date(timeIntervalSince1970: 1_795_089_600) }
        let clock = Clock()
        let cache = ServerCache(directory: Self.tempDir("week"), clock: { clock.now })
        let online = StubTransport()
        online.on("getCapacityWeek", .json(200, Self.weekJSON()))
        let first = KapacitasStore(client: Self.client(online), cache: cache)
        await first.loadWeek(monday: Self.monday)
        #expect(online.sent.first?.path == "/api/capacity/week?monday=2026-11-23")
        #expect(first.weeks[Self.monday]?.proposals.count == 1)
        #expect(first.weekAgeText(Self.monday) == nil)

        clock.now = clock.now.addingTimeInterval(3 * 3600)
        let off = StubTransport()
        off.on("getCapacityWeek", .fail(URLError(.notConnectedToInternet)))
        let later = KapacitasStore(client: Self.client(off), cache: cache)
        await later.loadWeek(monday: Self.monday)
        #expect(later.weeks[Self.monday]?.proposals.first?.title == "A lábnapot tedd át szombatra")
        #expect(later.weekAgeText(Self.monday) == "3 órás adat")
        #expect(later.weekProblem[Self.monday] == nil)

        // nothing cached for another week: the page says it is offline
        let otherWeek = StubTransport()
        otherWeek.on("getCapacityWeek", .fail(URLError(.notConnectedToInternet)))
        let empty = KapacitasStore(client: Self.client(otherWeek), cache: cache)
        await empty.loadWeek(monday: "2026-11-30")
        #expect(empty.weeks["2026-11-30"] == nil && empty.weekProblem["2026-11-30"] == .offline)
    }

    @Test func outboxReplayDoesNotDoubleAccept() async throws {
        // offline: the accept is queued once, however often he taps it
        let off = StubTransport()
        off.on("getCapacityWeek", .json(200, Self.weekJSON()))
        off.on("acceptCapacityProposal", .fail(URLError(.notConnectedToInternet)))
        off.on("acceptCapacityProposal", .fail(URLError(.notConnectedToInternet)))
        final class NoSender: OutboxSender { func send(_ item: OutboxItem) async -> OutboxSendResult { .offline } }
        let outbox = Outbox(directory: Self.tempDir("outbox"), sender: NoSender())
        let store = KapacitasStore(client: Self.client(off), cache: nil, outbox: outbox)
        await store.loadWeek(monday: Self.monday)
        let p = try #require(store.weeks[Self.monday]?.proposals.first)
        await store.accept(p, monday: Self.monday)
        await store.accept(p, monday: Self.monday)
        let queue = await outbox.queue
        #expect(queue.count == 1)
        let item = try #require(queue.first)
        #expect(item.kind == .dayAdjustment)
        let payload = try #require(KapacitasOutboxSender.decode(item.payload))
        #expect(payload.proposalId == Self.proposalId)
        #expect(payload.clientRef == item.id.uuidString.lowercased())
        #expect(store.queuedAccepts.contains(Self.proposalId))

        // the replay: the first answer is lost (a server fault), the resend carries the same clientRef
        let server = StubTransport()
        server.on("acceptCapacityProposal", .status(503))
        server.on("acceptCapacityProposal", .json(200, "[]"))
        let sender = KapacitasOutboxSender(raw: Self.raw(server))
        #expect(await sender.send(item) == .retryLater)
        #expect(await sender.send(item) == .sent(nil))
        let bodies = server.sent.map(\.body)
        #expect(bodies.count == 2 && bodies[0] == bodies[1])
        #expect(bodies[0] == #"{"clientRef":"\#(payload.clientRef)"}"#)
        #expect(server.sent[0].path == "/api/capacity/proposals/\(Self.proposalId)/accept")

        // a stale answer on replay is not retried forever
        let stale = StubTransport()
        stale.on("acceptCapacityProposal", .json(409, #"{"messages":[{"code":"CAPACITY_PROPOSAL_STALE"}]}"#))
        #expect(await KapacitasOutboxSender(raw: Self.raw(stale)).send(item) == .failed("CAPACITY_PROPOSAL_STALE"))
    }

    @Test func undoCallsDelete() async throws {
        let adjustments = #"""
        [{"id":"aaaaaaaa-0000-4000-8000-000000000001","date":"2026-11-26","kind":"MOVE_SESSION_DAY",
          "payload":{},"bundleId":"bbbbbbbb-0000-4000-8000-000000000001","proposalId":"\#(Self.proposalId)",
          "state":"active","createdAt":"2026-11-22T08:00:00Z"}]
        """#
        let stub = StubTransport()
        stub.on("getCapacityWeek", .json(200, Self.weekJSON(status: "accepted", adjustments: adjustments)))
        stub.on("undoCapacityAdjustment", .status(204))
        stub.on("getCapacityWeek", .json(200, Self.weekJSON(status: "undone")))
        let store = KapacitasStore(client: Self.client(stub), cache: nil)
        await store.loadWeek(monday: Self.monday)
        let p = try #require(store.weeks[Self.monday]?.proposals.first)
        await store.undo(p, monday: Self.monday)
        #expect(stub.ops == ["getCapacityWeek", "undoCapacityAdjustment", "getCapacityWeek"])
        #expect(stub.sent[1].path == "/api/capacity/adjustments/aaaaaaaa-0000-4000-8000-000000000001")
        #expect(store.weeks[Self.monday]?.proposals.first?.status == "undone")
    }

    @Test func staleAcceptRefreshes() async throws {
        let stub = StubTransport()
        stub.on("getCapacityWeek", .json(200, Self.weekJSON()))
        stub.on("acceptCapacityProposal", .json(409, #"{"messages":[{"code":"CAPACITY_PROPOSAL_STALE"}]}"#))
        // the refreshed week has the card expired and nothing open for that day: ask for new proposals
        stub.on("getCapacityWeek", .json(200, Self.weekJSON(status: "expired")))
        stub.on("regenerateCapacityProposals", .json(200, Self.weekJSON(proposals: "[]")))
        let store = KapacitasStore(client: Self.client(stub), cache: nil)
        await store.loadWeek(monday: Self.monday)
        let p = try #require(store.weeks[Self.monday]?.proposals.first)
        await store.accept(p, monday: Self.monday)
        #expect(stub.ops == ["getCapacityWeek", "acceptCapacityProposal", "getCapacityWeek", "regenerateCapacityProposals"])
        #expect(stub.sent[3].path == "/api/capacity/proposals/regenerate?monday=2026-11-23")
        #expect(store.notice == "Közben változott a heted, frissítettem a javaslatokat.")
        #expect(store.weeks[Self.monday]?.proposals.isEmpty == true)

        // a refreshed week that still has an open card for that day is not regenerated
        let kept = StubTransport()
        kept.on("getCapacityWeek", .json(200, Self.weekJSON()))
        kept.on("acceptCapacityProposal", .json(409, #"{"messages":[{"code":"CAPACITY_PROPOSAL_STALE"}]}"#))
        kept.on("getCapacityWeek", .json(200, Self.weekJSON()))
        let other = KapacitasStore(client: Self.client(kept), cache: nil)
        await other.loadWeek(monday: Self.monday)
        await other.accept(p, monday: Self.monday)
        #expect(kept.ops == ["getCapacityWeek", "acceptCapacityProposal", "getCapacityWeek"])
    }

    @Test func weekLogicWords() {
        #expect(kapacitasMonday(of: "2026-11-26") == "2026-11-23")
        #expect(kapacitasMonday(of: "2026-11-23") == "2026-11-23")
        #expect(kapacitasMonday(of: "2026-11-29") == "2026-11-23")
        #expect(kapacitasNextMonday(after: "2026-11-23") == "2026-11-30")
        #expect(kapacitasWeekLabel(monday: "2026-11-23") == "nov. 23–29.")
        #expect(kapacitasWeekLabel(monday: "2026-11-30") == "nov. 30. – dec. 6.")
    }

    // MARK: - Fix round 1

    static func refused(_ code: String) -> OutboxItem {
        let ref = UUID()
        let payload = try! JSONEncoder().encode(DayAdjustmentPayload(proposalId: proposalId, clientRef: ref.uuidString.lowercased()))
        return OutboxItem(id: ref, kind: .dayAdjustment, date: "2026-11-26", capturedAt: Date(), payload: payload,
                          failure: code)
    }

    final class NoSender: OutboxSender { func send(_ item: OutboxItem) async -> OutboxSendResult { .offline } }

    @Test func replayRefusalsSayWhatHappened() async throws {
        // a started day: its own line, the item leaves the queue
        let outbox = Outbox(directory: Self.tempDir("refused"), sender: NoSender())
        try await outbox.enqueue(Self.refused("CAPACITY_DAY_STARTED"))
        let stub = StubTransport()
        stub.on("getCapacityWeek", .json(200, Self.weekJSON()))
        stub.on("getCapacityWeek", .json(200, Self.weekJSON()))   // the refresh after the refusal
        let store = KapacitasStore(client: Self.client(stub), cache: nil, outbox: outbox)
        await store.loadWeek(monday: Self.monday)
        #expect(stub.ops == ["getCapacityWeek", "getCapacityWeek"])
        #expect(store.notice == "Ez a nap már elkezdődött, rajta már nem változtatok.")
        #expect(await outbox.queue.isEmpty)

        // a stale replay: the same refresh as an online stale accept (re-read, regenerate when nothing open is left)
        let box = Outbox(directory: Self.tempDir("refused2"), sender: NoSender())
        let s2 = StubTransport()
        s2.on("getCapacityWeek", .json(200, Self.weekJSON()))
        s2.on("getCapacityWeek", .json(200, Self.weekJSON(status: "expired")))
        s2.on("regenerateCapacityProposals", .json(200, Self.weekJSON(proposals: "[]")))
        let other = KapacitasStore(client: Self.client(s2), cache: nil, outbox: box)
        await other.loadWeek(monday: Self.monday)
        try await box.enqueue(Self.refused("CAPACITY_PROPOSAL_STALE"))
        await other.syncOutbox()
        #expect(s2.ops == ["getCapacityWeek", "getCapacityWeek", "regenerateCapacityProposals"])
        #expect(other.notice == KapacitasStore.staleNotice)
        #expect(await box.queue.isEmpty)
    }

    @Test func visszaWhileSendingWaits() async throws {
        final class SlowSender: OutboxSender {
            func send(_ item: OutboxItem) async -> OutboxSendResult { try? await Task.sleep(for: .milliseconds(400)); return .sent(nil) }
        }
        let outbox = Outbox(directory: Self.tempDir("flying"), sender: SlowSender())
        let stub = StubTransport()
        stub.on("getCapacityWeek", .json(200, Self.weekJSON()))
        stub.on("acceptCapacityProposal", .fail(URLError(.notConnectedToInternet)))
        let store = KapacitasStore(client: Self.client(stub), cache: nil, outbox: outbox)
        await store.loadWeek(monday: Self.monday)
        let p = try #require(store.weeks[Self.monday]?.proposals.first)
        await store.accept(p, monday: Self.monday)
        #expect(store.queuedAccepts.contains(p.id))

        let flush = Task { await outbox.flush() }
        try await Task.sleep(for: .milliseconds(100))
        await store.undo(p, monday: Self.monday)
        #expect(store.sendingQueued.contains(p.id))
        #expect(store.notice == KapacitasStore.sendingNotice)
        #expect(await outbox.queue.count == 1)   // not pulled out from under the send

        await flush.value
        await store.syncOutbox()
        #expect(store.sendingQueued.isEmpty && store.notice == nil && !store.queuedAccepts.contains(p.id))
    }

    @Test func whereYouSeeCopyAndAllEffects() throws {
        let move = KapacitasProposal(id: "m", kind: "MOVE_SESSION_DAY", day: "2026-11-26", status: "open", title: "",
                                     move: "", effectLines: [], why: [], effects: [],
                                     steps: [KapacitasStep(kind: "MOVE_SESSION_DAY",
                                                           payload: KapacitasStepPayload(fromDate: "2026-11-26", toDate: "2026-11-28"))])
        #expect(kapacitasWhereYouSee(move).map(\.body) == [
            "Szombaton a napod oldalán és a lejátszóban ott lesz az edzés, csütörtökön már nem. Az edzésnapi többlet is szombaton jár, amikor megcsinálod."])
        let sleep = KapacitasProposal(id: "s", kind: "SHIFT_BEDTIME", day: "2026-11-25", status: "open", title: "", move: "",
                                      effectLines: [], why: [], effects: [],
                                      steps: [KapacitasStep(kind: "SHIFT_BEDTIME", payload: KapacitasStepPayload(night: "2026-11-25", bedtime: "23:15:00")),
                                              KapacitasStep(kind: "SHIFT_SESSION_TIME", payload: KapacitasStepPayload(date: "2026-11-26", time: "07:45"))])
        #expect(kapacitasWhereYouSee(sleep).map(\.body) == [
            "Szerda este a lefekvés-emlékeztető 23:15-re igazodik.",
            "Csütörtökön a napod oldalán és a lejátszóban 7:45-kor kezdődik az edzés."])
        #expect(clockSublative("22:30") == "22:30-ra" && clockSublative("21:40") == "21:40-re" && clockSublative("18:00") == "18:00-ra")
        let todo = KapacitasProposal(id: "t", kind: "CALENDAR_TODO", day: "2026-11-27", status: "open", title: "", move: "",
                                     effectLines: [], why: [], effects: [])
        #expect(kapacitasWhereYouSee(todo).map(\.body) == ["Te teszed át a naptáradban, én észreveszem."])
        // nothing names the kcal target
        #expect(!kapacitasWhereYouSee(move).contains { $0.body.contains("keret") })

        // the week's „Ha mindet jóváhagyod" lines decode; absent stays nil; a step's payload is read leniently
        let json = Self.weekJSON().replacingOccurrences(of: #""patterns":[]}"#, with:
            #""patterns":[],"allEffects":[{"label":"Túl sok nap a héten","before":"1","after":"0","favours":1}]}"#)
        let w = try JSONDecoder().decode(KapacitasWeek.self, from: Data(json.utf8))
        #expect(w.allEffects?.first?.after == "0")
        #expect(w.proposals.first?.steps.first?.payload?.toDate == "2026-11-28")
        #expect(try JSONDecoder().decode(KapacitasWeek.self, from: Data(Self.weekJSON().utf8)).allEffects == nil)
    }

    @Test func mondayIsGregorianInTheGivenZone() {
        // 2026-11-29 23:30 UTC is already Monday 30 in Tokyo, still Sunday in UTC
        let instant = Date(timeIntervalSince1970: 1_795_995_000)
        #expect(kapacitasMonday(for: instant, timeZone: TimeZone(identifier: "UTC")!) == "2026-11-23")
        #expect(kapacitasMonday(for: instant, timeZone: TimeZone(identifier: "Asia/Tokyo")!) == "2026-11-30")
    }
}
