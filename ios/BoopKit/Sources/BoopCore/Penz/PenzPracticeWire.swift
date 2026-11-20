import Foundation

// Pénz L7 (`mezo-r36n9.105`) — the Gyakorlás (paper-trading practice) wire, hand-decoded like the rest of Pénz
// (build notes `2026-11-20-boop-penz-l7-build.md` §3.1): every enum is a plain string the screens map, a missing field
// falls back to a value that is visibly "nothing" (nil, 0, empty), never to an invented figure. Everything is `Codable`
// so the overview can sit in `ServerCache` and Gyakorlás renders offline with its age.

private extension KeyedDecodingContainer {
    func lenient<T: Decodable>(_ key: Key, _ fallback: T) -> T { ((try? decodeIfPresent(T.self, forKey: key)) ?? nil) ?? fallback }
    func optional<T: Decodable>(_ key: Key) -> T? { (try? decodeIfPresent(T.self, forKey: key)) ?? nil }
}

/// One of the fixed eight tags (`kitores` Kitörés …), in the server's order.
public struct PenzPracticeTag: Codable, Equatable, Sendable, Identifiable {
    public var key: String
    public var label: String
    public var id: String { key }
    public init(key: String, label: String) { self.key = key; self.label = label }
    private enum CodingKeys: String, CodingKey { case key, label }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        key = c.lenient(.key, ""); label = c.lenient(.label, "")
    }
}

/// The monthly practice cap: `penz_settings.practice_monthly_minor`, what open trades and this month's losses use.
public struct PenzPracticeCap: Codable, Equatable, Sendable {
    public var capHufMinor: Int64, usedHufMinor: Int64, leftHufMinor: Int64
    public init(capHufMinor: Int64, usedHufMinor: Int64, leftHufMinor: Int64) {
        self.capHufMinor = capHufMinor; self.usedHufMinor = usedHufMinor; self.leftHufMinor = leftHufMinor
    }
    private enum CodingKeys: String, CodingKey { case capHufMinor, usedHufMinor, leftHufMinor }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        capHufMinor = c.lenient(.capHufMinor, 0); usedHufMinor = c.lenient(.usedHufMinor, 0)
        leftHufMinor = c.lenient(.leftHufMinor, 0)
    }
}

