import Foundation

// The Pénz L6 wire (`mezo-r36n9.104`, contract `api/feature/penz/penz-portfolio.yml`): the portfolio by horizon, the
// holdings and their buys/sells, the owner-entered events and the daily news digest. Hand-decoded and lenient like
// L5's (`PenzWire.swift`): every enum is a plain string the screens map, a missing figure falls back to something that
// is visibly "nothing" (0, nil, empty), never an invented number. Everything is `Codable` so it can sit in
// `ServerCache` and Pénzem / the digest render offline with their age.

private extension KeyedDecodingContainer {
    func lenient<T: Decodable>(_ key: Key, _ fallback: T) -> T { ((try? decodeIfPresent(T.self, forKey: key)) ?? nil) ?? fallback }
    func optional<T: Decodable>(_ key: Key) -> T? { (try? decodeIfPresent(T.self, forKey: key)) ?? nil }
}

// MARK: - Holdings

/// One product in one sleeve (`PenzHoldingResponse`). The same product in two sleeves is two holdings.
public struct PenzHolding: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    /// `bond`, `etf`, `stock`, `fund`, `crypto`, `cash`.
    public var assetType: String
    public var symbol: String?
    /// `mbh`, `revolut`, `other`.
    public var platform: String
    public var platformName: String?
    /// `short`, `mid`, `long`.
    public var sleeve: String
    public var currency: String
    public var bondRatePct: Double?
    public var newsTerms: [String]
    public var note: String?
    public var position: Int
    public var archived: Bool
    public var clientRef: String?

    public init(id: String, name: String, assetType: String, symbol: String? = nil, platform: String = "other",
                platformName: String? = nil, sleeve: String, currency: String = "HUF", bondRatePct: Double? = nil,
                newsTerms: [String] = [], note: String? = nil, position: Int = 0, archived: Bool = false, clientRef: String? = nil) {
        self.id = id; self.name = name; self.assetType = assetType; self.symbol = symbol; self.platform = platform
        self.platformName = platformName; self.sleeve = sleeve; self.currency = currency; self.bondRatePct = bondRatePct
        self.newsTerms = newsTerms; self.note = note; self.position = position; self.archived = archived
        self.clientRef = clientRef
    }
    private enum CodingKeys: String, CodingKey {
        case id, name, assetType, symbol, platform, platformName, sleeve, currency, bondRatePct, newsTerms, note, position,
             archived, clientRef
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = c.lenient(.name, ""); assetType = c.lenient(.assetType, "other"); symbol = c.optional(.symbol)
        platform = c.lenient(.platform, "other"); platformName = c.optional(.platformName)
        sleeve = c.lenient(.sleeve, "long"); currency = c.lenient(.currency, "HUF"); bondRatePct = c.optional(.bondRatePct)
        newsTerms = c.lenient(.newsTerms, []); note = c.optional(.note); position = c.lenient(.position, 0)
        archived = c.lenient(.archived, false); clientRef = c.optional(.clientRef)
    }
}

/// `POST /api/penz/holdings` / `PUT …/{id}`.
public struct PenzHoldingRequest: Codable, Equatable, Sendable {
    public var clientRef: String?
    public var name: String
    public var assetType: String
    public var symbol: String?
    public var platform: String
    public var platformName: String?
    public var sleeve: String
    public var currency: String
    public var bondRatePct: Double?
    public var newsTerms: [String]?
    public var note: String?

    public init(clientRef: String? = nil, name: String, assetType: String, symbol: String? = nil, platform: String,
                platformName: String? = nil, sleeve: String, currency: String, bondRatePct: Double? = nil,
                newsTerms: [String]? = nil, note: String? = nil) {
        self.clientRef = clientRef; self.name = name; self.assetType = assetType; self.symbol = symbol
        self.platform = platform; self.platformName = platformName; self.sleeve = sleeve; self.currency = currency
        self.bondRatePct = bondRatePct; self.newsTerms = newsTerms; self.note = note
    }
}

