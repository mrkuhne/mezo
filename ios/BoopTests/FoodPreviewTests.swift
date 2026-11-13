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
        #expect(recipes.count == 1)
        #expect(try await food.recipe(recipes[0].id).steps.count == 3)
        #expect(try await food.importRecipe(.url("https://pelda.hu/r"))?.lines.count == 2)
        #expect(try await food.importRecipe(.photo(Data([1, 2, 3])))?.needsReview == true)
        #expect(try await food.pantry().count == 1)
        #expect(try await food.pantry(query: "zab").first?.onShelf == false)
        let profile = try await food.sensitivity()
        #expect(profile.items.count == 2)
        #expect(try await food.setSensitivity(profile) == profile)
        #expect(try await food.dietSettings().waterMl == 2500)
        #expect(try await food.protocol().items(in: "morning").count == 2)
        #expect(try await food.tickGroup(daypart: "morning", clientRef: UUID()) == 2)
    }
}
