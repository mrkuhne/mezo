import Foundation
import Testing
@testable import BoopCore

/// Invented, real-looking figures (the spike's), never the owner's.
enum PenzL6Fixtures {
    static func pos(_ id: String, _ name: String, _ ft: Int64, share: Double, symbol: String? = nil, type: String = "etf",
                    platform: String = "revolut", currency: String = "HUF", priced: Bool = true, valuation: String = "quote",
                    quantity: Double? = nil) -> PenzPosition {
        PenzPosition(holdingId: id, name: name, assetType: type, symbol: symbol, platform: platform, currency: currency,
                     quantity: quantity, valueHufMinor: ft * 100, costHufMinor: ft * 100, sharePct: share, priced: priced,
                     valuation: valuation)
    }

    static var portfolio: PenzPortfolio {
        PenzPortfolio(
            date: "2026-11-20", totalHufMinor: 641_800_000, priceMoveHufMinor: 12_000_000, fxMoveHufMinor: -2_500_000,
            priceMovePct: 2.1, fxMovePct: -0.4, pricesAsOf: "2026-11-19", fixedCostsMonthlyHufMinor: 41_200_000,
            sleeves: [
                PenzSleeve(sleeve: "long", valueHufMinor: 215_800_000, sharePct: 33.6, coverageMonths: 55,
                           holdings: [pos("h4", "Világ-ETF", 1_520_000, share: 70.4, symbol: "VWCE.DE", currency: "EUR"),
                                      pos("h5", "OTP részvény", 638_000, share: 29.6, symbol: "OTP.BD", type: "stock")]),
                PenzSleeve(sleeve: "short", valueHufMinor: 240_000_000, sharePct: 37.4,
                           holdings: [pos("h1", "Állampapír", 2_400_000, share: 100, type: "bond", platform: "mbh", valuation: "accrual")]),
                PenzSleeve(sleeve: "mid", valueHufMinor: 186_000_000, sharePct: 29.0,
                           holdings: [pos("h2", "Kötvény-ETF", 920_000, share: 49.5, symbol: "AGGH.AS"),
                                      pos("h3", "Világ-ETF", 520_000, share: 28, symbol: "vwce.de", currency: "EUR"),
                                      pos("h6", "Deviza", 420_000, share: 22.5, type: "cash", platform: "other", priced: false,
                                          valuation: "cost")]),
            ],
            events: [], practice: PenzPracticeRow(monthlyHufMinor: 2_000_000))
    }