/// A buy or a sell he already made on his own platform (`PenzInvestTxnResponse`).
public struct PenzInvestTxn: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var holdingId: String
    /// `buy` or `sell`.
    public var side: String
    public var quantity: Double?
    public var amount: PenzMoney
    public var fxRateDate: String?
    public var date: String
    public var note: String?
    public var realizedHufMinor: Int64?
    public var clientRef: String?
    /// The money account the buy was paid from / the sell paid into (`mezo-r36n9.119`); nil = not linked.
    public var accountId: String?
    /// The linked money row (kind `invest_buy` / `invest_sell`); nil = not linked.
    public var transactionId: String?

    public init(id: String, holdingId: String, side: String, quantity: Double? = nil, amount: PenzMoney, fxRateDate: String? = nil,
                date: String, note: String? = nil, realizedHufMinor: Int64? = nil, clientRef: String? = nil,
                accountId: String? = nil, transactionId: String? = nil) {
        self.id = id; self.holdingId = holdingId; self.side = side; self.quantity = quantity; self.amount = amount
        self.fxRateDate = fxRateDate; self.date = date; self.note = note; self.realizedHufMinor = realizedHufMinor
        self.clientRef = clientRef; self.accountId = accountId; self.transactionId = transactionId
    }
    private enum CodingKeys: String, CodingKey {
        case id, holdingId, side, quantity, amount, fxRateDate, date, note, realizedHufMinor, clientRef, accountId, transactionId
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        holdingId = c.lenient(.holdingId, ""); side = c.lenient(.side, "buy"); quantity = c.optional(.quantity)
        amount = c.lenient(.amount, .zero); fxRateDate = c.optional(.fxRateDate); date = c.lenient(.date, "")
        note = c.optional(.note); realizedHufMinor = c.optional(.realizedHufMinor); clientRef = c.optional(.clientRef)
        accountId = c.optional(.accountId); transactionId = c.optional(.transactionId)
    }
}

/// `POST /api/penz/invest-transactions`. The three account fields (`mezo-r36n9.119`) are left out of the body when nil
/// (synthesized `encodeIfPresent`), so a buy with no account is byte-for-byte the L6 request.
public struct PenzInvestTxnRequest: Codable, Equatable, Sendable {
    public var clientRef: String?
    public var holdingId: String
    public var side: String
    public var quantity: Double?
    /// Total paid / received in the holding currency, minor units.
    public var amountMinor: Int64
    public var date: String
    public var note: String?
    /// His live checking or cash account the buy was paid from / the sell paid into; nil = not linked (L6 behaviour).
    public var accountId: String?
    /// The exact amount in the ACCOUNT's currency, minor units; nil = the server converts.
    public var accountAmountMinor: Int64?
    /// A buy only, with `accountId`: the bank-SMS expense (from `smsCandidates`) to adopt as this buy.
    public var linkTransactionId: String?

    public init(clientRef: String? = nil, holdingId: String, side: String, quantity: Double? = nil, amountMinor: Int64,
                date: String, note: String? = nil, accountId: String? = nil, accountAmountMinor: Int64? = nil,
                linkTransactionId: String? = nil) {
        self.clientRef = clientRef; self.holdingId = holdingId; self.side = side; self.quantity = quantity
        self.amountMinor = amountMinor; self.date = date; self.note = note
        self.accountId = accountId; self.accountAmountMinor = accountAmountMinor; self.linkTransactionId = linkTransactionId
    }
}

/// A maturity, coupon, dividend or earnings date (`PenzHoldingEventResponse`).
public struct PenzHoldingEvent: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var holdingId: String
    public var holdingName: String
    public var sleeve: String
    /// `maturity`, `coupon`, `dividend`, `earnings`, `other`.
    public var kind: String
    public var date: String
    public var amountMinor: Int64?
    public var currency: String?
    public var amountHufMinor: Int64?
    public var note: String?

    public init(id: String, holdingId: String, holdingName: String, sleeve: String, kind: String, date: String,
                amountMinor: Int64? = nil, currency: String? = nil, amountHufMinor: Int64? = nil, note: String? = nil) {
        self.id = id; self.holdingId = holdingId; self.holdingName = holdingName; self.sleeve = sleeve; self.kind = kind
        self.date = date; self.amountMinor = amountMinor; self.currency = currency; self.amountHufMinor = amountHufMinor
        self.note = note
    }
    private enum CodingKeys: String, CodingKey {
        case id, holdingId, holdingName, sleeve, kind, date, amountMinor, currency, amountHufMinor, note
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        holdingId = c.lenient(.holdingId, ""); holdingName = c.lenient(.holdingName, ""); sleeve = c.lenient(.sleeve, "long")
        kind = c.lenient(.kind, "other"); date = c.lenient(.date, ""); amountMinor = c.optional(.amountMinor)
        currency = c.optional(.currency); amountHufMinor = c.optional(.amountHufMinor); note = c.optional(.note)
    }
}

/// `POST /api/penz/holding-events`.
public struct PenzHoldingEventRequest: Codable, Equatable, Sendable {
    public var clientRef: String?
    public var holdingId: String
    public var kind: String
    public var date: String
    public var amountMinor: Int64?
    public var note: String?

