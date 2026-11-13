import Foundation
import Testing
import BoopCore
@testable import Boop

/// The recipe import's review screen (B4 Task 12): the server does not enforce that a doubtful row was looked at, so the
/// review is the enforcement — a marked row is visible, and nothing uncertain is saved as if it were certain.
struct RecipeImportReviewTests {
    private let feta = UUID(), chicken = UUID(), yoghurt = UUID()

    private func draft(_ lines: [ImportedLine], cooked: Double? = nil) -> RecipeImportDraft {
        RecipeImportDraft(name: "Görög csirkesaláta", category: "lunch", servings: 4, steps: ["Keverd össze."], lines: lines,
                          sourceUrl: "https://example.hu/gorog", needsReview: lines.contains { $0.needsReview }, cookedWeightG: cooked)
    }
    private func line(_ name: String, _ amount: Double, _ unit: String = "g", catalog: UUID? = UUID(), confidence: Double = 1,
                      review: Bool = false) -> ImportedLine {
        ImportedLine(name: name, amount: amount, unit: unit, catalogId: catalog, confidence: confidence, needsReview: review, sourceText: "\(amount) \(unit) \(name)")
    }

    // MARK: marked rows

    @Test func lowConfidenceLinesAreMarked() {
        var r = RecipeReview(draft: draft([line("Csirkemell", 400, catalog: chicken), line("Feta sajt", 100, catalog: feta, confidence: 0.5, review: true)]))
        #expect(r.lines[0].mark == .none)
        #expect(r.lines[1].mark == .lowConfidence)
        #expect(r.markedCount == 1)
        // an uncertain row is not savable as if it were certain: the owner confirms it (or takes it out) first
        #expect(!r.canSave)
        #expect(r.saveBlocker?.contains("Feta sajt") == true)
        #expect(!r.lines[1].willSave)

        r.confirm(r.lines[1].id)
        #expect(r.canSave)
        #expect(r.lines[1].willSave)
        #expect(r.request().lines.map(\.catalogId) == [chicken, feta])

        // taking it out also unblocks the save, and it does not travel
        var again = RecipeReview(draft: draft([line("Csirkemell", 400, catalog: chicken), line("Feta sajt", 100, catalog: feta, confidence: 0.5, review: true)]))
        again.remove(again.lines[1].id)
        #expect(again.canSave)
        #expect(again.request().lines.count == 1)
    }

    @Test func aMatchedRowAtTheEdgeOfTheServersLineIsStillMarked() {
        // the server's own rule: needsReview at or below 0.6 — a row the server did not flag but sits at 0.6 is marked too
        let r = RecipeReview(draft: draft([line("Joghurt", 150, catalog: yoghurt, confidence: 0.6, review: false)]))
        #expect(r.lines[0].mark == .lowConfidence)
    }

    @Test func unmatchedLineBlocksNothingButIsVisible() {
        let r = RecipeReview(draft: draft([line("Csirkemell", 400, catalog: chicken), line("Friss kapor", 1, "csokor", catalog: nil, confidence: 0, review: true)]))
        #expect(r.lines[1].mark == .unmatched)
        #expect(r.markedCount == 1)
        #expect(r.leftOut.map(\.line.name) == ["Friss kapor"])
        // it blocks nothing…
        #expect(r.canSave)
        #expect(r.saveBlocker == nil)
        // …but the saved recipe does not pretend to contain it
        #expect(r.request().lines.count == 1)
        #expect(r.leftOutNote?.contains("Friss kapor") == true)
    }

    @Test func aRecipeWithNothingToSaveCannotBeSaved() {
        let r = RecipeReview(draft: draft([line("Kapor", 1, "csokor", catalog: nil, confidence: 0, review: true)]))
        #expect(!r.canSave)
        #expect(r.saveBlocker != nil)
    }

    // MARK: the weight of the finished dish

    @Test func cookedWeightDefaultsToTheRawSum() {
        let r = RecipeReview(draft: draft([line("Csirkemell", 400, catalog: chicken), line("Joghurt", 150, catalog: yoghurt),
                                           line("Olívaolaj", 26, "ml"), line("Rizs", 1, "kg"), line("Uborka", 1, "db")]))
        // grams and millilitres add up, a kilo counts a thousand, a piece cannot be weighed and stays out
        #expect(r.rawWeightG == 1576)
        #expect(r.cookedWeightG == 1576)
        #expect(r.cookedWeightIsEstimate)
    }

