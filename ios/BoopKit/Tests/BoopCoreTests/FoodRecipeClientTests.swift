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

    @Test func aBarcodeProductMissingAnyMacroIsMarkedForReview() async throws {
        stub.on("lookupPantryItem", .json(200, #"{"source":"OFF","results":[{"name":"Szelet","per":100,"unit":"g","kcal":380,"proteinG":30,"allergens":{}}]}"#))
        stub.on("lookupPantryItem", .json(200, #"{"source":"OFF","results":[{"name":"Teljes","per":100,"unit":"g","kcal":380,"proteinG":30,"carbsG":35,"fatG":12,"allergens":{}}]}"#))
        let f = try food()
        let partial = try await f.draft(date: Date(), text: nil, photo: nil, barcode: "5997001234567")
        #expect(partial.items.first?.needsReview == true)
        let full = try await f.draft(date: Date(), text: nil, photo: nil, barcode: "5997001234568")
        #expect(full.items.first?.needsReview == false)
    }

    @Test func anImportLineCarriesItsMatchedFoodsAllergens() async throws {
        stub.on("importRecipeFromUrl", .json(200, #"""
        {"result":{"name":"Feta","category":"lunch","servings":2,"steps":[],"lines":[
          {"source":"pantry","name":"Feta","amount":100,"unit":"g","match":{"state":"matched","onShelf":false,"amountDoubt":false,"alternatives":[],"catalogId":"\#(catalogId)","confidence":1,"needsReview":false},"allergens":{"milk":"contains"}},
          {"source":"estimate","name":"Kapor","amount":1,"unit":"csokor","match":{"state":"missing","onShelf":false,"amountDoubt":false,"alternatives":[],"confidence":0,"needsReview":true},"allergens":null}]}}
        """#))
        let d = try #require(try await food().importRecipe(.url("https://x.hu/r")))
        #expect(d.lines[0].allergens == ["milk": .contains])
        #expect(d.lines[1].allergens == nil)
    }

    @Test func anUndecodable400OnAMealSaveStaysRetryable() async throws {
        // a proxy's HTML "Bad Request" must never turn a queued capture into a permanent refusal (the outbox retries .server)
        stub.on("createMeal", .status(400))
        await #expect(throws: FoodFetchError.server) {
            _ = try await food().save(MealDraft(date: "2026-11-13", slot: "lunch", title: "x", items: []), clientRef: UUID(), capturedAt: Date())
        }
        // …while a recipe save nobody queues reads the same 400 as a refusal (aRefusedRecipeSaveThrowsRejected)
    }

    // MARK: „Ezt főztem" (mezo-r36n9.63)

    private var cookedJSON: String {
        #"""
        {"result":{"name":"Kurkumás csirkés rizs","category":"lunch","servings":4,"steps":[],"needsReview":true,"lines":[
          {"source":"pantry","name":"Csirkemell filé, friss","amount":500,"unit":"g","sourceText":"fél kiló csirkemell",
           "match":{"state":"matched","onShelf":true,"basisUnit":"g","amountDoubt":false,"alternatives":[],"catalogId":"\#(catalogId)","confidence":1,"needsReview":false}},
          {"source":"pantry","name":"Olívaolaj, extra szűz","amount":30,"unit":"g","sourceText":"két evőkanál olaj",
           "match":{"state":"confirm","onShelf":false,"basisUnit":"g","amountDoubt":true,"alternatives":[{"catalogId":"\#(pantryId)","name":"Napraforgóolaj","brand":"Pelda","basisUnit":"ml"}],"catalogId":"\#(catalogId)","confidence":0.5,"needsReview":true}},
          {"source":"estimate","name":"Kurkuma","amount":0,"unit":"tk","sourceText":"egy kis kurkuma",
           "match":{"state":"missing","onShelf":false,"basisUnit":null,"amountDoubt":true,"alternatives":[],"confidence":0,"needsReview":true}}]}}
        """#
    }

    @Test func testCooked_sendsMultipartWithTextAndEveryPhoto() async throws {
        stub.on("cookedRecipe", .json(200, cookedJSON))
        _ = try await food().cooked(text: "  fél kiló csirkemell  ", photos: [Data("a".utf8), Data("b".utf8), Data("c".utf8)])
        let sent = try #require(stub.sent.last)
        #expect(sent.path == "/api/recipe/cooked")
        let body = (sent.body ?? "").lowercased()
        #expect(body.components(separatedBy: #"name="text""#).count - 1 == 1)
        #expect(body.contains("fél kiló csirkemell"))
        #expect(body.components(separatedBy: #"name="photos""#).count - 1 == 3)
        // the server refuses a photo part that does not name an image type
        #expect(body.components(separatedBy: "content-type: image/jpeg").count - 1 == 3)
        #expect(!body.contains("application/octet-stream"))
    }

    @Test func testCooked_photosAloneSendNoTextPart() async throws {
        stub.on("cookedRecipe", .json(200, cookedJSON))
        _ = try await food().cooked(text: "   ", photos: [Data("a".utf8)])
        #expect((stub.sent.last?.body ?? "").contains(#"name="text""#) == false)
        // neither a text nor a photo never leaves the phone
        await #expect(throws: FoodFetchError.rejected) { _ = try await food().cooked(text: nil, photos: []) }
        #expect(stub.ops == ["cookedRecipe"])
    }

    @Test func testCooked_decodesStateAlternativesAndDoubt() async throws {
        stub.on("cookedRecipe", .json(200, cookedJSON))
        let d = try #require(try await food().cooked(text: "x", photos: []))
        #expect(d.lines.map(\.state) == [.matched, .confirm, .missing])
        #expect(d.lines[0].onShelf && !d.lines[1].onShelf)
        #expect(d.lines[0].sourceText == "fél kiló csirkemell")
        #expect(d.lines[1].amountDoubt && d.lines[1].amount == 30 && d.lines[1].unit == "g" && d.lines[1].basisUnit == "g")
        #expect(d.lines[1].alternatives == [FoodChoice(id: UUID(uuidString: pantryId)!, name: "Napraforgóolaj", brand: "Pelda", basisUnit: "ml")])
        #expect(d.lines[2].catalogId == nil && d.lines[2].amount == 0 && d.lines[2].basisUnit == nil)
    }

    @Test func testCooked_nullResultIsNil() async throws {
        stub.on("cookedRecipe", .json(200, #"{"result":null}"#))
        #expect(try await food().cooked(text: "asdf", photos: []) == nil)
    }

    @Test func testCooked_refusalsAndAnUnavailableModelStayApart() async throws {
        stub.on("cookedRecipe", .status(400))
        await #expect(throws: FoodFetchError.rejected) { _ = try await food().cooked(text: "x", photos: []) }
        stub.on("cookedRecipe", .status(503))
        await #expect(throws: FoodFetchError.unavailable) { _ = try await food().cooked(text: "x", photos: []) }
        stub.on("cookedRecipe", .status(502))
        await #expect(throws: FoodFetchError.unavailable) { _ = try await food().cooked(text: "x", photos: []) }
    }

    @Test func testCreateRecipe_sendsClientRef() async throws {
        stub.on("createRecipe", .json(201, recipeJSON()))
        let ref = UUID()
        _ = try await food().createRecipe(NewRecipe(name: "x", category: "lunch", servings: 1,
                                                    lines: [NewRecipeLine(catalogId: UUID(uuidString: catalogId)!, amount: 1, unit: "g")], clientRef: ref))
        let body = (try? JSONSerialization.jsonObject(with: Data((stub.sent.last?.body ?? "").utf8))) as? [String: Any]
        #expect(body?["clientRef"] as? String == ref.uuidString.lowercased())
    }
}
