import Foundation
import BoopCore

// The recipe evaluation's computed parts (mezo-r36n9.199, spec §5.1/§5.4): instant, free, always fresh — built from
// data the room already holds, never from the AI.

// MARK: - Ha ma megennéd

struct DayImpactRow: Equatable {
    var key: DayMacro
    var eaten: Double
    var after: Double
    /// nil on a kímélő day (eaten only) — never a zeroed target.
    var target: Double?
}

struct DayImpact: Equatable {
    var rows: [DayImpactRow]
    var sentence: String
}

/// Today's eaten → after one serving, against today's targets — from the same `FoodDay` Étel Ma reads. nil when the
/// day isn't loaded or isn't today (the block hides rather than show zeros).
func recipeDayImpact(day: FoodDay?, todayYmd: String, serving: Macros) -> DayImpact? {
    guard let day, day.date == todayYmd else { return nil }
    let guidance = day.fuelMode == "GUIDANCE"
    func row(_ key: DayMacro, _ eaten: Double, _ add: Double, _ target: Double) -> DayImpactRow {
        DayImpactRow(key: key, eaten: eaten, after: eaten + add, target: guidance || target <= 0 ? nil : target)
    }
    let rows = [row(.kcal, day.consumed.kcal, serving.kcal, day.targets.kcal),
                row(.protein, day.consumed.p, serving.p, day.targets.p),
                row(.carbs, day.consumed.c, serving.c, day.targets.c),
                row(.fat, day.consumed.f, serving.f, day.targets.f)]
    return DayImpact(rows: rows, sentence: dayImpactSentence(rows: rows, guidance: guidance))
}

/// One template-built sentence under the day bars.
func dayImpactSentence(rows: [DayImpactRow], guidance: Bool) -> String {
    let kcal = rows.first { $0.key == .kcal }
    let after = Int((kcal?.after ?? 0).rounded())
    if guidance { return "Ma kímélő nap van — ezzel \(huInt(after)) kcal-nál tartanál." }
    guard let kcal, let target = kcal.target else { return "Ezzel \(huInt(after)) kcal-nál tartanál ma." }
    let left = Int((target - kcal.after).rounded())
    if left < 0 { return "Ezzel \(huInt(-left)) kcal-lal a napi kereted felett lennél." }
    if let protein = rows.first(where: { $0.key == .protein }), let pt = protein.target {
        let pct = Int((protein.after / pt * 100).rounded())
        return "Ezzel a fehérjecélod \(pct)%-án lennél, és még \(huInt(left)) kcal maradna mára."
    }
    return "Ezzel még \(huInt(left)) kcal maradna mára."
}

// MARK: - A receptjeid között

struct RecipeRank: Equatable {
    struct Standout: Equatable { var macro: DayMacro; var position: Int }
    var position: Int
    var of: Int
    /// Its dot on the strip (weakest left, best right); a tie sits at the top of its group, as its rank says.
    var stripIndex: Int { of - position }
    var standout: Standout?
}

/// Where this recipe stands among the owner's scored recipes (`fit` is recomputed on every read, so it equals the
/// hero score). Ties share a rank; hidden below 3 scored recipes or when this one is unscored.
func recipeRank(id: UUID, recipes: [Recipe]) -> RecipeRank? {
    let scored = recipes.filter { $0.fit != nil }
    guard scored.count >= 3, let me = scored.first(where: { $0.id == id }), let fit = me.fit else { return nil }
    func position(_ value: (Recipe) -> Double) -> Int { 1 + scored.filter { value($0) > value(me) }.count }
    let candidates: [(DayMacro, Int)] = [(.protein, position { $0.perServing.p }),
                                         (.carbs, position { $0.perServing.c }),
                                         (.fat, position { $0.perServing.f })]
    let best = candidates.min { $0.1 < $1.1 }  // `min` keeps the first on ties → protein, carbs, fat
    return RecipeRank(position: 1 + scored.filter { ($0.fit ?? 0) > fit }.count, of: scored.count,
                      standout: best.map { RecipeRank.Standout(macro: $0.0, position: $0.1) })
}

/// „6× etted (utoljára nov. 22.)", nil when never eaten.
func recipeEatenLine(logs: [RecipeLog], now: Date = Date(), calendar: Calendar = .current) -> String? {
    guard let last = logs.map(\.loggedAt).max() else { return nil }
    let f = DateFormatter(); f.locale = Locale(identifier: "hu_HU"); f.timeZone = calendar.timeZone; f.dateFormat = "MMM d."
    let when = calendar.isDate(last, inSameDayAs: now) ? "ma" : f.string(from: last)
    return "\(logs.count)× etted (utoljára \(when))"
}

// MARK: - Weakest / strongest, verdict

/// The web's `extremes()` rule: over live dimensions only; nothing when fewer than two or all equal.
func dimensionExtremes(_ dims: [ScoreDimension]) -> (weakest: String?, strongest: String?) {
    let live = dims.filter { $0.weight > 0 }
    guard live.count >= 2, let lo = live.min(by: { $0.score < $1.score }), let hi = live.max(by: { $0.score < $1.score }),
          lo.score < hi.score else { return (nil, nil) }
    return (lo.id, hi.id)
}

/// The verdict headline: the AI's tagline when it fits, else an honest fallback from the score band and the weakest
/// dimension — never invented facts.
func recipeVerdict(_ b: MealBreakdown) -> String {
    if let t = b.tagline?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty, t.count <= 90 { return t }
    let band = b.value >= 0.8 ? "Erős recept" : b.value >= 0.6 ? "Jó alap" : "Van rajta mit javítani"
    guard let weakest = dimensionExtremes(b.dimensions).weakest,
          let label = b.dimensions.first(where: { $0.id == weakest })?.label, !label.isEmpty else { return band + "." }
    return "\(band), a(z) \(label.prefix(1).lowercased() + label.dropFirst()) húzza le."
}
