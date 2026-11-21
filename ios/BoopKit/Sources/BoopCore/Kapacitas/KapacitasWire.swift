import Foundation

// Day capacity wire types the generated client does not carry (B7 K2, `mezo-r36n9.17`), for the lenient
// `KapacitasClient`. Contract: `api/feature/capacity/capacity.yml`.

/// How an event felt, as the day page's three chips say it („Merít · Semleges · Feltölt"); `rawValue` is the wire's.
public enum KapacitasEffect: String, CaseIterable, Sendable, Identifiable {
    case drains, neutral, feeds

    public var id: String { rawValue }

    /// The chip's word.
    public var label: String {
        switch self {
        case .drains: "Merít"
        case .neutral: "Semleges"
        case .feeds: "Feltölt"
        }
    }
}

/// `PUT /api/capacity/event-feedback` body. The key travels in the body: device calendar ids may carry '/' and ':'.
struct KapacitasFeedbackBody: Encodable, Sendable {
    let eventKey: String
    let effect: String
}

/// One season week of the load-vs-recovery chart. `load` / `recovery` are the server's figures (never computed here);
/// a planned week has no recovery, and a `trainingOnly` week's load counts only the planned training sessions.
public struct KapacitasSeasonWeek: Codable, Equatable, Sendable {
    public let week: Int
    public let load: Double?
    public let recovery: Double?
    public let planned: Bool
    public let over: Bool
    public let trainingOnly: Bool

    public init(week: Int, load: Double?, recovery: Double?, planned: Bool, over: Bool, trainingOnly: Bool) {
        self.week = week; self.load = load; self.recovery = recovery
        self.planned = planned; self.over = over; self.trainingOnly = trainingOnly
    }
}

public struct KapacitasSeasonStats: Codable, Equatable, Sendable {
    public let overloadedDays4w: Int
    public let moves: Int
    public let movesGood: Int

    public init(overloadedDays4w: Int, moves: Int, movesGood: Int) {
        self.overloadedDays4w = overloadedDays4w; self.moves = moves; self.movesGood = movesGood
    }
}

/// `GET /api/capacity/season`.
public struct KapacitasSeasonLoad: Codable, Equatable, Sendable {
    public let weeks: [KapacitasSeasonWeek]
    /// 1-based season week containing today.
    public let nowWeek: Int
    public let stats: KapacitasSeasonStats
    public let headline: String?

    public init(weeks: [KapacitasSeasonWeek], nowWeek: Int, stats: KapacitasSeasonStats, headline: String?) {
        self.weeks = weeks; self.nowWeek = nowWeek; self.stats = stats; self.headline = headline
    }
}
