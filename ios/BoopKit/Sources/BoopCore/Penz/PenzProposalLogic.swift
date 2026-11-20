import Foundation

// Pénz L7 (`mezo-r36n9.105`) — the proposal flow, the catalog and the monthly strategy as he reads them, pure and
// unit-tested. The split, the shares, the options and their yearly cost are the server's; the phone adds what only
// it knows: the amounts he is adjusting (±10 000 Ft steps or typed) and the request that carries exactly those.
//
// Copy rules (spec §6): Boop never buys and never moves money, never urges, never promises a return, always says why.

// MARK: - Products in words

/// "Állampapír", "Részvény-ETF", …
public func penzProductKindName(_ kind: String) -> String {
    switch kind {
    case "state_bond": "Állampapír"
    case "money_market": "Pénzpiaci alap"
    case "bond_etf": "Kötvény-ETF"
    case "equity_etf": "Részvény-ETF"
    case "mixed_fund": "Vegyes alap"
    case "deposit": "Betét"
    default: "Befektetés"
    }
}

/// "felhalmozó" / "osztalékfizető" / "kamatozó".
public func penzDistributionName(_ d: String) -> String {
    switch d {
    case "accumulating": "felhalmozó"
    case "distributing": "osztalékfizető"
    case "interest": "kamatozó"
    default: ""
    }
}

/// `0,20%` — a fee percentage with a decimal comma (two decimals).
public func penzFeePct(_ pct: Double) -> String { penzPct(pct, decimals: 2, signed: false) + "%" }

/// The yearly running cost of `amount` at `terPct` — amount × TER, rounded to 10 Ft (the server's rule, so an amount
/// he adjusts shows the same figure the server would compute for it). nil without a TER.
public func penzYearlyCost(amountHufMinor: Int64, terPct: Double?) -> Int64? {
    guard let terPct else { return nil }
    let ft = Double(amountHufMinor) / 100 * terPct / 100
    return Int64((ft / 10).rounded()) * 10 * 100
}

/// The option's yearly cost for the amount on screen: the server's figure while the amount is the proposed one, the
/// same formula once he moved it.
public func penzOptionYearlyCost(_ o: PenzProductOption, amountHufMinor: Int64, proposedHufMinor: Int64) -> Int64? {
    if amountHufMinor == proposedHufMinor, let server = o.yearlyCostHufMinor { return server }
    return penzYearlyCost(amountHufMinor: amountHufMinor, terPct: o.terPct)
}

/// "évi 0,20% · kb. 800 Ft/év ennél az összegnél · belépéskor 1,00% · ellenőrizve: 2026. nov. 20."
public func penzFeeLine(terPct: Double?, entryFeePct: Double?, feeNote: String?, yearlyCostHufMinor: Int64?,
                        reviewedAt: String) -> String {
    var parts: [String] = []
    if let terPct { parts.append("évi \(penzFeePct(terPct))") }
    if let y = yearlyCostHufMinor, terPct != nil { parts.append("kb. \(penzFtUnit(y))/év ennél az összegnél") }
    if let e = entryFeePct, e > 0 { parts.append("belépéskor \(penzFeePct(e))") }
    if let note = feeNote, !note.isEmpty { parts.append(note) }
    if parts.isEmpty { parts.append("a költségét még nem rögzítettük") }
    if !reviewedAt.isEmpty { parts.append("ellenőrizve: \(penzLongDate(reviewedAt))") }
    return parts.joined(separator: " · ")
}

/// One option's cost line for the amount on screen.
public func penzOptionFeeLine(_ o: PenzProductOption, amountHufMinor: Int64, proposedHufMinor: Int64) -> String {
    penzFeeLine(terPct: o.terPct, entryFeePct: o.entryFeePct, feeNote: o.feeNote,
                yearlyCostHufMinor: penzOptionYearlyCost(o, amountHufMinor: amountHufMinor, proposedHufMinor: proposedHufMinor),
                reviewedAt: o.reviewedAt)
}

/// "Részvény-ETF · EUR · felhalmozó"
public func penzOptionSub(kind: String, currency: String, distribution: String) -> String {
    [penzProductKindName(kind), currency == "HUF" ? "forint" : currency, penzDistributionName(distribution)]
        .filter { !$0.isEmpty }.joined(separator: " · ")
}

/// A catalog row's sub: "Részvény-ETF · EUR · felhalmozó · 10+ év".
public func penzProductSub(_ p: PenzProduct) -> String {
    let sleeves = PenzSleeveKey.allCases.map(\.rawValue).filter { p.sleeves.contains($0) }.map(penzSleeveTitle)
    return ([penzOptionSub(kind: p.kind, currency: p.currency, distribution: p.distribution)] + sleeves)
        .filter { !$0.isEmpty }.joined(separator: " · ")
}

/// A catalog row's fee line (no amount: the yearly cost belongs to a proposal), with its source.
public func penzProductFeeLine(_ p: PenzProduct) -> String {
    let fee = penzFeeLine(terPct: p.terPct, entryFeePct: p.entryFeePct, feeNote: p.feeNote, yearlyCostHufMinor: nil,
                          reviewedAt: p.reviewedAt)
    guard let source = p.sourceName, !source.isEmpty else { return fee }
    return fee + " · forrás: \(source)"
}

/// The catalog in its three groups.
public func penzCatalogGroups(_ products: [PenzProduct]) -> (suggested: [PenzProduct], approved: [PenzProduct], declined: [PenzProduct]) {
    (products.filter { $0.status == "suggested" }, products.filter { $0.status == "approved" },
     products.filter { $0.status == "declined" })
}