/// One paper trade — a plan first, then opened, then closed with its journal line.
public struct PenzPaperTrade: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var paper: Bool
    /// `planned`, `open`, `closed`, `cancelled`.
    public var status: String
    public var instrument: String
    /// `long`, `short`.
    public var direction: String
    public var why: String
    public var currency: String
    public var quantity: Double
    public var plannedEntry: PenzMoney?
    public var stop: PenzMoney
    public var target: PenzMoney?
    public var entry: PenzMoney?
    public var entryDate: String?
    public var exit: PenzMoney?
    public var exitDate: String?
    public var lastClose: PenzMoney?
    public var lastCloseDate: String?
    public var riskMinor: Int64?
    public var riskHufMinor: Int64?
    public var costHufMinor: Int64?
    public var pnl: PenzMoney?
    public var rMultiple: Double?
    public var unrealizedHufMinor: Int64?
    public var tags: [String]
    public var mistake: Bool
    public var line: String?
    public var stopRespected: Bool?
    public var createdAt: String
    public var clientRef: String?

    public init(id: String, status: String, instrument: String, direction: String = "long", why: String = "",
                currency: String = "HUF", quantity: Double = 1, plannedEntry: PenzMoney? = nil, stop: PenzMoney,
                target: PenzMoney? = nil, entry: PenzMoney? = nil, entryDate: String? = nil, exit: PenzMoney? = nil,
                exitDate: String? = nil, lastClose: PenzMoney? = nil, lastCloseDate: String? = nil, riskMinor: Int64? = nil,
                riskHufMinor: Int64? = nil, costHufMinor: Int64? = nil, pnl: PenzMoney? = nil, rMultiple: Double? = nil,
                unrealizedHufMinor: Int64? = nil, tags: [String] = [], mistake: Bool = false, line: String? = nil,
                stopRespected: Bool? = nil, createdAt: String = "", clientRef: String? = nil) {
        self.id = id; self.paper = true; self.status = status; self.instrument = instrument; self.direction = direction
        self.why = why; self.currency = currency; self.quantity = quantity; self.plannedEntry = plannedEntry; self.stop = stop
        self.target = target; self.entry = entry; self.entryDate = entryDate; self.exit = exit; self.exitDate = exitDate
        self.lastClose = lastClose; self.lastCloseDate = lastCloseDate; self.riskMinor = riskMinor
        self.riskHufMinor = riskHufMinor; self.costHufMinor = costHufMinor; self.pnl = pnl; self.rMultiple = rMultiple
        self.unrealizedHufMinor = unrealizedHufMinor; self.tags = tags; self.mistake = mistake; self.line = line
        self.stopRespected = stopRespected; self.createdAt = createdAt; self.clientRef = clientRef
    }

    private enum CodingKeys: String, CodingKey {
        case id, paper, status, instrument, direction, why, currency, quantity, plannedEntry, stop, target, entry, entryDate,
             exit, exitDate, lastClose, lastCloseDate, riskMinor, riskHufMinor, costHufMinor, pnl, rMultiple,
             unrealizedHufMinor, tags, mistake, line, stopRespected, createdAt, clientRef
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        paper = c.lenient(.paper, true); status = c.lenient(.status, "planned")
        instrument = c.lenient(.instrument, ""); direction = c.lenient(.direction, "long")
        why = c.lenient(.why, ""); currency = c.lenient(.currency, "HUF"); quantity = c.lenient(.quantity, 0)
        plannedEntry = c.optional(.plannedEntry); stop = c.lenient(.stop, .zero); target = c.optional(.target)
        entry = c.optional(.entry); entryDate = c.optional(.entryDate); exit = c.optional(.exit)
        exitDate = c.optional(.exitDate); lastClose = c.optional(.lastClose); lastCloseDate = c.optional(.lastCloseDate)
        riskMinor = c.optional(.riskMinor); riskHufMinor = c.optional(.riskHufMinor); costHufMinor = c.optional(.costHufMinor)
        pnl = c.optional(.pnl); rMultiple = c.optional(.rMultiple); unrealizedHufMinor = c.optional(.unrealizedHufMinor)
        tags = c.lenient(.tags, []); mistake = c.lenient(.mistake, false); line = c.optional(.line)
        stopRespected = c.optional(.stopRespected); createdAt = c.lenient(.createdAt, ""); clientRef = c.optional(.clientRef)
    }
}

/// The week's numbers by setup (one tag).
public struct PenzSetupStat: Codable, Equatable, Sendable {
    public var tag: String, label: String
    public var count: Int, wins: Int
    public var avgR: Double?
    public init(tag: String, label: String, count: Int, wins: Int, avgR: Double?) {
        self.tag = tag; self.label = label; self.count = count; self.wins = wins; self.avgR = avgR
    }
    private enum CodingKeys: String, CodingKey { case tag, label, count, wins, avgR }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tag = c.lenient(.tag, ""); label = c.lenient(.label, ""); count = c.lenient(.count, 0); wins = c.lenient(.wins, 0)
        avgR = c.optional(.avgR)
    }
}

/// Is the week's R spread healthy: big wins (≥ +2R), small losses (−1.2R…0), losses worse than the limit (< −1.5R).
public struct PenzRDistribution: Codable, Equatable, Sendable {
    public var bigWins: Int, smallLosses: Int, worseThanLimit: Int
    public var healthy: Bool
    public init(bigWins: Int = 0, smallLosses: Int = 0, worseThanLimit: Int = 0, healthy: Bool = true) {
        self.bigWins = bigWins; self.smallLosses = smallLosses; self.worseThanLimit = worseThanLimit; self.healthy = healthy
    }
    private enum CodingKeys: String, CodingKey { case bigWins, smallLosses, worseThanLimit, healthy }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        bigWins = c.lenient(.bigWins, 0); smallLosses = c.lenient(.smallLosses, 0)
        worseThanLimit = c.lenient(.worseThanLimit, 0); healthy = c.lenient(.healthy, true)
    }
}

