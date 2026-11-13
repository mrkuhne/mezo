import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Étel room's `Ma` tab (B4 Task 9): what the verdict says, the quiet line of an empty plan, the eight dimensions.
struct EtelMaTests {
    private func set(_ k: Double, _ p: Double, _ c: Double, _ f: Double, water: Double = 0) -> MacroSet {
        MacroSet(kcal: k, p: p, c: c, f: f, water: water)
    }
    private func day(eaten: MacroSet, meals: [BoopCore.Meal] = [], fuelMode: String? = nil, skipped: Int = 0) -> FoodDay {
        FoodDay(date: "2026-11-13", targets: set(2350, 165, 250, 78, water: 3000), consumed: eaten, meals: meals,
                fuelMode: fuelMode, skippedKcal: skipped)
    }
    private func plan(remaining: Macros?, windows: [PlanWindow] = []) -> FuelPlan {
        FuelPlan(date: "2026-11-13", windows: windows, remaining: remaining)
    }
    private func meal(_ id: UUID = UUID(), slot: String = "lunch", breakdown: MealBreakdown? = nil) -> BoopCore.Meal {
        BoopCore.Meal(id: id, slot: slot, loggedAt: Date(), mealDate: "2026-11-13", title: "Étel",
                      macros: Macros(kcal: 500, p: 30, c: 50, f: 15), score: breakdown?.value, breakdown: breakdown)
    }

    // MARK: verdict

    @Test func verdictSentenceNamesTheFarthestMacro() {
        let d = day(eaten: set(1443, 87, 146, 49), meals: [meal()])
        let v = etelVerdict(day: d, plan: plan(remaining: Macros(kcal: 907, p: 78, c: 104, f: 29)), problem: nil)
        #expect(v.headline == "907 kalória van még hátra")
        #expect(v.sentence.contains("A fehérje van a legmesszebb: 87 g a 165-ből."))
        #expect(abs((v.level ?? 0) - 1443.0 / 2350.0) < 0.001)

        // the carbohydrate is the one farthest from its goal here (30 / 250 against 140 / 165 and 60 / 78)
        let c = etelVerdict(day: day(eaten: set(900, 140, 30, 60), meals: [meal()]),
                            plan: plan(remaining: Macros(kcal: 1450, p: 25, c: 220, f: 18)), problem: nil)
        #expect(c.sentence.contains("A szénhidrát van a legmesszebb: 30 g a 250-ből."))
    }

