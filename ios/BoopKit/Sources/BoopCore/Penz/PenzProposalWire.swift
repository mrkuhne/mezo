import Foundation

// Pénz L7 (`mezo-r36n9.105`) — the product catalog, the proposals and the monthly strategy (build notes §3.2/§3.3),
// hand-decoded and lenient like the rest of Pénz. Every text the server writes here is final Hungarian copy; every
// figure is the server's (the split, the yearly running cost, the strategy amount) — the phone only prints it.

private extension KeyedDecodingContainer {
    func lenient<T: Decodable>(_ key: Key, _ fallback: T) -> T { ((try? decodeIfPresent(T.self, forKey: key)) ?? nil) ?? fallback }
    func optional<T: Decodable>(_ key: Key) -> T? { (try? decodeIfPresent(T.self, forKey: key)) ?? nil }
}

// MARK: - Catalog

/// One product of his curated list. Only `approved` rows can ever appear in a proposal.
public struct PenzProduct: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    /// `state_bond`, `money_market`, `bond_etf`, `equity_etf`, `mixed_fund`, `deposit`.
    public var kind: String
    public var currency: String
    /// `short`, `mid`, `long`.
    public var sleeves: [String]
    public var whatItIs: String
    public var terPct: Double?
    public var entryFeePct: Double?
    public var feeNote: String?
    /// `accumulating`, `distributing`, `interest`.
    public var distribution: String
    public var isin: String?
    public var symbol: String?
    public var sourceName: String?
    public var sourceUrl: String?
    /// `YYYY-MM-DD` — when the figures were checked against the source.
    public var reviewedAt: String
    /// `suggested`, `approved`, `declined`.
    public var status: String
    /// `research`, `owner`.
    public var suggestedBy: String
    public var approvedAt: String?

    public init(id: String, name: String, kind: String, currency: String = "HUF", sleeves: [String] = [], whatItIs: String = "",
                terPct: Double? = nil, entryFeePct: Double? = nil, feeNote: String? = nil, distribution: String = "accumulating",
                isin: String? = nil, symbol: String? = nil, sourceName: String? = nil, sourceUrl: String? = nil,
                reviewedAt: String = "", status: String = "suggested", suggestedBy: String = "research", approvedAt: String? = nil) {
        self.id = id; self.name = name; self.kind = kind; self.currency = currency; self.sleeves = sleeves
        self.whatItIs = whatItIs; self.terPct = terPct; self.entryFeePct = entryFeePct; self.feeNote = feeNote
        self.distribution = distribution; self.isin = isin; self.symbol = symbol; self.sourceName = sourceName
        self.sourceUrl = sourceUrl; self.reviewedAt = reviewedAt; self.status = status; self.suggestedBy = suggestedBy
        self.approvedAt = approvedAt
    }
    private enum CodingKeys: String, CodingKey {
        case id, name, kind, currency, sleeves, whatItIs, terPct, entryFeePct, feeNote, distribution, isin, symbol,
             sourceName, sourceUrl, reviewedAt, status, suggestedBy, approvedAt
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = c.lenient(.name, ""); kind = c.lenient(.kind, ""); currency = c.lenient(.currency, "HUF")
        sleeves = c.lenient(.sleeves, []); whatItIs = c.lenient(.whatItIs, ""); terPct = c.optional(.terPct)
        entryFeePct = c.optional(.entryFeePct); feeNote = c.optional(.feeNote)
        distribution = c.lenient(.distribution, ""); isin = c.optional(.isin); symbol = c.optional(.symbol)
        sourceName = c.optional(.sourceName); sourceUrl = c.optional(.sourceUrl); reviewedAt = c.lenient(.reviewedAt, "")
        status = c.lenient(.status, "suggested"); suggestedBy = c.lenient(.suggestedBy, "research")
        approvedAt = c.optional(.approvedAt)
    }
}

// MARK: - Proposals

/// One concrete option offered for a sleeve (an approved product, with figures computed for the proposed amount).
public struct PenzProductOption: Codable, Equatable, Sendable, Identifiable {
    public var productId: String
    public var name: String
    public var whatItIs: String
    public var kind: String
    public var currency: String
    public var distribution: String
    public var terPct: Double?
    public var entryFeePct: Double?
    public var feeNote: String?
    /// The yearly running cost for the proposed amount (amount × TER, rounded to 10 Ft).
    public var yearlyCostHufMinor: Int64?
    public var reviewedAt: String
    /// Server-computed comparison lines ("évi 600 Ft-tal olcsóbb", "euróban van", …).
    public var differs: [String]
    public var sourceName: String?
    public var id: String { productId }

