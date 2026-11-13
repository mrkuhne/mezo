import Foundation
import Testing
@testable import BoopCore

private let recipeId = "7d2a0c74-3e5f-4a2a-9c74-9f1f6e3c2d03"
private let pantryId = "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c02"
private let catalogId = "33359b8f-e90a-45d5-8b8f-a4c13d1d0f2f"

private func recipeJSON(hasImage: Bool = true) -> String {
    #"""
    {"id":"\#(recipeId)","name":"Görög csirkesaláta","category":"lunch","servings":2,"tags":[],"starred":false,"role":"standard","createdDate":"2026-10-01",
     "novaDominant":1,"macros":{"kcal":960,"p":92,"c":40,"f":44},"mezoFit":{"score":0.78,"fitsFor":[]},"timesLogged":3,"avgScore":0,"lastLogged":"—",
     "ingredients":[{"pantryItemId":"\#(pantryId)","amount":300,"unit":"g","lineOrder":0,"name":"Csirkemell","contribution":{"kcal":495,"p":93,"c":0,"f":11}}],
     "steps":["Süsd meg."],"sourceUrl":"https://example.hu/gorog","hasImage":\#(hasImage),"allergens":{"milk":"contains","gluten":"unknown"}}
    """#
}

@MainActor
struct FoodRecipeClientTests {
    let stub = StubTransport()
    let tokens = MemoryTokenStore()
    func food() throws -> FoodClient {
        try tokens.write("t0")
        let tz = TimeZone(identifier: "Europe/Budapest")!
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        return FoodClient(client: makeClient(tokens: tokens, transport: stub, timeZone: tz), calendar: cal)
    }

    @Test func aRecipeCarriesItsPhotoFlagAllergensAndFit() async throws {
        stub.on("listRecipes", .json(200, #"{"recipes":[\#(recipeJSON())]}"#))
        let r = try await food().recipes().first!
        #expect(r.hasImage)
        #expect(r.allergens == ["milk": .contains, "gluten": .unknown])
        #expect(r.fit == 0.78)
        #expect(r.timesLogged == 3)
        #expect(r.ingredients.first?.kcal == 495)
        #expect(r.perServing.kcal == 480)
    }

    @Test func aRecipeWithoutTheFlagHasNoPhoto() async throws {
        stub.on("getRecipe", .json(200, recipeJSON(hasImage: false).replacingOccurrences(of: #","hasImage":false"#, with: "")))
        #expect(try await food().recipe(UUID(uuidString: recipeId)!).hasImage == false)
    }

    @Test func savingARecipeSendsTheReviewedLines() async throws {
        stub.on("createRecipe", .json(201, recipeJSON()))
        let saved = try await food().createRecipe(NewRecipe(
            name: "Görög csirkesaláta", category: "lunch", servings: 2, steps: ["Süsd meg."], sourceUrl: "https://example.hu/gorog",
            lines: [NewRecipeLine(catalogId: UUID(uuidString: catalogId)!, amount: 400, unit: "g"),
                    NewRecipeLine(pantryItemId: UUID(uuidString: pantryId)!, amount: 1, unit: "db")]))
        #expect(saved.name == "Görög csirkesaláta")
        let sent = stub.sent.first { $0.path == "/api/recipe" }
        let body = (try? JSONSerialization.jsonObject(with: Data((sent?.body ?? "").utf8))) as? [String: Any]
        #expect(body?["servings"] as? Int == 2)
        #expect(body?["sourceUrl"] as? String == "https://example.hu/gorog")
        let lines = body?["ingredients"] as? [[String: Any]]
        #expect(lines?.count == 2)
        #expect(lines?[0]["catalogId"] as? String == catalogId)
        #expect(lines?[0]["pantryItemId"] == nil)
        #expect(lines?[1]["pantryItemId"] as? String == pantryId)
    }

    @Test func aRefusedRecipeSaveThrowsRejected() async throws {
        stub.on("createRecipe", .status(400))
        await #expect(throws: FoodFetchError.rejected) {
            _ = try await food().createRecipe(NewRecipe(name: "x", category: "lunch", servings: 1, lines: []))
        }
    }

    @Test func recipeLogsAndBreakdownDecode() async throws {
        stub.on("recipeLogs", .json(200, #"{"recentLogs":[{"mealId":"5b0e8a52-1c3d-4e0e-9a52-7d9d4c1a0b01","slot":"lunch","loggedAt":"2026-11-10T12:30:00+01:00","kcal":480,"p":46,"c":20,"f":22,"score":0.8}]}"#))
        let logs = try await food().recipeLogs(UUID(uuidString: recipeId)!)
        #expect(logs.count == 1 && logs[0].kcal == 480 && logs[0].score == 0.8)
        #expect(stub.sent.last?.path == "/api/recipe/\(recipeId)/logs")

        stub.on("getRecipeBreakdown", .json(200, #"{"fitsFor":["post_workout"],"breakdown":{"value":0.78,"confidence":0.9,"dimensions":[{"id":"macro","label":"Makrók","weight":0.5,"score":0.8,"detail":"x"}],"improve":[],"tools":[]}}"#))
        let b = try await food().recipeBreakdown(UUID(uuidString: recipeId)!)
        #expect(b.fitsFor == ["post_workout"])
        #expect(b.breakdown?.dimensions.first?.points == 80)

        stub.on("getRecipeBreakdown", .json(200, #"{"fitsFor":[]}"#))
        #expect(try await food().recipeBreakdown(UUID(uuidString: recipeId)!).breakdown == nil)
    }

    @Test func aWorkshopTurnSendsTheHistoryAndTheDraft() async throws {
        stub.on("workshopTurn", .json(200, #"{"reply":"Íme.","draft":{"name":"Túrós tál","category":"breakfast","servings":1,"steps":["Keverd."],"lines":[{"source":"pantry","pantryItemId":"\#(pantryId)","name":"Zab","amount":60,"unit":"g"},{"source":"estimate","name":"Túró","amount":200,"unit":"g"}]}}"#))
        let draft = WorkshopDraft(name: "Régi", category: "lunch", servings: 2, steps: [], lines: [WorkshopLine(source: "estimate", name: "Rizs", amount: 100, unit: "g")])
        let r = try await food().workshop(message: "cseréld a rizst", history: [WorkshopChatMessage(fromUser: true, text: "vacsora"), WorkshopChatMessage(fromUser: false, text: "ok")], draft: draft)
        #expect(r.reply == "Íme.")
        #expect(r.draft.lines.map(\.source) == ["pantry", "estimate"])
        #expect(r.draft.lines[0].pantryItemId == UUID(uuidString: pantryId))
        let body = (try? JSONSerialization.jsonObject(with: Data((stub.sent.last?.body ?? "").utf8))) as? [String: Any]
        #expect(body?["message"] as? String == "cseréld a rizst")
        #expect((body?["history"] as? [[String: Any]])?.map { $0["role"] as? String } == ["user", "assistant"])
        #expect((body?["draft"] as? [String: Any])?["name"] as? String == "Régi")
    }

    @Test func aWorkshopWithTheModelOffIsUnavailable() async throws {
        stub.on("workshopTurn", .status(503))
        await #expect(throws: FoodFetchError.unavailable) { _ = try await food().workshop(message: "x", history: [], draft: nil) }
    }

    @Test func theRecipePhotoOperationsHitTheRightPaths() async throws {
        stub.on("putRecipeImage", .json(200, #"{"bytes":3,"width":1,"height":1}"#)); stub.on("deleteRecipeImage", .status(204))
        let f = try food()
        try await f.setRecipeImage(Data("JPG".utf8), recipeId: UUID(uuidString: recipeId)!)
        try await f.deleteRecipeImage(UUID(uuidString: recipeId)!)
        #expect(stub.sent.map(\.path) == ["/api/recipe/\(recipeId)/image", "/api/recipe/\(recipeId)/image"])
        // a recipe with no photo is already "deleted"
        stub.on("deleteRecipeImage", .status(404))
        try await f.deleteRecipeImage(UUID(uuidString: recipeId)!)
    }
}