    public init(clientRef: String? = nil, holdingId: String, kind: String, date: String, amountMinor: Int64? = nil,
                note: String? = nil) {
        self.clientRef = clientRef; self.holdingId = holdingId; self.kind = kind; self.date = date
        self.amountMinor = amountMinor; self.note = note
    }
}

// MARK: - The portfolio

/// One holding valued today (`PenzPosition`).
public struct PenzPosition: Codable, Equatable, Sendable, Identifiable {
    public var holdingId: String
    public var name: String
    public var assetType: String
    public var symbol: String?
    public var platform: String
    public var platformName: String?
    public var currency: String
    public var quantity: Double?
    public var valueHufMinor: Int64
    public var costHufMinor: Int64
    /// Share of its sleeve, percent.
    public var sharePct: Double
    public var priceMoveHufMinor: Int64
    public var fxMoveHufMinor: Int64
    public var changePct: Double?
    /// false = valued at cost.
    public var priced: Bool
    /// `quote`, `accrual`, `cost`.
    public var valuation: String
    public var priceAsOf: String?
    public var id: String { holdingId }

    public init(holdingId: String, name: String, assetType: String, symbol: String? = nil, platform: String = "other",
                platformName: String? = nil, currency: String = "HUF", quantity: Double? = nil, valueHufMinor: Int64,
                costHufMinor: Int64 = 0, sharePct: Double = 0, priceMoveHufMinor: Int64 = 0, fxMoveHufMinor: Int64 = 0,
                changePct: Double? = nil, priced: Bool = true, valuation: String = "quote", priceAsOf: String? = nil) {
        self.holdingId = holdingId; self.name = name; self.assetType = assetType; self.symbol = symbol
        self.platform = platform; self.platformName = platformName; self.currency = currency; self.quantity = quantity
        self.valueHufMinor = valueHufMinor; self.costHufMinor = costHufMinor; self.sharePct = sharePct
        self.priceMoveHufMinor = priceMoveHufMinor; self.fxMoveHufMinor = fxMoveHufMinor; self.changePct = changePct
        self.priced = priced; self.valuation = valuation; self.priceAsOf = priceAsOf
    }
    private enum CodingKeys: String, CodingKey {
        case holdingId, name, assetType, symbol, platform, platformName, currency, quantity, valueHufMinor, costHufMinor,
             sharePct, priceMoveHufMinor, fxMoveHufMinor, changePct, priced, valuation, priceAsOf
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        holdingId = try c.decode(String.self, forKey: .holdingId)
        name = c.lenient(.name, ""); assetType = c.lenient(.assetType, "other"); symbol = c.optional(.symbol)
        platform = c.lenient(.platform, "other"); platformName = c.optional(.platformName)
        currency = c.lenient(.currency, "HUF"); quantity = c.optional(.quantity)
        valueHufMinor = c.lenient(.valueHufMinor, 0); costHufMinor = c.lenient(.costHufMinor, 0)
        sharePct = c.lenient(.sharePct, 0); priceMoveHufMinor = c.lenient(.priceMoveHufMinor, 0)
        fxMoveHufMinor = c.lenient(.fxMoveHufMinor, 0); changePct = c.optional(.changePct)
        priced = c.lenient(.priced, false)
        valuation = c.lenient(.valuation, priced ? "quote" : "cost"); priceAsOf = c.optional(.priceAsOf)
    }
}

/// One of the three sleeves (`PenzSleeve`).
public struct PenzSleeve: Codable, Equatable, Sendable, Identifiable {
    /// `short`, `mid`, `long`.
    public var sleeve: String
    public var valueHufMinor: Int64
    public var costHufMinor: Int64
    public var sharePct: Double
    public var priceMoveHufMinor: Int64
    public var fxMoveHufMinor: Int64
    /// The long sleeve only: whole months of the current fixed costs it covers; nil without fixed costs.
    public var coverageMonths: Int?
    public var holdings: [PenzPosition]
    public var id: String { sleeve }

