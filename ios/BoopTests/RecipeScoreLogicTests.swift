import Foundation
import Testing
import BoopCore
@testable import Boop

// The recipe evaluation's computed parts (mezo-r36n9.199): the day block, the rank among the owner's recipes, the
// verdict fallback and the weakest/strongest marks. Numbers are invented (például).
struct RecipeScoreLogicTests {
    private let nb = "\u{00A0}"

    private func day(date: String = "2026-11-28", eaten: MacroSet, targets: MacroSet, mode: String? = nil) -> FoodDay {
        FoodDay(date: date, targets: targets, consumed: eaten, fuelMode: mode)
    }
    private let eaten = MacroSet(kcal: 1240, p: 96, c: 120, f: 40, water: 0)
    private let targets = MacroSet(kcal: 2400, p: 176, c: 260, f: 80, water: 0)
    private let serving = Macros(kcal: 410, p: 30, c: 35, f: 14)

    private func dim(_ id: String, _ score: Double, weight: Double = 0.2) -> ScoreDimension {
        ScoreDimension(id: id, label: id == "who" ? "Só és cukor" : id, weight: weight, score: score, detail: "")
    }

    private func recipe(_ fit: Double?, p: Double = 30, c: Double = 30, f: Double = 10, id: UUID = UUID()) -> Recipe {
        Recipe(id: id, name: "R", category: "lunch", servings: 1, macros: Macros(kcal: 400, p: p, c: c, f: f), fit: fit)
    }

    // MARK: Ha ma megennéd

    @Test func dayImpactAddsOneServingToTodaysEaten() throws {
        let impact = try #require(recipeDayImpact(day: day(eaten: eaten, targets: targets), todayYmd: "2026-11-28", serving: serving))
        #expect(impact.rows.map(\.key) == [.kcal, .protein, .carbs, .fat])
        #expect(impact.rows[0].eaten == 1240 && impact.rows[0].after == 1650 && impact.rows[0].target == 2400)
        #expect(impact.rows[1].after == 126 && impact.rows[1].target == 176)
        #expect(impact.sentence == "Ezzel a fehérjecélod 72%-án lennél, és még 750 kcal maradna mára.")
    }

    @Test func dayImpactIsHiddenWhenTheDayIsMissingOrNotToday() {
        #expect(recipeDayImpact(day: nil, todayYmd: "2026-11-28", serving: serving) == nil)
        #expect(recipeDayImpact(day: day(date: "2026-11-27", eaten: eaten, targets: targets), todayYmd: "2026-11-28", serving: serving) == nil)
    }

    @Test func overTheKcalTargetSaysByHowMuchWithoutAlarm() throws {
        let heavy = MacroSet(kcal: 2200, p: 150, c: 200, f: 70, water: 0)
        let impact = try #require(recipeDayImpact(day: day(eaten: heavy, targets: targets), todayYmd: "2026-11-28", serving: serving))
        #expect(impact.sentence == "Ezzel 210 kcal-lal a napi kereted felett lennél.")
    }

    @Test func aKimeloDayShowsEatenOnly() throws {
        let impact = try #require(recipeDayImpact(day: day(eaten: eaten, targets: targets, mode: "GUIDANCE"), todayYmd: "2026-11-28", serving: serving))
        #expect(impact.rows.allSatisfy { $0.target == nil })
        #expect(impact.sentence == "Ma kímélő nap van — ezzel 1\(nb)650 kcal-nál tartanál.")
    }

    @Test func withoutAProteinTargetOnlyTheKcalLeftIsSaid() throws {
        let noProtein = MacroSet(kcal: 2400, p: 0, c: 260, f: 80, water: 0)
        let impact = try #require(recipeDayImpact(day: day(eaten: eaten, targets: noProtein), todayYmd: "2026-11-28", serving: serving))
        #expect(impact.sentence == "Ezzel még 750 kcal maradna mára.")
    }

    // MARK: A receptjeid között

