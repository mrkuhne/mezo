import Foundation
import Testing
import BoopCore
@testable import Boop

/// „Ezt főztem" on the screen (mezo-r36n9.63): the entrance, the preview server's answer, the Kamra tag and
/// „Pontosítom" through the update route.
@MainActor
struct CookedCaptureViewTests {
    let food = FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: PreviewTransport()))

    @Test func testEntranceRow_isFirstInUjRecept() {
        #expect(recipeEntrances.first?.title == "Ezt főztem")
        #expect(recipeEntrances.first?.lit == true)
        #expect(recipeEntrances.filter(\.lit).count == 1)
        #expect(recipeEntrances.map(\.route) == [.cooked, .link, .photo, .workshop])
    }

    @Test func testFoodPreview_cookedFixtureDecodes() async throws {
        let d = try #require(try await food.cooked(text: "fél kiló csirkemell", photos: []))
        #expect(d.lines.count == 6)
        #expect(d.lines.map(\.state) == [.matched, .matched, .confirm, .confirm, .missing, .missing])
        #expect(d.lines.allSatisfy { $0.sourceText?.isEmpty == false })
        let review = RecipeReview(draft: d)
        #expect(review.toReviewCount == 2 && review.unmatchedLeftOut.count == 2)
        #expect(review.lines[2].line.alternatives.count == 2)
    }

    @Test func testPreviewQuickAddUpdateAndBreakdownsAnswer() async throws {
        let row = try await food.quickAddPantry(name: "kurkuma")
        #expect(row.estimated && row.unit == "g" && row.kcal == 354)
        #expect(try await food.quickAddPantry(name: "kurkuma").id == row.id)   // a second tap is the same food
        await #expect(throws: FoodFetchError.conflict) { _ = try await food.quickAddPantry(name: "Kurkuma kapszula") }
        let typed = try await food.setFacts(FoodFacts(kcal: 312, proteinG: 9, carbsG: 60, fatG: 8), of: row)
        #expect(!typed.estimated && typed.kcal == 312)
        let shelf = try await food.pantry()
        let estimated = try #require(shelf.first { $0.estimated })
        #expect(shelf.contains { $0.score != nil })
        let b = try #require(try await food.pantryBreakdown(estimated))
        #expect(Set(b.dimensions.map(\.id)) == ["micro", "who", "fat_quality", "nova", "energy_density"])
        let catalog = try #require(try await food.pantry(query: "zab").first)
        #expect(catalog.score != nil)
        #expect(try await food.pantryBreakdown(catalog) != nil)
    }

    @Test func testKamraRow_showsBecsultTagOnlyForEstimated() {
        #expect(kamraShowsEstimate(PantryRow(name: "Kurkuma", estimated: true)))
        #expect(!kamraShowsEstimate(PantryRow(name: "Zabpehely")))
        #expect(provenanceLines(PantryRow(name: "Kurkuma", source: "ai_estimate", estimated: true)).first == "Forrás: Boop becslése")
    }

    @Test func testReplacingMode_savesThroughUpdateNotCreate() async {
        final class Calls: @unchecked Sendable { var created = 0; var replaced: [(PantryRow, NewPantryFood)] = [] }
        let calls = Calls()
        let estimate = PantryRow(id: UUID(), catalogId: UUID(), name: "Kurkuma", per: 100, unit: "g", kcal: 354, proteinG: 7.8, carbsG: 64.9, fatG: 9.9,
                                 source: "ai_estimate", estimated: true)
        let m = PantryAddModel(route: .manual, mode: .replacing(estimate),
                               scraper: { _ in nil }, labeler: { _ in nil },
                               saver: { _ in calls.created += 1; return PantryRow(name: "x") },
                               replacer: { row, food in calls.replaced.append((row, food)); var r = row; r.kcal = food.kcal; r.estimated = false; return r })
        // the form opens with the food's own name and facts
        #expect(m.food.name == "Kurkuma" && m.food.kcal == 354 && m.isReplacing)
        m.food.kcal = 312
        let saved = await m.save()
        #expect(calls.created == 0 && calls.replaced.count == 1)
        #expect(calls.replaced[0].0.id == estimate.id && calls.replaced[0].1.kcal == 312)
        #expect(saved?.estimated == false && saved?.id == estimate.id)

        // a scanned product without a name keeps the food's own name
        let scan = PantryAddModel(route: .barcode, mode: .replacing(estimate), scraper: { _ in nil }, labeler: { _ in nil },
                                  saver: { _ in PantryRow(name: "x") }, replacer: { r, _ in r })
        scan.scanned(LookupItem(name: "", brand: nil, barcode: "5997001234567", per: 100, unit: "g", kcal: 330, proteinG: 8, carbsG: 65, fatG: 10))
        #expect(scan.food.name == "Kurkuma" && scan.food.barcode == "5997001234567" && scan.food.origin == .barcode)
    }

    @Test func testAddForm_opensWithTheRowsName() {
        let m = PantryAddModel(route: .manual, prefillName: "Kurkuma", scraper: { _ in nil }, labeler: { _ in nil }, saver: { _ in PantryRow(name: "x") })
        #expect(m.food.name == "Kurkuma" && !m.isReplacing)
    }
}