    public init(sleeve: String, valueHufMinor: Int64, costHufMinor: Int64 = 0, sharePct: Double = 0,
                priceMoveHufMinor: Int64 = 0, fxMoveHufMinor: Int64 = 0, coverageMonths: Int? = nil,
                holdings: [PenzPosition] = []) {
        self.sleeve = sleeve; self.valueHufMinor = valueHufMinor; self.costHufMinor = costHufMinor
        self.sharePct = sharePct; self.priceMoveHufMinor = priceMoveHufMinor; self.fxMoveHufMinor = fxMoveHufMinor
        self.coverageMonths = coverageMonths; self.holdings = holdings
    }
    private enum CodingKeys: String, CodingKey {
        case sleeve, valueHufMinor, costHufMinor, sharePct, priceMoveHufMinor, fxMoveHufMinor, coverageMonths, holdings
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sleeve = c.lenient(.sleeve, "long"); valueHufMinor = c.lenient(.valueHufMinor, 0)
        costHufMinor = c.lenient(.costHufMinor, 0); sharePct = c.lenient(.sharePct, 0)
        priceMoveHufMinor = c.lenient(.priceMoveHufMinor, 0); fxMoveHufMinor = c.lenient(.fxMoveHufMinor, 0)
        coverageMonths = c.optional(.coverageMonths); holdings = c.lenient(.holdings, [])
    }
}

/// The quiet Gyakorlás row (`PenzPracticeRow`).
public struct PenzPracticeRow: Codable, Equatable, Sendable {
    public var monthlyHufMinor: Int64
    /// nil until L7 builds trades.
    public var monthPnlHufMinor: Int64?
    public init(monthlyHufMinor: Int64, monthPnlHufMinor: Int64? = nil) {
        self.monthlyHufMinor = monthlyHufMinor; self.monthPnlHufMinor = monthPnlHufMinor
    }
    private enum CodingKeys: String, CodingKey { case monthlyHufMinor, monthPnlHufMinor }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        monthlyHufMinor = c.lenient(.monthlyHufMinor, 0); monthPnlHufMinor = c.optional(.monthPnlHufMinor)
    }
}

/// `GET /api/penz/portfolio` — Pénzem.
public struct PenzPortfolio: Codable, Equatable, Sendable {
    public var date: String
    /// Everything in the three sleeves now; the practice money is not in it.
    public var totalHufMinor: Int64
    public var costHufMinor: Int64?
    public var priceMoveHufMinor: Int64
    public var fxMoveHufMinor: Int64
    public var priceMovePct: Double?
    public var fxMovePct: Double?
    public var pricesAsOf: String?
    public var stale: Bool
    public var unpricedCount: Int
    public var fixedCostsMonthlyHufMinor: Int64?
    /// short, mid, long (the builders put them in that order whatever the server sent).
    public var sleeves: [PenzSleeve]
    public var events: [PenzHoldingEvent]
    public var practice: PenzPracticeRow

    public init(date: String, totalHufMinor: Int64, costHufMinor: Int64? = nil, priceMoveHufMinor: Int64 = 0,
                fxMoveHufMinor: Int64 = 0, priceMovePct: Double? = nil, fxMovePct: Double? = nil, pricesAsOf: String? = nil,
                stale: Bool = false, unpricedCount: Int = 0, fixedCostsMonthlyHufMinor: Int64? = nil,
                sleeves: [PenzSleeve] = [], events: [PenzHoldingEvent] = [], practice: PenzPracticeRow = PenzPracticeRow(monthlyHufMinor: 0)) {
        self.date = date; self.totalHufMinor = totalHufMinor; self.costHufMinor = costHufMinor
        self.priceMoveHufMinor = priceMoveHufMinor; self.fxMoveHufMinor = fxMoveHufMinor; self.priceMovePct = priceMovePct
        self.fxMovePct = fxMovePct; self.pricesAsOf = pricesAsOf; self.stale = stale; self.unpricedCount = unpricedCount
        self.fixedCostsMonthlyHufMinor = fixedCostsMonthlyHufMinor; self.sleeves = sleeves; self.events = events
        self.practice = practice
    }
    private enum CodingKeys: String, CodingKey {
        case date, totalHufMinor, costHufMinor, priceMoveHufMinor, fxMoveHufMinor, priceMovePct, fxMovePct, pricesAsOf,
             stale, unpricedCount, fixedCostsMonthlyHufMinor, sleeves, events, practice
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = c.lenient(.date, ""); totalHufMinor = c.lenient(.totalHufMinor, 0); costHufMinor = c.optional(.costHufMinor)
        priceMoveHufMinor = c.lenient(.priceMoveHufMinor, 0); fxMoveHufMinor = c.lenient(.fxMoveHufMinor, 0)
        priceMovePct = c.optional(.priceMovePct); fxMovePct = c.optional(.fxMovePct); pricesAsOf = c.optional(.pricesAsOf)
        stale = c.lenient(.stale, false); unpricedCount = c.lenient(.unpricedCount, 0)
        fixedCostsMonthlyHufMinor = c.optional(.fixedCostsMonthlyHufMinor)
        sleeves = c.lenient(.sleeves, []); events = c.lenient(.events, [])
        practice = c.lenient(.practice, PenzPracticeRow(monthlyHufMinor: 0))
    }