    public init(productId: String, name: String, whatItIs: String = "", kind: String = "", currency: String = "HUF",
                distribution: String = "", terPct: Double? = nil, entryFeePct: Double? = nil, feeNote: String? = nil,
                yearlyCostHufMinor: Int64? = nil, reviewedAt: String = "", differs: [String] = [], sourceName: String? = nil) {
        self.productId = productId; self.name = name; self.whatItIs = whatItIs; self.kind = kind; self.currency = currency
        self.distribution = distribution; self.terPct = terPct; self.entryFeePct = entryFeePct; self.feeNote = feeNote
        self.yearlyCostHufMinor = yearlyCostHufMinor; self.reviewedAt = reviewedAt; self.differs = differs
        self.sourceName = sourceName
    }
    private enum CodingKeys: String, CodingKey {
        case productId, name, whatItIs, kind, currency, distribution, terPct, entryFeePct, feeNote, yearlyCostHufMinor,
             reviewedAt, differs, sourceName
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        productId = c.lenient(.productId, ""); name = c.lenient(.name, ""); whatItIs = c.lenient(.whatItIs, "")
        kind = c.lenient(.kind, ""); currency = c.lenient(.currency, "HUF"); distribution = c.lenient(.distribution, "")
        terPct = c.optional(.terPct); entryFeePct = c.optional(.entryFeePct); feeNote = c.optional(.feeNote)
        yearlyCostHufMinor = c.optional(.yearlyCostHufMinor); reviewedAt = c.lenient(.reviewedAt, "")
        differs = c.lenient(.differs, []); sourceName = c.optional(.sourceName)
    }
}

/// One sleeve of a proposal: its amount, its share, why, and the options to pick from.
public struct PenzProposalSleeve: Codable, Equatable, Sendable, Identifiable {
    public var sleeve: String
    public var label: String
    public var amountHufMinor: Int64
    public var sharePct: Double
    public var why: String
    /// Fewer than two approved products for this sleeve: the honest line.
    public var optionsNote: String?
    public var options: [PenzProductOption]
    public var id: String { sleeve }

    public init(sleeve: String, label: String = "", amountHufMinor: Int64, sharePct: Double = 0, why: String = "",
                optionsNote: String? = nil, options: [PenzProductOption] = []) {
        self.sleeve = sleeve; self.label = label; self.amountHufMinor = amountHufMinor; self.sharePct = sharePct
        self.why = why; self.optionsNote = optionsNote; self.options = options
    }
    private enum CodingKeys: String, CodingKey { case sleeve, label, amountHufMinor, sharePct, why, optionsNote, options }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sleeve = c.lenient(.sleeve, ""); label = c.lenient(.label, ""); amountHufMinor = c.lenient(.amountHufMinor, 0)
        sharePct = c.lenient(.sharePct, 0); why = c.lenient(.why, ""); optionsNote = c.optional(.optionsNote)
        options = c.lenient(.options, [])
    }
}

/// One step of the accepted plan, which he ticks himself.
public struct PenzPlanStep: Codable, Equatable, Sendable, Identifiable {
    public var index: Int
    public var sleeve: String
    public var productId: String?
    public var productName: String?
    public var amountHufMinor: Int64
    public var done: Bool
    public var doneAt: String?
    public var id: Int { index }
    public init(index: Int, sleeve: String, productId: String? = nil, productName: String? = nil, amountHufMinor: Int64,
                done: Bool = false, doneAt: String? = nil) {
        self.index = index; self.sleeve = sleeve; self.productId = productId; self.productName = productName
        self.amountHufMinor = amountHufMinor; self.done = done; self.doneAt = doneAt
    }
    private enum CodingKeys: String, CodingKey { case index, sleeve, productId, productName, amountHufMinor, done, doneAt }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        index = c.lenient(.index, 0); sleeve = c.lenient(.sleeve, ""); productId = c.optional(.productId)
        productName = c.optional(.productName); amountHufMinor = c.lenient(.amountHufMinor, 0)
        done = c.lenient(.done, false); doneAt = c.optional(.doneAt)
    }
}

/// One fact of the "miért?" page, formatted by the server.
public struct PenzProposalFact: Codable, Equatable, Sendable {
    public var value: String, unit: String, label: String
    public init(value: String, unit: String, label: String) { self.value = value; self.unit = unit; self.label = label }
    private enum CodingKeys: String, CodingKey { case value, unit, label }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        value = c.lenient(.value, ""); unit = c.lenient(.unit, ""); label = c.lenient(.label, "")
    }
}