// MARK: - Proposals on Pénz Ma

/// The proposals waiting for his answer, newest first.
public func penzOpenProposals(_ list: [PenzProposal]) -> [PenzProposal] {
    list.filter { $0.status == "proposed" }.sorted { $0.createdAt > $1.createdAt }
}

/// Accepted proposals whose plan he has not finished ticking.
public func penzActivePlans(_ list: [PenzProposal]) -> [PenzProposal] {
    list.filter { $0.status == "accepted" && $0.plan.contains { !$0.done } }.sorted { $0.createdAt > $1.createdAt }
}

/// "2 / 3 lépés kész".
public func penzPlanProgressText(_ p: PenzProposal) -> String {
    "\(p.plan.filter(\.done).count) / \(p.plan.count) lépés kész"
}

// MARK: - Adjusting a proposal

/// One sleeve as he is setting it: the amount and the option picked.
public struct PenzSleeveDraft: Equatable, Sendable {
    public var sleeve: String
    public var amountHufMinor: Int64
    public var productId: String?
    public init(sleeve: String, amountHufMinor: Int64, productId: String?) {
        self.sleeve = sleeve; self.amountHufMinor = amountHufMinor; self.productId = productId
    }
}

/// The step of the ± buttons: 10 000 Ft.
public let penzSleeveStepHufMinor: Int64 = 1_000_000

/// The proposal as offered: the server's amounts, the first (cheapest) option of every sleeve picked.
public func penzSleeveDrafts(_ p: PenzProposal) -> [PenzSleeveDraft] {
    p.sleeves.map { PenzSleeveDraft(sleeve: $0.sleeve, amountHufMinor: $0.amountHufMinor, productId: $0.options.first?.productId) }
}

/// The amount after a ± tap: never below zero.
public func penzStepped(_ amount: Int64, by delta: Int64) -> Int64 { max(0, amount + delta) }

public func penzDraftTotal(_ drafts: [PenzSleeveDraft]) -> Int64 { drafts.reduce(0) { $0 + $1.amountHufMinor } }

/// The share of one sleeve in what he set now, whole percent.
public func penzDraftShare(_ amount: Int64, of total: Int64) -> Int {
    total > 0 ? Int((Double(amount) / Double(total) * 100).rounded()) : 0
}

/// The accept call: his numbers; a zero sleeve carries no product.
public func penzAcceptRequest(_ drafts: [PenzSleeveDraft]) -> PenzAcceptRequest {
    PenzAcceptRequest(sleeves: drafts.map {
        .init(sleeve: $0.sleeve, amountHufMinor: $0.amountHufMinor, productId: $0.amountHufMinor > 0 ? $0.productId : nil)
    })
}

/// What stops the accept: a sleeve with money and no product, or nothing at all set. nil = ready.
public func penzAcceptProblem(_ drafts: [PenzSleeveDraft], proposal: PenzProposal) -> String? {
    if penzDraftTotal(drafts) <= 0 { return "Legalább egy rekeszbe tegyél valamennyit." }
    for d in drafts where d.amountHufMinor > 0 && d.productId == nil {
        let label = proposal.sleeves.first { $0.sleeve == d.sleeve }?.label ?? penzSleeveTitle(d.sleeve)
        return "A(z) \(label.isEmpty ? penzSleeveTitle(d.sleeve) : label) rekeszhez még nincs jóváhagyott termék — tedd nullára, vagy hagyj jóvá egyet a termékjegyzékben."
    }
    return nil
}

/// One step of the accepted plan: "Világ-ETF · 10+ év" / "120 000 Ft".
public func penzPlanStepTitle(_ s: PenzPlanStep) -> String {
    "\(s.productName ?? "Nincs kiválasztva") · \(penzSleeveTitle(s.sleeve))"
}

// MARK: - The "miért?" page

public struct PenzProposalWhy: Equatable, Sendable {
    public let title: String, sub: String
    public let facts: [PenzProposalFact]
    /// The voices: how it was computed (the rules), and where it could be wrong.
    public let notes: [(label: String, text: String, doubt: Bool)]
    public let closing: String
    public static func == (a: Self, b: Self) -> Bool {
        a.title == b.title && a.sub == b.sub && a.facts == b.facts && a.closing == b.closing
            && a.notes.map(\.text) == b.notes.map(\.text)
    }
}

public let penzProposalClosing = "Ez javaslat, nem utasítás. Te döntöd el, mennyi menjen hova, és a vételt is te intézed a saját platformodon — Boop soha nem vesz és nem mozgat pénzt."

/// The "miért?" page of a proposal: its title, Boop's summary, the server's facts, the split rules, the uncertainty.
public func penzProposalWhy(_ p: PenzProposal) -> PenzProposalWhy {
    var notes: [(label: String, text: String, doubt: Bool)] = []
    if !p.rules.isEmpty {
        notes.append(("Hogyan számoltam", p.rules.map { "• " + $0 }.joined(separator: "\n"), false))
    }
    if !p.uncertainty.isEmpty { notes.append(("Ahol tévedhetek", p.uncertainty, true)) }
    return PenzProposalWhy(title: p.title, sub: p.summary.isEmpty ? p.sub : p.summary, facts: p.facts, notes: notes,
                           closing: penzProposalClosing)
}

// MARK: - The amount sheet

/// The amount he types for a lump sum ("500 000") → minor units; nil unless at least 1 000 Ft.
public func penzProposalAmount(_ text: String) -> Int64? {
    guard let m = penzParseFt(text), m >= 100_000 else { return nil }
    return m
}
