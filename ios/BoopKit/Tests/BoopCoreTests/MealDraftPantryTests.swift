import Foundation
import Testing
@testable import BoopCore

@Suite struct MealDraftPantryTests {
    @Test func shelfRowMissingAMacroIsFlaggedForReviewNotZeroed() throws {
        let id = UUID()
        let partial = PantryRow(id: id, name: "Müzli", per: 100, unit: "g", kcal: 380, proteinG: nil, carbsG: 60, fatG: 8)
        let item = try #require(DraftItem(pantry: partial))
        #expect(item.needsReview)
        let full = PantryRow(id: id, name: "Müzli", per: 100, unit: "g", kcal: 380, proteinG: 10, carbsG: 60, fatG: 8)
        #expect(try #require(DraftItem(pantry: full)).needsReview == false)
    }
}
