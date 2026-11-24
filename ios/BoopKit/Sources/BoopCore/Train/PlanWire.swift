import Foundation

// The wire shapes the block builder and the weekly review read and write (contract: api/feature/train/train.yml and
// train-week-proposal.yml). Hand-written on purpose — see PlanTransport.swift: every enum here is a plain String, so a
// value the server adds later never fails a response. Only the fields the two screens use are declared; unknown
// fields are ignored by `Decodable`.

// MARK: - The running block

public struct WireBlock: Decodable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let shortTitle: String?
    public let status: String
    public let weeks: Int
    public let currentWeek: Int
    public let phaseCurve: [String]
    public let musclePriorities: [String: String]?
    public let sportGroups: [String]?
    public let trainingStyle: String?
    public let techniquesEnabled: Bool?
    public let weeklyReviewMode: String?
    public let startDate: String?
    public let days: [WireDay]?
}

public struct WireDay: Decodable, Equatable, Sendable {
    public let id: String
    public let day: String
    public let type: String
    public let muscle: String?
    public let muscleAccent: Bool?
    public let note: String?
    public let exercises: [WireExercise]
}

public struct WireExercise: Codable, Equatable, Sendable {
    public var id: String?
    public var name: String
    public var muscle: String
    public var warmupSets: Int?
    public var workingSets: Int
    public var repMin: Int?
    public var repMax: Int?
    public var targetRIR: Int?
    public var anchorWeightKg: Double?
    public var type: String?
    public var warning: String?
    public var catalogId: String?
    public var countsTowardVolume: Bool?
    public var trainingStyle: String?
    public var effectiveTrainingStyle: String?
    public var restSec: Int?
    public var overrides: [String]?
    public var technique: String?
    public var techniqueSource: String?
    public var challenge: Bool?
}

/// The catalog attributes the technique rules need (`stability`, `lengthenedFriendly`) and the challenge rule's
/// answer (`challengeAllowed`, server-computed, owner decision #72) with the kit it falls back on (`gear`).
public struct WireCatalogItem: Decodable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let muscle: String?
    public let type: String?
    public let stability: String?
    public let lengthenedFriendly: Bool?
    /// Explicit server palette; absent on older responses.
    public let allowedTechniques: [String]?
    public let gear: [String]?
    public let challengeAllowed: Bool?
    /// The demo still (start position), a server path for `BoopConfig.mediaURL`; nil without a picture.
    public let imageStartUrl: String?
}

// MARK: - The evaluator (POST /api/train/meso-plans/evaluate)

/// One exercise as the evaluator and the day save take it (`GymExerciseInput`). Absent optionals are omitted from
/// the JSON, which on a day save means "carry over" for the style and technique fields.
public struct WireExerciseInput: Encodable, Equatable, Sendable {
    public var name: String
    public var muscle: String
    public var warmupSets: Int
    public var workingSets: Int
    public var repMin: Int
    public var repMax: Int
    public var targetRIR: Int
    public var anchorWeightKg: Double?
    public var type: String
    public var warning: String?
    public var catalogId: String?
    public var countsTowardVolume: Bool
    public var trainingStyle: String?
    public var restSec: Int?
    public var overrides: [String]?
    public var technique: String?
    public var techniqueSource: String?
    public var challenge: Bool?
}

public struct WireDayInput: Encodable, Equatable, Sendable {
    public var day: String
    public var type: String
    public var muscle: String
    public var muscleAccent: Bool
    public var note: String?
    public var exercises: [WireExerciseInput]
}

public struct WireEvaluateRequest: Encodable, Equatable, Sendable {
    public var weeks: Int
    public var phaseCurve: [String]
    public var days: [WireDayInput]
    public var musclePriorities: [String: String]?
    public var sportGroups: [String]?
    public var trainingStyle: String?
    public var techniquesEnabled: Bool?
    /// The session-minutes target (mezo-r36n9.113); absent = no capacity, no per-day over-target.
    public var sessionMinutesTarget: Int? = nil
}

public struct WireBand: Decodable, Equatable, Sendable {
    public let low: Int
    public let high: Int
    public let limit: Int
    public let sportAdjusted: Bool
}

public struct WireSpread: Decodable, Equatable, Sendable {
    public let dayIndex: Int
    public let sets: Int
}

public struct WireEdit: Decodable, Equatable, Sendable {
    public let dayIndex: Int
    public let exerciseIndex: Int
    public let delta: Int
}