/// The week's most common mistake and what it cost.
public struct PenzCommonMistake: Codable, Equatable, Sendable {
    public var tag: String, label: String
    public var count: Int
    public var costHufMinor: Int64
    public init(tag: String, label: String, count: Int, costHufMinor: Int64) {
        self.tag = tag; self.label = label; self.count = count; self.costHufMinor = costHufMinor
    }
    private enum CodingKeys: String, CodingKey { case tag, label, count, costHufMinor }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tag = c.lenient(.tag, ""); label = c.lenient(.label, ""); count = c.lenient(.count, 0)
        costHufMinor = c.lenient(.costHufMinor, 0)
    }
}

/// One deterministic observation line of the weekly review.
public struct PenzObservation: Codable, Equatable, Sendable {
    public var title: String, body: String
    public init(title: String, body: String) { self.title = title; self.body = body }
    private enum CodingKeys: String, CodingKey { case title, body }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = c.lenient(.title, ""); body = c.lenient(.body, "")
    }
}

/// One point of the week's curve: the cumulative closed P/L up to that day (0 baseline).
public struct PenzCurvePoint: Codable, Equatable, Sendable {
    public var date: String
    public var cumulativeHufMinor: Int64
    public init(date: String, cumulativeHufMinor: Int64) { self.date = date; self.cumulativeHufMinor = cumulativeHufMinor }
    private enum CodingKeys: String, CodingKey { case date, cumulativeHufMinor }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = c.lenient(.date, ""); cumulativeHufMinor = c.lenient(.cumulativeHufMinor, 0)
    }
}

/// The weekly review — computed figures and fixed Hungarian templates on the server.
public struct PenzPracticeWeek: Codable, Equatable, Sendable {
    public var weekStart: String, weekEnd: String
    /// The highlight; nil when no trade was closed this week.
    public var headline: String?, sub: String?
    public var closedCount: Int
    public var winRatePct: Int?
    public var avgR: Double?
    public var bySetup: [PenzSetupStat]
    public var distribution: PenzRDistribution
    public var commonMistake: PenzCommonMistake?
    public var observations: [PenzObservation]
    public var curve: [PenzCurvePoint]
    /// Closed this week, newest first.
    public var trades: [PenzPaperTrade]

    public init(weekStart: String = "", weekEnd: String = "", headline: String? = nil, sub: String? = nil, closedCount: Int = 0,
                winRatePct: Int? = nil, avgR: Double? = nil, bySetup: [PenzSetupStat] = [],
                distribution: PenzRDistribution = PenzRDistribution(), commonMistake: PenzCommonMistake? = nil,
                observations: [PenzObservation] = [], curve: [PenzCurvePoint] = [], trades: [PenzPaperTrade] = []) {
        self.weekStart = weekStart; self.weekEnd = weekEnd; self.headline = headline; self.sub = sub
        self.closedCount = closedCount; self.winRatePct = winRatePct; self.avgR = avgR; self.bySetup = bySetup
        self.distribution = distribution; self.commonMistake = commonMistake; self.observations = observations
        self.curve = curve; self.trades = trades
    }
    private enum CodingKeys: String, CodingKey {
        case weekStart, weekEnd, headline, sub, closedCount, winRatePct, avgR, bySetup, distribution, commonMistake,
             observations, curve, trades
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        weekStart = c.lenient(.weekStart, ""); weekEnd = c.lenient(.weekEnd, "")
        headline = c.optional(.headline); sub = c.optional(.sub); closedCount = c.lenient(.closedCount, 0)
        winRatePct = c.optional(.winRatePct); avgR = c.optional(.avgR); bySetup = c.lenient(.bySetup, [])
        distribution = c.lenient(.distribution, PenzRDistribution()); commonMistake = c.optional(.commonMistake)
        observations = c.lenient(.observations, []); curve = c.lenient(.curve, []); trades = c.lenient(.trades, [])
    }
}