    static let portfolioJSON = #"""
    {"date":"2026-11-20","totalHufMinor":641800000,"priceMoveHufMinor":12000000,"fxMoveHufMinor":-2500000,
     "priceMovePct":2.1,"fxMovePct":-0.4,"pricesAsOf":"2026-11-19","stale":false,"unpricedCount":1,
     "fixedCostsMonthlyHufMinor":41200000,"somethingNew":true,
     "sleeves":[{"sleeve":"short","valueHufMinor":240000000,"costHufMinor":238000000,"sharePct":37.4,"priceMoveHufMinor":0,
                 "fxMoveHufMinor":0,"coverageMonths":null,
                 "holdings":[{"holdingId":"h1","name":"Állampapír","assetType":"bond","platform":"mbh","currency":"HUF",
                              "valueHufMinor":240000000,"costHufMinor":238000000,"sharePct":100,"priceMoveHufMinor":0,
                              "fxMoveHufMinor":0,"priced":true,"valuation":"accrual","futureField":1}]},
                {"sleeve":"long","valueHufMinor":215800000,"sharePct":33.6,"coverageMonths":55,"holdings":[]}],
     "events":[{"id":"e1","holdingId":"h1","holdingName":"Állampapír","sleeve":"short","kind":"coupon","date":"2026-12-08",
                "amountMinor":3420000,"currency":"HUF","amountHufMinor":3420000}],
     "practice":{"monthlyHufMinor":2000000,"monthPnlHufMinor":null}}
    """#

    static let digestJSON = #"""
    {"date":"2026-11-20","status":"ready","generatedAt":"2026-11-20T06:41:00+01:00","newsHealthy":true,
     "items":[{"id":"d1","kind":"holding","holdingId":"h4","holdingName":"Világ-ETF","sleeve":"long",
               "title":"A világ-ETF-ed 1,1%-ot esett a héten","effectHufMinor":-1840000,"effectNote":"a te részeden",
               "changePct":-1.1,"confidence":2,"verdict":"Egy héten belüli mozgás.","body":"A *te* rekeszed.",
               "uncertainty":"A miértje értelmezés.","noAction":"Ez a pénz 10+ évre szól.",
               "publishedAt":"2026-11-20T09:30:00+01:00",
               "sources":[{"name":"Portfolio","title":"A tőzsdék hete","url":"https://www.portfolio.hu/a"},
                          {"name":"Reuters","title":"Equities slip","url":"javascript:alert(1)"}],
               "narratedBy":"model","extra":"x"},
              {"id":"d2","kind":"a_kind_from_the_future","title":"Valami","effectHufMinor":0,"effectNote":"","confidence":7,
               "verdict":"","body":"","uncertainty":"","noAction":"","sources":[],"narratedBy":"fallback"}]}
    """#
}

@Suite("Pénz L6 — the client and the store")
@MainActor
struct PenzPortfolioClientTests {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" })
    }

    @Test func portfolioDecodesLenientlyWithTheToken() async throws {
        let stub = StubTransport()
        stub.on("getPenzPortfolio", .json(200, PenzL6Fixtures.portfolioJSON))
        let p = try await PenzClient(raw: Self.raw(stub)).portfolio()
        #expect(p.totalHufMinor == 641_800_000 && p.unpricedCount == 1 && p.priceMovePct == 2.1)
        #expect(p.sleeves.count == 2 && p.sleeves[0].holdings.first?.valuation == "accrual")
        #expect(p.sleeves[0].coverageMonths == nil && p.sleeves[1].coverageMonths == 55)
        #expect(p.events.first?.kind == "coupon" && p.practice.monthPnlHufMinor == nil)
        #expect(stub.sent[0].path == "/api/penz/portfolio" && stub.sent[0].auth == "Bearer tok")
    }

    @Test func digestDecodesUnknownKindsAndClampsConfidence() async throws {
        let stub = StubTransport()
        stub.on("getPenzDigest", .json(200, PenzL6Fixtures.digestJSON))
        let d = try await PenzClient(raw: Self.raw(stub)).digest(date: "2026-11-20")
        #expect(d.status == "ready" && d.items.count == 2)
        #expect(d.items[0].effectHufMinor == -1_840_000 && d.items[0].sources.count == 2)
        #expect(d.items[1].kind == "a_kind_from_the_future" && d.items[1].confidence == 2)
        #expect(stub.sent[0].path == "/api/penz/digest?date=2026-11-20")
    }

    @Test func readPathsMatchTheContract() async throws {
        let stub = StubTransport()
        stub.on("listPenzHoldings", .json(200, #"[{"id":"h1","name":"Állampapír","assetType":"bond","platform":"mbh","sleeve":"short","currency":"HUF","newsTerms":[],"position":0,"archived":false}]"#))
        stub.on("listPenzInvestTransactions", .json(200, #"[{"id":"t1","holdingId":"h1","side":"sell","amount":{"minor":100,"currency":"EUR","hufMinor":39000},"date":"2026-11-02","realizedHufMinor":-1200}]"#))
        stub.on("listPenzHoldingEvents", .json(200, "[]"))
        let c = PenzClient(raw: Self.raw(stub))
        #expect(try await c.holdings().first?.sleeve == "short")
        let t = try await c.investTransactions(holdingId: "h1")
        #expect(t.first?.side == "sell" && t.first?.realizedHufMinor == -1200 && t.first?.amount.hufMinor == 39_000)
        #expect(try await c.holdingEvents(from: "2026-11-20").isEmpty)
        #expect(stub.sent.map(\.path) == ["/api/penz/holdings", "/api/penz/holdings/h1/transactions",
                                          "/api/penz/holding-events?from=2026-11-20"])
    }

    @Test func writesSendTheirBodiesAndClientRefs() async throws {
        let stub = StubTransport()
        let holding = #"{"id":"h9","name":"Világ-ETF","assetType":"etf","symbol":"VWCE.DE","platform":"revolut","sleeve":"long","currency":"EUR","newsTerms":[],"position":0,"archived":false,"clientRef":"r1"}"#
        stub.on("createPenzHolding", .json(201, holding))
        stub.on("updatePenzHolding", .json(200, holding))
        stub.on("deletePenzHolding", .status(204))
        stub.on("createPenzInvestTransaction", .json(201, #"{"id":"t1","holdingId":"h9","side":"buy","amount":{"minor":12000,"currency":"EUR","hufMinor":4700000},"date":"2026-11-20"}"#))
        stub.on("deletePenzInvestTransaction", .status(204))
        stub.on("createPenzHoldingEvent", .json(201, #"{"id":"e1","holdingId":"h9","holdingName":"Világ-ETF","sleeve":"long","kind":"dividend","date":"2026-12-19"}"#))
        stub.on("deletePenzHoldingEvent", .status(204))
        let c = PenzClient(raw: Self.raw(stub))
        let req = PenzHoldingRequest(clientRef: "r1", name: "Világ-ETF", assetType: "etf", symbol: "VWCE.DE", platform: "revolut",
                                     sleeve: "long", currency: "EUR")
        #expect(try await c.createHolding(req).id == "h9")
        _ = try await c.updateHolding(id: "h9", req)
        try await c.deleteHolding(id: "h9")
        _ = try await c.createInvestTransaction(PenzInvestTxnRequest(clientRef: "r2", holdingId: "h9", side: "buy", quantity: 1.5,
                                                                     amountMinor: 12_000, date: "2026-11-20"))
        try await c.deleteInvestTransaction(id: "t1")
        _ = try await c.createHoldingEvent(PenzHoldingEventRequest(clientRef: "r3", holdingId: "h9", kind: "dividend", date: "2026-12-19"))
        try await c.deleteHoldingEvent(id: "e1")
        #expect(stub.sent.map(\.path) == ["/api/penz/holdings", "/api/penz/holdings/h9", "/api/penz/holdings/h9",
                                          "/api/penz/invest-transactions", "/api/penz/invest-transactions/t1",
                                          "/api/penz/holding-events", "/api/penz/holding-events/e1"])
        #expect(stub.sent[0].body?.contains(#""clientRef":"r1""#) == true && stub.sent[0].body?.contains(#""sleeve":"long""#) == true)
        #expect(stub.sent[3].body?.contains(#""amountMinor":12000"#) == true && stub.sent[3].body?.contains(#""quantity":1.5"#) == true)
        #expect(stub.sent[5].body?.contains(#""kind":"dividend""#) == true)
    }

    @Test func serverRefusalsReadInHungarian() async {
        let stub = StubTransport()
        stub.on("createPenzInvestTransaction", .json(400, #"{"messages":[{"code":"PENZ_SELL_EXCEEDS_POSITION"}]}"#))
        stub.on("createPenzInvestTransaction", .json(503, #"{"messages":[{"code":"PENZ_FX_UNAVAILABLE"}]}"#))
        stub.on("createPenzHolding", .json(400, #"{"messages":[{"code":"PENZ_SYMBOL_UNKNOWN"}]}"#))
        let c = PenzClient(raw: Self.raw(stub))
        let txn = PenzInvestTxnRequest(holdingId: "h1", side: "sell", amountMinor: 100, date: "2026-11-20")
        do { _ = try await c.createInvestTransaction(txn); Issue.record("expected a refusal") } catch {
            #expect(penzErrorText(error).contains("Ennyit nem adhatsz el"))
        }
        do { _ = try await c.createInvestTransaction(txn); Issue.record("expected a refusal") } catch {
            #expect(error == .conflict("PENZ_FX_UNAVAILABLE") && penzErrorText(error).contains("árfolyamot"))
        }
        do {
            _ = try await c.createHolding(PenzHoldingRequest(name: "X", assetType: "etf", symbol: "NOPE", platform: "other",
                                                            sleeve: "long", currency: "HUF"))
            Issue.record("expected a refusal")
        } catch {
            #expect(penzErrorText(error).contains("nem ismeri az árfolyamforrás"))
        }
    }

    private func scriptL5(_ stub: StubTransport) {
        stub.on("getPenzAllowance", .json(200, PenzClientTests.allowanceJSON))
        stub.on("listPenzTransactions", .json(200, "[]"))
        stub.on("listPenzCategories", .json(200, "[]"))
        stub.on("listPenzAccounts", .json(200, "[]"))
        stub.on("listOpenPenzMonths", .json(200, "[]"))
        stub.on("listPenzSavingsGoals", .json(200, "[]"))
        stub.on("getPenzSettings", .json(200, #"{"savingsTargetHufMinor":0,"practiceMonthlyHufMinor":0}"#))
    }

    @Test func storeReadsPortfolioAndDigestCachesThemAndShowsThemOfflineWithTheirAge() async {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("penz-l6-\(UUID().uuidString)")
        let clock = TestClock(Date(timeIntervalSince1970: 1_795_168_800))   // 2026-11-20
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let stub = StubTransport()
        scriptL5(stub)
        stub.on("getPenzPortfolio", .json(200, PenzL6Fixtures.portfolioJSON))
        stub.on("getPenzDigest", .json(200, PenzL6Fixtures.digestJSON))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: cache, clock: { clock.now })
        await store.load()
        #expect(store.portfolio?.value.totalHufMinor == 641_800_000 && store.portfolioProblem == nil)
        #expect(store.digest?.value.items.count == 2 && store.digestProblem == nil)

        clock.advance(2 * 3600)
        let off = StubTransport()
        for op in ["getPenzAllowance", "listPenzTransactions", "listPenzCategories", "listPenzAccounts", "listOpenPenzMonths",
                   "listPenzSavingsGoals", "getPenzSettings", "getPenzPortfolio", "getPenzDigest"] {
            off.on(op, .fail(URLError(.notConnectedToInternet)))
        }
        let later = PenzStore(client: PenzClient(raw: Self.raw(off)), cache: cache, clock: { clock.now })
        await later.load()
        #expect(later.portfolioOffline && later.portfolio?.value.unpricedCount == 1)
        #expect(later.digestOffline && later.digest?.value.status == "ready")
        #expect(later.portfolioAgeText == "2 órás adat")
    }

    @Test func aFailingDigestNeverTakesThePortfolioOrTheWeekWithIt() async {
        let stub = StubTransport()
        scriptL5(stub)
        stub.on("getPenzPortfolio", .json(200, PenzL6Fixtures.portfolioJSON))
        stub.on("getPenzDigest", .status(500))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        await store.load()
        #expect(store.allowance != nil && store.portfolio != nil)
        #expect(store.digest == nil && store.digestProblem == .server)
    }

    @Test func recordingANewHoldingCreatesItThenTheBuyThenReadsPenzemAgain() async {
        let stub = StubTransport()
        stub.on("createPenzHolding", .json(201, #"{"id":"h9","name":"Világ-ETF","assetType":"etf","platform":"revolut","sleeve":"long","currency":"EUR"}"#))
        stub.on("createPenzInvestTransaction", .json(201, #"{"id":"t1","holdingId":"h9","side":"buy","amount":{"minor":12000,"currency":"EUR","hufMinor":4700000},"date":"2026-11-20"}"#))
        stub.on("getPenzPortfolio", .json(200, PenzL6Fixtures.portfolioJSON))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        let error = await store.recordInvestment(
            newHolding: PenzHoldingRequest(clientRef: "r1", name: "Világ-ETF", assetType: "etf", platform: "revolut", sleeve: "long", currency: "EUR"),
            holdingId: nil,
            transaction: PenzInvestTxnRequest(clientRef: "r2", holdingId: "", side: "buy", amountMinor: 12_000, date: "2026-11-20"))
        #expect(error == nil)
        #expect(stub.ops == ["createPenzHolding", "createPenzInvestTransaction", "getPenzPortfolio"])
        #expect(stub.sent[1].body?.contains(#""holdingId":"h9""#) == true)
        #expect(store.portfolio != nil)
    }

    @Test func aRefusedSellSaysWhyAndWritesNothingElse() async {
        let stub = StubTransport()
        stub.on("createPenzInvestTransaction", .json(400, #"{"messages":[{"code":"PENZ_SELL_EXCEEDS_POSITION"}]}"#))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        let error = await store.recordInvestment(newHolding: nil, holdingId: "h1",
                                                 transaction: PenzInvestTxnRequest(holdingId: "", side: "sell", amountMinor: 1, date: "2026-11-20"))
        #expect(error?.contains("Ennyit nem adhatsz el") == true)
        #expect(stub.ops == ["createPenzInvestTransaction"])
    }

    @Test func addEventPostsAndReloads() async {
        let stub = StubTransport()
        stub.on("createPenzHoldingEvent", .json(201, #"{"id":"e1","holdingId":"h1","holdingName":"Állampapír","sleeve":"short","kind":"maturity","date":"2027-02-02"}"#))
        stub.on("getPenzPortfolio", .json(200, PenzL6Fixtures.portfolioJSON))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        #expect(await store.addEvent(PenzHoldingEventRequest(holdingId: "h1", kind: "maturity", date: "2027-02-02")) == nil)
        #expect(stub.ops == ["createPenzHoldingEvent", "getPenzPortfolio"])
    }
}

@Suite("Pénz L6 — the pure builders")
struct PenzPortfolioLogicTests {
    typealias F = PenzL6Fixtures

    @Test func percentsAndEffects() {
        #expect(penzPct(2.1) == "+2,1" && penzPct(-0.44) == "\u{2212}0,4" && penzPct(0) == "0,0")
        #expect(penzPct(37.4, decimals: 0, signed: false) == "37")
        #expect(penzEffectText(-1_840_000) == "\u{2212}18\u{202F}400\u{00A0}Ft")
        #expect(penzEffectText(0) == "0\u{00A0}Ft" && penzEffectText(20) == "0\u{00A0}Ft")
        #expect(penzEffectText(890_000) == "+8\u{202F}900\u{00A0}Ft")
    }

    @Test func amountsAndQuantitiesHeTypes() {
        #expect(penzParseAmount("120 000") == 12_000_000)
        #expect(penzParseAmount("1 234,56") == 123_456 && penzParseAmount("99.5") == 9_950)
        #expect(penzParseAmount("1.234.567") == 123_456_700)
        #expect(penzParseAmount("") == nil && penzParseAmount("0") == nil && penzParseAmount("abc") == nil)
        #expect(penzParseQuantity("3,5") == 3.5 && penzParseQuantity("") == nil && penzParseQuantity("-1") == nil)
    }

    @Test func sleeveRowsAreAlwaysThreeInOrderWithTheSpikesWords() {
        let rows = penzSleeveRows(F.portfolio)
        #expect(rows.map(\.title) == ["1–3 év", "5–10 év", "10+ év"])
        #expect(rows[0].sub == "Biztonság · állampapír, pénzpiac" && rows[1].sub == "Vegyes · ETF és kötvény")
        #expect(rows[2].sub == "Növekedés · 4 év 7 hónapnyi fix kiadásod")
        #expect(rows[0].value == "2\u{202F}400\u{202F}000" && rows[0].valueSub == "Ft · 37%")
        #expect(abs(rows[2].level - 0.336) < 0.001)
        let lone = penzSleeveRows(PenzPortfolio(date: "2026-11-20", totalHufMinor: 0))
        #expect(lone.count == 3 && lone[2].sub == "Növekedés · még üres" && lone[0].valueSub == "Ft · 0%")
    }

    @Test func coverageSaysYearsAndMonthsHonestly() {
        #expect(penzCoverageShort(55) == "4 év 7 hónapnyi fix kiadásod")
        #expect(penzCoverageShort(7) == "7 hónapnyi fix kiadásod")
        #expect(penzCoverageShort(48) == "4 évnyi fix kiadásod")
        #expect(penzCoverageShort(nil) == "nincs rögzített fix kiadás")
        #expect(penzCoverageSentence(55) == "Ahogy most áll, növekedést nem feltételezve, *4 év 7 hónapnyi fix kiadásodat* fedezi.")
        #expect(penzCoverageSentence(nil).contains("nincs rögzített fix kiadásod"))
        #expect(penzCoverageSentence(0).contains("egy hónapnyi fix kiadásodat sem"))
    }

    @Test func heroKeepsPriceAndCurrencyApartAndNeverLightsAMove() {
        let s = penzHeroStats(F.portfolio)
        #expect(s.map(\.label) == ["amid most van", "a befektetések mozgása", "ebből az árfolyam"])
        #expect(s[0].value == "6\u{202F}418\u{202F}000" && s[1].value == "+2,1" && s[1].trend == 1)
        #expect(s[2].value == "\u{2212}0,4" && s[2].trend == -1)
        #expect(s.allSatisfy { !$0.hot })
        var unpriced = F.portfolio
        unpriced.sleeves = [PenzSleeve(sleeve: "short", valueHufMinor: 100, holdings: [F.pos("x", "Deviza", 1, share: 100, priced: false)])]
        #expect(penzNothingPriced(unpriced) && penzHeroStats(unpriced)[1].value == nil)
        var noPct = F.portfolio
        noPct.fxMovePct = nil
        #expect(penzHeroStats(noPct)[2].value == nil)
    }

    @Test func staleTextSaysHowOldThePricesAre() {
        var p = F.portfolio
        #expect(penzPricesStaleText(p, today: "2026-11-20") == nil)
        p.stale = true; p.pricesAsOf = "2026-11-14"
        #expect(penzPricesStaleText(p, today: "2026-11-20") == "6 napos árak · November 14.")
        p.pricesAsOf = nil
        #expect(penzPricesStaleText(p, today: "2026-11-20") == "Az árforrás most nem válaszol")
        #expect(penzPricesInfoText(F.portfolio).contains("(most: november 19.)"))
        #expect(penzCoverageInfoText(F.portfolio).contains("*4 év 7 hónapnyi fix kiadásodat*"))
    }

    @Test func compositionSumsOneProductAcrossSleevesAndSaysSo() {
        let parts = penzComposition(F.portfolio)
        #expect(parts.map(\.name) == ["Állampapír", "Világ-ETF", "Kötvény-ETF", "OTP részvény", "Deviza"])
        #expect(parts[1].valueHufMinor == 204_000_000)
        var six = F.portfolio
        six.sleeves[0].holdings.append(F.pos("h7", "Arany", 100_000, share: 4, symbol: "GLD"))
        let folded = penzComposition(six)
        #expect(folded.last?.name == "Minden más" && folded.last?.valueHufMinor == 52_000_000 && folded.count == 5)
        #expect(penzCompositionNote(F.portfolio) == "Ugyanaz a Világ-ETF *két rekeszben* is ott van, külön darabszámmal — mert 7 évre és 15 évre nem ugyanazt jelenti.")
        var single = F.portfolio
        single.sleeves.removeAll { $0.sleeve == "mid" }
        #expect(penzCompositionNote(single) == nil)
    }

    @Test func positionRowsNameThePlatformAndTheAtCostMarker() {
        let mid = penzSleeves(F.portfolio)[1]
        let rows = penzPositionRows(mid)
        #expect(rows.map(\.title) == ["Kötvény-ETF", "Világ-ETF", "Deviza"])
        #expect(rows[1].sub == "Revolut · EUR" && rows[1].valueSub == "Ft · 28%")
        #expect(rows[2].atCost && rows[2].sub == "Más platform · vételáron számolva")
        #expect(penzPositionRows(penzSleeves(F.portfolio)[0])[0].sub == "MBH · a kamatából számolva")
    }

    @Test func timelineRowsByKindLikeTheSpike() {
        let events = [
            PenzHoldingEvent(id: "e3", holdingId: "h1", holdingName: "Állampapír", sleeve: "short", kind: "maturity", date: "2027-02-02",
                             amountMinor: 120_000_000, currency: "HUF", amountHufMinor: 120_000_000),
            PenzHoldingEvent(id: "e1", holdingId: "h1", holdingName: "Állampapír", sleeve: "short", kind: "coupon", date: "2026-12-08",
                             amountMinor: 3_420_000, currency: "HUF", note: "1 200 000 Ft-os rész"),
            PenzHoldingEvent(id: "e2", holdingId: "h4", holdingName: "Világ-ETF", sleeve: "long", kind: "dividend", date: "2026-12-19",
                             amountMinor: 2_300, currency: "EUR", amountHufMinor: 890_000),
            PenzHoldingEvent(id: "e4", holdingId: "h5", holdingName: "OTP", sleeve: "long", kind: "earnings", date: "2027-03-01"),
        ]
        let rows = penzEventRows(events, today: "2026-11-20")
        #expect(rows.map(\.id) == ["e1", "e2", "e3", "e4"])
        #expect(rows[0].title == "Állampapír kamatfordulója" && rows[0].sub == "December 8. · 1 200 000 Ft-os rész")
        #expect(rows[0].value == "+34\u{202F}200" && rows[0].valueSub == "Ft kamat")
        #expect(rows[1].title == "Világ-ETF osztalékfizetés" && rows[1].sub == "December 19. · a 10+ rekeszből" && rows[1].value == "+8\u{202F}900")
        #expect(rows[2].title == "Állampapír lejárata" && rows[2].value == "1\u{202F}200\u{202F}000" && rows[2].badge == 1)
        #expect(rows[3].value == "" && rows[3].valueSub == "" && rows[3].badge == 0)
    }

    @Test func practiceRowNeverInventsAProfit() {
        let none = penzPracticeLine(PenzPracticeRow(monthlyHufMinor: 2_000_000))
        #expect(none.sub == "Papír-próba · nem számít bele a fentibe" && none.chip == "még nincs kereskedés")
        #expect(none.value == "20\u{202F}000" && none.valueSub == "Ft havi keret")
        let some = penzPracticeLine(PenzPracticeRow(monthlyHufMinor: 2_000_000, monthPnlHufMinor: 120_000))
        #expect(some.value == "+1\u{202F}200" && some.valueSub == "Ft a hónapban" && some.chip == nil)
    }

    @Test func holdingChoicesCarryTheirSleeve() {
        let c = penzHoldingChoices(F.portfolio)
        #expect(c.first?.label == "Állampapír · 1–3 év" && c.count == 6)
        #expect(penzHoldingChoices(nil).isEmpty)
    }

    private static let budapest = TimeZone(identifier: "Europe/Budapest")!
    private static let now = ISO8601DateFormatter().date(from: "2026-11-20T12:00:00+01:00")!

    private static func digest() throws -> PenzDigest {
        try JSONDecoder().decode(PenzDigest.self, from: Data(F.digestJSON.utf8))
    }

    @Test func newsCardCarriesTheComputedEffectAndOnlySafeLinks() throws {
        let d = try Self.digest()
        let card = penzNewsCard(d.items[0], generatedAt: d.generatedAt, now: Self.now, timeZone: Self.budapest)
        #expect(card.holding == "Világ-ETF" && card.sleeve == "10+ év" && card.holdingGlyph == "star-sun")
        #expect(card.effect == "\u{2212}18\u{202F}400\u{00A0}Ft" && card.negative && card.effectNote == "a te részeden")
        #expect(card.confidenceText == "Magas" && card.sourceCount == 2)
        #expect(card.when == "Ma 09:30 · 2 forrásból összevonva")
        #expect(card.sources.map(\.text) == ["Portfolio · A tőzsdék hete", "Reuters · Equities slip"])
        #expect(card.sources[0].url?.host == "www.portfolio.hu" && card.sources[1].url == nil)
        let fx = penzNewsCard(PenzDigestItem(id: "f", kind: "fx", sleeve: "mid", title: "A forint erősödött", effectHufMinor: 0,
                                             effectNote: "forintban mérve", confidence: 1, verdict: "", body: "", uncertainty: "",
                                             noAction: "", sources: [PenzDigestSource(name: "MNB", title: "", url: "")]),
                              generatedAt: "2026-11-19T18:10:00+01:00", now: Self.now, timeZone: Self.budapest)
        #expect(fx.holding == "Deviza" && fx.effect == "0\u{00A0}Ft" && !fx.negative && fx.confidenceText == "Közepes")
        #expect(fx.when == "Tegnap 18:10 · 1 forrásból" && fx.sources[0].text == "MNB")
        #expect(!fx.noAction.isEmpty, "an empty noAction gets the general line, never a blank")
    }

    @Test func digestViewCoversEveryState() throws {
        let d = try Self.digest()
        let p = F.portfolio
        guard case .items(let cards) = penzDigestView(digest: d, problem: nil, portfolio: p, now: Self.now, timeZone: Self.budapest) else {
            Issue.record("expected items"); return
        }
        #expect(cards.count == 2)
        #expect(penzDigestView(digest: d, problem: nil, portfolio: PenzPortfolio(date: "", totalHufMinor: 0)) == .noHoldings)
        #expect(penzDigestView(digest: PenzDigest(date: "", status: "pending"), problem: nil, portfolio: p) == .pending)
        #expect(penzDigestView(digest: PenzDigest(date: "", status: "quiet"), problem: nil, portfolio: p) == .quiet)
        #expect(penzDigestView(digest: PenzDigest(date: "", status: "quiet", newsHealthy: false), problem: nil, portfolio: p) == .unhealthy)
        #expect(penzDigestView(digest: PenzDigest(date: "", status: "failed"), problem: nil, portfolio: p) == .buildFailed)
        #expect(penzDigestView(digest: nil, problem: nil, portfolio: nil) == .loading)
        guard case .failed(let line) = penzDigestView(digest: nil, problem: .offline, portfolio: p) else { Issue.record("failed"); return }
        #expect(line.contains("Nincs net"))
    }
}
