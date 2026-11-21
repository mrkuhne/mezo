import Foundation

// The wire shapes of the Hatás tab — experiments (Boop B6 Évad S4, `mezo-r36n9.16`, contract
// `api/feature/season/season.yml`: `SeasonExperiments`, `SeasonExperiment`, `SeasonExperimentResult`,
// `SeasonExperimentSignal`, `SeasonExperimentOverlap`). Hand-written and lenient like the rest of Évad: every enum is a
// plain String, unknown fields are ignored, a missing optional is nil or empty.

/// One compared signal of a finished experiment. `key`: sleep_min · deep_min · hrv_ms · resting_hr · energy · mood ·
/// morning_feel. `before` / `after` are means over the days with data (nil without any); `clear` = the change is beyond
/// his day-to-day variation (|Cliff's delta| ≥ 0.33 with ≥ 5 days on each side); `better` is set only when clear.
public struct EvadExperimentSignal: Codable, Equatable, Sendable {
    public let key: String
    public let before: Double?
    public let after: Double?
    public let nBefore: Int
    public let nAfter: Int
    public let cliffsDelta: Double?
    public let clear: Bool
    public let better: Bool?

    public init(key: String, before: Double?, after: Double?, nBefore: Int = 14, nAfter: Int = 14,
                cliffsDelta: Double? = nil, clear: Bool = false, better: Bool? = nil) {
        self.key = key; self.before = before; self.after = after; self.nBefore = nBefore; self.nAfter = nAfter
        self.cliffsDelta = cliffsDelta; self.clear = clear; self.better = better
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        key = try c.decode(String.self, forKey: .key)
        before = try c.decodeIfPresent(Double.self, forKey: .before)
        after = try c.decodeIfPresent(Double.self, forKey: .after)
        nBefore = try c.decodeIfPresent(Int.self, forKey: .nBefore) ?? 0
        nAfter = try c.decodeIfPresent(Int.self, forKey: .nAfter) ?? 0
        cliffsDelta = try c.decodeIfPresent(Double.self, forKey: .cliffsDelta)
        clear = try c.decodeIfPresent(Bool.self, forKey: .clear) ?? false
        better = try c.decodeIfPresent(Bool.self, forKey: .better)
    }
}

/// A finished experiment's verdict. `verdict`: clear · none · insufficient (fewer than `needDays` marked).
public struct EvadExperimentResult: Codable, Equatable, Sendable {
    public let verdict: String
    public let signals: [EvadExperimentSignal]
    public let baselineFrom: String
    public let baselineTo: String
    public let markedCount: Int

    public init(verdict: String, signals: [EvadExperimentSignal], baselineFrom: String, baselineTo: String, markedCount: Int) {
        self.verdict = verdict; self.signals = signals; self.baselineFrom = baselineFrom; self.baselineTo = baselineTo
        self.markedCount = markedCount
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        verdict = try c.decodeIfPresent(String.self, forKey: .verdict) ?? "none"
        signals = try c.decodeIfPresent([EvadExperimentSignal].self, forKey: .signals) ?? []
        baselineFrom = try c.decodeIfPresent(String.self, forKey: .baselineFrom) ?? ""
        baselineTo = try c.decodeIfPresent(String.self, forKey: .baselineTo) ?? ""
        markedCount = try c.decodeIfPresent(Int.self, forKey: .markedCount) ?? 0
    }
}

/// Another change inside the window (`kind`: mesocycle · deload · kimelo · season), in one Hungarian line.
public struct EvadExperimentOverlap: Codable, Equatable, Hashable, Sendable {
    public let kind: String
    public let date: String
    public let text: String
    public init(kind: String, date: String, text: String) { self.kind = kind; self.date = date; self.text = text }
}

