import Foundation

// The Éves terv wire shapes (mezo-r36n9.113; contract: api/feature/train/train.yml, YearPlan / YearBlock / YearNote /
// YearNext / YearUnlinkedRunning / YearReview / YearPlanRequest / YearBlockPatch). Hand-written like PlanWire.swift:
// every enum is a plain String (`status`, `kind`, `code`, `reason`), so a value the server adds later never fails the
// plan — an unknown note code simply shows no line. Every contract-required number, date, `status` and `kind` on the
// plan and its blocks decodes strictly: a malformed answer is the error state, never invented numbers. Collections and
// booleans stay lenient (a missing one is empty / false). Every number and date the phone shows is the server's.
// Codable both ways: the last good plan is kept in the `ServerCache`.

public struct WireYearPlan: Codable, Equatable, Sendable {
    /// nil on a preview.
    public let id: String?
    /// `active` / `archived`.
    public let status: String
    public let startDate: String
    /// The consolidation's last day (re-dated; past the 52nd week when `overrunWeeks > 0`).
    public let endDate: String
    public let blockWeeks: Int
    public let consolidationWeeks: Int
    public let emphasis: [String]
    /// Week of today since `startDate` (1-based, may exceed 52); nil before the start.
    public let currentWeek: Int?
    public let loadingBlocks: Int
    public let bufferWeeks: Int
    public let bufferStart: String?
    public let overrunWeeks: Int
    /// Ordinal order, the consolidation last.
    public let blocks: [WireYearBlock]
    public let relaxed: [WireYearNote]
    public let warnings: [WireYearNote]
    /// Every landmark group → how many non-skipped loading blocks focus it.
    public let focusCount: [String: Int]
    public let next: WireYearNext?
    public let unlinkedRunning: WireYearUnlinked?
    /// The Monday „Jövő évi terv" starts on (the server's; it knows a late consolidation outlasts the plan). Only on the
    /// active plan; nil on a preview and on a plan cached before the server sent it.
    public let nextYearStart: String?
    public let review: WireYearReview

    enum CodingKeys: String, CodingKey {
        case id, status, startDate, endDate, blockWeeks, consolidationWeeks, emphasis, currentWeek, loadingBlocks,
             bufferWeeks, bufferStart, overrunWeeks, blocks, relaxed, warnings, focusCount, next, unlinkedRunning,
             nextYearStart, review
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        status = try c.decode(String.self, forKey: .status)
        startDate = try c.decode(String.self, forKey: .startDate)
        endDate = try c.decode(String.self, forKey: .endDate)
        blockWeeks = try c.decode(Int.self, forKey: .blockWeeks)
        consolidationWeeks = try c.decode(Int.self, forKey: .consolidationWeeks)
        emphasis = try c.decodeIfPresent([String].self, forKey: .emphasis) ?? []
        currentWeek = try c.decodeIfPresent(Int.self, forKey: .currentWeek)
        blocks = try c.decodeIfPresent([WireYearBlock].self, forKey: .blocks) ?? []
        loadingBlocks = try c.decode(Int.self, forKey: .loadingBlocks)
        bufferWeeks = try c.decode(Int.self, forKey: .bufferWeeks)
        bufferStart = try c.decodeIfPresent(String.self, forKey: .bufferStart)
        overrunWeeks = try c.decode(Int.self, forKey: .overrunWeeks)
        relaxed = try c.decodeIfPresent([WireYearNote].self, forKey: .relaxed) ?? []
        warnings = try c.decodeIfPresent([WireYearNote].self, forKey: .warnings) ?? []
        focusCount = try c.decodeIfPresent([String: Int].self, forKey: .focusCount) ?? [:]
        next = try c.decodeIfPresent(WireYearNext.self, forKey: .next)
        unlinkedRunning = try c.decodeIfPresent(WireYearUnlinked.self, forKey: .unlinkedRunning)
        nextYearStart = try c.decodeIfPresent(String.self, forKey: .nextYearStart)
        review = try c.decodeIfPresent(WireYearReview.self, forKey: .review) ?? WireYearReview(blocksDone: 0, blocksSkipped: 0, focused: [], unfocused: [])
    }

    /// The block with this id, if the plan has it.
    public func block(_ id: String) -> WireYearBlock? { blocks.first { $0.id == id } }
}

