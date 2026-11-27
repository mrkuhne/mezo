import Foundation
import Testing
@testable import BoopCore

/// mezo-r36n9.184 — correcting and deleting a logged meal: the seed the composer edits, and the two calls.
@MainActor
struct MealEditTests {
    let stub = StubTransport()
    private let mealId = UUID(uuidString: "5b0e8a52-1c3d-4e0e-9a52-7d9d4c1a0b01")!
    private let pantryId = UUID(uuidString: "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c02")!
    private let recipeId = UUID(uuidString: "7d2a0c74-3e5f-4a2a-9c74-9f1f6e3c2d03")!

    let tokens = MemoryTokenStore()
    private static let noon: Date = {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        return cal.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 12))!
    }()

    func food() throws -> FoodClient {
        try tokens.write("t0")
        let tz = TimeZone(identifier: "Europe/Budapest")!
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        return FoodClient(client: makeClient(tokens: tokens, transport: stub, timeZone: tz), calendar: cal)
    }

    private func fields(_ body: String?) -> [String: Any] {
        (try? JSONSerialization.jsonObject(with: Data((body ?? "").utf8)) as? [String: Any]) ?? [:]
    }

    private func meal() -> Meal {
        Meal(id: mealId, slot: "lunch", loggedAt: Self.noon, mealDate: "2026-11-13", title: "Ebéd",
             macros: Macros(kcal: 700, p: 40, c: 70, f: 20), score: 71,
             items: [
                MealItem(name: "Zabpehely", source: "pantry", amount: 60, unit: "g", contribution: Macros(kcal: 228, p: 8, c: 40, f: 4),
                         nova: 1, pantryItemId: pantryId),
                MealItem(name: "Saláta", source: "estimate", amount: 150, unit: "g", contribution: Macros(kcal: 90, p: 3, c: 6, f: 6),
                         nova: 1, fiberG: 4.5, sugarG: 3, saltG: 0.6, saturatedFatG: 1),
                MealItem(name: "Lecsó", source: "recipe", amount: 1, unit: "adag", contribution: Macros(kcal: 382, p: 29, c: 24, f: 10),
                         nova: nil, recipeId: recipeId,
                         ingredientOverrides: [IngredientOverride(lineOrder: 2, pantryItemId: pantryId, amount: 80)]),
             ], hasPhoto: true)
    }

    @Test func theSeedKeepsEveryLineAndItsMacros() throws {
        let d = MealDraft(editing: meal())
        #expect(d.date == "2026-11-13" && d.slot == "lunch" && d.title == "Ebéd")
        #expect(d.photo == nil && d.draftId == nil)
        #expect(d.items.map(\.source) == [.pantry, .estimate, .recipe])
        #expect(d.items[0].pantryItemId == pantryId)
        let salad = d.items[1]
        #expect(salad.per == 150 && salad.basisUnit == "g" && salad.kcal == 90 && salad.fiberG == 4.5 && salad.saltG == 0.6)
        #expect(d.items[2].recipeId == recipeId && d.items[2].ingredientOverrides?.first?.amount == 80)
        #expect(d.items.allSatisfy { !$0.needsReview && $0.confidence == 1 })
    }

    @Test func updateSendsTheOriginalTimeEveryLineAndNoWindow() async throws {
        stub.on("updateMeal", .status(204))
        var d = MealDraft(editing: meal())
        d.items[1].amount = 300
        let m = meal()
        try await food().updateMeal(m.id, with: d, at: m.loggedAt)
        let sent = try #require(stub.sent.first)
        #expect(sent.op == "updateMeal" && sent.path == "/api/meal/\(mealId.uuidString.lowercased())")
        let body = fields(sent.body)
        #expect(body["window"] == nil && body["clientRef"] == nil)
        #expect(body["slot"] as? String == "lunch" && body["title"] as? String == "Ebéd")
        #expect(body["capturedAt"] as? String == "2026-11-13T12:00:00+01:00")
        let items = try #require(body["items"] as? [[String: Any]])
        #expect(items[0]["pantryItemId"] as? String == pantryId.uuidString.lowercased())
        #expect(items[1]["amount"] as? Double == 300 && items[1]["per"] as? Double == 150 && items[1]["kcal"] as? Double == 90)
        let overrides = try #require(items[2]["ingredientOverrides"] as? [[String: Any]])
        #expect(overrides.first?["lineOrder"] as? Int == 2 && overrides.first?["amount"] as? Double == 80)
        #expect(items[0]["ingredientOverrides"] == nil)
    }

    @Test func aRefusedUpdateIsRejected() async throws {
        stub.on("updateMeal", .status(400))
        let m = meal()
        await #expect(throws: FoodFetchError.rejected) { try await food().updateMeal(m.id, with: MealDraft(editing: m), at: m.loggedAt) }
    }

    @Test func deleteHitsTheMealAndAGoneMealIsFine() async throws {
        stub.on("deleteMeal", .status(204)); stub.on("deleteMeal", .status(404))
        let f = try food()
        try await f.deleteMeal(mealId)
        try await f.deleteMeal(mealId)
        #expect(stub.ops == ["deleteMeal", "deleteMeal"])
        #expect(stub.sent[0].path == "/api/meal/\(mealId.uuidString.lowercased())")
    }

    @Test func theMealReadsItsPantryIdNutrientsAndOverrides() async throws {
        stub.on("getFuelDay", .json(200, #"""
        {"date":"2026-11-13","targets":{"kcal":2000,"p":150,"c":200,"f":60,"water":2500},"consumed":{"kcal":700,"p":40,"c":70,"f":20,"water":0},"skippedKcal":0,
         "meals":[{"id":"\#(mealId.uuidString.lowercased())","slot":"lunch","loggedAt":"2026-11-13T12:00:00+01:00","mealDate":"2026-11-13","title":"Ebéd",
           "macros":{"kcal":700,"p":40,"c":70,"f":20},"score":{"value":71},
           "items":[{"source":"recipe","recipeId":"\#(recipeId.uuidString.lowercased())","pantryItemId":null,"amount":1,"unit":"adag","lineOrder":0,"name":"Lecsó",
                     "contribution":{"kcal":382,"p":29,"c":24,"f":10},"nutrients":{"fiberG":5,"sugarG":8,"saltG":1.2,"saturatedFatG":2},
                     "ingredientOverrides":[{"lineOrder":2,"pantryItemId":"\#(pantryId.uuidString.lowercased())","name":"Paprika","unit":"g","originalAmount":100,"amount":80}]},
                    {"source":"pantry","pantryItemId":"\#(pantryId.uuidString.lowercased())","amount":60,"unit":"g","lineOrder":1,"name":"Zab","contribution":{"kcal":228,"p":8,"c":40,"f":4}}]}]}
        """#))
        let day = try await food().day(Self.noon)
        let items = try #require(day.meals.first?.items)
        #expect(items[0].fiberG == 5 && items[0].saltG == 1.2)
        #expect(items[0].ingredientOverrides == [IngredientOverride(lineOrder: 2, pantryItemId: pantryId, amount: 80)])
        #expect(items[1].pantryItemId == pantryId && items[1].ingredientOverrides.isEmpty)
    }
}
