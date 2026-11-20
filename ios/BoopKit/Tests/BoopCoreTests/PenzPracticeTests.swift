import Foundation
import Testing
@testable import BoopCore

/// Invented, real-looking figures (the spike's), never the owner's.
enum PenzL7Fixtures {
    static let overviewJSON = #"""
    {"paper":true,"month":"2026-11","somethingNew":1,
     "cap":{"capHufMinor":2000000,"usedHufMinor":1200000,"leftHufMinor":800000},
     "monthPnlHufMinor":120000,"avgR":0.3,"closedCount":4,"taggedCount":4,
     "noiseLine":"50 jelölt kereskedés alatt ezek a számok még zajnak számítanak — most 4 van.",
     "tags":[{"key":"kitores","label":"Kitörés"},{"key":"visszateszt","label":"Visszateszt"},
             {"key":"hirre","label":"Hírre ugrottam"},{"key":"korai_zaras","label":"Korán zártam"}],
     "week":{"weekStart":"2026-11-16","weekEnd":"2026-11-22",
             "headline":"A terv nélküli belépések vitték el a hetet","sub":"Négy kereskedésből háromnál *+0,8R*.",
             "closedCount":4,"winRatePct":50,"avgR":-0.1,
             "bySetup":[{"tag":"kitores","label":"Kitörés","count":1,"wins":1,"avgR":1.9}],
             "distribution":{"bigWins":0,"smallLosses":1,"worseThanLimit":1,"healthy":false},
             "commonMistake":{"tag":"hirre","label":"Hírre ugrottam","count":1,"costHufMinor":510000},
             "observations":[{"title":"A terv a döntő","body":"Amikor előre leírtad…"}],
             "curve":[{"date":"2026-11-16","cumulativeHufMinor":0},{"date":"2026-11-17","cumulativeHufMinor":380000},
                      {"date":"2026-11-18","cumulativeHufMinor":-200000}],
             "trades":[{"id":"t1","paper":true,"status":"closed","instrument":"OTP","direction":"long","why":"Kitörés",
                        "currency":"HUF","quantity":2,"stop":{"minor":1980000,"currency":"HUF","hufMinor":1980000},
                        "entry":{"minor":2000000,"currency":"HUF"},"exit":{"minor":2038000,"currency":"HUF"},
                        "rMultiple":1.9,"tags":["kitores"],"mistake":false,"stopRespected":true,"createdAt":"2026-11-17T09:00:00Z"}]},
     "open":[{"id":"t2","status":"open","instrument":"Mol","direction":"long","currency":"HUF","quantity":10,
              "stop":{"minor":290000},"entry":{"minor":300000},"entryDate":"2026-11-18",
              "lastClose":{"minor":305000,"currency":"HUF"},"lastCloseDate":"2026-11-19","unrealizedHufMinor":50000,
              "tags":[],"mistake":false,"createdAt":"2026-11-18T08:00:00Z","futureField":"x"}],
     "planned":[{"id":"t3","status":"planned","instrument":"Richter","direction":"short","currency":"HUF","quantity":1,
                 "plannedEntry":{"minor":1050000},"stop":{"minor":1080000},"createdAt":"2026-11-19T08:00:00Z"}]}
    """#

    static func trade(_ id: String = "t", status: String = "closed", instrument: String = "OTP", r: Double? = 1.9,
                      tags: [String] = ["kitores"], mistake: Bool = false, stopRespected: Bool? = true,
                      target: Int64? = nil, exit: Int64? = 2_038_000, direction: String = "long") -> PenzPaperTrade {
        PenzPaperTrade(id: id, status: status, instrument: instrument, direction: direction, stop: .huf(1_980_000),
                       target: target.map(PenzMoney.huf), entry: .huf(2_000_000), exit: exit.map(PenzMoney.huf), rMultiple: r,
                       tags: tags, mistake: mistake, stopRespected: stopRespected)
    }
}

@Suite("Pénz L7 — practice: the client, the store, the wording")
@MainActor
struct PenzPracticeTests {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" })
    }

    // MARK: client

    @Test func overviewDecodesLenientlyWithTheToken() async throws {
        let stub = StubTransport()
        stub.on("getPenzPractice", .json(200, PenzL7Fixtures.overviewJSON))
        let o = try await PenzClient(raw: Self.raw(stub)).practice()
        #expect(o.cap.leftHufMinor == 800_000 && o.avgR == 0.3 && o.taggedCount == 4)
        #expect(o.week.headline?.hasPrefix("A terv") == true && o.week.commonMistake?.costHufMinor == 510_000)
        #expect(o.week.distribution.healthy == false && o.week.curve.count == 3)
        #expect(o.open.first?.lastClose?.minor == 305_000 && o.planned.first?.direction == "short")
        // a missing hufMinor on a forint amount falls back to the amount; a missing field is nothing, never invented
        #expect(o.planned.first?.plannedEntry?.hufMinor == 1_050_000 && o.planned.first?.entry == nil)
        #expect(stub.sent[0].path == "/api/penz/practice" && stub.sent[0].auth == "Bearer tok")
    }

    @Test func writesHitTheContractPathsWithTheRightBodies() async throws {
        let stub = StubTransport()
        let trade = #"{"id":"t9","status":"open","instrument":"OTP","stop":{"minor":1980000}}"#
        for op in ["createPenzPaperTrade", "openPenzPaperTrade", "closePenzPaperTrade", "setPenzPaperTradeLastClose",
                   "cancelPenzPaperTrade"] { stub.on(op, .json(200, trade)) }
        stub.on("listPenzPaperTrades", .json(200, "[\(trade)]"))
        let c = PenzClient(raw: Self.raw(stub))
        _ = try await c.createTrade(PenzTradeRequest(clientRef: "r1", instrument: "OTP", direction: "long", why: "Kitörés",
                                                     currency: "HUF", quantity: 2, plannedEntryMinor: 2_000_000,
                                                     stopMinor: 1_980_000))
        _ = try await c.openTrade(id: "t9", PenzTradeOpenRequest(entryMinor: 2_000_000, entryDate: "2026-11-20"))
        _ = try await c.closeTrade(id: "t9", PenzTradeCloseRequest(exitMinor: 2_038_000, exitDate: "2026-11-20",
                                                                  tags: ["kitores"], mistake: false, line: "Terv szerint."))
        _ = try await c.recordLastClose(id: "t9", PenzLastCloseRequest(closeMinor: 2_010_000, date: "2026-11-20"))
        _ = try await c.cancelTrade(id: "t9")
        let all = try await c.practiceTrades(from: "2026-11-01")
        #expect(all.count == 1)
        #expect(stub.sent.map(\.path) == ["/api/penz/practice/trades", "/api/penz/practice/trades/t9/open",
                                          "/api/penz/practice/trades/t9/close", "/api/penz/practice/trades/t9/last-close",
                                          "/api/penz/practice/trades/t9/cancel", "/api/penz/practice/trades?from=2026-11-01"])
        let create = stub.sent[0].body ?? ""
        #expect(create.contains(#""stopMinor":1980000"#) && !create.contains("entryMinor") && !create.contains("targetMinor"))
        #expect(stub.sent[2].body?.contains(#""tags":["kitores"]"#) == true)
    }

    @Test func aNamed422IsARefusalHeCanRead() async {
        let stub = StubTransport()
        stub.on("openPenzPaperTrade", .json(422, #"{"messages":[{"code":"PENZ_PRACTICE_CAP_EXCEEDED"}]}"#))
        stub.on("openPenzPaperTrade", .status(422))
        let c = PenzClient(raw: Self.raw(stub))
        await #expect(throws: PlanFetchError.rejected("PENZ_PRACTICE_CAP_EXCEEDED")) {
            _ = try await c.openTrade(id: "t", PenzTradeOpenRequest(entryMinor: 1, entryDate: "2026-11-20"))
        }
        await #expect(throws: PlanFetchError.server) {
            _ = try await c.openTrade(id: "t", PenzTradeOpenRequest(entryMinor: 1, entryDate: "2026-11-20"))
        }
    }

    // MARK: store

    @Test func storeCachesPracticeAndShowsItOfflineWithItsAge() async {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("penz-l7-\(UUID().uuidString)")
        let clock = TestClock(Date(timeIntervalSince1970: 1_795_168_800))
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let stub = StubTransport()
        stub.on("getPenzPractice", .json(200, PenzL7Fixtures.overviewJSON))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: cache, clock: { clock.now })
        await store.loadPractice()
        #expect(store.practice?.value.closedCount == 4 && store.practiceProblem == nil && !store.practiceOffline)
        await store.loadPractice()               // once is enough without force
        #expect(stub.ops == ["getPenzPractice"])

        clock.advance(3 * 3600)
        let off = StubTransport()
        off.on("getPenzPractice", .fail(URLError(.notConnectedToInternet)))
        let later = PenzStore(client: PenzClient(raw: Self.raw(off)), cache: cache, clock: { clock.now })
        await later.loadPractice()
        #expect(later.practiceOffline && later.practice?.value.cap.capHufMinor == 2_000_000)
        #expect(later.practiceAgeText == "3 órás adat")

        let nothing = StubTransport()
        nothing.on("getPenzPractice", .fail(URLError(.notConnectedToInternet)))
        let fresh = PenzStore(client: PenzClient(raw: Self.raw(nothing)), cache: nil)
        await fresh.loadPractice()
        #expect(fresh.practice == nil && fresh.practiceProblem == .offline)
    }

    @Test func theCapRefusalSaysWhatStillFitsFromAFreshRead() async {
        let stub = StubTransport()
        stub.on("openPenzPaperTrade", .json(422, #"{"messages":[{"code":"PENZ_PRACTICE_CAP_EXCEEDED"}]}"#))
        stub.on("getPenzPractice", .json(200, PenzL7Fixtures.overviewJSON))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        let text = await store.openTrade(id: "t3", entryMinor: 1_050_000, date: "2026-11-20")
        #expect(text == "Ez túllépné a havi 20\u{202F}000\u{00A0}Ft-os keretet — még 8\u{202F}000\u{00A0}Ft fér bele.")
    }

    @Test func aWriteRereadsThePractice() async {
        let stub = StubTransport()
        stub.on("closePenzPaperTrade", .json(200, #"{"id":"t2","status":"closed","instrument":"Mol","stop":{"minor":290000}}"#))
        stub.on("getPenzPractice", .json(200, PenzL7Fixtures.overviewJSON))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        let e = await store.closeTrade(id: "t2", PenzTradeCloseRequest(exitMinor: 305_000, exitDate: "2026-11-20",
                                                                      tags: ["trend"], mistake: false, line: ""))
        #expect(e == nil && stub.ops == ["closePenzPaperTrade", "getPenzPractice"] && store.practice != nil)
    }

    // MARK: wording

    @Test func closedRowsReadLikeTheSpike() {
        let tags = penzPracticeDefaultTags
        let win = penzTradeRow(PenzL7Fixtures.trade(target: 2_030_000), tags: tags)
        #expect(win.title == "OTP · kitörés" && win.sub == "Terv megvolt · kilépés a szintnél")
        #expect(win.value == "+1,9" && win.valueSub == "R" && win.glyph == "check-ink" && win.badge == 0)

        let stopped = penzTradeRow(PenzL7Fixtures.trade(instrument: "Nasdaq-ETF", r: -1.0, tags: ["visszateszt"]), tags: tags)
        #expect(stopped.title == "Nasdaq-ETF · visszateszt" && stopped.sub == "Terv megvolt · stop vitte ki")
        #expect(stopped.value == "\u{2212}1,0")

        let early = penzTradeRow(PenzL7Fixtures.trade(instrument: "Mol", r: 0.5, tags: ["nyitasi_tartomany", "korai_zaras"]), tags: tags)
        #expect(early.title == "Mol · nyitási tartomány" && early.sub == "Terv megvolt · kézzel zártad korábban")

        let news = penzTradeRow(PenzL7Fixtures.trade(instrument: "Richter", r: -1.7, tags: ["hirre", "terven_kivul"],
                                                     mistake: true, stopRespected: false), tags: tags)
        #expect(news.title == "Richter · hírre ugrottam")
        #expect(news.sub == "Eltértél a tervtől · túl a stopon zártad · hiba megjelölve")
        #expect(news.glyph == "bolt-ink" && news.badge == 1)
    }

    @Test func openAndPlannedRowsSayWhereTheyStand() {
        var open = PenzL7Fixtures.trade(status: "open", instrument: "Mol", r: nil, tags: [], exit: nil)
        open.lastClose = .huf(305_000); open.lastCloseDate = "2026-11-19"; open.unrealizedHufMinor = 50_000
        let row = penzTradeRow(open, tags: [])
        #expect(row.title == "Mol · hosszú")
        #expect(row.sub == "Nyitott · utolsó záróár, amit beírtál: 3\u{202F}050\u{00A0}Ft (nov. 19.)")
        #expect(row.value == "+500" && row.kind == .open)

        open.lastClose = nil; open.lastCloseDate = nil; open.unrealizedHufMinor = nil
        #expect(penzTradeRow(open, tags: []).sub == "Nyitott · még nem írtál be záróárat, a belépőn számolom")
        #expect(penzTradeRow(open, tags: []).value == "0")

        var plan = PenzL7Fixtures.trade(status: "planned", instrument: "Richter", r: nil, tags: [], exit: nil, direction: "short")
        plan.plannedEntry = .huf(1_050_000)
        #expect(penzTradeRow(plan, tags: []).sub == "Terv · belépő 10\u{202F}500\u{00A0}Ft · stop 19\u{202F}800\u{00A0}Ft")
        #expect(penzTradeRow(plan, tags: []).title == "Richter · rövid")
    }

    @Test func pricesKeepTheirCurrencyAndCents() {
        #expect(penzPrice(.huf(412_000)) == "4\u{202F}120\u{00A0}Ft")
        #expect(penzPrice(.huf(412_050)) == "4\u{202F}120,50\u{00A0}Ft")
        #expect(penzPrice(PenzMoney(minor: 18_240, currency: "EUR")) == "182,40\u{00A0}EUR")
        #expect(penzShortDate("2026-11-19") == "nov. 19." && penzLongDate("2026-11-20") == "2026. nov. 20.")
    }

    @Test func theTabsHeadStatsAndNoiseAreHonest() throws {
        let o = try PlanJSON.decoder.decode(PenzPracticeOverview.self, from: Data(PenzL7Fixtures.overviewJSON.utf8))
        #expect(penzPracticeHighlight(o).text == "A terv nélküli belépések vitték el a hetet")
        let stats = penzPracticeStats(o)
        #expect(stats.map(\.value) == ["+1\u{202F}200", "0,3", "12\u{202F}000"] && stats[2].label == "elkelt a 20\u{202F}000\u{00A0}Ft-os keretből")
        #expect(stats.allSatisfy { !$0.hot })
        #expect(penzNoiseLine(o)?.contains("most 4 van") == true)
        #expect(penzWeekTradeRows(o).map(\.id) == ["t2", "t3", "t1"])

        var quiet = o
        quiet.week.headline = nil; quiet.week.sub = nil
        #expect(penzPracticeHighlight(quiet).text == "Még nincs lezárt kereskedés a héten")
        let empty = PenzPracticeOverview(month: "2026-11", cap: o.cap)
        #expect(penzPracticeIsEmpty(empty) && penzPracticeHighlight(empty).text == "Még nem kereskedtél papíron")
        // an old cache without the server's line still says it under 50; never from 50
        #expect(penzNoiseLine(empty) == "50 jelölt kereskedés alatt ezek a számok még zajnak számítanak — most 0 van.")
        var many = empty; many.taggedCount = 50
        #expect(penzNoiseLine(many) == nil)
        // a losing month is never lit
        var losing = o; losing.monthPnlHufMinor = -340_000
        #expect(penzPracticeStats(losing)[0].value == "\u{2212}3\u{202F}400" && !penzPracticeStats(losing)[0].hot)
    }

    @Test func aLossInTheReviewIsNeverLit() {
        #expect(penzUnlitNegatives("átlagban *+0,8R*, a negyedik *\u{2212}1,7R* lett, *-5 100 Ft*") == "átlagban *+0,8R*, a negyedik \u{2212}1,7R lett, -5 100 Ft")
    }

    @Test func theCurveSitsOnItsBaselineAndLosesBelowIt() throws {
        let o = try PlanJSON.decoder.decode(PenzPracticeOverview.self, from: Data(PenzL7Fixtures.overviewJSON.utf8))
        let c = try #require(penzPracticeCurve(o.week))
        #expect(c.labels == ["H", "K", "Sze"] && c.now == 2 && c.baseline == 0.5)
        #expect(c.values[0] == 0.5 && c.values[1] > 0.5 && c.values[2] < 0.5 && c.values.allSatisfy { $0 > 0 && $0 < 1 })
        #expect(penzPracticeCurve(PenzPracticeWeek()) == nil)
    }

    @Test func capTextsAndPlanChecks() {
        let cap = PenzPracticeCap(capHufMinor: 2_000_000, usedHufMinor: 2_000_000, leftHufMinor: 0)
        #expect(penzCapExceededText(cap) == "Ez túllépné a havi 20\u{202F}000\u{00A0}Ft-os keretet — ebben a hónapban már nem fér bele több.")
        #expect(penzCapMenuSub(cap) == "Havi 20\u{202F}000\u{00A0}Ft · nem nyúl a többihez")
        #expect(penzPlanProblem(instrument: "OTP", why: "Kitörés", quantity: 2, direction: "long", stopMinor: nil, entryMinor: nil)?
            .contains("stop") == true)
        #expect(penzPlanProblem(instrument: "OTP", why: "Kitörés", quantity: 2, direction: "long", stopMinor: 2_100_000,
                                entryMinor: 2_000_000) == "Hosszú kereskedésnél a stop a belépő alatt van.")
        #expect(penzPlanProblem(instrument: "OTP", why: "Kitörés", quantity: 2, direction: "short", stopMinor: 2_100_000,
                                entryMinor: 2_000_000) == nil)
        #expect(penzJournalLineTrimmed(String(repeating: "a", count: 200)).count == 140)
    }

    @Test func theJournalGroupsByMonthNewestFirst() {
        var a = PenzL7Fixtures.trade("a"); a.exitDate = "2026-11-18"
        var b = PenzL7Fixtures.trade("b"); b.exitDate = "2026-10-30"
        var c = PenzL7Fixtures.trade("c", status: "planned"); c.createdAt = "2026-11-19T08:00:00Z"
        let g = penzJournalGroups([b, a, c])
        #expect(g.map(\.title) == ["November", "Október"] && g[0].trades.map(\.id) == ["c", "a"])
    }
}
