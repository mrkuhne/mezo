import Foundation

// The weekly review deck's model (mezo-r36n9.83): Monday's proposal grouped the way the approved spike shows it —
// one card per muscle that changes, one tile per exercise change with its own accept / keep, a card for the muscles
// that stay, a summary. Decisions are collected on the phone and sent once from the summary card; undecided lines
// then stay as they were (`keepRest`). „Elfogadom átnézés nélkül" is `acceptRest` alone.
//
// Lenient by construction: a line kind the phone does not know is shown as a plain "from → to" tile, a reason code it
// does not know gets no pill. The technique planner (T3) adds both while this screen is live.

public enum LineDecision: String, Sendable, Equatable { case accepted, kept }

public enum ReviewLineKind: Equatable, Sendable {
    case sets(from: Int, to: Int)
    case weight(from: Double, to: Double)
    case reps(from: Int, to: Int)
    case technique(from: SetTechnique, to: SetTechnique, challenge: Bool)
    case repRange(from: String, to: String)
    /// A kind this build does not know yet.
    case other(from: Double, to: Double)

    /// The pill under the exercise name: „SOROZAT", „SÚLY" …
    public var label: String {
        switch self {
        case .sets: "sorozat"
        case .weight: "súly"
        case .reps: "ismétlés"
        case .technique: "technika"
        case .repRange: "tartomány"
        case .other: "változás"
        }
    }

    /// Weekly set change this line makes if accepted (a planner technique replaces one straight set).
    public var setDelta: Int {
        switch self {
        case .sets(let from, let to): to - from
        default: 0
        }
    }
}

public struct ReviewLine: Identifiable, Equatable, Sendable {
    public let id: String
    public let exerciseId: String
    public let exerciseName: String
    public let dayIndex: Int
    /// „Hétfő".
    public let dayName: String
    /// Coarse muscle key.
    public let muscle: String
    public let kind: ReviewLineKind
    /// The reasons as short Hungarian pills (unknown codes dropped).
    public let reasons: [String]
    /// The raw reason codes, for the marks.
    public let reasonCodes: [String]
    /// What the server already holds (a decided line is final there).
    public let serverDecision: LineDecision?
}

public struct ReviewMuscle: Identifiable, Equatable, Sendable {
    public let muscle: String
    public let tier: MuscleTier
    public let bandLow: Int?
    public let bandHigh: Int?
    public let sportAdjusted: Bool
    public let setsBefore: Int
    public let setsAfter: Int
    public let lineCount: Int
    public let reasons: [String]
    public var id: String { muscle }
}

public struct WeekReview: Equatable, Sendable {
    public let proposalId: String
    public let blockId: String
    public let week: Int
    /// `weekly` or `tier_change`.
    public let kind: String
    /// `pending`, `applied`, `auto_applied`, `expired`, `superseded`.
    public let status: String
    public let mode: ReviewMode
    public let createdAt: String
    public let lines: [ReviewLine]
    public let muscles: [ReviewMuscle]
    /// His choices on the phone, line id → decision; nil entries are undecided.
    public private(set) var local: [String: LineDecision] = [:]

    /// Can he still decide? Only a pending proposal in manual mode takes decisions.
    public var isOpen: Bool { status == "pending" }
    public var wasAppliedAutomatically: Bool { status == "auto_applied" }

    /// The body's order, top to bottom, then anything else alphabetically.
    public static let bodyOrder = ["back", "biceps", "shoulder", "chest", "triceps", "quad", "ham", "glute", "calf"]

    public init(_ p: WireProposal) {
        proposalId = p.id
        blockId = p.mesocycleId
        week = p.week
        kind = p.kind
        status = p.status
        mode = ReviewMode(rawValue: p.mode) ?? .auto
        createdAt = p.createdAt
        lines = p.lines.map(Self.line)
        muscles = p.muscles.map {
            ReviewMuscle(muscle: coarseMuscle($0.muscle), tier: MuscleTier(wire: $0.tier), bandLow: $0.bandLow, bandHigh: $0.bandHigh,
                         sportAdjusted: $0.sportAdjusted, setsBefore: $0.setsBefore, setsAfter: $0.setsAfter,
                         lineCount: $0.lineCount, reasons: $0.reasons.compactMap(reasonText))
        }
    }

    static func line(_ l: WireProposalLine) -> ReviewLine {
        let kind: ReviewLineKind
        switch l.kind {
        case "sets": kind = .sets(from: Int(l.from.rounded()), to: Int(l.to.rounded()))
        case "weight": kind = .weight(from: l.from, to: l.to)
        case "reps": kind = .reps(from: Int(l.from.rounded()), to: Int(l.to.rounded()))
        case "technique":
            kind = .technique(from: SetTechnique(wire: l.fromTechnique), to: SetTechnique(wire: l.toTechnique), challenge: l.challenge ?? false)
        case "rep_range":
            let from = l.fromRepMin.map { "\($0)–\(l.fromRepMax ?? Int(l.from))" } ?? "\(Int(l.from))"
            let to = l.toRepMin.map { "\($0)–\(l.toRepMax ?? Int(l.to))" } ?? "\(Int(l.to))"
            kind = .repRange(from: from, to: to)
        default: kind = .other(from: l.from, to: l.to)
        }
        return ReviewLine(id: l.id, exerciseId: l.exerciseId, exerciseName: l.exerciseName, dayIndex: l.dayIndex,
                          dayName: DraftDay.longName(l.dayName ?? ""), muscle: coarseMuscle(l.muscleGroup), kind: kind,
                          reasons: l.reasons.compactMap(reasonText), reasonCodes: l.reasons,
                          serverDecision: l.decision.flatMap(LineDecision.init(rawValue:)))
    }