    @Test func aStatedCookedWeightWinsOverTheRawSum() {
        let r = RecipeReview(draft: draft([line("Csirkemell", 400, catalog: chicken)], cooked: 1126))
        #expect(r.cookedWeightG == 1126)
        #expect(!r.cookedWeightIsEstimate)
        #expect(r.rawWeightG == 400)
    }

    @Test func theRawSumCountsOnlyWhatIsSaved() {
        var r = RecipeReview(draft: draft([line("Csirkemell", 400, catalog: chicken), line("Kapor", 50, catalog: nil, confidence: 0, review: true)]))
        #expect(r.rawWeightG == 400)
        r.remove(r.lines[0].id)
        #expect(r.rawWeightG == 0)
    }

    // MARK: the request, and the workshop's draft

    @Test func theRequestCarriesTheReviewedRecipe() {
        var r = RecipeReview(draft: draft([line("Csirkemell", 400, catalog: chicken)]))
        r.name = "  Saját név  "
        r.servings = 3
        let req = r.request()
        #expect(req.name == "Saját név")
        #expect(req.servings == 3)
        #expect(req.steps == ["Keverd össze."])
        #expect(req.sourceUrl == "https://example.hu/gorog")
        #expect(req.lines == [NewRecipeLine(catalogId: chicken, amount: 400, unit: "g")])
    }

    @Test func aWorkshopDraftKeepsItsShelfLinesAndLeavesTheEstimatesOut() {
        let shelf = UUID()
        let w = WorkshopDraft(name: "Túrós tál", category: "breakfast", servings: 1, steps: ["Keverd."],
                              lines: [WorkshopLine(source: "pantry", pantryItemId: shelf, name: "Zab", amount: 60, unit: "g"),
                                      WorkshopLine(source: "estimate", name: "Túró", amount: 200, unit: "g")])
        let r = RecipeReview(workshop: w)
        #expect(r.canSave)
        #expect(r.request().lines == [NewRecipeLine(pantryItemId: shelf, amount: 60, unit: "g")])
        #expect(r.leftOut.map(\.line.name) == ["Túró"])
    }

    // MARK: the library

    @Test func theRowSaysEverythingItNeeds() {
        let r = Recipe(id: UUID(), name: "Görög csirkesaláta", category: "lunch", servings: 2, macros: Macros(kcal: 960, p: 92, c: 40, f: 44))
        #expect(recipeRowFacts(r) == "480 kcal · 46 g fehérje · 2 adag")
    }

    @Test func theLibraryFiltersByNameIgnoringCaseAndAccents() {
        let a = Recipe(id: UUID(), name: "Túrós zabkása", category: "breakfast", servings: 1, macros: Macros(kcal: 1, p: 1, c: 1, f: 1))
        let b = Recipe(id: UUID(), name: "Sült lazac", category: "dinner", servings: 1, macros: Macros(kcal: 1, p: 1, c: 1, f: 1))
        #expect(filterRecipes([a, b], query: "turos").map(\.name) == ["Túrós zabkása"])
        #expect(filterRecipes([a, b], query: "  ").count == 2)
        #expect(filterRecipes([a, b], query: "pizza").isEmpty)
    }

    @Test func anAbsentAllergenKeyNeverReadsAsFree() {
        let profile = SensitivityProfile(items: [SensitivityItem(key: "milk", level: .intolerance, note: nil)], novaRule: NovaRule(enabled: false, maxLevel: 4))
        let unknown = Recipe(id: UUID(), name: "Zabkása", category: "breakfast", servings: 1, macros: Macros(kcal: 1, p: 1, c: 1, f: 1), allergens: [:])
        #expect(recipeBadges(unknown, profile: profile).isEmpty)           // a row stays quiet…
        #expect(recipeAllergenLine(unknown, profile: profile)?.contains("nincs adat") == true) // …the detail says it plainly
        #expect(recipeAllergenLine(unknown, profile: profile)?.lowercased().contains("mentes") == false)
        let milk = Recipe(id: UUID(), name: "Túrós", category: "breakfast", servings: 1, macros: Macros(kcal: 1, p: 1, c: 1, f: 1), allergens: ["milk": .contains])
        #expect(recipeBadges(milk, profile: profile).first?.text.contains("Tej") == true)
    }
}
