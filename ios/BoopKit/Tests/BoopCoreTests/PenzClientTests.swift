import Foundation
import Testing
@testable import BoopCore

@Suite("Pénz — the client, the cash outbox and the store")
@MainActor
struct PenzClientTests {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" })
    }

    static let allowanceJSON = #"""
    {"date":"2026-11-19","month":{"month":"2026-11","free":{"minor":31400000,"currency":"HUF","hufMinor":31400000},
     "spent":{"minor":21900000,"currency":"HUF","hufMinor":21900000},"remaining":{"minor":9500000,"currency":"HUF","hufMinor":9500000}},
     "week":{"start":"2026-11-16","end":"2026-11-22","budget":{"minor":7700000,"currency":"HUF","hufMinor":7700000},
     "spent":{"minor":4250000,"currency":"HUF","hufMinor":4250000},"remaining":{"minor":3450000,"currency":"HUF","hufMinor":3450000},
     "perDay":{"minor":862500,"currency":"HUF","hufMinor":862500}},
     "lines":[{"key":"recurringIncome","amount":{"minor":98000000,"currency":"HUF","hufMinor":98000000}},
              {"key":"somethingNew","amount":{"minor":1,"currency":"HUF","hufMinor":1}}]}
    """#

    static let txJSON = #"""
    [{"id":"t1","accountId":"a1","kind":"expense","amount":{"minor":824000,"currency":"HUF","hufMinor":824000},
      "categoryId":"c1","date":"2026-11-19","note":"Spar","source":"sms","needsReview":true,"smsMessageId":"s1","fxRate":null},
     {"id":"t2","accountId":"a1","kind":"a_kind_from_the_future","amount":{"minor":100,"currency":"EUR","hufMinor":39000},
      "date":"2026-11-18","source":"manual","needsReview":false}]
    """#

    // MARK: reads

    @Test func readsTheAllowanceLenientlyWithTheToken() async throws {
        let stub = StubTransport()
        stub.on("getPenzAllowance", .json(200, Self.allowanceJSON))
        let a = try await PenzClient(raw: Self.raw(stub)).allowance(date: "2026-11-19")
        #expect(a.week.remaining.hufMinor == 3_450_000 && a.line("recurringIncome") == 98_000_000)
        #expect(a.line("previousDeficit") == 0, "a missing line reads 0")
        #expect(stub.sent[0].path == "/api/penz/allowance?date=2026-11-19" && stub.sent[0].auth == "Bearer tok")
    }

    @Test func transactionsDecodeUnknownKindsAndExtraFields() async throws {
        let stub = StubTransport()
        stub.on("listPenzTransactions", .json(200, Self.txJSON))
        let t = try await PenzClient(raw: Self.raw(stub)).transactions(month: "2026-11")
        #expect(t.count == 2 && t[0].needsReview && t[0].note == "Spar")
        #expect(t[1].kind == "a_kind_from_the_future" && t[1].amount.hufMinor == 39_000)
        #expect(stub.sent[0].path == "/api/penz/transactions?month=2026-11")
    }

    @Test func goalsDecodeTheL5Wire() async throws {
        let stub = StubTransport()
        stub.on("listPenzSavingsGoals", .json(200, #"""
        [{"id":"g1","name":"Nyári út","kind":"goal","target":{"minor":60000000,"currency":"HUF","hufMinor":60000000},
          "saved":{"minor":32000000,"currency":"HUF","hufMinor":32000000},"dueDate":"2027-06-15","position":1}]
        """#))
        let g = try await PenzClient(raw: Self.raw(stub)).goals()
        #expect(g.first?.dueDate == "2027-06-15" && g.first?.saved.hufMinor == 32_000_000)
        #expect(stub.sent[0].path == "/api/penz/savings-goals")
    }

    // MARK: online writes

    @Test func confirmPutsTheCategoryThenMarksReviewed() async throws {
        let stub = StubTransport()
        let one = #"{"id":"t1","accountId":"a1","kind":"expense","amount":{"minor":824000,"currency":"HUF","hufMinor":824000},"date":"2026-11-19","source":"sms","needsReview":false}"#
        stub.on("updatePenzTransaction", .json(200, one))
        stub.on("markPenzTransactionReviewed", .json(200, one))
        let t = PenzFixtures.tx("t1", 8_240, "c-eat", source: "sms", review: true, note: "Spar")
        _ = try await PenzClient(raw: Self.raw(stub)).confirm(t, categoryId: "c-food")
        #expect(stub.ops == ["updatePenzTransaction", "markPenzTransactionReviewed"])
        #expect(stub.sent[0].path == "/api/penz/transactions/t1")
        #expect(stub.sent[0].body?.contains(#""categoryId":"c-food""#) == true)
        #expect(stub.sent[0].body?.contains(#""amountMinor":824000"#) == true)
        #expect(stub.sent[1].path == "/api/penz/transactions/t1/reviewed")
    }

    @Test func confirmWithTheSameCategoryOnlyMarksReviewed() async throws {
        let stub = StubTransport()
        stub.on("markPenzTransactionReviewed", .json(200, #"{"id":"t1","date":"2026-11-19"}"#))
        _ = try await PenzClient(raw: Self.raw(stub)).confirm(PenzFixtures.tx("t1", 1, "c-food", review: true), categoryId: "c-food")
        #expect(stub.ops == ["markPenzTransactionReviewed"])
    }

    @Test func settingsCarryEverythingHeDidNotEdit() async throws {
        let stub = StubTransport()
        stub.on("putPenzSettings", .json(200, #"{"savingsTargetHufMinor":25000000,"practiceMonthlyHufMinor":0}"#))
        let base = PenzSettings(savingsTargetHufMinor: 1, practiceMonthlyHufMinor: 1, weekStart: "monday",
                                emergencyFundMonths: 6, timezone: "Europe/Budapest",
                                monthOverrides: ["2026-12": PenzMonthOverride(savingsTargetHufMinor: 5)])
        _ = try await PenzClient(raw: Self.raw(stub)).saveSettings(
            PenzSettingsRequest(from: base, savingsTargetHufMinor: 25_000_000, practiceMonthlyHufMinor: 0))
        let body = stub.sent[0].body ?? ""
        #expect(body.contains(#""savingsTargetHufMinor":25000000"#) && body.contains(#""practiceMonthlyHufMinor":0"#))
        #expect(body.contains(#""timezone":"Europe\/Budapest""#) && body.contains(#""2026-12""#))
    }

    @Test func closeMonthAndGoalCalls() async throws {
        let stub = StubTransport()
        stub.on("closePenzMonth", .json(409, #"[{"code":"PENZ_NO_SAVINGS_TARGET_ACCOUNT","message":"x"}]"#))
        stub.on("createPenzSavingsGoal", .json(200, #"{"id":"g9","name":"Futócipő","kind":"purchase","target":{"minor":3059000,"currency":"HUF","hufMinor":3059000},"saved":{"minor":0,"currency":"HUF","hufMinor":0},"position":0}"#))
        stub.on("deletePenzSavingsGoal", .status(204))
        let c = PenzClient(raw: Self.raw(stub))
        do {
            _ = try await c.closeMonth("2026-10", leftoverAction: "transferred")
            Issue.record("a 409 must throw")
        } catch {
            let e = (error as? PlanFetchError) ?? .server
            #expect(e == .conflict("PENZ_NO_SAVINGS_TARGET_ACCOUNT"))
            #expect(penzErrorText(e).contains("megtakarítási számla"))
        }
        #expect(stub.sent[0].path == "/api/penz/month-closes/2026-10" && stub.sent[0].body == #"{"leftoverAction":"transferred"}"#)
        let g = try await c.createGoal(PenzGoalRequest(name: "Futócipő", kind: "purchase", targetHufMinor: 3_059_000))
        #expect(g.kind == "purchase")
        #expect(stub.sent[1].body?.contains(#""targetHufMinor":3059000"#) == true)
        #expect(stub.sent[1].body?.contains("savedHufMinor") == false, "an absent optional is not sent")
        try await c.deleteGoal(id: "g9")
        #expect(stub.sent[2].path == "/api/penz/savings-goals/g9")
    }

    @Test func createCashAccountPostsAForintCashAccountAsDefault() async throws {
        let stub = StubTransport()
        stub.on("createPenzAccount", .json(201, #"{"id":"a-new","name":"Készpénz","type":"cash","currency":"HUF","openingBalanceMinor":0,"isDefault":true,"isSavingsTarget":false,"archived":false}"#))
        let a = try await PenzClient(raw: Self.raw(stub)).createAccount(.cash)
        #expect(a.id == "a-new" && a.type == "cash" && a.isDefault)
        #expect(stub.sent[0].path == "/api/penz/accounts")
        #expect(stub.sent[0].body?.contains(#""type":"cash""#) == true)
        #expect(stub.sent[0].body?.contains(#""currency":"HUF""#) == true)
        #expect(stub.sent[0].body?.contains(#""isDefault":true"#) == true)
    }

    // MARK: the cash outbox

    @Test func payloadRoundTripsThroughTheOutboxItem() throws {
        let p = PenzExpensePayload(accountId: "a-cash", amountMinor: 189_000, categoryId: "c-eat", date: "2026-11-19", note: "Kávézó")
        let item = OutboxItem(kind: .penzExpense, date: "2026-11-19", capturedAt: Date(), payload: RitmusPayload.encode(p))
        #expect(RitmusPayload.decodePenzExpense(item.payload) == p)
        let data = try JSONEncoder().encode(item)
        let back = try JSONDecoder().decode(OutboxItem.self, from: data)
        #expect(back.kind == .penzExpense && OutboxKind(rawValue: "penzExpense") == .penzExpense)
        #expect(Outbox.group(of: item).waits == false, "one stuck amount never holds another back")
    }

    @Test func senderPostsTheTransactionWithTheItemIdAsClientRef() async {
        let stub = StubTransport()
        stub.on("createPenzTransaction", .json(200, #"{"id":"t9","date":"2026-11-19"}"#))
        let id = UUID()
        let item = OutboxItem(id: id, kind: .penzExpense, date: "2026-11-19", capturedAt: Date(),
                              payload: RitmusPayload.encode(PenzExpensePayload(accountId: "a-cash", amountMinor: 189_000,
                                                                               categoryId: nil, date: "2026-11-19")))
        let result = await PenzOutboxSender(raw: Self.raw(stub)).send(item)
        guard case .sent = result else { Issue.record("expected sent, got \(result)"); return }
        let s = stub.sent[0]
        #expect(s.op == "createPenzTransaction" && s.path == "/api/penz/transactions" && s.auth == "Bearer tok")
        let body = s.body ?? ""
        #expect(body.contains(#""clientRef":"\#(id.uuidString.lowercased())""#))
        #expect(body.contains(#""kind":"expense""#) && body.contains(#""amountMinor":189000"#))
        #expect(body.contains(#""currency":"HUF""#) && body.contains(#""accountId":"a-cash""#) && body.contains(#""date":"2026-11-19""#))
        #expect(!body.contains("categoryId"), "no category chosen, none sent")
    }

    @Test func senderMapsStatusesToTheOutboxVocabulary() async {
        let cases: [(StubTransport.Reply, OutboxSendResult)] = [
            (.status(201), .sent(nil)), (.status(400), .failed("HTTP 400")), (.status(404), .failed("HTTP 404")),
            (.status(401), .retryLater), (.status(409), .retryLater), (.status(503), .retryLater),
            (.fail(URLError(.notConnectedToInternet)), .offline), (.fail(URLError(.timedOut)), .retryLater),
        ]
        for (reply, expected) in cases {
            let stub = StubTransport()
            stub.on("createPenzTransaction", reply)
            let item = OutboxItem(kind: .penzExpense, date: "2026-11-19", capturedAt: Date(),
                                  payload: RitmusPayload.encode(PenzExpensePayload(accountId: "a", amountMinor: 100, date: "2026-11-19")))
            let got = await PenzOutboxSender(raw: Self.raw(stub)).send(item)
            if case .sent = expected, case .sent = got { continue }
            #expect(got == expected, "\(reply)")
        }
        let junk = OutboxItem(kind: .penzExpense, date: "2026-11-19", capturedAt: Date(), payload: Data("x".utf8))
        #expect(await PenzOutboxSender(raw: Self.raw(StubTransport())).send(junk) == .failed("unreadable penzExpense payload"))
    }

    // MARK: the store

    private func scriptAll(_ stub: StubTransport, allowance: StubTransport.Reply? = nil) {
        stub.on("getPenzAllowance", allowance ?? .json(200, Self.allowanceJSON))
        stub.on("listPenzTransactions", .json(200, Self.txJSON))
        stub.on("listPenzCategories", .json(200, #"[{"id":"c1","name":"Élelmiszer","kind":"expense","position":0}]"#))
        stub.on("listPenzAccounts", .json(200, #"[{"id":"a1","name":"Készpénz","type":"cash","currency":"HUF","isDefault":true,"isSavingsTarget":false,"archived":false}]"#))
        stub.on("listOpenPenzMonths", .json(200, "[]"))
        stub.on("listPenzSavingsGoals", .status(404))
        stub.on("getPenzSettings", .json(200, #"{"savingsTargetHufMinor":20000000,"practiceMonthlyHufMinor":2000000}"#))
        // L6 reads Pénzem and the digest alongside; these L5 tests do not look at them.
        stub.on("getPenzPortfolio", .status(404))
        stub.on("getPenzDigest", .status(404))
        stub.on("getPenzWeeklyReview", .status(404))
    }

    @Test func storeReadsEverythingCachesItAndShowsTheCacheWithItsAgeOffline() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("penz-cache-\(UUID().uuidString)")
        let clock = TestClock(Date(timeIntervalSince1970: 1_800_000_000))
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let stub = StubTransport()
        scriptAll(stub)
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: cache, clock: { clock.now })
        await store.load()
        #expect(store.problem == nil && store.allowance?.week.remaining.hufMinor == 3_450_000)
        #expect(store.reviewRows.count == 1 && store.verdict == .review(count: 1))
        #expect(store.value?.goals == nil, "goals that could not be read are nil, never an empty list")
        #expect(store.cashAccount?.id == "a1")

        clock.advance(3 * 3600)
        let offline = StubTransport()
        for op in ["getPenzAllowance", "listPenzTransactions", "listPenzCategories", "listPenzAccounts", "listOpenPenzMonths",
                   "listPenzSavingsGoals", "getPenzSettings", "getPenzPortfolio", "getPenzDigest", "getPenzWeeklyReview"] {
            offline.on(op, .fail(URLError(.notConnectedToInternet)))
        }
        let later = PenzStore(client: PenzClient(raw: Self.raw(offline)), cache: cache, clock: { clock.now })
        await later.load()
        #expect(later.problem == nil && later.offline)
        #expect(later.allowance?.week.remaining.hufMinor == 3_450_000)
        #expect(later.ageText == "3 órás adat")
    }

    @Test func storeReportsAServerFaultAsItselfAndNoCacheOfflineAsOffline() async {
        let stub = StubTransport()
        scriptAll(stub, allowance: .status(500))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        await store.load()
        #expect(store.problem == .server && store.value == nil)

        let off = StubTransport()
        scriptAll(off, allowance: .fail(URLError(.notConnectedToInternet)))
        let s2 = PenzStore(client: PenzClient(raw: Self.raw(off)), cache: nil)
        await s2.load()
        #expect(s2.problem == .offline)
    }

    @Test func storeLaysPendingCashOverTheWeek() async {
        let stub = StubTransport()
        scriptAll(stub)
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil, clock: { Date(timeIntervalSince1970: 1_795_089_600) })
        await store.load()
        let id = UUID()
        let p = PenzExpensePayload(accountId: "a1", amountMinor: 189_000, date: "2026-11-19", note: "Kávézó")
        store.setPending([OutboxItem(id: id, kind: .penzExpense, date: "2026-11-19", capturedAt: Date(), payload: RitmusPayload.encode(p)),
                          OutboxItem(kind: .journal, date: "2026-11-19", capturedAt: Date(), payload: Data())])
        #expect(store.pending.count == 1)
        #expect(store.problem == nil)
        let remaining: Int64 = store.allowance?.week.remaining.hufMinor ?? 0
        #expect(remaining == 3_261_000)
        #expect(store.todayItems.first?.title == "Kávézó" && store.todayItems.first?.pending == true)
    }

    // MARK: review round (2026-11-20)

    @Test func aFirstLoadThatFoundNoNetIsRetriedWithoutForce() async {
        let off = StubTransport()
        scriptAll(off, allowance: .fail(URLError(.notConnectedToInternet)))
        scriptAll(off)   // the second round answers
        let store = PenzStore(client: PenzClient(raw: Self.raw(off)), cache: nil)
        await store.load()
        #expect(store.problem == .offline)
        await store.load()
        #expect(store.problem == nil && store.value != nil, "an offline first read must not stick for ever")
    }

    @Test func aForcedReloadDuringALoadRunsAfterIt() async {
        let stub = StubTransport()
        stub.on("getPenzAllowance", .slowJson(200, Self.allowanceJSON, ms: 300))
        for op in ["listPenzTransactions", "listPenzCategories", "listPenzAccounts", "listOpenPenzMonths", "listPenzSavingsGoals", "getPenzSettings"] {
            stub.on(op, .json(200, op == "getPenzSettings" ? #"{"savingsTargetHufMinor":1,"practiceMonthlyHufMinor":1}"# : "[]"))
        }
        stub.on("getPenzPortfolio", .status(404)); stub.on("getPenzDigest", .status(404))
        stub.on("getPenzWeeklyReview", .status(404))
        scriptAll(stub)
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        async let first: Void = store.load()
        try? await Task.sleep(for: .milliseconds(60))
        await store.load(force: true)   // arrives while the first is in flight
        await first
        #expect(stub.ops.filter { $0 == "getPenzAllowance" }.count == 2, "the forced reload is not dropped")
        #expect(store.transactions.count == 2, "the second read's rows are on screen")
    }

    @Test func aFailedTransactionsReadNeverCarriesAnotherMonthsRows() async {
        let clock = TestClock(Date(timeIntervalSince1970: 1_798_804_800))   // 2027-01-01 noon UTC
        let failing = StubTransport()
        for op in ["getPenzAllowance", "listPenzCategories", "listPenzAccounts", "listOpenPenzMonths", "listPenzSavingsGoals", "getPenzSettings"] {
            failing.on(op, op == "getPenzAllowance" ? .json(200, Self.allowanceJSON)
                                                    : .json(200, op == "getPenzSettings" ? #"{"savingsTargetHufMinor":1,"practiceMonthlyHufMinor":1}"# : "[]"))
        }
        failing.on("listPenzTransactions", .status(500))
        failing.on("getPenzPortfolio", .status(404)); failing.on("getPenzDigest", .status(404))
        failing.on("getPenzWeeklyReview", .status(404))
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("penz-month-\(UUID().uuidString)")
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let old = PenzSnapshot(allowance: PenzFixtures.allowance(), transactions: [PenzFixtures.tx("old", 1, nil, date: "2026-11-19")])
        try? await cache.put(old, endpoint: "penz/snapshot", date: "current")
        let next = PenzStore(client: PenzClient(raw: Self.raw(failing)), cache: cache, clock: { clock.now })
        await next.load()
        #expect(next.transactionsFailed)
        #expect(next.transactions.isEmpty, "November's rows are not January's")
        #expect(next.today == "2027-01-01", "today is the device's, not a stale allowance date")
    }

    @Test func settingsSaveReadsFreshSettingsAndNeverWritesTheCachedTimezone() async throws {
        let stub = StubTransport()
        scriptAll(stub)
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        await store.load()
        stub.on("getPenzSettings", .json(200, #"{"savingsTargetHufMinor":1,"practiceMonthlyHufMinor":1,"timezone":"Europe/Vienna"}"#))
        stub.on("putPenzSettings", .json(200, #"{"savingsTargetHufMinor":5,"practiceMonthlyHufMinor":0}"#))
        scriptAll(stub)   // the re-read after the save
        #expect(await store.saveSettings(savingsTargetHufMinor: 500, practiceMonthlyHufMinor: 0) == nil)
        let put = stub.sent.first { $0.op == "putPenzSettings" }?.body ?? ""
        #expect(put.contains("Europe\\/Vienna"), "the fresh GET's timezone, not the snapshot's")

        let lost = StubTransport()
        scriptAll(lost)
        let s2 = PenzStore(client: PenzClient(raw: Self.raw(lost)), cache: nil)
        await s2.load()
        lost.on("getPenzSettings", .fail(URLError(.timedOut)))
        lost.on("putPenzSettings", .json(200, #"{"savingsTargetHufMinor":5,"practiceMonthlyHufMinor":0}"#))
        scriptAll(lost)
        _ = await s2.saveSettings(savingsTargetHufMinor: 500, practiceMonthlyHufMinor: 0)
        let put2 = lost.sent.first { $0.op == "putPenzSettings" }?.body ?? ""
        #expect(put2 == #"{"practiceMonthlyHufMinor":0,"savingsTargetHufMinor":500}"#, "without a fresh read only the edited lines go")
    }

    @Test func todaysItemsLeaveReviewRowsToTheAggregateRow() async {
        let stub = StubTransport()
        scriptAll(stub)
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil, clock: { Date(timeIntervalSince1970: 1_795_089_600) })   // 2026-11-19 noon UTC
        await store.load()
        #expect(store.reviewRows.count == 1)
        #expect(!store.todayItems.contains { $0.needsReview }, "a review row is shown once, inside the aggregate")
    }
}
