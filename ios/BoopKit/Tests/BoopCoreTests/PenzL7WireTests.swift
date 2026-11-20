import Foundation
import Testing
@testable import BoopCore

/// The Pénz L7 wire against the server as built (`PenzPracticeMapper`, `PenzProposalMapper`, `PenzErrors`): fixtures shaped
/// exactly like the mappers' output (every key, nulls where the mapper writes null, UUID ids, `OffsetDateTime` stamps,
/// stripped `BigDecimal` quantities) and the error body the global handler writes (a bare `SystemMessage` array).
/// Invented, real-looking figures, never the owner's.
enum PenzL7ServerFixtures {
    /// `PenzPracticeMapper.trade` of an open EUR trade with a typed last close.
    static let openTradeJSON = #"""
    {"id":"6f1d1f0e-2b7a-4c55-9a51-0d3b8f6f2a01","paper":true,"status":"open","instrument":"VWCE","direction":"long",
     "why":"Kitörés a heti csúcs fölé.","currency":"EUR","quantity":2.5,
     "plannedEntry":{"minor":11850,"currency":"EUR","hufMinor":4680750},
     "stop":{"minor":11500,"currency":"EUR","hufMinor":4542500},"target":null,
     "entry":{"minor":11900,"currency":"EUR","hufMinor":4700500},"entryDate":"2026-11-18",
     "exit":null,"exitDate":null,
     "lastClose":{"minor":12010,"currency":"EUR","hufMinor":4743950},"lastCloseDate":"2026-11-19",
     "riskMinor":1000,"riskHufMinor":395000,"costHufMinor":11751250,"pnl":null,"rMultiple":null,
     "unrealizedHufMinor":108625,"tags":[],"mistake":false,"line":null,"stopRespected":null,
     "createdAt":"2026-11-18T08:12:31.402117Z","clientRef":"0c7b4f43-8d0b-4b8e-a1f4-5b0e4f8b1c22"}
    """#

    /// A closed HUF trade, as the mapper writes it.
    static let closedTradeJSON = #"""
    {"id":"6f1d1f0e-2b7a-4c55-9a51-0d3b8f6f2a02","paper":true,"status":"closed","instrument":"OTP","direction":"short",
     "why":"Visszateszt a letört szintre.","currency":"HUF","quantity":10,
     "plannedEntry":null,"stop":{"minor":2050000,"currency":"HUF","hufMinor":2050000},
     "target":{"minor":1950000,"currency":"HUF","hufMinor":1950000},
     "entry":{"minor":2000000,"currency":"HUF","hufMinor":2000000},"entryDate":"2026-11-16",
     "exit":{"minor":1960000,"currency":"HUF","hufMinor":1960000},"exitDate":"2026-11-17",
     "lastClose":null,"lastCloseDate":null,"riskMinor":500000,"riskHufMinor":500000,"costHufMinor":20000000,
     "pnl":{"minor":400000,"currency":"HUF","hufMinor":400000},"rMultiple":0.80,"unrealizedHufMinor":null,
     "tags":["visszateszt","korai_zaras"],"mistake":false,"line":"Korán zártam.","stopRespected":true,
     "createdAt":"2026-11-16T07:00:00Z","clientRef":null}
    """#

    /// One researched seed row, as `PenzProposalMapper.product` writes it on the first catalog read.
    static func seedProductJSON(_ n: Int, sleeves: String, ter: String = "0.14") -> String {
        #"{"id":"a1b2c3d4-0000-4000-8000-00000000000\#(n)","name":"Termék \#(n)","kind":"equity_etf","currency":"EUR","sleeves":\#(sleeves),"whatItIs":"Tőzsdei indexalap.","terPct":\#(ter),"entryFeePct":null,"feeNote":null,"distribution":"accumulating","isin":"IE00BK5BQT80","symbol":"VWCE.DE","sourceName":"justETF","sourceUrl":"https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQT80","reviewedAt":"2026-11-20","status":"suggested","suggestedBy":"research","approvedAt":null}"#
    }

    /// The ten seeded suggestions, in the server's order (3 state bonds, 3 mid, 4 long).
    static let seededCatalogJSON = "[" + [
        seedProductJSON(0, sleeves: #"["short"]"#, ter: "null"), seedProductJSON(1, sleeves: #"["short","mid"]"#, ter: "null"),
        seedProductJSON(2, sleeves: #"["short","mid"]"#, ter: "null"), seedProductJSON(3, sleeves: #"["mid"]"#, ter: "0.10"),
        seedProductJSON(4, sleeves: #"["mid"]"#, ter: "0.08"), seedProductJSON(5, sleeves: #"["mid"]"#, ter: "0.25"),
        seedProductJSON(6, sleeves: #"["long"]"#), seedProductJSON(7, sleeves: #"["long"]"#, ter: "0.20"),
        seedProductJSON(8, sleeves: #"["long"]"#, ter: "0.17"), seedProductJSON(9, sleeves: #"["long"]"#, ter: "0.07"),
    ].joined(separator: ",") + "]"

    /// `PenzProposalMapper.proposal` of a fresh lump-sum proposal (fallback narration, no plan yet).
    static let proposalJSON = #"""
    {"id":"9e0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b","kind":"lump_sum","status":"proposed","amountHufMinor":50000000,
     "createdAt":"2026-11-20T09:00:00.123Z","acceptedAt":null,"title":"500 000 Ft három rekeszbe",
     "sub":"A tartalékod megvan.","summary":"A szabály szerint osztottam.","uncertainty":"A díjak változhattak.",
     "narratedBy":"fallback","facts":[{"value":"6","unit":"hó","label":"a tartalék célja"}],
     "rules":["Előbb a tartalék.","40% közép, 60% hosszú."],
     "sleeves":[{"sleeve":"short","label":"1–3 év","amountHufMinor":0,"sharePct":0.0,"why":"A tartalék megvan.",
                 "optionsNote":null,"options":[]},
                {"sleeve":"mid","label":"5–10 év","amountHufMinor":20000000,"sharePct":40.0,"why":"Középtáv.",
                 "optionsNote":"ehhez a rekeszhez még nincs jóváhagyott termék","options":[]},
                {"sleeve":"long","label":"10+ év","amountHufMinor":30000000,"sharePct":60.0,"why":"Hosszú táv.",
                 "optionsNote":null,
                 "options":[{"productId":"a1b2c3d4-0000-4000-8000-000000000009","name":"Termék 9",
                             "whatItIs":"Tőzsdei indexalap.","kind":"equity_etf","currency":"EUR",
                             "distribution":"accumulating","terPct":0.07,"entryFeePct":null,"feeNote":null,
                             "yearlyCostHufMinor":21000,"reviewedAt":"2026-11-20","differs":["a legolcsóbb"]}]}],
     "plan":[]}
    """#

    static func error(_ code: String) -> String {
        #"[{"level":"ERROR","code":"\#(code)","params":[],"message":"x","type":"REQUEST","exceptionTraceId":"5d0f5a8e-1111-4a2b-9c3d-222233334444"}]"#
    }
}

@Suite("Pénz L7 — the wire as the server serves it")
@MainActor
struct PenzL7WireTests {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" })
    }

    @Test func tradesDecodeExactlyAsTheMapperWritesThem() throws {
        let open = try PlanJSON.decoder.decode(PenzPaperTrade.self, from: Data(PenzL7ServerFixtures.openTradeJSON.utf8))
        #expect(open.status == "open" && open.quantity == 2.5 && open.currency == "EUR" && open.target == nil)
        #expect(open.entry?.hufMinor == 4_700_500 && open.lastClose?.minor == 12_010 && open.unrealizedHufMinor == 108_625)
        #expect(open.costHufMinor == 11_751_250 && open.riskHufMinor == 395_000 && open.pnl == nil && open.stopRespected == nil)
        #expect(open.clientRef == "0c7b4f43-8d0b-4b8e-a1f4-5b0e4f8b1c22" && open.line == nil)

        let closed = try PlanJSON.decoder.decode(PenzPaperTrade.self, from: Data(PenzL7ServerFixtures.closedTradeJSON.utf8))
        #expect(closed.quantity == 10 && closed.rMultiple == 0.8 && closed.pnl?.hufMinor == 400_000)
        #expect(closed.tags == ["visszateszt", "korai_zaras"] && closed.stopRespected == true && closed.plannedEntry == nil)
    }

    @Test func aMissingOptionalFieldNeverFailsTheDecode() throws {
        // only the id: every other field falls back to "nothing"
        let bare = try PlanJSON.decoder.decode(PenzPaperTrade.self, from: Data(#"{"id":"t"}"#.utf8))
        #expect(bare.stop == .zero && bare.tags.isEmpty && bare.entry == nil)
        let overview = try PlanJSON.decoder.decode(PenzPracticeOverview.self, from: Data(#"{"month":"2026-11"}"#.utf8))
        #expect(overview.open.isEmpty && overview.week.curve.isEmpty && overview.cap.capHufMinor == 0)
        let product = try PlanJSON.decoder.decode(PenzProduct.self, from: Data(#"{"id":"p","terPct":"oops"}"#.utf8))
        #expect(product.terPct == nil && product.status == "suggested")
        let proposal = try PlanJSON.decoder.decode(PenzProposal.self, from: Data(#"{"id":"p","sleeves":null}"#.utf8))
        #expect(proposal.sleeves.isEmpty && proposal.plan.isEmpty)
        let strategy = try PlanJSON.decoder.decode(PenzStrategy.self, from: Data(#"{"current":{"title":"no id"}}"#.utf8))
        #expect(strategy.availableHufMinor == 0 && strategy.current == nil)
    }

    @Test func theLastCloseCallUsesTheContractsOperation() async throws {
        let stub = StubTransport()
        stub.on("setPenzPaperTradeLastClose", .json(200, PenzL7ServerFixtures.openTradeJSON))
        let t = try await PenzClient(raw: Self.raw(stub)).recordLastClose(
            id: "6f1d1f0e-2b7a-4c55-9a51-0d3b8f6f2a01", PenzLastCloseRequest(closeMinor: 12_010, date: "2026-11-19"))
        #expect(t.lastCloseDate == "2026-11-19")
        #expect(stub.sent[0].path == "/api/penz/practice/trades/6f1d1f0e-2b7a-4c55-9a51-0d3b8f6f2a01/last-close")
        #expect(stub.sent[0].body == #"{"closeMinor":12010,"date":"2026-11-19"}"#)
    }

    @Test func theServersErrorArrayBecomesHisSentence() async {
        let stub = StubTransport()
        let open = PenzTradeOpenRequest(entryMinor: 11_900, entryDate: "2026-11-18")
        stub.on("openPenzPaperTrade", .json(422, PenzL7ServerFixtures.error("PENZ_PRACTICE_CAP_EXCEEDED")))
        stub.on("openPenzPaperTrade", .json(409, PenzL7ServerFixtures.error("PENZ_PAPER_TRADE_STATE")))
        stub.on("openPenzPaperTrade", .json(400, PenzL7ServerFixtures.error("PENZ_PAPER_TRADE_INVALID_STOP")))
        stub.on("openPenzPaperTrade", .json(503, PenzL7ServerFixtures.error("PENZ_FX_UNAVAILABLE")))
        let c = PenzClient(raw: Self.raw(stub))
        await #expect(throws: PlanFetchError.rejected("PENZ_PRACTICE_CAP_EXCEEDED")) { _ = try await c.openTrade(id: "t", open) }
        await #expect(throws: PlanFetchError.conflict("PENZ_PAPER_TRADE_STATE")) { _ = try await c.openTrade(id: "t", open) }
        await #expect(throws: PlanFetchError.rejected("PENZ_PAPER_TRADE_INVALID_STOP")) { _ = try await c.openTrade(id: "t", open) }
        await #expect(throws: PlanFetchError.conflict("PENZ_FX_UNAVAILABLE")) { _ = try await c.openTrade(id: "t", open) }

        let accept = StubTransport()
        accept.on("acceptPenzProposal", .json(409, PenzL7ServerFixtures.error("PENZ_PRODUCT_NOT_APPROVED")))
        accept.on("acceptPenzProposal", .json(409, PenzL7ServerFixtures.error("PENZ_PROPOSAL_STATE")))
        accept.on("listPenzProposals", .json(200, "[]"))
        let store = PenzStore(client: PenzClient(raw: Self.raw(accept)), cache: nil)
        let drafts = [PenzSleeveDraft(sleeve: "long", amountHufMinor: 30_000_000, productId: "x")]
        let notApproved = await store.acceptProposal(id: "p", drafts: drafts)
        #expect(notApproved == penzErrorText(.conflict("PENZ_PRODUCT_NOT_APPROVED")) && notApproved?.contains("jóváhagyva") == true)
        let state = await store.acceptProposal(id: "p", drafts: drafts)
        #expect(state == penzErrorText(.conflict("PENZ_PROPOSAL_STATE")) && state != penzErrorText(.server))
        // every L7 code has its own sentence, never the generic refusal
        for code in ["PENZ_PRACTICE_CAP_EXCEEDED", "PENZ_PAPER_TRADE_NOT_FOUND", "PENZ_PAPER_TRADE_STATE",
                     "PENZ_PAPER_TRADE_INVALID_STOP", "PENZ_PRACTICE_TAG_UNKNOWN", "PENZ_PRODUCT_NOT_FOUND",
                     "PENZ_PRODUCT_NOT_APPROVED", "PENZ_PROPOSAL_NOT_FOUND", "PENZ_PROPOSAL_STATE",
                     "PENZ_PROPOSAL_AMOUNT_INVALID", "PENZ_FX_UNAVAILABLE"] {
            #expect(penzErrorText(.rejected(code)) != penzErrorText(.rejected("SOMETHING_ELSE")), "\(code)")
        }
    }

    @Test func theTenSeededSuggestionsAreGroupedByHorizon() async throws {
        let stub = StubTransport()
        stub.on("listPenzProducts", .json(200, PenzL7ServerFixtures.seededCatalogJSON))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        await store.loadCatalog()
        let products = try #require(store.catalog?.value)
        #expect(products.count == 10 && store.catalogProblem == nil)
        #expect(products[0].terPct == nil && products[9].terPct == 0.07 && products[0].approvedAt == nil)
        let g = penzCatalogGroups(products)
        #expect(g.suggested.count == 10 && g.approved.isEmpty && g.declined.isEmpty)
        let bySleeve = penzCatalogSuggestedBySleeve(g.suggested)
        #expect(bySleeve.map(\.title) == ["1–3 év", "5–10 év", "10+ év"])
        #expect(bySleeve.map(\.products.count) == [3, 3, 4])
        // a product listed under two horizons sits under its shortest, once
        #expect(bySleeve[0].products.map(\.name) == ["Termék 0", "Termék 1", "Termék 2"])
        // a seed row with a source URL carrying a query still opens
        #expect(products[0].sourceUrl.flatMap(URL.init(string:))?.scheme == "https")
        #expect(penzCatalogSuggestedBySleeve([PenzProduct(id: "x", name: "X", kind: "deposit")]).map(\.title) == [""])
    }

    @Test func aServerProposalShowsTheServersCostForTheProposedAmount() throws {
        let p = try PlanJSON.decoder.decode(PenzProposal.self, from: Data(PenzL7ServerFixtures.proposalJSON.utf8))
        #expect(p.narratedBy == "fallback" && p.sleeves.map(\.sharePct) == [0, 40, 60] && p.acceptedAt == nil)
        #expect(p.sleeves[1].options.isEmpty && p.sleeves[1].optionsNote != nil)
        let long = p.sleeves[2]
        let o = try #require(long.options.first)
        #expect(o.sourceName == nil && o.yearlyCostHufMinor == 21_000)
        #expect(penzOptionFeeLine(o, proposedHufMinor: long.amountHufMinor)
            == "évi 0,07% · kb. 210\u{00A0}Ft/év a javasolt 300\u{202F}000\u{00A0}Ft-ra · ellenőrizve: 2026. nov. 20.")
        // the mid sleeve has money but no approved product: accept is held on the phone, with the reason
        let drafts = penzSleeveDrafts(p)
        #expect(drafts.map(\.productId) == [nil, nil, "a1b2c3d4-0000-4000-8000-000000000009"])
        #expect(penzAcceptProblem(drafts, proposal: p)?.contains("5–10 év") == true)
    }
}