/// One experiment. `status`: proposed · running · done · dismissed. `subjectKind`: supplement · recipe · food · habit ·
/// text.
public struct EvadExperiment: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let subjectKind: String
    public let subjectRef: String?
    public let title: String
    /// Why Boop proposed it („Hétfő óta szedsz esti magnéziumot."); nil for his own.
    public let reason: String?
    public let startDate: String?
    public let endDate: String?
    public let lengthDays: Int
    public let status: String
    /// Running: which day of the window today is (1-based, capped at `lengthDays`).
    public let dayIndex: Int?
    public let markedDays: [String]
    /// ceil(0.7 × lengthDays): the marked days the result needs.
    public let needDays: Int
    public let watched: [String]
    public let overlaps: [EvadExperimentOverlap]
    public let result: EvadExperimentResult?
    public let finishedOn: String?
    public let kept: Bool

    public init(id: String, subjectKind: String = "habit", subjectRef: String? = nil, title: String, reason: String? = nil,
                startDate: String? = nil, endDate: String? = nil, lengthDays: Int = 14, status: String,
                dayIndex: Int? = nil, markedDays: [String] = [], needDays: Int = 10, watched: [String] = [],
                overlaps: [EvadExperimentOverlap] = [], result: EvadExperimentResult? = nil, finishedOn: String? = nil,
                kept: Bool = false) {
        self.id = id; self.subjectKind = subjectKind; self.subjectRef = subjectRef; self.title = title; self.reason = reason
        self.startDate = startDate; self.endDate = endDate; self.lengthDays = lengthDays; self.status = status
        self.dayIndex = dayIndex; self.markedDays = markedDays; self.needDays = needDays; self.watched = watched
        self.overlaps = overlaps; self.result = result; self.finishedOn = finishedOn; self.kept = kept
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        subjectKind = try c.decodeIfPresent(String.self, forKey: .subjectKind) ?? "habit"
        subjectRef = try c.decodeIfPresent(String.self, forKey: .subjectRef)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        reason = try c.decodeIfPresent(String.self, forKey: .reason)
        startDate = try c.decodeIfPresent(String.self, forKey: .startDate)
        endDate = try c.decodeIfPresent(String.self, forKey: .endDate)
        lengthDays = try c.decodeIfPresent(Int.self, forKey: .lengthDays) ?? 14
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "proposed"
        dayIndex = try c.decodeIfPresent(Int.self, forKey: .dayIndex)
        markedDays = try c.decodeIfPresent([String].self, forKey: .markedDays) ?? []
        needDays = try c.decodeIfPresent(Int.self, forKey: .needDays) ?? Int((0.7 * Double(lengthDays)).rounded(.up))
        watched = try c.decodeIfPresent([String].self, forKey: .watched) ?? []
        overlaps = try c.decodeIfPresent([EvadExperimentOverlap].self, forKey: .overlaps) ?? []
        result = try c.decodeIfPresent(EvadExperimentResult.self, forKey: .result)
        finishedOn = try c.decodeIfPresent(String.self, forKey: .finishedOn)
        kept = try c.decodeIfPresent(Bool.self, forKey: .kept) ?? false
    }
}

/// The Hatás tab's read model: at most one open proposal, at most one running experiment, the finished ones newest
/// first (dismissed ones left out), and the season's „Boop is javasol kísérletet" switch.
public struct EvadExperiments: Codable, Equatable, Sendable {
    public let proposal: EvadExperiment?
    public let running: EvadExperiment?
    public let past: [EvadExperiment]
    public let proposeOn: Bool

    public init(proposal: EvadExperiment? = nil, running: EvadExperiment? = nil, past: [EvadExperiment] = [],
                proposeOn: Bool = true) {
        self.proposal = proposal; self.running = running; self.past = past; self.proposeOn = proposeOn
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        proposal = try c.decodeIfPresent(EvadExperiment.self, forKey: .proposal)
        running = try c.decodeIfPresent(EvadExperiment.self, forKey: .running)
        past = try c.decodeIfPresent([EvadExperiment].self, forKey: .past) ?? []
        proposeOn = try c.decodeIfPresent(Bool.self, forKey: .proposeOn) ?? true
    }

    /// Nothing at all to show: no proposal, nothing running, nothing finished.
    public var isEmpty: Bool { proposal == nil && running == nil && past.isEmpty }
}

/// „Új kísérlet" / „Újra kipróbálom" (`SeasonExperimentCreate`). An absent `subjectRef` is omitted.
public struct EvadExperimentCreate: Codable, Equatable, Sendable {
    public var title: String
    public var subjectKind: String
    public var subjectRef: String?
    public var lengthDays: Int
    public init(title: String, subjectKind: String = "habit", subjectRef: String? = nil, lengthDays: Int = 14) {
        self.title = title; self.subjectKind = subjectKind; self.subjectRef = subjectRef; self.lengthDays = lengthDays
    }
}

struct EvadExperimentMarkBody: Encodable { let date: String; let done: Bool }
