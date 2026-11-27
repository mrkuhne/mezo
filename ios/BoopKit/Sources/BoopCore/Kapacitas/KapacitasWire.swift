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

/// The season's advisory card (B7 K4, owner decision #121 „Csak szóljon"): the lighter week is worth bringing forward.
/// It only tells — the phone writes nothing; its one action opens the Boop chat.
public struct KapacitasDeloadHint: Codable, Equatable, Sendable {
    public let fromWeek: Int
    public let toWeek: Int
    public let title: String
    public let body: String

    public init(fromWeek: Int, toWeek: Int, title: String, body: String) {
        self.fromWeek = fromWeek; self.toWeek = toWeek; self.title = title; self.body = body
    }
}

/// `GET /api/capacity/season`.
public struct KapacitasSeasonLoad: Codable, Equatable, Sendable {
    public let weeks: [KapacitasSeasonWeek]
    /// 1-based season week containing today.
    public let nowWeek: Int
    public let stats: KapacitasSeasonStats
    public let headline: String?
    /// K4: *Amit a mozgatásokból tanultam* — the shown patterns; [] from an older server.
    public let patterns: [KapacitasPattern]
    /// K4: the advisory lighter-week card, nil when there is nothing to say.
    public let deloadForward: KapacitasDeloadHint?

    public init(weeks: [KapacitasSeasonWeek], nowWeek: Int, stats: KapacitasSeasonStats, headline: String?,
                patterns: [KapacitasPattern] = [], deloadForward: KapacitasDeloadHint? = nil) {
        self.weeks = weeks; self.nowWeek = nowWeek; self.stats = stats; self.headline = headline
        self.patterns = patterns; self.deloadForward = deloadForward
    }

    enum CodingKeys: String, CodingKey { case weeks, nowWeek, stats, headline, patterns, deloadForward }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        weeks = try c.decode([KapacitasSeasonWeek].self, forKey: .weeks)
        nowWeek = try c.decode(Int.self, forKey: .nowWeek)
        stats = try c.decode(KapacitasSeasonStats.self, forKey: .stats)
        headline = try c.decodeIfPresent(String.self, forKey: .headline)
        patterns = ((try? c.decodeIfPresent([KapacitasPattern].self, forKey: .patterns)) ?? nil) ?? []
        deloadForward = (try? c.decodeIfPresent(KapacitasDeloadHint.self, forKey: .deloadForward)) ?? nil
    }
}

/// `GET /api/capacity/season-hints`: patterns worth knowing when he sets up a new season.
struct KapacitasSeasonHints: Decodable, Sendable {
    let hints: [KapacitasPattern]

    enum CodingKeys: String, CodingKey { case hints }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        hints = ((try? c.decodeIfPresent([KapacitasPattern].self, forKey: .hints)) ?? nil) ?? []
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

/// A step: its kind (an „ALVÁS + EDZÉS" card has steps of both) and the days / clock values its payload names, for
/// *Ha jóváhagyod, itt látod*. Read leniently: a missing or odd field is nil, never a failed week.
public struct KapacitasStep: Codable, Equatable, Sendable {
    public let kind: String
    public let payload: KapacitasStepPayload?
    public init(kind: String, payload: KapacitasStepPayload? = nil) { self.kind = kind; self.payload = payload }

    enum CodingKeys: String, CodingKey { case kind, payload }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = try c.decode(String.self, forKey: .kind)
        payload = try? c.decodeIfPresent(KapacitasStepPayload.self, forKey: .payload)
    }
}

/// The payload fields the phone reads (MOVE_SESSION_DAY fromDate/toDate, SHIFT_SESSION_TIME date/time, SHORTEN_SESSION
/// date/minutes, SHIFT_BEDTIME night/bedtime, the others date).
public struct KapacitasStepPayload: Codable, Equatable, Sendable {
    public let fromDate: String?, toDate: String?, date: String?, night: String?, time: String?, bedtime: String?
    public let minutes: Int?

    public init(fromDate: String? = nil, toDate: String? = nil, date: String? = nil, night: String? = nil,
                time: String? = nil, bedtime: String? = nil, minutes: Int? = nil) {
        self.fromDate = fromDate; self.toDate = toDate; self.date = date; self.night = night; self.time = time
        self.bedtime = bedtime; self.minutes = minutes
    }