    @Test func overBudgetIsANegativeNumberAndNeverAReproach() {
        let d = day(eaten: set(2473, 160, 260, 80), meals: [meal()])
        let v = etelVerdict(day: d, plan: plan(remaining: Macros(kcal: -123, p: 5, c: -10, f: -2)), problem: nil)
        #expect(v.headline == "−123 kalória van még hátra")
        #expect(v.level == 1)
        for word in ["túl", "sajnos", "baj", "rossz", "szégyen"] { #expect(!v.sentence.lowercased().contains(word)) }
    }

    @Test func aDayWithNoMealYetSaysSoInsteadOfNamingAZeroMacro() {
        let v = etelVerdict(day: day(eaten: set(0, 0, 0, 0)), plan: plan(remaining: Macros(kcal: 2350, p: 165, c: 250, f: 78)), problem: nil)
        #expect(v.headline == "2\u{00A0}350 kalória van még hátra")
        #expect(v.sentence.contains("Még nem rögzítettél semmit"))
        #expect(v.level == 0)
    }

    @Test func aGentleDayHasNoBudgetAtAll() {
        let v = etelVerdict(day: day(eaten: set(300, 10, 40, 8), meals: [meal()], fuelMode: "GUIDANCE"), plan: plan(remaining: nil), problem: nil)
        #expect(v.headline == "Ma nincs kalóriakeret")
        #expect(!v.headline.contains("kalória van"))
    }

    @Test func theVerdictFollowsTheProblemWhenNothingCameBack() {
        let off = etelVerdict(day: nil, plan: nil, problem: .offline)
        #expect(off.headline.contains("nem érem el") && off.sentence.contains("net"))
        let loading = etelVerdict(day: nil, plan: nil, problem: nil)
        #expect(loading.headline == "Betöltöm a mai étkezéseid")
    }

    @Test func numbersGroupThousandsWithoutBreakingTheLine() {
        #expect(huInt(2350) == "2\u{00A0}350")
        #expect(huInt(-123) == "−123")
        #expect(huInt(907) == "907")
        #expect(huInt(-1450) == "−1\u{00A0}450")
    }

    // MARK: the windows

    @Test func emptyPlanShowsTheQuietLineNotAnEmptyList() {
        let d = day(eaten: set(0, 0, 0, 0))
        let items = etelWindowItems(plan: plan(remaining: nil), day: d)
        #expect(items.isEmpty)
        #expect(etelWindowsEmptyLine(items)?.contains("Mára még nincs tervem") == true)

        let one = etelWindowItems(plan: plan(remaining: nil, windows: [PlanWindow(slot: "lunch", label: "Ebéd", from: "12:00", to: "14:00", state: .now)]), day: d)
        #expect(one.count == 1)
        #expect(etelWindowsEmptyLine(one) == nil)
    }

    @Test func windowsBecomeCardsRowsAndOpenCards() throws {
        let logged = meal(slot: "breakfast")
        let stray = meal(slot: "snack")
        let windows = [
            PlanWindow(slot: "breakfast", label: "Reggeli", from: "07:00", to: "09:00", state: .done, loggedMealIds: [logged.id]),
            PlanWindow(slot: "snack", kind: .snack, label: "Tízórai", from: "10:00", to: "11:00", state: .skipped),
            PlanWindow(slot: "lunch", label: "Ebéd", from: "12:00", to: "14:00", state: .now),
            PlanWindow(slot: "dinner", label: "Vacsora", from: "19:00", to: "21:00", state: .pending),
            PlanWindow(slot: "snack", kind: .snack, label: "Uzsonna", from: "16:00", to: "17:00", state: .done),
        ]
        let items = etelWindowItems(plan: plan(remaining: nil, windows: windows), day: day(eaten: set(0, 0, 0, 0), meals: [logged, stray]))
        #expect(items.count == 6)
        guard case .logged(let label, let meals) = items[0] else { Issue.record("first is the logged breakfast"); return }
        #expect(label == "Reggeli" && meals.map(\.id) == [logged.id])
        guard case .skipped = items[1] else { Issue.record("a skipped window is a quiet row"); return }
        guard case .open(let lunch) = items[2], lunch.state == .now else { Issue.record("an open window"); return }
        guard case .open = items[3] else { Issue.record("a pending window is open too"); return }
        guard case .quiet = items[4] else { Issue.record("done without a meal found is a quiet row"); return }
        guard case .logged(let strayLabel, let strayMeals) = items[5] else { Issue.record("a meal no window claims still shows"); return }
        #expect(strayLabel == "Nasi" && strayMeals.map(\.id) == [stray.id])
    }

    // MARK: the eight dimensions (owner decision 12)

    private func dim(_ id: String, _ score: Double, weight: Double = 0.1) -> ScoreDimension {
        ScoreDimension(id: id, label: id, weight: weight, score: score, detail: "d")
    }

    @Test func dimensionRowHasEightEntries() {
        // a meal scored before the engine existed still shows eight tiles, all "nincs adat"
        let bare = dimensionRow(meal())
        #expect(bare.count == 8)
        #expect(bare.allSatisfy { $0.points == nil && $0.dimension == nil })

        // a partial envelope: present ones carry their points, missing and degraded ones read "nincs adat"
        let b = MealBreakdown(value: 0.8, confidence: 0.9, dimensions: [dim("who", 0.78), dim("macro", 0.86), dim("context", 0, weight: 0)])
        let row = dimensionRow(meal(breakdown: b))
        #expect(row.count == 8)
        #expect(row.map(\.name) == ["Makrók", "Feldolgozottság", "WHO", "Rost", "Zsírminőség", "Növényi változatosság", "Energiasűrűség", "Napi helyzet"])
        #expect(row[0].points == 86 && row[2].points == 78)
        #expect(row[1].points == nil && row[7].points == nil)
        #expect(row[7].dimension?.id == "context")                  // present but degraded: the sheet can still explain why
    }

    @Test func aDimensionSheetExplainsWithItsOwnWordsAndTheCoachesNote() {
        let d = ScoreDimension(id: "nova", label: "Feldolgozottság · NOVA", weight: 0.1, score: 0.38, detail: "A kalória 61%-a 4-es.", coverage: 0.61)
        let plain = dimensionExplanation(d, coachNote: nil)
        #expect(plain.why == "A kalória 61%-a 4-es.")
        #expect(plain.coverage == "A tányér energiájának 61%-át láttam ennél a szempontnál.")
        #expect(plain.note == nil)
        #expect(dimensionExplanation(d, coachNote: "Egy marék dió kisebb feldolgozottságú.").note == "Egy marék dió kisebb feldolgozottságú.")
        // an older envelope carries no coverage: say nothing, never "0%"
        #expect(dimensionExplanation(ScoreDimension(id: "nova", label: "x", weight: 0.1, score: 0.5, detail: "d"), coachNote: nil).coverage == nil)
        // the dimension's own note wins over nothing, the coach's verdict wins over the envelope's
        let withNote = ScoreDimension(id: "nova", label: "x", weight: 0.1, score: 0.5, detail: "d", note: "régi jegyzet")
        #expect(dimensionExplanation(withNote, coachNote: nil).note == "régi jegyzet")
        #expect(dimensionExplanation(withNote, coachNote: "friss jegyzet").note == "friss jegyzet")
    }

    // MARK: supplements

    @Test func theSupplementTapKeyIsStablePerDayAndGroup() {
        #expect(supplementRef(day: "2026-11-13", daypart: "morning") == supplementRef(day: "2026-11-13", daypart: "morning"))
        #expect(supplementRef(day: "2026-11-13", daypart: "morning") != supplementRef(day: "2026-11-13", daypart: "evening"))
        #expect(supplementRef(day: "2026-11-13", daypart: "morning") != supplementRef(day: "2026-11-14", daypart: "morning"))
    }

    @Test func supplementGroupsFollowTheDayAndSkipEmptyOnes() {
        let a = UUID(), b = UUID(), c = UUID()
        let names = [a: StashRow(id: a, name: "D3-vitamin", dose: "4000 NE"), b: StashRow(id: b, name: "Magnézium", dose: nil)]
        let items = [ProtocolItem(id: UUID(), pantryItemId: b, slotKey: "evening", dose: "200 mg", pinned: false),
                     ProtocolItem(id: UUID(), pantryItemId: a, slotKey: "morning", dose: nil, pinned: false),
                     ProtocolItem(id: UUID(), pantryItemId: c, slotKey: "morning", dose: nil, pinned: false)]
        let groups = supplementGroups(items, names: names)
        #expect(groups.map(\.key) == ["morning", "evening"])
        #expect(groups[0].label == "Reggel" && groups[0].count == 2)
        #expect(groups[0].summary == "D3-vitamin 4000 NE · Kiegészítő")
        #expect(groups[1].summary == "Magnézium 200 mg")
    }
}
