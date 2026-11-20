import Foundation
import Testing
@testable import BoopCore

/// Invented, real-looking figures, never the owner's.
enum PenzProposalFixtures {
    static let proposalJSON = #"""
    {"id":"p1","kind":"lump_sum","status":"proposed","amountHufMinor":50000000,"createdAt":"2026-11-20T09:00:00Z",
     "title":"500 000 Ft három rekeszbe","sub":"A tartalékod megvan, ezért a nagyobb rész hosszú távra megy.",
     "summary":"A tartalékod *6 hónapra* elég.","uncertainty":"A fix kiadásaid számát a múlt hónapból vettem.",
     "narratedBy":"model","newThing":true,
     "facts":[{"value":"6","unit":"hó","label":"ennyi a tartalékod"}],
     "rules":["A biztonsági rekesz előbb a 6 havi tartalékig töltődik.","A maradék 40% közép, 60% hosszú."],
     "sleeves":[{"sleeve":"short","label":"1–3 év","amountHufMinor":0,"sharePct":0,"why":"A tartalék megvan.",
                 "optionsNote":null,"options":[]},
                {"sleeve":"long","label":"10+ év","amountHufMinor":30000000,"sharePct":60,"why":"Hosszú távra.",
                 "optionsNote":"ehhez a rekeszhez még csak 1 jóváhagyott termék van",
                 "options":[{"productId":"pr1","name":"Világ-ETF","whatItIs":"A világ 1 500 nagyvállalata.",
                             "kind":"equity_etf","currency":"EUR","distribution":"accumulating","terPct":0.2,
                             "entryFeePct":null,"yearlyCostHufMinor":60000,"reviewedAt":"2026-11-20",
                             "differs":["euróban van"],"extra":1}]}],
     "plan":[]}
    """#

    static func proposal(sleeves: [PenzProposalSleeve]) -> PenzProposal {
        PenzProposal(id: "p", amountHufMinor: sleeves.reduce(0) { $0 + $1.amountHufMinor }, title: "T", sub: "S", sleeves: sleeves)
    }
}

@Suite("Pénz L7 — proposals, catalog, strategy")
@MainActor
struct PenzProposalTests {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" })
    }

    @Test func proposalDecodesLeniently() throws {
        let p = try PlanJSON.decoder.decode(PenzProposal.self, from: Data(PenzProposalFixtures.proposalJSON.utf8))
        #expect(p.amountHufMinor == 50_000_000 && p.sleeves.count == 2 && p.rules.count == 2)
        #expect(p.sleeves[1].options.first?.yearlyCostHufMinor == 60_000 && p.sleeves[1].options.first?.entryFeePct == nil)
        #expect(p.sleeves[0].optionsNote == nil && p.sleeves[1].optionsNote?.contains("1 jóváhagyott") == true)
        #expect(p.facts.first?.unit == "hó" && p.plan.isEmpty)
    }

    @Test func callsHitTheContractPaths() async throws {
        let stub = StubTransport()
        let p = PenzProposalFixtures.proposalJSON
        stub.on("createPenzProposal", .json(201, p))
        stub.on("createPenzProposal", .json(201, p))
        stub.on("acceptPenzProposal", .json(200, p))
        stub.on("dismissPenzProposal", .json(200, p))
        stub.on("setPenzProposalStep", .json(200, p))
        stub.on("listPenzProposals", .json(200, "[\(p)]"))
        stub.on("listPenzProducts", .json(200, #"[{"id":"pr1","name":"Világ-ETF","kind":"equity_etf","status":"approved"}]"#))
        stub.on("approvePenzProduct", .json(200, #"{"id":"pr2","name":"MÁP Plusz","kind":"state_bond","status":"approved"}"#))
        stub.on("getPenzStrategy", .json(200, #"{"availableHufMinor":12000000,"inputs":[{"key":"avgIncome","label":"Átlagos bevétel","hufMinor":98000000}],"note":"Az elmúlt 3 hónapból.","current":null}"#))
        let c = PenzClient(raw: Self.raw(stub))
        _ = try await c.createProposal(.lumpSum(50_000_000))
        _ = try await c.createProposal(.monthly)
        _ = try await c.acceptProposal(id: "p1", PenzAcceptRequest(sleeves: [.init(sleeve: "long", amountHufMinor: 30_000_000, productId: "pr1")]))
        _ = try await c.dismissProposal(id: "p1")
        _ = try await c.setProposalStep(id: "p1", index: 0, done: true)
        #expect(try await c.proposals(status: "proposed").count == 1)
        #expect(try await c.catalog().first?.status == "approved")
        #expect(try await c.approveProduct(id: "pr2").kind == "state_bond")
        let s = try await c.strategy()
        #expect(s.availableHufMinor == 12_000_000 && s.inputs.first?.label == "Átlagos bevétel" && s.current == nil)
        #expect(stub.sent.map(\.path) == ["/api/penz/proposals", "/api/penz/proposals", "/api/penz/proposals/p1/accept",
                                          "/api/penz/proposals/p1/dismiss", "/api/penz/proposals/p1/steps/0",
                                          "/api/penz/proposals?status=proposed", "/api/penz/catalog",
                                          "/api/penz/catalog/pr2/approve", "/api/penz/strategy"])
        #expect(stub.sent[0].body == #"{"amountHufMinor":50000000,"kind":"lump_sum"}"#)
        #expect(stub.sent[1].body == #"{"kind":"monthly"}"#)
        #expect(stub.sent[4].body == #"{"done":true}"#)
    }

    @Test func acceptCarriesHisNumbersAndNoProductOnAZeroSleeve() throws {
        let p = try PlanJSON.decoder.decode(PenzProposal.self, from: Data(PenzProposalFixtures.proposalJSON.utf8))
        var drafts = penzSleeveDrafts(p)
        #expect(drafts.map(\.amountHufMinor) == [0, 30_000_000] && drafts.map(\.productId) == [nil, "pr1"])
        drafts[1].amountHufMinor = penzStepped(drafts[1].amountHufMinor, by: penzSleeveStepHufMinor)
        drafts[0].amountHufMinor = penzStepped(drafts[0].amountHufMinor, by: -penzSleeveStepHufMinor)
        #expect(drafts[1].amountHufMinor == 31_000_000 && drafts[0].amountHufMinor == 0)
        let body = String(decoding: try PlanJSON.encoder.encode(penzAcceptRequest(drafts)), as: UTF8.self)
        #expect(body == #"{"sleeves":[{"amountHufMinor":0,"sleeve":"short"},{"amountHufMinor":31000000,"productId":"pr1","sleeve":"long"}]}"#)
        #expect(penzAcceptProblem(drafts, proposal: p) == nil)
        // money in a sleeve with no approved product cannot be accepted
        drafts[0].amountHufMinor = 1_000_000
        #expect(penzAcceptProblem(drafts, proposal: p)?.contains("termékjegyzék") == true)
        #expect(penzAcceptProblem([], proposal: p) != nil)
        #expect(penzDraftShare(31_000_000, of: 32_000_000) == 97)
    }

    @Test func costLinesAreTheServersUntilHeMovesTheAmount() {
        let o = PenzProductOption(productId: "pr1", name: "Világ-ETF", terPct: 0.2, yearlyCostHufMinor: 80_000, reviewedAt: "2026-11-20")
        #expect(penzOptionFeeLine(o, amountHufMinor: 40_000_000, proposedHufMinor: 40_000_000)
            == "évi 0,20% · kb. 800\u{00A0}Ft/év ennél az összegnél · ellenőrizve: 2026. nov. 20.")
        // 410 000 Ft × 0,20% = 820 Ft
        #expect(penzOptionYearlyCost(o, amountHufMinor: 41_000_000, proposedHufMinor: 40_000_000) == 82_000)
        // 123 456 Ft × 0,07% = 86,4 → 90 Ft (to 10 Ft)
        #expect(penzYearlyCost(amountHufMinor: 12_345_600, terPct: 0.07) == 9_000)
        #expect(penzYearlyCost(amountHufMinor: 12_345_600, terPct: nil) == nil)
        let bond = PenzProductOption(productId: "pr2", name: "MÁP Plusz", entryFeePct: 0, feeNote: "nincs díja, ha lejáratig tartod",
                                     reviewedAt: "2026-11-18")
        #expect(penzOptionFeeLine(bond, amountHufMinor: 1, proposedHufMinor: 1)
            == "nincs díja, ha lejáratig tartod · ellenőrizve: 2026. nov. 18.")
    }

    @Test func catalogRowsCarryTheirSourceAndDate() {
        let p = PenzProduct(id: "pr1", name: "Világ-ETF", kind: "equity_etf", currency: "EUR", sleeves: ["long", "mid"],
                            terPct: 0.22, distribution: "accumulating", sourceName: "justETF", reviewedAt: "2026-11-20",
                            status: "approved")
        #expect(penzProductSub(p) == "Részvény-ETF · EUR · felhalmozó · 5–10 év · 10+ év")
        #expect(penzProductFeeLine(p) == "évi 0,22% · ellenőrizve: 2026. nov. 20. · forrás: justETF")
        let g = penzCatalogGroups([p, PenzProduct(id: "a", name: "A", kind: "deposit"),
                                   PenzProduct(id: "b", name: "B", kind: "deposit", status: "declined")])
        #expect(g.approved.map(\.id) == ["pr1"] && g.suggested.map(\.id) == ["a"] && g.declined.map(\.id) == ["b"])
    }

    @Test func proposalsOnMaAndTheWhyPage() throws {
        let p = try PlanJSON.decoder.decode(PenzProposal.self, from: Data(PenzProposalFixtures.proposalJSON.utf8))
        var older = p; older.id = "p0"; older.createdAt = "2026-11-10T09:00:00Z"
        var accepted = p; accepted.id = "pa"; accepted.status = "accepted"
        accepted.plan = [PenzPlanStep(index: 0, sleeve: "long", productName: "Világ-ETF", amountHufMinor: 30_000_000, done: true),
                         PenzPlanStep(index: 1, sleeve: "mid", amountHufMinor: 0)]
        var finished = accepted; finished.id = "pf"; finished.plan = [accepted.plan[0]]
        #expect(penzOpenProposals([older, accepted, p]).map(\.id) == ["p1", "p0"])
        #expect(penzActivePlans([accepted, finished]).map(\.id) == ["pa"])
        #expect(penzPlanProgressText(accepted) == "1 / 2 lépés kész")
        #expect(penzPlanStepTitle(accepted.plan[1]) == "Nincs kiválasztva · 5–10 év")

        let why = penzProposalWhy(p)
        #expect(why.title == p.title && why.sub == "A tartalékod *6 hónapra* elég." && why.facts.count == 1)
        #expect(why.notes.map(\.label) == ["Hogyan számoltam", "Ahol tévedhetek"] && why.notes[1].doubt)
        #expect(why.closing.contains("soha nem vesz és nem mozgat pénzt"))
    }

    @Test func storeKeepsProposalsCachedAndDismissRereads() async {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("penz-l7p-\(UUID().uuidString)")
        let cache = ServerCache(directory: dir)
        let stub = StubTransport()
        stub.on("listPenzProposals", .json(200, "[\(PenzProposalFixtures.proposalJSON)]"))
        stub.on("dismissPenzProposal", .json(200, PenzProposalFixtures.proposalJSON))
        stub.on("listPenzProposals", .json(200, "[]"))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: cache)
        await store.loadProposals()
        #expect(store.openProposals.map(\.id) == ["p1"] && store.proposal(id: "p1") != nil)
        #expect(await store.dismissProposal(id: "p1") == nil)
        #expect(store.openProposals.isEmpty)

        let off = StubTransport()
        off.on("listPenzProposals", .fail(URLError(.notConnectedToInternet)))
        let later = PenzStore(client: PenzClient(raw: Self.raw(off)), cache: cache)
        await later.loadProposals()
        #expect(later.proposalsOffline && later.proposals?.value.isEmpty == true)
    }

    @Test func aRefusedProposalIsHisSentence() async {
        let stub = StubTransport()
        stub.on("createPenzProposal", .json(400, #"{"messages":[{"code":"PENZ_PROPOSAL_AMOUNT_INVALID"}]}"#))
        let store = PenzStore(client: PenzClient(raw: Self.raw(stub)), cache: nil)
        let r = await store.createProposal(.lumpSum(100))
        #expect(r == .failure(PenzStoreRefusal(penzErrorText(.rejected("PENZ_PROPOSAL_AMOUNT_INVALID")))))
        #expect(penzProposalAmount("500 000") == 50_000_000 && penzProposalAmount("500") == nil)
    }
}