    /// Every holding across the sleeves.
    public var positions: [PenzPosition] { sleeves.flatMap(\.holdings) }
    /// Nothing recorded yet.
    public var isEmpty: Bool { positions.isEmpty }
}

// MARK: - The digest

public struct PenzDigestSource: Codable, Equatable, Sendable {
    public var name: String
    public var title: String
    public var url: String
    public var publishedAt: String?
    public init(name: String, title: String, url: String, publishedAt: String? = nil) {
        self.name = name; self.title = title; self.url = url; self.publishedAt = publishedAt
    }
    private enum CodingKeys: String, CodingKey { case name, title, url, publishedAt }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = c.lenient(.name, ""); title = c.lenient(.title, ""); url = c.lenient(.url, ""); publishedAt = c.optional(.publishedAt)
    }
}

/// One story touching his holdings (`PenzDigestItem`). Every figure is the backend's; the prose is validated.
public struct PenzDigestItem: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    /// `holding`, `fx`, `rates`.
    public var kind: String
    public var holdingId: String?
    public var holdingName: String?
    public var sleeve: String?
    public var title: String
    public var effectHufMinor: Int64
    public var effectNote: String
    public var changePct: Double?
    /// 0 alacsony · 1 közepes · 2 magas.
    public var confidence: Int
    public var verdict: String
    public var body: String
    public var uncertainty: String
    public var noAction: String
    public var publishedAt: String?
    public var sources: [PenzDigestSource]
    /// `model` or `fallback`.
    public var narratedBy: String

    public init(id: String, kind: String, holdingId: String? = nil, holdingName: String? = nil, sleeve: String? = nil,
                title: String, effectHufMinor: Int64, effectNote: String, changePct: Double? = nil, confidence: Int,
                verdict: String, body: String, uncertainty: String, noAction: String, publishedAt: String? = nil,
                sources: [PenzDigestSource] = [], narratedBy: String = "model") {
        self.id = id; self.kind = kind; self.holdingId = holdingId; self.holdingName = holdingName; self.sleeve = sleeve
        self.title = title; self.effectHufMinor = effectHufMinor; self.effectNote = effectNote; self.changePct = changePct
        self.confidence = confidence; self.verdict = verdict; self.body = body; self.uncertainty = uncertainty
        self.noAction = noAction; self.publishedAt = publishedAt; self.sources = sources; self.narratedBy = narratedBy
    }
    private enum CodingKeys: String, CodingKey {
        case id, kind, holdingId, holdingName, sleeve, title, effectHufMinor, effectNote, changePct, confidence, verdict,
             body, uncertainty, noAction, publishedAt, sources, narratedBy
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = c.lenient(.kind, "holding"); holdingId = c.optional(.holdingId); holdingName = c.optional(.holdingName)
        sleeve = c.optional(.sleeve); title = c.lenient(.title, ""); effectHufMinor = c.lenient(.effectHufMinor, 0)
        effectNote = c.lenient(.effectNote, ""); changePct = c.optional(.changePct)
        confidence = min(2, max(0, c.lenient(.confidence, 0)))
        verdict = c.lenient(.verdict, ""); body = c.lenient(.body, ""); uncertainty = c.lenient(.uncertainty, "")
        noAction = c.lenient(.noAction, ""); publishedAt = c.optional(.publishedAt); sources = c.lenient(.sources, [])
        narratedBy = c.lenient(.narratedBy, "model")
    }
}

/// `GET /api/penz/digest`.
public struct PenzDigest: Codable, Equatable, Sendable {
    public var date: String
    /// `pending`, `ready`, `quiet`, `failed`.
    public var status: String
    public var generatedAt: String?
    public var pricesAsOf: String?
    public var newsHealthy: Bool
    public var items: [PenzDigestItem]

    public init(date: String, status: String, generatedAt: String? = nil, pricesAsOf: String? = nil, newsHealthy: Bool = true,
                items: [PenzDigestItem] = []) {
        self.date = date; self.status = status; self.generatedAt = generatedAt; self.pricesAsOf = pricesAsOf
        self.newsHealthy = newsHealthy; self.items = items
    }
    private enum CodingKeys: String, CodingKey { case date, status, generatedAt, pricesAsOf, newsHealthy, items }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = c.lenient(.date, ""); status = c.lenient(.status, "pending"); generatedAt = c.optional(.generatedAt)
        pricesAsOf = c.optional(.pricesAsOf); newsHealthy = c.lenient(.newsHealthy, true); items = c.lenient(.items, [])
    }
}