/// `GET /api/penz/practice` — the Gyakorlás tab in one answer.
public struct PenzPracticeOverview: Codable, Equatable, Sendable {
    public var paper: Bool
    /// `YYYY-MM`.
    public var month: String
    public var cap: PenzPracticeCap
    public var monthPnlHufMinor: Int64
    /// All-time closed paper trades; nil before the first close.
    public var avgR: Double?
    public var closedCount: Int, taggedCount: Int
    /// Under 50 tagged trades: "… ezek a számok még zajnak számítanak — most N van."
    public var noiseLine: String?
    public var tags: [PenzPracticeTag]
    public var week: PenzPracticeWeek
    public var open: [PenzPaperTrade]
    public var planned: [PenzPaperTrade]

    public init(month: String, cap: PenzPracticeCap, monthPnlHufMinor: Int64 = 0, avgR: Double? = nil, closedCount: Int = 0,
                taggedCount: Int = 0, noiseLine: String? = nil, tags: [PenzPracticeTag] = [],
                week: PenzPracticeWeek = PenzPracticeWeek(), open: [PenzPaperTrade] = [], planned: [PenzPaperTrade] = []) {
        self.paper = true; self.month = month; self.cap = cap; self.monthPnlHufMinor = monthPnlHufMinor; self.avgR = avgR
        self.closedCount = closedCount; self.taggedCount = taggedCount; self.noiseLine = noiseLine; self.tags = tags
        self.week = week; self.open = open; self.planned = planned
    }
    private enum CodingKeys: String, CodingKey {
        case paper, month, cap, monthPnlHufMinor, avgR, closedCount, taggedCount, noiseLine, tags, week, open, planned
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        paper = c.lenient(.paper, true); month = c.lenient(.month, "")
        cap = c.lenient(.cap, PenzPracticeCap(capHufMinor: 0, usedHufMinor: 0, leftHufMinor: 0))
        monthPnlHufMinor = c.lenient(.monthPnlHufMinor, 0); avgR = c.optional(.avgR)
        closedCount = c.lenient(.closedCount, 0); taggedCount = c.lenient(.taggedCount, 0); noiseLine = c.optional(.noiseLine)
        tags = c.lenient(.tags, []); week = c.lenient(.week, PenzPracticeWeek())
        open = c.lenient(.open, []); planned = c.lenient(.planned, [])
    }
}

// MARK: - Requests

/// `POST /api/penz/practice/trades` (and `PUT …/{id}` while planned). With `entryMinor` + `entryDate` the plan is
/// created and opened in one call ("most lépek be").
public struct PenzTradeRequest: Codable, Equatable, Sendable {
    public var clientRef: String?
    public var instrument: String
    public var direction: String
    public var why: String
    public var currency: String
    public var quantity: Double
    public var plannedEntryMinor: Int64?
    public var stopMinor: Int64
    public var targetMinor: Int64?
    public var entryMinor: Int64?
    public var entryDate: String?
    public init(clientRef: String?, instrument: String, direction: String, why: String, currency: String, quantity: Double,
                plannedEntryMinor: Int64?, stopMinor: Int64, targetMinor: Int64? = nil, entryMinor: Int64? = nil,
                entryDate: String? = nil) {
        self.clientRef = clientRef; self.instrument = instrument; self.direction = direction; self.why = why
        self.currency = currency; self.quantity = quantity; self.plannedEntryMinor = plannedEntryMinor
        self.stopMinor = stopMinor; self.targetMinor = targetMinor; self.entryMinor = entryMinor; self.entryDate = entryDate
    }
}

public struct PenzTradeOpenRequest: Codable, Equatable, Sendable {
    public var entryMinor: Int64
    public var entryDate: String
    public init(entryMinor: Int64, entryDate: String) { self.entryMinor = entryMinor; self.entryDate = entryDate }
}

public struct PenzTradeCloseRequest: Codable, Equatable, Sendable {
    public var exitMinor: Int64
    public var exitDate: String
    public var tags: [String]
    public var mistake: Bool
    public var line: String
    public init(exitMinor: Int64, exitDate: String, tags: [String], mistake: Bool, line: String) {
        self.exitMinor = exitMinor; self.exitDate = exitDate; self.tags = tags; self.mistake = mistake; self.line = line
    }
}

public struct PenzLastCloseRequest: Codable, Equatable, Sendable {
    public var closeMinor: Int64
    public var date: String
    public init(closeMinor: Int64, date: String) { self.closeMinor = closeMinor; self.date = date }
}