public struct WireYearBlock: Codable, Equatable, Sendable {
    /// nil on a preview.
    public let id: String?
    public let ordinal: Int
    /// `upper` / `lower` / `consolidation`.
    public let kind: String
    public let focus: [String]
    /// The weeks the block takes (actual for a followed mesocycle).
    public let weeks: Int
    public let plannedStart: String
    public let lastDay: String
    /// `planned` / `running` / `done` / `skipped`.
    public let status: String
    public let mesocycleId: String?
    /// Week of today inside the block (1-based); nil when today is outside it.
    public let currentWeek: Int?
    public let adopted: Bool
    /// true when "Egy héttel előbb" is possible.
    public let canMoveEarlier: Bool
    /// Focus groups no other block focuses — lost for the year if this block is skipped.
    public let skipConsequence: [String]

    public var isConsolidation: Bool { kind == "consolidation" }

    enum CodingKeys: String, CodingKey {
        case id, ordinal, kind, focus, weeks, plannedStart, lastDay, status, mesocycleId, currentWeek, adopted,
             canMoveEarlier, skipConsequence
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        ordinal = try c.decode(Int.self, forKey: .ordinal)
        kind = try c.decode(String.self, forKey: .kind)
        focus = try c.decodeIfPresent([String].self, forKey: .focus) ?? []
        weeks = try c.decode(Int.self, forKey: .weeks)
        plannedStart = try c.decode(String.self, forKey: .plannedStart)
        lastDay = try c.decode(String.self, forKey: .lastDay)
        status = try c.decode(String.self, forKey: .status)
        mesocycleId = try c.decodeIfPresent(String.self, forKey: .mesocycleId)
        currentWeek = try c.decodeIfPresent(Int.self, forKey: .currentWeek)
        adopted = try c.decodeIfPresent(Bool.self, forKey: .adopted) ?? false
        canMoveEarlier = try c.decodeIfPresent(Bool.self, forKey: .canMoveEarlier) ?? false
        skipConsequence = try c.decodeIfPresent([String].self, forKey: .skipConsequence) ?? []
    }
}

/// A rotation relaxation or a rule break. `code` is read leniently: `emphasis_once`, `no_focus`, `pair_relaxed`,
/// `focus_consecutive`, `no_focus_this_year`, `pair_unusual`, `mixed_focus` today; anything else shows no line.
public struct WireYearNote: Codable, Equatable, Hashable, Sendable {
    public let code: String
    public let group: String?
    public let ordinal: Int?
    /// `no_focus_this_year`: the suggested block for the group.
    public let blockId: String?
    /// `no_focus_this_year`: the group to swap out of `blockId`; nil = add as a second focus.
    public let replaces: String?
    public let weeks: Int?
}

public struct WireYearNext: Codable, Equatable, Sendable {
    public let blockId: String
    public let startsOn: String
    /// `last_week` / `no_block`, read leniently.
    public let reason: String
}

/// A started (running or planned) mesocycle that is linked to no block of the plan.
public struct WireYearUnlinked: Codable, Equatable, Sendable {
    public let mesocycleId: String
    public let title: String
    public let startDate: String
    /// `active` (runs now) / `planned` (starts on `startDate`), read leniently; nil from an older cached plan.
    public let status: String?

    public var isPlanned: Bool { status == "planned" }
}

public struct WireYearReview: Codable, Equatable, Sendable {
    public let blocksDone: Int
    public let blocksSkipped: Int
    /// Groups focused by a done or running block, config order.
    public let focused: [String]
    /// The other landmark groups, config order.
    public let unfocused: [String]
}

// MARK: - Requests (absent optionals are omitted: the server takes its defaults / keeps the value)

public struct WireYearPlanRequest: Encodable, Equatable, Sendable {
    public var startDate: String
    public var emphasis: [String]?
    public var blockWeeks: Int?
    public var consolidationWeeks: Int?
    public var replaceActive: Bool?
    public init(startDate: String, emphasis: [String]? = nil, blockWeeks: Int? = nil, consolidationWeeks: Int? = nil,
                replaceActive: Bool? = nil) {
        self.startDate = startDate; self.emphasis = emphasis; self.blockWeeks = blockWeeks
        self.consolidationWeeks = consolidationWeeks; self.replaceActive = replaceActive
    }
}

/// One edit of a year block; the server applies focus, weeks, ordinal, shiftWeeks, skip in that order.
public struct WireYearBlockPatch: Encodable, Equatable, Sendable {
    public var focus: [String]?
    public var weeks: Int?
    public var ordinal: Int?
    public var shiftWeeks: Int?
    public var skip: Bool?
    public var linkRunning: Bool?
    public init(focus: [String]? = nil, weeks: Int? = nil, ordinal: Int? = nil, shiftWeeks: Int? = nil, skip: Bool? = nil,
                linkRunning: Bool? = nil) {
        self.focus = focus; self.weeks = weeks; self.ordinal = ordinal; self.shiftWeeks = shiftWeeks; self.skip = skip
        self.linkRunning = linkRunning
    }
}