public struct WireMuscleEvaluation: Decodable, Equatable, Sendable {
    public let muscle: String
    public let tier: String
    public let band: WireBand
    public let weeklySets: Int
    public let fit: String
    public let diff: Int
    public let spread: [WireSpread]
    public let proposal: [WireEdit]
    public let proposalBlocked: Bool
    /// Why the band is what it is (`landmarks_rp`, `maintain_third`, `sport_adjusted` — read leniently). Absent on older servers.
    public let basis: WireBasis?
    /// Consecutive calendar days on which this muscle is trained heavy both days.
    public let consecutiveHeavy: [WireConsecutive]?
}

public struct WireBasis: Decodable, Equatable, Sendable {
    public let source: String
}

public struct WireConsecutive: Decodable, Equatable, Sendable {
    public let dayIndex: Int
    public let nextDayIndex: Int
    public let sets: Int
    public let nextSets: Int
}

/// The weekly set budget the tiers spend (mezo-r36n9.113). Every number is the server's.
public struct WireBudget: Decodable, Equatable, Sendable {
    /// Working sets the training days fit in the session-minutes target; nil without a target (raises then never run
    /// out of room).
    public let capacitySets: Int?
    /// Peak weekly total over the non-deload weeks.
    public let usedSets: Int
    public let emphasizeCount: Int
    public let emphasizeMax: Int
    /// Muscle → extra peak weekly sets if raised one tier; emphasized muscles are absent.
    public let raiseCost: [String: Int]

    enum CodingKeys: String, CodingKey { case capacitySets, usedSets, emphasizeCount, emphasizeMax, raiseCost }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        capacitySets = try c.decodeIfPresent(Int.self, forKey: .capacitySets)
        usedSets = try c.decode(Int.self, forKey: .usedSets)
        emphasizeCount = try c.decodeIfPresent(Int.self, forKey: .emphasizeCount) ?? 0
        emphasizeMax = try c.decodeIfPresent(Int.self, forKey: .emphasizeMax) ?? 2
        raiseCost = try c.decodeIfPresent([String: Int].self, forKey: .raiseCost) ?? [:]
    }

    public init(capacitySets: Int?, usedSets: Int, emphasizeCount: Int, emphasizeMax: Int, raiseCost: [String: Int]) {
        self.capacitySets = capacitySets; self.usedSets = usedSets; self.emphasizeCount = emphasizeCount
        self.emphasizeMax = emphasizeMax; self.raiseCost = raiseCost
    }
}

public struct WireCapWarning: Decodable, Equatable, Sendable {
    public let muscle: String?
    public let exerciseIndex: Int?
    public let sets: Int
    public let cap: Int
}

public struct WireDayEvaluation: Decodable, Equatable, Sendable {
    public let dayIndex: Int
    public let day: String
    public let minutesEstimate: Int
    public let sessionCapWarnings: [WireCapWarning]
    public let exerciseCapWarnings: [WireCapWarning]?
    public let sportSameDay: Bool
}

public struct WirePathWeek: Decodable, Equatable, Sendable {
    public let week: Int
    public let phase: String
    public let total: Int
    public let muscles: [String: Int]
    /// T3 (planned): how many techniques / challenges the week carries. Absent until it ships.
    public let techniques: Int?
    public let challenges: Int?

    enum CodingKeys: String, CodingKey { case week, phase, total, muscles, techniques, challenges }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        week = try c.decode(Int.self, forKey: .week)
        phase = try c.decode(String.self, forKey: .phase)
        total = try c.decode(Int.self, forKey: .total)
        muscles = try c.decode([String: Int].self, forKey: .muscles)
        // The planner may send a count or a list; either is read as a count, anything else as absent.
        techniques = Self.count(c, .techniques)
        challenges = Self.count(c, .challenges)
    }

    public init(week: Int, phase: String, total: Int, muscles: [String: Int], techniques: Int? = nil, challenges: Int? = nil) {
        self.week = week; self.phase = phase; self.total = total; self.muscles = muscles
        self.techniques = techniques; self.challenges = challenges
    }

    private static func count(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Int? {
        if let n = try? c.decodeIfPresent(Int.self, forKey: key) { return n }
        struct Any_: Decodable {}
        if let list = try? c.decodeIfPresent([Any_].self, forKey: key) { return list.count }
        return nil
    }
}

/// The server's rule-based technique recommendation for one exercise (mezo-r36n9.98).
public struct WireRecommendation: Decodable, Equatable, Sendable {
    public let dayIndex: Int
    public let exerciseIndex: Int
    /// `rest_drop`, `drop`, `myo`, `partials` or `none` — read leniently.
    public let technique: String
    public let reason: String?
    public let challengeFit: Bool?
}

