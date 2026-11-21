import SwiftUI
import BoopCore
import BoopDesign

// „Heti keret" (mezo-r36n9.113, spike screens 2 and 4b): a week's sets against what fits in the training days × the
// session minutes, split by tier colour, with the Hangsúly counter. Every number is the server's budget: the builder
// shows the heaviest week (its tier split read off the evaluation's peak week), the new-block intake the first week
// (the week the candidate filter judges, its tier split from the lead candidate's weekly sets).

struct PlanBudget: Equatable {
    let capacity: Int
    let used: Int
    let emphasizeMax: Int
    /// Sets of the week the keret speaks for, by tier (Hangsúly · Építés · Tartás).
    let emphasize: Int, grow: Int, maintain: Int
    let minutes: Int
    let days: Int
    /// Hangsúly muscles as the screen shows them (the budget may lag an edit by one refresh).
    let emphasizeCount: Int
    /// No one-tier raise fits any more.
    let full: Bool
    /// Which week the numbers are: the builder's heaviest week, the intake's first.
    let week: String

    /// The builder's keret: the peak loading week. nil without a capacity (no minutes target): the keret is not shown.
    init?(_ budget: WireBudget?, evaluation: WireEvaluation?, tier: (String) -> MuscleTier, minutes: Int?, days: Int, emphasized: Int? = nil) {
        guard let budget, let capacity = budget.capacitySets, let minutes else { return nil }
        let loading = (evaluation?.path ?? []).filter { $0.phase.lowercased() != "deload" }
        let peak = loading.max { $0.total < $1.total }
        var by: [MuscleTier: Int] = [:]
        for (muscle, sets) in peak?.muscles ?? [:] { by[tier(muscle), default: 0] += sets }
        self.init(capacity: capacity, used: budget.usedSets, emphasizeMax: budget.emphasizeMax, by: by, minutes: minutes,
                  days: days, emphasizeCount: emphasized ?? budget.emphasizeCount,
                  full: (budget.raiseCost.values.filter { $0 > 0 }.min() ?? .max) > capacity - budget.usedSets,
                  week: "a legnehezebb héten")
    }

    /// The new-block intake's keret (mezo-r36n9.113): week 1 of the lead candidate, consistent with the candidate
    /// filter. Full when the server found no muscle whose one-tier raise still offers a candidate.
    init?(intake: WireIntakeBudget?, evaluation: WireEvaluation?, tier: (String) -> MuscleTier, minutes: Int, days: Int, emphasized: Int) {
        guard let intake, let capacity = intake.capacitySets else { return nil }
        var by: [MuscleTier: Int] = [:]
        for m in evaluation?.muscles ?? [] { by[tier(m.muscle), default: 0] += m.weeklySets }
        self.init(capacity: capacity, used: intake.usedSets, emphasizeMax: intake.emphasizeMax, by: by, minutes: minutes,
                  days: days, emphasizeCount: emphasized,
                  full: !intake.raiseAllowed.isEmpty && !intake.raiseAllowed.values.contains(true), week: "az első héten")
    }

    private init(capacity: Int, used: Int, emphasizeMax: Int, by: [MuscleTier: Int], minutes: Int, days: Int,
                 emphasizeCount: Int, full: Bool, week: String) {
        self.capacity = capacity
        self.used = used
        self.emphasizeMax = emphasizeMax
        emphasize = by[.emphasize] ?? 0
        grow = by[.grow] ?? 0
        maintain = by[.maintain] ?? 0
        self.minutes = minutes
        self.days = days
        self.emphasizeCount = emphasizeCount
        self.full = full
        self.week = week
    }

    var over: Bool { used > capacity }
}

struct PlanBudgetCard: View {
    let data: PlanBudget
    var compact = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 7 : 10) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                if compact {
                    Text("HETI KERET").nkFont(10, .semibold, design: .monospaced).tracking(1.2).foregroundStyle(.white.opacity(0.6))
                }
                Text("\(data.used)").font(.nkNumber(compact ? 18 : 28)).foregroundStyle(data.over ? planWarn : .white)
                    .contentTransition(.numericText())
                Text("/ \(data.capacity) sorozat").nkFont(compact ? 12 : 14).foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1).fixedSize()
                Spacer(minLength: 6)
                emphasisCounter
            }
            GeometryReader { geo in
                let total = CGFloat(max(1, max(data.capacity, data.emphasize + data.grow + data.maintain, data.used)))
                HStack(spacing: 2) {
                    segment(data.emphasize, total, geo.size.width, planTierColor(.emphasize))
                    segment(data.grow, total, geo.size.width, planTierColor(.grow))
                    segment(data.maintain, total, geo.size.width, .white.opacity(0.55))
                    Spacer(minLength: 0)
                }
                .frame(width: geo.size.width, alignment: .leading)
                .background(Capsule().fill(.white.opacity(0.08)))
                .clipShape(Capsule())
            }
            .frame(height: compact ? 6 : 10)
            if !compact {
                Text(data.over ? "Túllépi a keretet: vegyél le egy izmot Tartásra, vagy adj hozzá időt."
                     : (data.full && !data.over ? "A keret tele: feljebb csak úgy tehetsz egy izmot, ha egy másikat lejjebb veszel."
                        : "\(data.week) · \(data.days) × \(data.minutes) perc · még \(data.capacity - data.used) sorozat fér bele"))
                    .nkFont(12, design: data.over || data.full ? .default : .monospaced)
                    .foregroundStyle(data.over ? planWarn : .white.opacity(0.55))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(compact ? 12 : 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(compact ? 18 : 22)
        .animation(reduceMotion ? nil : .snappy, value: data.used)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Heti keret: \(data.used) a \(data.capacity) sorozatból, Hangsúly \(data.emphasizeCount) a \(data.emphasizeMax)-ből")
    }

    private var emphasisCounter: some View {
        let n = data.emphasizeCount, max = data.emphasizeMax
        return HStack(spacing: 5) {
            Text("Hangsúly").nkFont(compact ? 11 : 12).foregroundStyle(.white.opacity(0.65))
            Text("\(n) / \(max)").nkFont(compact ? 11 : 12, .semibold, design: .monospaced)
                .foregroundStyle(n >= max ? NK.ground : .white.opacity(0.9))
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Capsule().fill(n >= max ? planTierColor(.emphasize) : .white.opacity(0.14)))
        }
        .lineLimit(1).fixedSize()
    }

    private func segment(_ sets: Int, _ total: CGFloat, _ width: CGFloat, _ color: Color) -> some View {
        Rectangle().fill(color).frame(width: max(0, width * CGFloat(sets) / total - 2))
    }
}