    // MARK: grouping

    private static func order(_ a: String, _ b: String) -> Bool {
        let ia = bodyOrder.firstIndex(of: a) ?? Int.max, ib = bodyOrder.firstIndex(of: b) ?? Int.max
        return ia == ib ? a < b : ia < ib
    }

    /// The muscles the review has something to say about, in the order of the body.
    public var reviewMuscles: [String] { Array(Set(lines.map(\.muscle))).sorted(by: Self.order) }

    /// The muscles that stay where they were.
    public var quietMuscles: [ReviewMuscle] {
        let changing = Set(reviewMuscles)
        return muscles.filter { !changing.contains($0.muscle) }.sorted { Self.order($0.muscle, $1.muscle) }
    }

    public func muscle(_ key: String) -> ReviewMuscle? { muscles.first { $0.muscle == key } }
    public func lines(_ muscle: String) -> [ReviewLine] { lines.filter { $0.muscle == muscle } }

    // MARK: deciding

    /// The decision that counts for a line: the server's if it already holds one, else his choice here.
    public func decision(_ id: String) -> LineDecision? {
        lines.first { $0.id == id }?.serverDecision ?? local[id]
    }

    public mutating func decide(_ id: String, _ decision: LineDecision?) {
        guard isOpen, let line = lines.first(where: { $0.id == id }), line.serverDecision == nil else { return }
        local[id] = decision
    }

    public mutating func decideAll(_ muscle: String, _ decision: LineDecision, onlyOpen: Bool = true) {
        for l in lines(muscle) where !onlyOpen || self.decision(l.id) == nil { decide(l.id, decision) }
    }

    public mutating func acceptAllOpen() { for m in reviewMuscles { decideAll(m, .accepted) } }

    public func open(_ muscle: String) -> Int { lines(muscle).filter { decision($0.id) == nil }.count }
    public func isSettled(_ muscle: String) -> Bool { open(muscle) == 0 }

    public var acceptedCount: Int { lines.filter { decision($0.id) == .accepted }.count }
    public var keptCount: Int { lines.filter { decision($0.id) == .kept }.count }
    public var openCount: Int { lines.count - acceptedCount - keptCount }

    /// The set change of the accepted lines.
    public var addedSets: Int { lines.filter { decision($0.id) == .accepted }.map(\.kind.setDelta).reduce(0, +) }

    public func acceptedCount(where pick: (ReviewLineKind) -> Bool) -> Int {
        lines.filter { decision($0.id) == .accepted && pick($0.kind) }.count
    }

    /// Weekly working sets before the proposal, across every muscle.
    public var setsBefore: Int { muscles.map(\.setsBefore).reduce(0, +) }

    /// Accepted changes per template day index — „hol érzed a héten".
    public func acceptedOn(day: Int) -> Int { lines.filter { $0.dayIndex == day && decision($0.id) == .accepted }.count }

    /// The days the lines sit on, in week order, as (index, name).
    public var days: [(Int, String)] {
        Array(Dictionary(lines.map { ($0.dayIndex, $0.dayName) }, uniquingKeysWith: { a, _ in a })).sorted { $0.key < $1.key }
            .map { ($0.key, $0.value) }
    }

    /// The one request the summary sends: every choice made here, and the rest kept.
    public func finalRequest() -> WireDecisionRequest {
        let decisions = lines.compactMap { l -> WireLineDecision? in
            guard l.serverDecision == nil, let d = local[l.id] else { return nil }
            return WireLineDecision(lineId: l.id, decision: d.rawValue)
        }
        let anyOpen = lines.contains { decision($0.id) == nil }
        return WireDecisionRequest(decisions: decisions.isEmpty ? nil : decisions, acceptRest: nil, keepRest: anyOpen ? true : nil)
    }

    /// „Elfogadom átnézés nélkül".
    public static let acceptEverything = WireDecisionRequest(decisions: nil, acceptRest: true, keepRest: nil)
}

/// The Hungarian pill for a reason code; nil for a code this build does not know (no pill rather than a raw code).
public func reasonText(_ code: String) -> String? {
    switch code {
    case "all_sets_done": "minden sorozat megvolt"
    case "felt_easy": "könnyen ment"
    case "deficit_pace": "fogyás alatt lassabban"
    case "room_in_band": "a sávban van hely"
    case "soreness_cleared": "az izomláz elmúlt"
    case "top_of_rep_range": "a tartomány tetején"
    case "reserve_left": "maradt tartalék"
    case "next_plate": "jöhet a következő súly"
    case "grind": "nagyon nehezen ment"
    case "too_much": "sok volt"
    case "sets_missed": "kimaradt sorozat"
    case "tier_maintain": "Tartás: nem nő"
    case "deload": "könnyített hét"
    case "no_slot": "nincs hova tenni"
    case "above_band": "a sáv fölött"
    case "joint_pain": "ízületi panasz"
    case "soreness": "izomláz"
    case "at_ceiling": "a sáv tetején"
    case "deload_restore": "vissza a könnyített hét után"
    case "stalled": "megállt a fejlődés"
    case "tier_change": "új szint"
    // The technique planner (T3).
    case "technique_week": "technikás hét"
    case "emphasis": "hangsúlyos izom"
    case "deficit_allowance": "fogyás alatt is belefér"
    case "ai_suggested": "Boop javaslata"
    case "challenge": "a nap kihívása"
    case "sport_day": "sportnap"
    default: nil
    }
}

/// „62,5 kg".
public func formatKg(_ kg: Double) -> String {
    let whole = kg.rounded() == kg
    return (whole ? String(Int(kg)) : String(format: "%.1f", kg).replacingOccurrences(of: ".", with: ",")) + " kg"
}
