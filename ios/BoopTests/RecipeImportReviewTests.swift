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

    // MARK: review follow-ups

    private func milkProfile() -> SensitivityProfile {
        SensitivityProfile(items: [SensitivityItem(key: "milk", level: .intolerance, note: nil)], novaRule: NovaRule(enabled: false, maxLevel: 4))
    }

    @Test func theReviewWarnsAboutAnAllergenBeforeTheSave() {
        let r = RecipeReview(draft: draft([
            ImportedLine(name: "Feta sajt", amount: 100, unit: "g", catalogId: feta, confidence: 1, needsReview: false, allergens: ["milk": .contains]),
            line("Csirkemell", 400, catalog: chicken),                     // matched, but its food declares nothing
            line("Kapor", 1, "csokor", catalog: nil, confidence: 0, review: true)]))
        let warnings = reviewAllergenWarnings(r, profile: milkProfile())
        #expect(warnings.count == 1)
        #expect(warnings[0].text.contains("Tej") && warnings[0].text.contains("tartalmazza"))
        #expect(warnings[0].lineNames == ["Feta sajt"])
        #expect(reviewLineBadges(r.lines[0], profile: milkProfile()).count == 1)
        // no data is said, never read as free: the row with no declared states and the unmatched row
        #expect(reviewNoDataLines(r, profile: milkProfile()) == ["Csirkemell", "Kapor"])
        // an owner with no allergen rules sees nothing about allergens
        #expect(reviewAllergenWarnings(r, profile: nil).isEmpty && reviewNoDataLines(r, profile: nil).isEmpty)
    }

    @Test func theHeaderCountReachesZeroAndIgnoresUnmatchedRows() {
        var r = RecipeReview(draft: draft([line("Feta", 100, catalog: feta, confidence: 0.5, review: true),
                                           line("Kapor", 1, "csokor", catalog: nil, confidence: 0, review: true)]))
        #expect(r.toReviewCount == 1)
        r.confirm(r.lines[0].id)
        #expect(r.toReviewCount == 0)
    }

    @Test func anAmountOfZeroOrLessIsNotAccepted() {
        var r = RecipeReview(draft: draft([line("Csirkemell", 400, catalog: chicken)]))
        let id = r.lines[0].id
        r.setAmount(id, 0); r.setAmount(id, -5); r.setAmount(id, .nan)
        #expect(r.lines[0].line.amount == 400)
        r.setAmount(id, 250)
        #expect(r.request().lines[0].amount == 250)
    }

    @Test func aLargeLeftOutShareMustBeOwnedBeforeTheSave() {
        var lines = [line("Csirke", 400, catalog: chicken), line("Joghurt", 150, catalog: yoghurt), line("Feta", 100, catalog: feta), line("Rizs", 200, catalog: UUID())]
        for k in 0..<8 { lines.append(line("Ismeretlen \(k)", 1, "db", catalog: nil, confidence: 0, review: true)) }
        var r = RecipeReview(draft: draft(lines))
        #expect(r.needsLeftOutAcknowledgement)
        #expect(r.leftOutWarning?.hasPrefix("8 hozzávaló kimarad — a recept számai ennyivel kevesebbet mutatnak") == true)
        #expect(!r.canSave)
        r.acknowledgeLeftOut()
        #expect(r.canSave)
        #expect(r.request().lines.count == 4)
    }

    @Test func aSmallLeftOutShareNeedsNoAcknowledgement() {
        let r = RecipeReview(draft: draft([line("A", 1, catalog: chicken), line("B", 1, catalog: yoghurt), line("C", 1, catalog: feta), line("D", 1, catalog: UUID()),
                                           line("E", 1, "db", catalog: nil, confidence: 0, review: true)]))
        #expect(!r.needsLeftOutAcknowledgement)
        #expect(r.canSave)
    }

    @Test func theWorkshopsEstimateLinesFollowTheSameRule() {
        let shelf = UUID()
        let w = WorkshopDraft(name: "Tál", category: "lunch", servings: 1, steps: [],
                              lines: [WorkshopLine(source: "pantry", pantryItemId: shelf, name: "Zab", amount: 60, unit: "g"),
                                      WorkshopLine(source: "estimate", name: "Túró", amount: 200, unit: "g"),
                                      WorkshopLine(source: "estimate", name: "Méz", amount: 20, unit: "g")])
        var r = RecipeReview(workshop: w)
        #expect(r.needsLeftOutAcknowledgement && !r.canSave)
        r.acknowledgeLeftOut()
        #expect(r.canSave)
    }

    @Test func aRecipeWithAnAllergenAndAProcessedFlagShowsBothOnItsRow() {
        let r = Recipe(id: UUID(), name: "Túrós szelet", category: "snack", servings: 1, macros: Macros(kcal: 1, p: 1, c: 1, f: 1), nova: 4, allergens: ["milk": .contains])
        #expect(recipeBadges(r, profile: milkProfile()).count == 2)
    }

    @Test func aPartialAllergenMapIsNotSilence() {
        // gluten is declared, milk (which the owner watches) is not: the row says nothing about milk, and that must be said
        let r = RecipeReview(draft: draft([
            ImportedLine(name: "Kenyér", amount: 100, unit: "g", catalogId: UUID(), confidence: 1, needsReview: false, allergens: ["gluten": .contains]),
            ImportedLine(name: "Zab", amount: 100, unit: "g", catalogId: UUID(), confidence: 1, needsReview: false, allergens: ["milk": .unknown]),
            ImportedLine(name: "Víz", amount: 100, unit: "g", catalogId: UUID(), confidence: 1, needsReview: false, allergens: ["milk": .traces]),
            ImportedLine(name: "Rizs", amount: 100, unit: "g", catalogId: UUID(), confidence: 1, needsReview: false, allergens: ["milk": .contains])]))
        #expect(reviewNoDataLines(r, profile: milkProfile()) == ["Kenyér", "Zab"])
    }

    @Test func theLeftOutTickResetsWhenTheUnmatchedRowsChange() {
        var lines = [line("A", 1, catalog: chicken), line("B", 1, catalog: yoghurt)]
        for k in 0..<3 { lines.append(line("Ismeretlen \(k)", 1, "db", catalog: nil, confidence: 0, review: true)) }
        var r = RecipeReview(draft: draft(lines))
        r.acknowledgeLeftOut()
        #expect(r.canSave)
        let gone = r.lines[2].id
        r.remove(gone)                       // 2 unmatched left: still large, but a different set
        #expect(!r.leftOutAcknowledged && !r.canSave)
        r.acknowledgeLeftOut()
        r.restore(gone)                      // back to 3: the warning must not reappear already ticked
        #expect(!r.leftOutAcknowledged && !r.canSave)
    }
}
