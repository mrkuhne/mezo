import Foundation

// Where each muscle stands in the running block — the maths behind „A blokk terhelése".
//
// **The same rules as the web app's own week page** (`frontend/src/features/train/logic/
// mesoBands.ts` + `mesoWeek.ts`), because the owner reads both and a muscle must not be
// „plafonon" on one screen and „még fér bele" on the other. What is deliberately NOT copied
// is its vocabulary: „Hamstring", „Core", „MV-n tart · nem rámpázik" are the words he asked
// us to stop using.
//
// The one idea the whole thing rests on: **a muscle's ceiling is not its MRV.** It is where
// *this plan* will take it, which depends on the priority he set for it. A muscle he is only
// maintaining is already at its ceiling at MEV, and saying it "has 8 sets left" would be a
// promise the plan never made.

/// What this block is trying to do with one muscle.
public enum MuscleTier: String, Codable, Equatable, Sendable {
    /// He marked it as a priority: the plan takes it all the way to MRV.
    case emphasize
    /// The default: the plan builds it to MAV.
    case grow
    /// Kept where it is, at MEV — it is not being built this block.
    case maintain

    public init(wire: String?) { self = MuscleTier(rawValue: (wire ?? "").lowercased()) ?? .grow }

    /// „Hangsúly" · „Építés" · „Tartás".
    public var hungarian: String {
        switch self {
        case .emphasize: "Hangsúly"
        case .grow: "Építés"
        case .maintain: "Tartás"
        }
    }
}

/// Where one muscle stands this week, and what the block will still do with it.
public struct MuscleBand: Identifiable, Equatable, Sendable {
    public let muscle: String
    public let tier: MuscleTier
    /// This week's planned working sets.
    public let current: Int
    /// Last week's, for the comparison; nil in week 1.
    public let previous: Int?
    /// Where **this plan** stops for this muscle — MRV, MAV or MEV by its tier.
    public let ceiling: Int
    /// The least that keeps it, and the body's own most. `mrv` is the muscle's limit, which
    /// the ceiling only reaches for a priority muscle.
    public let mev: Int
    public let mrv: Int
    /// What next Monday adds: the engine's +2, clamped to what fits under the ceiling, and 0
    /// for a muscle that is only being maintained.
    public let step: Int
    /// The weeks of the block for this muscle, oldest first.
    public let weeks: [MuscleVolumeWeek]
    public var id: String { muscle }

    /// How many sets this muscle may still add inside this plan. The one number the page
    /// ranks by: the muscles with something still to give are the ones worth looking at.
    public var room: Int { max(0, ceiling - current) }

    /// How full it is against its own ceiling, 0…1 — never past 1, and never below a sliver
    /// so a muscle that is being trained is visible at all.
    public var level: Double {
        guard ceiling > 0 else { return 0.12 }
        return min(1, max(0.12, Double(current) / Double(ceiling)))
    }

    public init(muscle: String, tier: MuscleTier, current: Int, previous: Int? = nil, ceiling: Int,
                mev: Int, mrv: Int, step: Int, weeks: [MuscleVolumeWeek] = []) {
        self.muscle = muscle; self.tier = tier; self.current = current; self.previous = previous
        self.ceiling = ceiling; self.mev = mev; self.mrv = mrv; self.step = step; self.weeks = weeks
    }

    /// What it means, in a sentence — the page says the meaning first and the number second.
    public var verdict: String {
        switch tier {
        case .maintain: return "Ezt most szinten tartod."
        default:
            return room > 0
                ? "Még \(room) szett fér bele."
                : "Elérte a felső értéket ebben a tervben."
        }
    }

    /// Still growing · at the top of what this plan does · only being kept.
    public enum Standing: Sendable { case growing, atCeiling, held }
    public var standing: Standing {
        if tier == .maintain { return .held }
        return room > 0 ? .growing : .atCeiling
    }
}

/// Every muscle of the block, **ranked by how much room it still has** (the ones with
/// something to give lead), ties going to the bigger ceiling so a priority muscle still
/// leads a field where nothing has room left.
public func muscleBands(_ block: BlockPlan) -> [MuscleBand] {
    block.muscles.map { volume in
        let tier = MuscleTier(wire: block.musclePriorities[volume.muscle])
        let mev = volume.mev ?? 0
        let mav = volume.mav ?? volume.mrv
        let ceiling: Int = switch tier {
        case .emphasize: volume.mrv
        case .grow: mav
        case .maintain: mev
        }
        let weeks = volume.weeks.sorted { $0.week < $1.week }
        let current = volume.current
            ?? weeks.first(where: \.isCurrent)?.planned
            ?? weeks.last?.planned ?? 0
        let currentIndex = weeks.firstIndex(where: \.isCurrent)
        let previous = currentIndex.flatMap { $0 > 0 ? weeks[$0 - 1].planned : nil }
        let step = tier == .maintain ? 0 : max(0, min(2, ceiling - current))
        return MuscleBand(muscle: volume.muscle, tier: tier, current: current, previous: previous,
                          ceiling: ceiling, mev: mev, mrv: volume.mrv, step: step, weeks: weeks)
    }
    .sorted { ($0.room, $0.ceiling) > ($1.room, $1.ceiling) }
}

/// The week in three sentences' worth of numbers.
public struct BlockWeekSummary: Equatable, Sendable {
    public let muscles: Int
    /// All the planned working sets of this week, across every muscle.
    public let total: Int
    /// Last week's total; nil in week 1, where there is nothing to compare with.
    public let previous: Int?
    public let growing: Int
    public let atCeiling: Int
    public let held: Int

    public var delta: Int? { previous.map { total - $0 } }

    /// „3 izomban van még hova nőni, 2 elérte a felső értéket." — clauses with a count of 0
    /// are left out rather than printed as "0 izom".
    public var stateLine: String {
        var parts: [String] = []
        if growing > 0 { parts.append("\(growing) izomban van még hova nőni") }
        if atCeiling > 0 { parts.append("\(atCeiling) elérte a felső értéket") }
        if held > 0 { parts.append("\(held) izmot csak szinten tartasz") }
        return parts.isEmpty ? "" : parts.joined(separator: ", ") + "."
    }

    /// „4 szettel több a múlt héthez képest." — the phrase the whole app uses.
    public var deltaLine: String {
        guard let delta else { return "Ez a terv első hete — még nincs mihez mérni." }
        if delta > 0 { return "\(delta) szettel több a múlt héthez képest." }
        if delta < 0 { return "\(-delta) szettel kevesebb a múlt héthez képest." }
        return "Pont annyi, mint a múlt héten."
    }
}

public func blockWeekSummary(_ bands: [MuscleBand]) -> BlockWeekSummary {
    let total = bands.reduce(0) { $0 + $1.current }
    let previousValues = bands.compactMap(\.previous)
    return BlockWeekSummary(
        muscles: bands.count,
        total: total,
        previous: previousValues.isEmpty ? nil : previousValues.reduce(0, +),
        growing: bands.filter { $0.standing == .growing }.count,
        atCeiling: bands.filter { $0.standing == .atCeiling }.count,
        held: bands.filter { $0.standing == .held }.count)
}