public struct WireEvaluation: Decodable, Equatable, Sendable {
    public let deficit: Bool
    public let sportDays: [Int]
    public let suggestedSportGroups: [String]
    public let muscles: [WireMuscleEvaluation]
    public let days: [WireDayEvaluation]
    public let path: [WirePathWeek]
    /// Absent until the server sends it; never fails a response.
    public let recommendations: [WireRecommendation]?
    /// The tier budget (mezo-r36n9.113); nil when the plan has no counting exercises or the server predates it.
    public let budget: WireBudget?
}

// MARK: - The weekly proposal

public struct WireProposalLine: Decodable, Equatable, Sendable {
    public let id: String
    public let exerciseId: String
    public let exerciseName: String
    public let dayIndex: Int
    public let dayName: String?
    public let muscleGroup: String
    public let kind: String
    public let from: Double
    public let to: Double
    public let reasons: [String]
    public let decision: String?
    // T3 (planned, optional): technique and rep-range lines.
    public let fromTechnique: String?
    public let toTechnique: String?
    public let challenge: Bool?
    public let fromRepMin: Int?
    public let fromRepMax: Int?
    public let toRepMin: Int?
    public let toRepMax: Int?
    /// T4: the AI's one-line Hungarian reason on an `ai_suggested` line.
    public let note: String?
}

public struct WireProposalMuscle: Decodable, Equatable, Sendable {
    public let muscle: String
    public let tier: String
    public let bandLow: Int?
    public let bandHigh: Int?
    public let sportAdjusted: Bool
    public let setsBefore: Int
    public let setsAfter: Int
    public let lineCount: Int
    public let reasons: [String]
}

public struct WireProposal: Decodable, Equatable, Sendable {
    public let id: String
    public let mesocycleId: String
    public let week: Int
    public let kind: String
    public let status: String
    public let mode: String
    public let createdAt: String
    public let decidedAt: String?
    public let lines: [WireProposalLine]
    public let muscles: [WireProposalMuscle]
}

public struct WireLineDecision: Encodable, Equatable, Sendable {
    public let lineId: String
    public let decision: String
}

public struct WireDecisionRequest: Encodable, Equatable, Sendable {
    public var decisions: [WireLineDecision]?
    public var acceptRest: Bool?
    public var keepRest: Bool?
}

// MARK: - Block writes

public struct WirePrioritiesRequest: Encodable, Equatable, Sendable {
    public var musclePriorities: [String: String]
    public var sportGroups: [String]
}

public struct WireTechniqueRequest: Encodable, Equatable, Sendable {
    public var technique: String
    public var challenge: Bool
}

public struct WireSettingsRequest: Encodable, Equatable, Sendable {
    public var trainingStyle: String?
    public var techniquesEnabled: Bool?
    public var weeklyReviewMode: String?
}

// MARK: - The block day editor's add/swap read (POST /api/train/mesocycles/{id}/exercise-suggestions)

/// The exercise being replaced (swap mode); the server needs only its identity and shape.
public struct WireSuggestionOutgoing: Encodable, Equatable, Sendable {
    public var catalogId: String?
    public var name: String
    public var muscle: String
    public var type: String
    public init(catalogId: String?, name: String, muscle: String, type: String) {
        self.catalogId = catalogId; self.name = name; self.muscle = muscle; self.type = type
    }
}

/// `mode` is `replace` (needs `outgoing`) or `add`: the fine catalogue tokens picked in the add sheet (`muscles`,
/// mezo-r36n9.127), else the legacy coarse `muscle`; both absent = the week's under-band groups. `dayIndex` 0 = Monday.
/// Absent optionals are omitted from the JSON.
public struct WireSuggestionsRequest: Encodable, Equatable, Sendable {
    public var mode: String
    public var dayIndex: Int
    public var outgoing: WireSuggestionOutgoing?
    public var muscle: String?
    public var muscles: [String]?
    public var dayCatalogIds: [String]
    public init(mode: String, dayIndex: Int, outgoing: WireSuggestionOutgoing?, muscle: String?,
                muscles: [String]? = nil, dayCatalogIds: [String]) {
        self.mode = mode; self.dayIndex = dayIndex; self.outgoing = outgoing; self.muscle = muscle
        self.muscles = muscles; self.dayCatalogIds = dayCatalogIds
    }
}

