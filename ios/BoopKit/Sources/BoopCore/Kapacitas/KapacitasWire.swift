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

// MARK: - The Átrendezés week (B7 K3, `mezo-r36n9.17`)
//
// Enums travel as plain strings (the lenient-client rule): a value the server adds later must not drop the week.
// Step / adjustment payloads are not decoded — the phone never reads them, it only shows the server's words.

/// One day of `GET /api/capacity/week`: the load model's verdict and its word, as the server shows them.
public struct KapacitasWeekDay: Codable, Equatable, Sendable {
    public let date: String
    /// laza | rendben | szoros | tulSok
    public let verdict: String
    /// The verdict word as shown („túl sok").
    public let label: String
    /// Day load / capacity.
    public let ratio: Double
    public let calendarKnown: Bool

    public init(date: String, verdict: String, label: String, ratio: Double, calendarKnown: Bool) {
        self.date = date; self.verdict = verdict; self.label = label; self.ratio = ratio; self.calendarKnown = calendarKnown
    }
}

/// A *Minden hatása* row (Most → Utána); every figure comes from an engine, „–" when unknown.
public struct KapacitasCompareLine: Codable, Equatable, Sendable {
    public let label: String
    public let before: String
    public let after: String
    /// 1 = the change helps, -1 = it costs, 0 = neutral.
    public let favours: Int

    public init(label: String, before: String, after: String, favours: Int) {
        self.label = label; self.before = before; self.after = after; self.favours = favours
    }
}

/// Only the step's kind is read (an „ALVÁS + EDZÉS" card has steps of both).
public struct KapacitasStep: Codable, Equatable, Sendable {
    public let kind: String
    public init(kind: String) { self.kind = kind }
}

/// One proposal of the week.
public struct KapacitasProposal: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    /// MOVE_SESSION_DAY … CALENDAR_TODO
    public let kind: String
    public let day: String?
    /// open | accepted | declined | ignored | undone | expired
    public let status: String
    public let title: String
    public let move: String
    public let effectLines: [String]
    public let why: [String]
    public let effects: [KapacitasCompareLine]
    public let steps: [KapacitasStep]
    public let touchedDays: [String]
    public let decidedAt: String?

    public init(id: String, kind: String, day: String?, status: String, title: String, move: String,
                effectLines: [String], why: [String], effects: [KapacitasCompareLine], steps: [KapacitasStep] = [],
                touchedDays: [String] = [], decidedAt: String? = nil) {
        self.id = id; self.kind = kind; self.day = day; self.status = status; self.title = title; self.move = move
        self.effectLines = effectLines; self.why = why; self.effects = effects; self.steps = steps
        self.touchedDays = touchedDays; self.decidedAt = decidedAt
    }

    /// A calendar to-do: the phone never writes his calendar, he moves the event himself.
    public var isCalendarTodo: Bool { kind == "CALENDAR_TODO" }
}

/// A ledger row touching the week.
public struct KapacitasAdjustment: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    /// The day the row is filed under (a move: its from-day).
    public let date: String
    public let kind: String
    public let bundleId: String
    public let proposalId: String?
    /// active | undone | waiting | done | expired
    public let state: String

    public init(id: String, date: String, kind: String, bundleId: String, proposalId: String?, state: String) {
        self.id = id; self.date = date; self.kind = kind; self.bundleId = bundleId; self.proposalId = proposalId
        self.state = state
    }
}

/// A learned pattern (empty until K4).
public struct KapacitasPattern: Codable, Equatable, Sendable {
    public let key: String
    public let line: String
    public let evidence: Int
}

/// `GET /api/capacity/week`.
public struct KapacitasWeek: Codable, Equatable, Sendable {
    public let monday: String
    public let days: [KapacitasWeekDay]
    public let proposals: [KapacitasProposal]
    public let adjustments: [KapacitasAdjustment]
    public let patterns: [KapacitasPattern]

    public init(monday: String, days: [KapacitasWeekDay], proposals: [KapacitasProposal],
                adjustments: [KapacitasAdjustment] = [], patterns: [KapacitasPattern] = []) {
        self.monday = monday; self.days = days; self.proposals = proposals; self.adjustments = adjustments
        self.patterns = patterns
    }
}

/// `POST /api/capacity/proposals/{id}/accept` body.
struct KapacitasAcceptBody: Encodable, Sendable {
    let clientRef: String
}

/// The queued accept (`OutboxKind.dayAdjustment`): the proposal and the phone's idempotency key. The key is the
/// outbox item's own id as well, so a replay after a lost answer carries the same `clientRef` and never moves twice.
public struct DayAdjustmentPayload: Codable, Equatable, Sendable {
    public var proposalId: String
    public var clientRef: String

    public init(proposalId: String, clientRef: String) { self.proposalId = proposalId; self.clientRef = clientRef }
}