    enum CodingKeys: String, CodingKey { case fromDate, toDate, date, night, time, bedtime, minutes }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func s(_ k: CodingKeys) -> String? { (try? c.decodeIfPresent(String.self, forKey: k)) ?? nil }
        fromDate = s(.fromDate); toDate = s(.toDate); date = s(.date); night = s(.night); time = s(.time)
        bedtime = s(.bedtime)
        minutes = ((try? c.decodeIfPresent(Int.self, forKey: .minutes)) ?? nil)
            ?? ((try? c.decodeIfPresent(Double.self, forKey: .minutes)) ?? nil).map { Int($0) }
    }
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
    /// K4: how the day went after it („jól", „félig", „még nem tudom"…) and the line under it, from the server.
    public let outcomeWord: String?
    public let outcomeSub: String?

    public init(id: String, kind: String, day: String?, status: String, title: String, move: String,
                effectLines: [String], why: [String], effects: [KapacitasCompareLine], steps: [KapacitasStep] = [],
                touchedDays: [String] = [], decidedAt: String? = nil, outcomeWord: String? = nil,
                outcomeSub: String? = nil) {
        self.id = id; self.kind = kind; self.day = day; self.status = status; self.title = title; self.move = move
        self.effectLines = effectLines; self.why = why; self.effects = effects; self.steps = steps
        self.touchedDays = touchedDays; self.decidedAt = decidedAt
        self.outcomeWord = outcomeWord; self.outcomeSub = outcomeSub
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

/// A learned pattern (K4): title, evidence sentence and counts, all from the server's rule — never phrased here.
public struct KapacitasPattern: Codable, Equatable, Sendable {
    public let key: String
    public let line: String
    public let body: String?
    public let evidence: Int
    public let consistent: Int
    /// MONDAY…SUNDAY for a weekday pattern.
    public let weekday: String?

    public init(key: String, line: String, body: String? = nil, evidence: Int, consistent: Int = 0,
                weekday: String? = nil) {
        self.key = key; self.line = line; self.body = body; self.evidence = evidence; self.consistent = consistent
        self.weekday = weekday
    }

    enum CodingKeys: String, CodingKey { case key, line, body, evidence, consistent, weekday }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        key = try c.decode(String.self, forKey: .key)
        line = try c.decode(String.self, forKey: .line)
        body = (try? c.decodeIfPresent(String.self, forKey: .body)) ?? nil
        evidence = ((try? c.decodeIfPresent(Int.self, forKey: .evidence)) ?? nil) ?? 0
        consistent = ((try? c.decodeIfPresent(Int.self, forKey: .consistent)) ?? nil) ?? 0
        weekday = (try? c.decodeIfPresent(String.self, forKey: .weekday)) ?? nil
    }
}

/// A decided proposal of an earlier week (K4), as *Korábban áttettük* shows it.
public struct KapacitasHistoryItem: Codable, Equatable, Sendable {
    public let proposalId: String
    public let kind: String
    public let day: String
    /// accepted | declined | undone
    public let status: String
    public let title: String
    /// The outcome word („jól", „még nem tudom", „maradt így"…).
    public let word: String
    public let sub: String?
    /// Accepted only: whether the day went well after it.
    public let good: Bool?

    public init(proposalId: String, kind: String, day: String, status: String, title: String, word: String,
                sub: String? = nil, good: Bool? = nil) {
        self.proposalId = proposalId; self.kind = kind; self.day = day; self.status = status; self.title = title
        self.word = word; self.sub = sub; self.good = good
    }
}

/// `GET /api/capacity/week`.
public struct KapacitasWeek: Codable, Equatable, Sendable {
    public let monday: String
    public let days: [KapacitasWeekDay]
    public let proposals: [KapacitasProposal]
    public let adjustments: [KapacitasAdjustment]
    public let patterns: [KapacitasPattern]
    /// „Ha mindet jóváhagyod": the week with every open proposal applied together, from the server's engines; nil
    /// below two open proposals.
    public let allEffects: [KapacitasCompareLine]?
    /// K4: decided proposals of the eight weeks before, newest first; [] from an older server.
    public let history: [KapacitasHistoryItem]

    public init(monday: String, days: [KapacitasWeekDay], proposals: [KapacitasProposal],
                adjustments: [KapacitasAdjustment] = [], patterns: [KapacitasPattern] = [],
                allEffects: [KapacitasCompareLine]? = nil, history: [KapacitasHistoryItem] = []) {
        self.monday = monday; self.days = days; self.proposals = proposals; self.adjustments = adjustments
        self.patterns = patterns; self.allEffects = allEffects; self.history = history
    }

    enum CodingKeys: String, CodingKey { case monday, days, proposals, adjustments, patterns, allEffects, history }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        monday = try c.decode(String.self, forKey: .monday)
        days = try c.decode([KapacitasWeekDay].self, forKey: .days)
        proposals = try c.decode([KapacitasProposal].self, forKey: .proposals)
        adjustments = try c.decodeIfPresent([KapacitasAdjustment].self, forKey: .adjustments) ?? []
        patterns = ((try? c.decodeIfPresent([KapacitasPattern].self, forKey: .patterns)) ?? nil) ?? []
        allEffects = try c.decodeIfPresent([KapacitasCompareLine].self, forKey: .allEffects)
        history = ((try? c.decodeIfPresent([KapacitasHistoryItem].self, forKey: .history)) ?? nil) ?? []
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