public struct WireTopSet: Decodable, Equatable, Sendable {
    public let weightKg: Double?
    public let reps: Int
    public init(weightKg: Double?, reps: Int) { self.weightKg = weightKg; self.reps = reps }
}

/// One suggested exercise. `signals` stay plain strings (the server adds new ones); `prescription` is nil on an
/// unstyled block or a row the style never stamps — the phone then falls back to `Prescription.fallback`.
public struct WireSuggestion: Decodable, Equatable, Sendable {
    public let exercise: WireCatalogItem
    public let reasonText: String
    public let signals: [String]
    public let lastTopSet: WireTopSet?
    public let prescription: Prescription?
}

public struct WireSuggestions: Decodable, Equatable, Sendable {
    public let suggestions: [WireSuggestion]
    /// catalogue id → label (`NO_EQUIPMENT`, `HURT_BEFORE`), folded from the wire's `[{catalogId, label}]`.
    public let labels: [String: String]

    private enum CodingKeys: String, CodingKey { case suggestions, labels }
    private struct Label: Decodable { let catalogId: String; let label: String }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        suggestions = try c.decode([WireSuggestion].self, forKey: .suggestions)
        let list = try c.decodeIfPresent([Label].self, forKey: .labels) ?? []
        labels = Dictionary(list.map { ($0.catalogId, $0.label) }, uniquingKeysWith: { _, last in last })
    }
}

// MARK: - The new-block intake (mezo-r36n9.113)

