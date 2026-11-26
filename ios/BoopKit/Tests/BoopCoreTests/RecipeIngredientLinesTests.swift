import Foundation
import Testing
@testable import BoopCore

/// A recipe logged ingredient by ingredient (mezo-r36n9.181).
@Suite struct RecipeIngredientLinesTests {
    let rice = PantryRow(id: UUID(), name: "Rizs", per: 100, unit: "g", kcal: 360, proteinG: 7, carbsG: 79, fatG: 1)
    let chicken = PantryRow(id: UUID(), name: "Csirkemell", per: 100, unit: "g", kcal: 110, proteinG: 23, carbsG: 0, fatG: 2)

    func recipe(_ ings: [RecipeIngredient], servings: Int = 2) -> Recipe {
        Recipe(id: UUID(), name: "Csirkés rizs", category: "lunch", servings: servings,
               macros: Macros(kcal: 0, p: 0, c: 0, f: 0), ingredients: ings)
    }

    @Test func oneServingBecomesGramLinesMarkedWithTheRecipe() throws {
        let r = recipe([RecipeIngredient(pantryItemId: rice.id!, name: "Rizs", amount: 160, unit: "g"),
                        RecipeIngredient(pantryItemId: chicken.id!, name: "Csirkemell", amount: 0.3, unit: "kg")])
        let lines = try #require(DraftItem.ingredientLines(of: r, shelf: [rice, chicken]))
        #expect(lines.map(\.amount) == [80, 150])
        #expect(lines.map(\.unit) == ["g", "g"])
        #expect(lines.allSatisfy { $0.source == .pantry && $0.recipeId == r.id && $0.recipeName == "Csirkés rizs" })
        #expect(lines.map(\.pantryItemId) == [rice.id, chicken.id])
        // 80 g rice (288 kcal) + 150 g chicken (165 kcal)
        #expect(abs(lines.reduce(0) { $0 + $1.contribution.kcal } - 453) < 0.01)
    }

    @Test func aMissingShelfRowOrAPieceUnitFallsBackToTheServingLine() {
        let gone = recipe([RecipeIngredient(pantryItemId: UUID(), name: "Tojás", amount: 100, unit: "g")])
        #expect(DraftItem.ingredientLines(of: gone, shelf: [rice]) == nil)
        let pieces = recipe([RecipeIngredient(pantryItemId: rice.id!, name: "Rizs", amount: 2, unit: "piece")])
        #expect(DraftItem.ingredientLines(of: pieces, shelf: [rice]) == nil)
        #expect(DraftItem.ingredientLines(of: recipe([]), shelf: [rice]) == nil)
    }

    @Test func smallAmountsKeepOneDecimal() throws {
        let r = recipe([RecipeIngredient(pantryItemId: rice.id!, name: "Rizs", amount: 5, unit: "g")], servings: 4)
        #expect(try #require(DraftItem.ingredientLines(of: r, shelf: [rice])).first?.amount == 1.3)
    }
}