/// A proposal: a split per horizon with options per sleeve, narrated, and — once accepted — his plan.
public struct PenzProposal: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    /// `lump_sum`, `monthly`.
    public var kind: String
    /// `proposed`, `accepted`, `dismissed`, `superseded`.
    public var status: String
    public var amountHufMinor: Int64
    public var createdAt: String
    public var acceptedAt: String?
    /// The card's two lines.
    public var title: String, sub: String
    public var summary: String, uncertainty: String
    /// `model`, `fallback`.
    public var narratedBy: String
    public var facts: [PenzProposalFact]
    public var rules: [String]
    public var sleeves: [PenzProposalSleeve]
    public var plan: [PenzPlanStep]

    public init(id: String, kind: String = "lump_sum", status: String = "proposed", amountHufMinor: Int64, createdAt: String = "",
                acceptedAt: String? = nil, title: String = "", sub: String = "", summary: String = "", uncertainty: String = "",
                narratedBy: String = "model", facts: [PenzProposalFact] = [], rules: [String] = [],
                sleeves: [PenzProposalSleeve] = [], plan: [PenzPlanStep] = []) {
        self.id = id; self.kind = kind; self.status = status; self.amountHufMinor = amountHufMinor; self.createdAt = createdAt
        self.acceptedAt = acceptedAt; self.title = title; self.sub = sub; self.summary = summary
        self.uncertainty = uncertainty; self.narratedBy = narratedBy; self.facts = facts; self.rules = rules
        self.sleeves = sleeves; self.plan = plan
    }
    private enum CodingKeys: String, CodingKey {
        case id, kind, status, amountHufMinor, createdAt, acceptedAt, title, sub, summary, uncertainty, narratedBy, facts,
             rules, sleeves, plan
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = c.lenient(.kind, "lump_sum"); status = c.lenient(.status, "proposed")
        amountHufMinor = c.lenient(.amountHufMinor, 0); createdAt = c.lenient(.createdAt, "")
        acceptedAt = c.optional(.acceptedAt); title = c.lenient(.title, ""); sub = c.lenient(.sub, "")
        summary = c.lenient(.summary, ""); uncertainty = c.lenient(.uncertainty, "")
        narratedBy = c.lenient(.narratedBy, "fallback"); facts = c.lenient(.facts, []); rules = c.lenient(.rules, [])
        sleeves = c.lenient(.sleeves, []); plan = c.lenient(.plan, [])
    }
}

/// `GET /api/penz/strategy` — the monthly investable figure and what it is made of.
public struct PenzStrategy: Codable, Equatable, Sendable {
    public struct Input: Codable, Equatable, Sendable, Identifiable {
        public var key: String, label: String
        public var hufMinor: Int64
        public var id: String { key }
        public init(key: String, label: String, hufMinor: Int64) { self.key = key; self.label = label; self.hufMinor = hufMinor }
        private enum CodingKeys: String, CodingKey { case key, label, hufMinor }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            key = c.lenient(.key, ""); label = c.lenient(.label, ""); hufMinor = c.lenient(.hufMinor, 0)
        }
    }
    public var availableHufMinor: Int64
    public var inputs: [Input]
    public var note: String
    public var current: PenzProposal?

    public init(availableHufMinor: Int64, inputs: [Input] = [], note: String = "", current: PenzProposal? = nil) {
        self.availableHufMinor = availableHufMinor; self.inputs = inputs; self.note = note; self.current = current
    }
    private enum CodingKeys: String, CodingKey { case availableHufMinor, inputs, note, current }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        availableHufMinor = c.lenient(.availableHufMinor, 0); inputs = c.lenient(.inputs, [])
        note = c.lenient(.note, ""); current = c.optional(.current)
    }
}

// MARK: - Requests

/// `POST /api/penz/proposals`: a lump sum with its amount, or the monthly strategy.
public struct PenzProposalRequest: Codable, Equatable, Sendable {
    public var kind: String
    public var amountHufMinor: Int64?
    public init(kind: String, amountHufMinor: Int64? = nil) { self.kind = kind; self.amountHufMinor = amountHufMinor }
    public static func lumpSum(_ amountHufMinor: Int64) -> PenzProposalRequest { .init(kind: "lump_sum", amountHufMinor: amountHufMinor) }
    public static let monthly = PenzProposalRequest(kind: "monthly")
}

/// `POST /api/penz/proposals/{id}/accept` — his numbers, one line per sleeve.
public struct PenzAcceptRequest: Codable, Equatable, Sendable {
    public struct Sleeve: Codable, Equatable, Sendable {
        public var sleeve: String
        public var amountHufMinor: Int64
        public var productId: String?
        public init(sleeve: String, amountHufMinor: Int64, productId: String?) {
            self.sleeve = sleeve; self.amountHufMinor = amountHufMinor; self.productId = productId
        }
    }
    public var sleeves: [Sleeve]
    public init(sleeves: [Sleeve]) { self.sleeves = sleeves }
}

public struct PenzStepRequest: Codable, Equatable, Sendable {
    public var done: Bool
    public init(done: Bool) { self.done = done }
}