    @Test func rankCountsOnlyScoredRecipesAndTiesShare() throws {
        let me = UUID()
        let list = [recipe(0.9), recipe(0.74), recipe(0.74, p: 50, id: me), recipe(0.5), recipe(nil)]
        let rank = try #require(recipeRank(id: me, recipes: list))
        #expect(rank.position == 2 && rank.of == 4)
        #expect(rank.standout?.macro == .protein && rank.standout?.position == 1)
    }

    @Test func rankStripPlacesTheRecipeWhereItsRankSays() {
        let me = UUID()
        // Ascending strip 0.5 · 0.74 · 0.74 · 0.9: the tie sits at the top of its group, never on the weaker end.
        let tied = try? #require(recipeRank(id: me, recipes: [recipe(0.9), recipe(0.74), recipe(0.74, id: me), recipe(0.5)]))
        #expect(tied?.stripIndex == 2)
        // All equal: first place, so the right (better) end.
        let equal = try? #require(recipeRank(id: me, recipes: [recipe(0.7, id: me), recipe(0.7), recipe(0.7), recipe(0.7)]))
        #expect(equal?.stripIndex == 3)
    }

    @Test func rankIsHiddenBelowThreeScoredRecipesOrWhenUnscored() {
        let me = UUID()
        #expect(recipeRank(id: me, recipes: [recipe(0.9), recipe(0.7, id: me), recipe(nil)]) == nil)
        #expect(recipeRank(id: me, recipes: [recipe(0.9), recipe(0.8), recipe(0.7), recipe(nil, id: me)]) == nil)
    }

    @Test func eatenLineCountsAndDatesTheLastLog() {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        let now = cal.date(from: DateComponents(year: 2026, month: 11, day: 28, hour: 12))!
        let last = cal.date(from: DateComponents(year: 2026, month: 11, day: 22, hour: 8))!
        let logs = [RecipeLog(mealId: UUID(), slot: "breakfast", loggedAt: last, kcal: 400),
                    RecipeLog(mealId: UUID(), slot: "breakfast", loggedAt: cal.date(byAdding: .day, value: -10, to: last)!, kcal: 400)]
        #expect(recipeEatenLine(logs: logs, now: now, calendar: cal) == "2× etted (utoljára nov. 22.)")
        #expect(recipeEatenLine(logs: [], now: now, calendar: cal) == nil)
    }

    // MARK: Weakest / strongest, verdict

    @Test func extremesSkipDegradedDimensions() {
        let ex = dimensionExtremes([dim("macro", 0.84), dim("who", 0.41), dim("nova", 0.92), dim("micro", 0, weight: 0)])
        #expect(ex.weakest == "who" && ex.strongest == "nova")
        #expect(dimensionExtremes([dim("macro", 0.8), dim("micro", 0, weight: 0)]).weakest == nil)
        #expect(dimensionExtremes([dim("macro", 0.5), dim("who", 0.5)]).weakest == nil)
    }

    @Test func verdictUsesTheTaglineOrAnHonestFallback() {
        let dims = [dim("macro", 0.84), dim("who", 0.41)]
        #expect(recipeVerdict(MealBreakdown(value: 0.74, confidence: 0.8, tagline: "Fehérjében erős.", dimensions: dims)) == "Fehérjében erős.")
        let long = String(repeating: "a", count: 120)
        #expect(recipeVerdict(MealBreakdown(value: 0.74, confidence: 0.8, tagline: long, dimensions: dims)) == "Jó alap, a(z) só és cukor húzza le.")
        #expect(recipeVerdict(MealBreakdown(value: 0.85, confidence: 0.8, dimensions: [dim("macro", 0.85)])) == "Erős recept.")
        #expect(recipeVerdict(MealBreakdown(value: 0.4, confidence: 0.8, tagline: "  ", dimensions: dims)) == "Van rajta mit javítani, a(z) só és cukor húzza le.")
    }
}