/// Any JSON value, kept as it came. The generated template is relayed, not interpreted: the phone decodes it into this
/// and posts it back to POST /meso-templates unchanged, so a field the server adds later is never lost on the way.
public enum WireJSON: Codable, Equatable, Sendable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([WireJSON])
    case object([String: WireJSON])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let i = try? c.decode(Int.self) { self = .int(i) }
        else if let d = try? c.decode(Double.self) { self = .double(d) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([WireJSON].self) { self = .array(a) }
        else { self = .object(try c.decode([String: WireJSON].self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .int(let i): try c.encode(i)
        case .double(let d): try c.encode(d)
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }

    public subscript(key: String) -> WireJSON? { if case .object(let o) = self { o[key] } else { nil } }
    public var string: String? { if case .string(let s) = self { s } else { nil } }
    public var array: [WireJSON]? { if case .array(let a) = self { a } else { nil } }
}

/// A `MesoTemplateUpsertRequest` as the server generated it — opaque on the phone, a few read-only peeks for display.
public struct WireTemplate: Codable, Equatable, Sendable {
    public let json: WireJSON

    public init(json: WireJSON) { self.json = json }
    public init(from decoder: Decoder) throws { json = try WireJSON(from: decoder) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }

    public var title: String? { json["title"]?.string }
    public var trainingStyle: String? { json["trainingStyle"]?.string }
    public var dayCount: Int { json["days"]?.array?.count ?? 0 }
    public var exerciseCount: Int { (json["days"]?.array ?? []).reduce(0) { $0 + ($1["exercises"]?.array?.count ?? 0) } }
}

/// POST /api/train/meso-plans/candidates. Absent optionals are omitted.
public struct WireCandidatesRequest: Encodable, Equatable, Sendable {
    public var daysOfWeek: [String]
    public var weeks: Int
    public var priorities: [String: String]?
    public var sessionMinutesTarget: Int?
    public var sportGroups: [String]?
    public init(daysOfWeek: [String], weeks: Int, priorities: [String: String]?, sessionMinutesTarget: Int?, sportGroups: [String]? = nil) {
        self.daysOfWeek = daysOfWeek; self.weeks = weeks; self.priorities = priorities
        self.sessionMinutesTarget = sessionMinutesTarget; self.sportGroups = sportGroups
    }
}

/// A neutral or positive fact about a candidate (`fits_time`, `freq_2x`, `freq_high`, `more_warmups`, … read leniently).
public struct WireReason: Decodable, Equatable, Sendable {
    public let code: String
    public let value: Int?
}

/// What would make a candidate pass when nothing fits (`more_minutes`, `fewer_emphasis`, `more_days`, … read leniently).
public struct WireFix: Decodable, Equatable, Sendable {
    public let code: String
    public let value: Int?
    /// `fewer_emphasis`: the Hangsúly muscle the server lowered to make it fit (absent on older servers).
    public let muscle: String?

    public init(code: String, value: Int?, muscle: String? = nil) { self.code = code; self.value = value; self.muscle = muscle }
}

/// The intake's weekly set budget (mezo-r36n9.113): week 1 of the lead candidate, consistent with the candidate
/// filter. Every number and every verdict is the server's.
public struct WireIntakeBudget: Decodable, Equatable, Sendable {
    /// Week-1 counting working sets of the lead candidate.
    public let usedSets: Int
    /// What the lead candidate's training days fit in the session minutes; nil without a target.
    public let capacitySets: Int?
    public let emphasizeCount: Int
    public let emphasizeMax: Int
    /// Muscle → whether raising only it one tier still offers a candidate. Emphasized muscles are absent; a missing key
    /// is not a refusal.
    public let raiseAllowed: [String: Bool]

    enum CodingKeys: String, CodingKey { case usedSets, capacitySets, emphasizeCount, emphasizeMax, raiseAllowed }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        usedSets = try c.decode(Int.self, forKey: .usedSets)
        capacitySets = try c.decodeIfPresent(Int.self, forKey: .capacitySets)
        emphasizeCount = try c.decodeIfPresent(Int.self, forKey: .emphasizeCount) ?? 0
        emphasizeMax = try c.decodeIfPresent(Int.self, forKey: .emphasizeMax) ?? 2
        raiseAllowed = try c.decodeIfPresent([String: Bool].self, forKey: .raiseAllowed) ?? [:]
    }

    public init(usedSets: Int, capacitySets: Int?, emphasizeCount: Int, emphasizeMax: Int, raiseAllowed: [String: Bool]) {
        self.usedSets = usedSets; self.capacitySets = capacitySets; self.emphasizeCount = emphasizeCount
        self.emphasizeMax = emphasizeMax; self.raiseAllowed = raiseAllowed
    }
}

public struct WireCandidate: Decodable, Equatable, Sendable {
    public let splitKey: String
    public let splitLabel: String
    public let template: WireTemplate
    public let evaluation: WireEvaluation
    public let recommended: Bool
    public let reasons: [WireReason]
}

public struct WireCandidates: Decodable, Equatable, Sendable {
    /// Best first (max 3); when `nothingFits`, exactly the closest one.
    public let candidates: [WireCandidate]
    public let nothingFits: Bool
    public let fixes: [WireFix]
    /// The intake's heti keret and raise verdicts; nil when no candidate came back or the server predates it.
    public let intakeBudget: WireIntakeBudget?

    enum CodingKeys: String, CodingKey { case candidates, nothingFits, fixes, intakeBudget }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        candidates = try c.decode([WireCandidate].self, forKey: .candidates)
        nothingFits = try c.decodeIfPresent(Bool.self, forKey: .nothingFits) ?? false
        fixes = try c.decodeIfPresent([WireFix].self, forKey: .fixes) ?? []
        intakeBudget = try c.decodeIfPresent(WireIntakeBudget.self, forKey: .intakeBudget)
    }

    /// The candidate whose evaluation speaks for the intake: the recommended one, else the closest.
    public var lead: WireCandidate? { candidates.first { $0.recommended } ?? candidates.first }
}

/// POST /api/train/meso-plans/generate with the chosen candidate's `split` and the minutes it was offered under (the
/// server keeps the AI's exercise picks only while the plan still fits them).
public struct WireGenerateRequest: Encodable, Equatable, Sendable {
    public var daysOfWeek: [String]
    public var weeks: Int
    public var priorities: [String: String]?
    public var goalText: String?
    public var split: String?
    public var sessionMinutesTarget: Int?
    public var sportGroups: [String]?
    public init(daysOfWeek: [String], weeks: Int, priorities: [String: String]?, goalText: String? = nil, split: String?,
                sessionMinutesTarget: Int? = nil, sportGroups: [String]? = nil) {
        self.daysOfWeek = daysOfWeek; self.weeks = weeks; self.priorities = priorities; self.goalText = goalText; self.split = split
        self.sessionMinutesTarget = sessionMinutesTarget; self.sportGroups = sportGroups
    }
}

public struct WireGenerateResponse: Decodable, Equatable, Sendable {
    public let draftId: String?
    public let template: WireTemplate
    public let rationale: String?
    public let llmUsed: Bool?
}

/// POST /api/train/meso-templates/{id}/start. `status` is `active` (today) or `planned` (a later date).
public struct WireTemplateStart: Encodable, Equatable, Sendable {
    public var startDate: String
    public var status: String
    public init(startDate: String, status: String) { self.startDate = startDate; self.status = status }
}
