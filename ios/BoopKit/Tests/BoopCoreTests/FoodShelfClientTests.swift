import Foundation
import Testing
@testable import BoopCore

private let pantryId = "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c02"
private let catalogId = "33359b8f-e90a-45d5-8b8f-a4c13d1d0f2f"

private func rollup(_ date: String, kcal: Double, target: Double, mode: String? = nil, skipped: Int = 0, planned: Int? = nil) -> String {
    let energy = planned.map { #","energy":{"baseKcal":2000,"plannedMovementKcal":\#($0),"extraMovementKcal":0,"balanceKcal":0,"targetKcal":\#(Int(target))}"# } ?? ""
    return #"{"date":"\#(date)","targets":{"kcal":\#(target),"p":165,"c":280,"f":70,"water":3000},"consumed":{"kcal":\#(kcal),"p":120,"c":200,"f":60,"water":2000}\#(energy),"fuelMode":\#(mode.map { "\"\($0)\"" } ?? "null"),"skippedKcal":\#(skipped)}"#
}

@MainActor
struct FoodShelfClientTests {
    let stub = StubTransport()
    let tokens = MemoryTokenStore()
    func food() throws -> FoodClient {
        try tokens.write("t0")
        let tz = TimeZone(identifier: "Europe/Budapest")!
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        return FoodClient(client: makeClient(tokens: tokens, transport: stub, timeZone: tz), calendar: cal)
    }

    @Test func theWeekCarriesEachDaysTargetKimeloModeAndSkippedKcal() async throws {
        stub.on("getFuelWeek", .json(200, #"{"start":"2026-11-07","days":[\#(rollup("2026-11-07", kcal: 2200, target: 2350, planned: 300)),\#(rollup("2026-11-08", kcal: 2150, target: 2350, mode: "GUIDANCE")),\#(rollup("2026-11-09", kcal: 2280, target: 2350, skipped: 300))],"mealScoreAvg":0.71}"#))
        let week = try await food().week(from: Date(timeIntervalSince1970: 1_794_000_000))
        #expect(week.days.count == 3)
        #expect(week.days[0].plannedMovementKcal == 300)
        #expect(week.days[1].fuelMode == "GUIDANCE")
        #expect(week.days[2].skippedKcal == 300)
        #expect(week.mealScoreAvg == 0.71)
        #expect(stub.sent.last?.path.hasPrefix("/api/fuel/week/") == true)
    }

    @Test func usualsComeRankedAndTheWindowTravelsAsAQuery() async throws {
        stub.on("getUsualMeals", .json(200, #"{"usuals":[{"key":"lunch:csirke rizzsel","title":"Csirke rizzsel","slot":"lunch","count":3,"lastLoggedAt":"2026-11-12T11:00:00Z"},{"key":"breakfast:zabkása","title":"Zabkása","slot":"breakfast","count":2,"lastLoggedAt":"2026-11-12T07:00:00Z"}]}"#))
        let list = try await food().usuals(slot: "lunch")
        #expect(list.map(\.title) == ["Csirke rizzsel", "Zabkása"])
        #expect(list[0].count == 3)
        #expect(stub.sent.last?.path.contains("slot=lunch") == true)
    }

    @Test func aPageWithoutFactsIsNilAndAReadPageKeepsItsOwnUrl() async throws {
        stub.on("scrapePantryItem", .json(200, #"{"result":null}"#))
        #expect(try await food().scrapeFood(url: "https://bolt.hu/valami-termek") == nil)
        stub.on("scrapePantryItem", .json(200, #"{"result":{"name":"Skyr natúr","brand":"Mizo","per":100,"unit":"g","kcal":63,"proteinG":11,"carbsG":4,"fatG":0.2,"nova":3,"category":"dairy","source":"web","sourceUrl":"https://bolt.hu/skyr","confidence":0.8,"needsReview":false}}"#))
        let found = try #require(try await food().scrapeFood(url: "https://bolt.hu/skyr"))
        #expect(found.name == "Skyr natúr")
        #expect(found.category == "dairy")
        #expect(found.origin == .link("https://bolt.hu/skyr"))
        #expect(found.fiberG == nil)   // a fact the page does not give stays unknown, never a fabricated zero
    }

    @Test func aScrapeThatTheServerRefusesIsRejectedAndOneThatCannotBeReadIsUnavailable() async throws {
        stub.on("scrapePantryItem", .status(400))
        await #expect(throws: FoodFetchError.rejected) { _ = try await food().scrapeFood(url: "https://bolt.hu/x") }
        stub.on("scrapePantryItem", .status(502))
        await #expect(throws: FoodFetchError.unavailable) { _ = try await food().scrapeFood(url: "https://bolt.hu/y") }
    }

    @Test func aTypedFoodIsSavedAsTheOwnersOwnAndAScannedOneKeepsItsBarcodeAndAllergens() async throws {
        stub.on("createPantryItem", .json(201, #"{"id":"\#(pantryId)","catalogId":"\#(catalogId)","kind":"food","name":"Házi lekvár","source":"manual"}"#))
        let typed = try await food().addFood(NewPantryFood(name: "Házi lekvár", per: 100, unit: "g", kcal: 250, proteinG: 0.5, nova: 2, origin: .manual))
        #expect(typed.onShelf)
        #expect(typed.source == "manual")
        let typedBody = (try? JSONSerialization.jsonObject(with: Data((stub.sent.last?.body ?? "").utf8))) as? [String: Any]
        #expect(typedBody?["source"] as? String == "manual")
        #expect(typedBody?["fatG"] == nil || typedBody?["fatG"] is NSNull)

        stub.on("importPantryItem", .json(201, #"{"id":"\#(pantryId)","catalogId":"\#(catalogId)","kind":"food","name":"Skyr","source":"openfoodfacts","barcode":"5997001234567","allergens":{"milk":"contains"}}"#))
        let scanned = try await food().addFood(NewPantryFood(name: "Skyr", barcode: "5997001234567", per: 100, unit: "g", kcal: 63,
                                                              allergens: ["milk": .contains], origin: .barcode))
        #expect(scanned.barcode == "5997001234567")
        #expect(scanned.allergens == ["milk": .contains])
        let body = (try? JSONSerialization.jsonObject(with: Data((stub.sent.last?.body ?? "").utf8))) as? [String: Any]
        #expect(body?["barcode"] as? String == "5997001234567")
        #expect((body?["allergens"] as? [String: String]) == ["milk": "contains"])
        #expect(body?["origin"] == nil || body?["origin"] is NSNull)
    }

    @Test func aLabelPhotoIsImportedWithItsOriginAndAPageWithItsUrl() async throws {
        stub.on("importPantryItem", .json(201, #"{"id":"\#(pantryId)","catalogId":"\#(catalogId)","kind":"food","name":"Müzli","source":"photo"}"#))
        _ = try await food().addFood(NewPantryFood(name: "Müzli", per: 100, unit: "g", kcal: 380, origin: .labelPhoto, confidence: 0.7, needsReview: true))
        let photo = (try? JSONSerialization.jsonObject(with: Data((stub.sent.last?.body ?? "").utf8))) as? [String: Any]
        #expect(photo?["origin"] as? String == "photo")
        #expect(photo?["confidence"] as? Double == 0.7)

        stub.on("importPantryItem", .json(201, #"{"id":"\#(pantryId)","catalogId":"\#(catalogId)","kind":"food","name":"Skyr","source":"web"}"#))
        _ = try await food().addFood(NewPantryFood(name: "Skyr", per: 100, unit: "g", kcal: 63, origin: .link("https://bolt.hu/skyr")))
        let page = (try? JSONSerialization.jsonObject(with: Data((stub.sent.last?.body ?? "").utf8))) as? [String: Any]
        #expect(page?["sourceUrl"] as? String == "https://bolt.hu/skyr")
    }

    @Test func aRefusedAddThrowsRejected() async throws {
        stub.on("createPantryItem", .status(400))
        await #expect(throws: FoodFetchError.rejected) { _ = try await food().addFood(NewPantryFood(name: "x", kcal: 1, origin: .manual)) }
    }

    @Test func aShelfRowCarriesItsAllergensBarcodeAndProvenance() async throws {
        stub.on("getPantry", .json(200, #"{"ingredients":[{"id":"\#(pantryId)","kind":"food","name":"Zabpehely","brand":null,"source":"openfoodfacts","category":"grains","per":100,"unit":"g","macros":{"kcal":370,"p":13,"c":60,"f":7},"price":null,"priceUnit":null,"pkg":null,"micros":[],"nova":1,"lastUsed":"-","usedInRecipes":2,"catalogId":"\#(catalogId)","catalogEditable":true,"allergens":{"gluten":"traces"},"barcode":"5997001234567","fiberG":10,"sharedFrom":{"authorName":"Anna"}}],"stash":[],"imports":[],"suggestions":[]}"#))
        let row = try await food().pantry().first!
        #expect(row.allergens == ["gluten": .traces])
        #expect(row.barcode == "5997001234567")
        #expect(row.source == "openfoodfacts")
        #expect(row.category == "grains")
        #expect(row.fiberG == 10)
        #expect(row.sugarG == nil)
        #expect(row.sharedFrom == "Anna")
    }

    @Test func aCatalogFoodGoesOnTheShelfAndKeepsItsFacts() async throws {
        stub.on("addPantryItemFromCatalog", .json(200, #"{"id":"\#(pantryId)","catalogId":"\#(catalogId)","kind":"food","name":"Zabpehely"}"#))
        let catalog = PantryRow(id: nil, catalogId: UUID(uuidString: catalogId), name: "Zabpehely", per: 100, unit: "g", kcal: 370, onShelf: false)
        let shelf = try await food().addFromCatalog(catalog)
        #expect(shelf.id == UUID(uuidString: pantryId))
        #expect(shelf.onShelf)
        #expect(shelf.kcal == 370)
        let body = (try? JSONSerialization.jsonObject(with: Data((stub.sent.last?.body ?? "").utf8))) as? [String: Any]
        #expect(body?["catalogId"] as? String == catalogId)
    }

    @Test func aUsualCarriesItsLatestMealsLinesAsDraftLinesAndAPartialLineIsMarked() async throws {
        stub.on("getUsualMeals", .json(200, #"{"usuals":[{"key":"lunch:csirke rizzsel","title":"Csirke rizzsel","slot":"lunch","count":3,"lastLoggedAt":"2026-11-12T11:00:00Z","mealId":"\#(pantryId)","kcal":365,"items":[{"source":"pantry","pantryItemId":"\#(pantryId)","amount":150,"unit":"g","name":"Csirkemell","per":100,"basisUnit":"g","kcal":110,"proteinG":23,"carbsG":0,"fatG":1.5,"nova":1},{"source":"estimate","amount":180,"unit":"g","name":"Rizs","per":100,"basisUnit":"g","kcal":123}]},{"key":"dinner:tojás","title":"Tojás","slot":"dinner","count":1,"lastLoggedAt":"2026-11-12T18:00:00Z","items":[]}]}"#))
        let list = try await food().usuals()
        let first = try #require(list.first)
        #expect(first.mealId == UUID(uuidString: pantryId))
        #expect(first.kcal == 365)
        #expect(first.items.map(\.name) == ["Csirkemell", "Rizs"])
        #expect(first.items[0].pantryItemId == UUID(uuidString: pantryId))
        #expect(first.items[0].contribution.kcal == 165)   // 150 g of a 110 kcal / 100 g line
        #expect(first.items[0].needsReview == false)
        // a snapshot that lacks macros is not a clean line
        #expect(first.items[1].needsReview)
        // a usual whose meal had no lines carries none: the composer falls back to the name and says so
        #expect(list[1].items.isEmpty)
        #expect(list[1].mealId == nil)
    }
}
