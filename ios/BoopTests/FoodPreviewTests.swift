import Foundation
import Testing
import BoopCore
@testable import Boop

/// The simulator has no network: every Étel operation must be answered by the DEBUG `PreviewTransport`, and the answers
/// must decode through `FoodClient` (a missing or malformed stub would blank the whole room in the review).
@MainActor
struct FoodPreviewTests {
    let food = FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: PreviewTransport()))

    @Test func theFoodDayPlanAndMealsDecode() async throws {
        let day = try await food.day(Date())
        #expect(day.meals.first?.hasPhoto == true)
        #expect(day.targets.kcal > 0)
        let plan = try await food.plan(Date())
        #expect(plan.windows.map(\.state).contains(.now))
        #expect(plan.windows.contains { $0.suggestion != nil })
        #expect(plan.remaining != nil && plan.tip != nil)
        let photo = try await food.photo(mealId: try #require(day.meals.first?.id))
        #expect(photo?.isEmpty == false)
    }

    @Test func draftSaveWaterAndSkipRoundTrip() async throws {
        let draft = try await food.draft(date: Date(), text: "csirkés rizs", photo: nil, barcode: "5997001234567")
        #expect(draft.items.count == 3)
        #expect(draft.items.last?.allergens["milk"] == .contains)
        var withPhoto = draft; withPhoto.photo = Data([1, 2, 3])
        let meal = try await food.save(withPhoto, clientRef: UUID())
        #expect(meal.hasPhoto)
        try await food.deletePhoto(mealId: meal.id)
        try await food.deleteAllPhotos()
        #expect(meal.macros.kcal > 0)
        try await food.water(ml: 250, date: Date(), clientRef: UUID())
        let plan = try await food.plan(Date())
        let open = try #require(plan.windows.first { $0.state == .pending })
        try await food.skip(window: open, in: plan, reason: .notHungry)
        let after = try await food.plan(Date())
        #expect(after.windows.first { $0.from == open.from }?.state == .skipped)
    }

    @Test func lookupRecipesPantrySettingsAndProtocolDecode() async throws {
        #expect(try await food.lookup(barcode: "5997001234567").source == .off)
        #expect(try await food.lookup(barcode: "5990001111").source == .catalog)
        #expect(try await food.lookup(barcode: "5990000000").source == .none)
        let recipes = try await food.recipes()
        #expect(recipes.count >= 4)
        #expect(try await food.recipe(recipes[0].id).steps.count == 3)
        #expect(try await food.importRecipe(.url("https://pelda.hu/r"))?.lines.count == 3)
        #expect(try await food.importRecipe(.photo(Data([1, 2, 3])))?.needsReview == true)
        #expect(try await food.pantry().count > 4)
        #expect(try await food.pantry(query: "zab").first?.onShelf == false)
        let profile = try await food.sensitivity()
        #expect(profile.items.count == 2)
        #expect(try await food.setSensitivity(profile) == profile)
        #expect(try await food.dietSettings().waterMl == 2500)
        #expect(try await food.protocol().items(in: "morning").count == 2)
        #expect(try await food.tickGroup(daypart: "morning", clientRef: UUID()) == 2)
    }

    @Test func theRecipeOperationsAnswerThroughThePreviewToo() async throws {
        let library = try await food.recipes()
        #expect(library.filter(\.hasImage).count >= 2)
        #expect(library.first { $0.allergens["milk"] == .contains } != nil)
        let first = library[0]
        #expect(try await food.recipeLogs(first.id).count == 2)
        #expect(try await food.recipeBreakdown(first.id).breakdown?.dimensions.count == 3)
        #expect(try await food.recipeImage(first.id) != nil)
        try await food.setRecipeImage(Data([1, 2, 3]), recipeId: first.id)
        try await food.deleteRecipeImage(first.id)
        let turn = try await food.workshop(message: "valami gyors", history: [], draft: nil)
        #expect(turn.draft.lines.count == 2 && turn.draft.lines[0].pantryItemId != nil)
        let saved = try await food.createRecipe(NewRecipe(name: "Próba", category: "lunch", servings: 2,
                                                          lines: [NewRecipeLine(catalogId: UUID(), amount: 200, unit: "g")]))
        #expect(saved.name == "Próba" && saved.servings == 2)
    }

    @Test func theUsualsAndTheWeekDecodeFromThePreviewServer() async throws {
        let usuals = try await food.usuals(slot: "dinner")
        #expect(try await food.usuals().count == 3)
        #expect(usuals[0].items.count == 2)   // a usual with its latest meal's lines
        #expect(usuals[2].items.isEmpty)       // and one without (the name-only fallback)
        #expect(usuals.count == 3)
        let week = try await food.week(from: Date().addingTimeInterval(-6 * 86_400))
        #expect(week.days.count == 7)
        #expect(week.days.contains { $0.fuelMode == "GUIDANCE" })
        let scraped = try await food.scrapeFood(url: "https://bolt.hu/skyr")
        #expect(scraped?.name == "Skyr natúr")
        #expect(try await food.scrapeFood(url: "https://bolt.hu/nincs") == nil)
        #expect(try await food.readLabel(Data([1]))?.needsReview == true)
        let saved = try await food.addFood(NewPantryFood(name: "Házi lekvár", kcal: 250, origin: .manual))
        #expect(saved.source == "manual")
    }
}
