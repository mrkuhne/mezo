import Foundation
import Testing
@testable import BoopCore

private let mealId = "5b0e8a52-1c3d-4e0e-9a52-7d9d4c1a0b01"
private let pantryId = "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c02"

private func mealJSON(hasPhoto: Bool = false, loggedAt: String = "2026-11-13T08:15:00.123456+01:00") -> String {
    #"""
    {"id":"\#(mealId)","slot":"breakfast","loggedAt":"\#(loggedAt)","mealDate":"2026-11-13","title":"Zabkása",
     "macros":{"kcal":420,"p":24,"c":55,"f":12},"score":{"value":71},
     "items":[{"source":"pantry","amount":60,"unit":"g","lineOrder":0,"name":"Zabpehely","contribution":{"kcal":228,"p":8,"c":40,"f":4}}],
     "hasPhoto":\#(hasPhoto)}
    """#
}

private func planJSON() -> String {
    #"""
    {"date":"2026-11-13","windows":[
      {"slot":"breakfast","kind":"meal","label":"Reggeli","from":"07:00","to":"09:00","budget":{"kcal":600,"p":40,"c":70,"f":18},"state":"done","loggedMealIds":["\#(mealId)"]},
      {"slot":"snack","kind":"snack","label":"Tízórai","from":"10:00","to":"11:00","budget":{"kcal":200,"p":15,"c":20,"f":6},"state":"missed","loggedMealIds":[]},
      {"slot":"lunch","kind":"meal","label":"Ebéd","from":"12:00","to":"14:00","budget":{"kcal":700,"p":50,"c":80,"f":20},"state":"now","loggedMealIds":[],
       "suggestion":{"kind":"recipe","recipeId":"7d2a0c74-3e5f-4a2a-9c74-9f1f6e3c2d03","text":"Csirkés rizs","reason":"belefér a fehérjébe"}},
      {"slot":"snack","kind":"snack","label":"Uzsonna","from":"16:00","to":"17:00","budget":{"kcal":200,"p":15,"c":20,"f":6},"state":"pending","loggedMealIds":[]}],
     "remaining":{"kcal":1100,"p":80,"c":120,"f":32},"tip":{"text":"Ebédre fehérje.","reason":"kevés a fehérje"}}
    """#
}

private func fields(_ body: String?) -> [String: Any] {
    (try? JSONSerialization.jsonObject(with: Data((body ?? "").utf8)) as? [String: Any]) ?? [:]
}

@MainActor
struct FoodClientTests {
    let stub = StubTransport()
    let tokens = MemoryTokenStore()

    func food(_ zone: String = "Europe/Budapest") throws -> FoodClient {
        try tokens.write("t0")
        let tz = TimeZone(identifier: zone)!
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        return FoodClient(client: makeClient(tokens: tokens, transport: stub, timeZone: tz), calendar: cal)
    }
    func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 12, _ min: Int = 0) -> Date {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        return cal.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
    }

    @Test func decodesDayPlanWithWindows() async throws {
        stub.on("getFuelPlan", .json(200, planJSON()))
        let plan = try await food().plan(date(2026, 11, 13))
        #expect(stub.sent.first?.path == "/api/fuel/plan/2026-11-13")
        #expect(plan.windows.count == 4)
        #expect(plan.windows.map(\.state) == [.done, .missed, .now, .pending])
        #expect(plan.windows[0].loggedMealIds == [UUID(uuidString: mealId)!])
        #expect(plan.windows[2].suggestion?.kind == .recipe)
        #expect(plan.remaining?.kcal == 1100)
        #expect(plan.tip?.text == "Ebédre fehérje.")
    }

    @Test func dayDecodesMealsWithPhotoFlag() async throws {
        stub.on("getFuelDay", .json(200, #"""
        {"date":"2026-11-13","targets":{"kcal":2400,"p":150,"c":260,"f":70,"water":2500},"consumed":{"kcal":420,"p":24,"c":55,"f":12,"water":500},
         "meals":[\#(mealJSON(hasPhoto: true))],"skippedKcal":0}
        """#))
        let day = try await food().day(date(2026, 11, 13))
        #expect(day.meals.first?.hasPhoto == true)
        #expect(day.meals.first?.macros.kcal == 420)
        #expect(day.targets.water == 2500)
        #expect(day.fuelMode == nil)
    }

    @Test func dayCarriesTheScoreBreakdownAndCoachWordsDecode() async throws {
        let meal = #"""
        {"id":"\#(mealId)","slot":"lunch","loggedAt":"2026-11-13T12:40:00+01:00","mealDate":"2026-11-13","title":"Lazac",
         "macros":{"kcal":640,"p":42,"c":55,"f":24},
         "score":{"value":0.82,"breakdown":{"value":0.82,"confidence":0.9,"tagline":"Jó ebéd","improve":[],"tools":[],
           "dimensions":[
             {"id":"macro","label":"Kcal & makró arány","weight":0.3,"score":0.86,"detail":"A fehérje a helyén.","coverage":1,"note":"Szép arány."},
             {"id":"context","label":"Időzítés & kontextus","weight":0,"score":0,"detail":"Ehhez kevés az adat."}]}},
         "items":[],"hasPhoto":false}
        """#
        stub.on("getFuelDay", .json(200, #"{"date":"2026-11-13","targets":{"kcal":2400,"p":150,"c":260,"f":70,"water":2500},"consumed":{"kcal":640,"p":42,"c":55,"f":24,"water":0},"meals":[\#(meal)],"skippedKcal":0}"#))
        let b = try #require(try await food().day(date(2026, 11, 13)).meals.first?.breakdown)
        #expect(b.tagline == "Jó ebéd")
        #expect(b.dimensions.map(\.id) == ["macro", "context"])
        #expect(b.dimensions[0].points == 86 && b.dimensions[0].note == "Szép arány." && b.dimensions[0].coverage == 1)
        #expect(b.dimensions[1].points == nil)                      // weight 0 = degraded = "nincs adat", never 0

        stub.on("getMealCoachForDay", .json(200, #"""
        {"verdicts":[{"mealId":"\#(mealId)","tagline":"t","summary":"Jó kezdés.","improve":[{"text":"több rost","impact":"+6"}],
          "dimensionNotes":{"macro":"A fehérje jó."},"glucoseTips":[{"title":"Laposabb","body":"Tegyél bele chiamagot."}]}]}
        """#))
        let coach = try await food().coach(date(2026, 11, 13))
        let c = try #require(coach[UUID(uuidString: mealId)!])
        #expect(c.summary == "Jó kezdés." && c.dimensionNotes["macro"] == "A fehérje jó.")
        #expect(c.glucoseTips == [GlucoseTip(title: "Laposabb", body: "Tegyél bele chiamagot.")])
        #expect(stub.sent.last?.path.contains("/api/meal/coach") == true)
    }

    @Test func draftCarriesBarcodeAndPhoto() async throws {
        stub.on("lookupPantryItem", .json(200, #"""
        {"source":"OFF","results":[{"name":"Protein szelet","brand":"Márka","barcode":"5997001234567","per":100,"unit":"g",
          "kcal":380,"proteinG":30,"carbsG":35,"fatG":12,"nova":4,"allergens":{"milk":"contains","nuts":"traces","soybeans":"unknown"},
          "servingSize":"40 g","servingQuantity":40}]}
        """#))
        stub.on("draftMealFromAi", .json(200, #"{"draftId":"8e3b1d85-4f60-4b3b-8d85-0a2a7f4d3e04","slot":"snack","title":"Almás","items":[{"source":"estimate","name":"Alma","amount":1,"unit":"db","per":1,"basisUnit":"db","kcal":80,"proteinG":0,"carbsG":20,"fatG":0,"confidence":0.6,"needsReview":true}]}"#))
        let photo = Data("JPEGBYTES".utf8)
        let draft = try await food().draft(date: date(2026, 11, 13), text: "egy alma", photo: photo, barcode: "5997001234567")
        #expect(draft.barcode == "5997001234567")
        #expect(draft.photo == photo)
        #expect(draft.slot == "snack")
        #expect(draft.items.count == 2)
        #expect(draft.items[0].name == "Alma")
        #expect(draft.items[0].needsReview)
        let scanned = draft.items[1]
        #expect(scanned.name == "Protein szelet")
        #expect(scanned.source == .estimate)
        #expect(scanned.amount == 40 && scanned.unit == "g")        // the label's serving, in grams
        #expect(scanned.allergens["milk"] == .contains)
        let body = try #require(stub.sent.first { $0.op == "draftMealFromAi" }?.body)
        #expect(body.contains("JPEGBYTES") && body.contains("egy alma") && body.contains("2026-11-13"))
    }

    @Test func draftWithBarcodeOnlyDoesNotCallTheModel() async throws {
        stub.on("lookupPantryItem", .json(200, #"{"source":"CATALOG","results":[{"name":"Zabpehely","per":100,"unit":"g","kcal":370,"proteinG":13,"carbsG":60,"fatG":7}]}"#))
        let draft = try await food().draft(date: date(2026, 11, 13), text: nil, photo: nil, barcode: "5997001234567")
        #expect(stub.ops == ["lookupPantryItem"])
        #expect(draft.items.count == 1)
        #expect(draft.items[0].amount == 100 && draft.items[0].unit == "g")   // catalog hit: no serving, grams
    }

    @Test func lookupMarksSourceAndDefaultsServingToGrams() async throws {
        stub.on("lookupPantryItem", .json(200, #"{"source":"CATALOG","results":[{"name":"Zabpehely","per":100,"unit":"g","kcal":370}]}"#))
        stub.on("lookupPantryItem", .json(200, #"{"source":"NONE","results":[]}"#))
        let f = try food()
        let hit = try await f.lookup(barcode: "5997001234567")
        #expect(hit.source == .catalog)
        #expect(hit.results[0].servingQuantity == nil)
        #expect(hit.results[0].defaultServing == FoodAmount(amount: 100, unit: "g"))
        #expect(stub.sent.first?.path.contains("q=5997001234567") == true)
        let none = try await f.lookup(barcode: "0000000000000")
        #expect(none.source == .none && none.results.isEmpty)
    }

    @Test func saveSendsClientRef() async throws {
        stub.on("createMeal", .json(201, mealJSON()))
        let ref = UUID(uuidString: "9f4c2e96-5071-4c4c-9e96-1b3b8a5e4f05")!
        let draft = MealDraft(date: "2026-11-13", slot: "breakfast", title: "Zabkása",
                              items: [DraftItem(source: .pantry, pantryItemId: UUID(uuidString: pantryId), name: "Zabpehely", amount: 60, unit: "g", per: 100, basisUnit: "g", kcal: 370, proteinG: 13, carbsG: 60, fatG: 7)])
        // 00:30 Budapest on the 13th is still the 12th in UTC: the stamp must keep the phone's offset.
        let meal = try await food().save(draft, clientRef: ref, capturedAt: date(2026, 11, 13, 0, 30))
        let body = try #require(stub.sent.first { $0.op == "createMeal" }?.body)
        #expect(fields(body)["clientRef"] as? String == ref.uuidString.lowercased())
        #expect(fields(body)["capturedAt"] as? String == "2026-11-13T00:30:00+01:00")
        #expect(!body.contains("2026-11-12T23:30:00Z"))
        #expect(meal.id == UUID(uuidString: mealId))
        #expect(!stub.ops.contains("putMealPhoto"))
    }

    @Test func saveWithoutCapturedAtStampsTheDraftsDayNeverUtcNow() async throws {
        stub.on("createMeal", .json(201, mealJSON())); stub.on("createMeal", .json(201, mealJSON()))
        let f = try food()
        let item = DraftItem(source: .estimate, name: "Alma", amount: 1, unit: "db", per: 1, basisUnit: "db", kcal: 80, proteinG: 0, carbsG: 20, fatG: 0)
        _ = try await f.save(MealDraft(date: f.ymd(Date()), slot: "snack", title: nil, items: [item]))
        let now = try #require(fields(stub.sent[0].body)["capturedAt"] as? String)
        #expect(now.hasSuffix("+01:00") || now.hasSuffix("+02:00"))
        // A draft for an earlier day lands on THAT day (noon, Budapest), not on today.
        _ = try await f.save(MealDraft(date: "2026-11-10", slot: "snack", title: nil, items: [item]))
        #expect(fields(stub.sent[1].body)["capturedAt"] as? String == "2026-11-10T12:00:00+01:00")
    }

    @Test func aFailedLookupKeepsTheModelsDraft() async throws {
        stub.on("draftMealFromAi", .json(200, #"{"draftId":"8e3b1d85-4f60-4b3b-8d85-0a2a7f4d3e04","slot":"snack","items":[{"source":"estimate","name":"Alma","amount":1,"unit":"db","per":1,"basisUnit":"db","kcal":80,"proteinG":0,"carbsG":20,"fatG":0,"confidence":0.6,"needsReview":true}]}"#))
        stub.on("lookupPantryItem", .status(502))
        let d = try await food().draft(date: date(2026, 11, 13), text: "alma", photo: nil, barcode: "5997001234567")
        #expect(d.items.count == 1 && d.barcode == "5997001234567")
        #expect(d.lookupFailed && d.lookupSource == nil)
    }

    @Test func aLookupWithNothingFoundIsToldApartFromNeverLooked() async throws {
        stub.on("lookupPantryItem", .json(200, #"{"source":"NONE","results":[]}"#))
        let f = try food()
        let looked = try await f.draft(date: date(2026, 11, 13), text: nil, photo: nil, barcode: "0000000000000")
        #expect(looked.lookupSource == LookupSource.none && !looked.lookupFailed && looked.items.isEmpty)
        stub.on("draftMealFromAi", .json(200, #"{"draftId":"8e3b1d85-4f60-4b3b-8d85-0a2a7f4d3e04","slot":"snack","items":[]}"#))
        let never = try await f.draft(date: date(2026, 11, 13), text: "alma", photo: nil, barcode: nil)
        #expect(never.lookupSource == nil && !never.lookupFailed)
    }

    @Test func deletingPhotosHitsTheRightOperations() async throws {
        stub.on("deleteMealPhoto", .status(204)); stub.on("deleteAllMealPhotos", .status(204))
        let f = try food()
        try await f.deletePhoto(mealId: UUID(uuidString: mealId)!)
        try await f.deleteAllPhotos()
        #expect(stub.sent[0].path == "/api/meal/\(mealId)/photo" && stub.sent[1].path == "/api/meal/photos")
    }

    @Test func savePutsThePhotoAfterTheMeal() async throws {
        stub.on("createMeal", .json(201, mealJSON()))
        stub.on("putMealPhoto", .json(200, #"{"bytes":9,"width":4,"height":3}"#))
        var draft = MealDraft(date: "2026-11-13", slot: "breakfast", title: nil,
                              items: [DraftItem(source: .estimate, name: "Alma", amount: 1, unit: "db", per: 1, basisUnit: "db", kcal: 80, proteinG: 0, carbsG: 20, fatG: 0)])
        draft.photo = Data("JPEGBYTES".utf8)
        let meal = try await food().save(draft)
        #expect(stub.ops == ["createMeal", "putMealPhoto"])
        #expect(stub.sent[1].path == "/api/meal/\(mealId)/photo")   // lowercase on the wire
        #expect(meal.hasPhoto)
    }

    @Test func waterSendsClientRefAndOffset() async throws {
        stub.on("logWater", .json(201, #"{"id":"aa5d3f07-6182-4d5d-8f07-2c4c9b6f5a06","date":"2026-11-13","amountMl":250}"#))
        let ref = UUID()
        try await food().water(ml: 250, date: date(2026, 11, 13), clientRef: ref, capturedAt: date(2026, 11, 13, 0, 30))
        let sent = fields(stub.sent.first?.body)
        #expect(sent["amountMl"] as? Int == 250 && sent["date"] as? String == "2026-11-13")
        #expect(sent["capturedAt"] as? String == "2026-11-13T00:30:00+01:00")
        #expect(sent["clientRef"] as? String == ref.uuidString.lowercased())
    }

    @Test func skipWritesTheMealKeyByIndexAmongSameKind() async throws {
        stub.on("upsertPlannedSkip", .json(200, #"{"id":"bb6e4a18-7293-4e6e-9a18-3d5dac7a6b07","date":"2026-11-13","kind":"MEAL","sessionKey":"snack#2","reasonCategory":"NOT_HUNGRY","source":"USER","serious":false,"freePass":false,"excused":false,"plannedKcal":200}"#))
        let plan = try await { () async throws -> FuelPlan in
            stub.on("getFuelPlan", .json(200, planJSON()))
            return try await food().plan(date(2026, 11, 13))
        }()
        try await food().skip(window: plan.windows[3], in: plan, reason: .notHungry)
        let sent = fields(stub.sent.last?.body)
        #expect(sent["sessionKey"] as? String == "snack#2" && sent["kind"] as? String == "MEAL")
        #expect(sent["reasonCategory"] as? String == "NOT_HUNGRY" && sent["plannedKcal"] as? Int == 200 && sent["date"] as? String == "2026-11-13")
    }

    @Test func tickGroupLogsEachItemOfTheDaypartWithItsOwnStableRef() async throws {
        let protocolJSON = #"""
        {"active":{"id":"cc7f5b29-83a4-4f7f-8b29-4e6ebd8b7c08","version":3,"builtAt":"2026-11-01T06:00:00Z","status":"active","items":[
          {"id":"dd805c3a-94b5-4080-9c3a-5f7fce9c8d09","pantryItemId":"\#(pantryId)","slotKey":"morning","dose":"1 db","pinned":false,"placementSource":"rule"},
          {"id":"ee916d4b-a5c6-4191-ad4b-608d0fad9e0a","pantryItemId":"ff027e5c-b6d7-42a2-be5c-719e1abeaf0b","slotKey":"morning","dose":"2 db","pinned":true,"placementSource":"user"},
          {"id":"0013 8f6d-c7e8-43b3-8f6d-82af2bcfb01c","pantryItemId":"11138f6d-c7e8-43b3-8f6d-82af2bcfb01d","slotKey":"evening","pinned":false,"placementSource":"rule"}]},"history":[]}
        """#.replacingOccurrences(of: "0013 8f6d", with: "00138f6d")
        let intake = #"{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","pantryItemId":"\#(pantryId)","takenAt":"2026-11-13T07:30:00Z","takenDate":"2026-11-13"}"#
        stub.on("getProtocol", .json(200, protocolJSON))
        stub.on("logIntake", .json(201, intake)); stub.on("logIntake", .json(201, intake))
        let ref = UUID(uuidString: "9f4c2e96-5071-4c4c-9e96-1b3b8a5e4f05")!
        let n = try await food().tickGroup(daypart: "morning", clientRef: ref)
        #expect(n == 2)
        let bodies = stub.sent.filter { $0.op == "logIntake" }.compactMap(\.body)
        #expect(bodies.count == 2)
        let refs = bodies.map { fields($0)["clientRef"] as? String }
        #expect(refs[0] != nil && refs[0] != refs[1])
        // The same tap replayed after a lost answer derives the same refs, so the server's idempotency holds.
        #expect(FoodClient.derivedRef(ref, "dd805c3a-94b5-4080-9c3a-5f7fce9c8d09").uuidString.lowercased() == refs[0]?.lowercased())
    }

    @Test func tickGroupIntakesReturnTheServersIdsAndDeleteIntakeUndoesOne() async throws {
        let protocolJSON = #"""
        {"active":{"id":"cc7f5b29-83a4-4f7f-8b29-4e6ebd8b7c08","version":3,"builtAt":"2026-11-01T06:00:00Z","status":"active","items":[
          {"id":"dd805c3a-94b5-4080-9c3a-5f7fce9c8d09","pantryItemId":"\#(pantryId)","slotKey":"morning","pinned":false,"placementSource":"rule"}]},"history":[]}
        """#
        stub.on("getProtocol", .json(200, protocolJSON))
        stub.on("logIntake", .json(201, #"{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","pantryItemId":"\#(pantryId)","takenAt":"2026-11-13T07:30:00Z","takenDate":"2026-11-13"}"#))
        let ids = try await food().tickGroupIntakes(daypart: "morning")
        #expect(ids == [UUID(uuidString: "22249a7e-d8f9-44c4-9a7e-93b03cd0c12e")!])
        stub.on("deleteIntake", .status(204))
        try await food().deleteIntake(ids[0])
        #expect(stub.sent.last?.path == "/api/fuel/intake/entry/22249a7e-d8f9-44c4-9a7e-93b03cd0c12e")
        stub.on("deleteIntake", .status(404))
        try await food().deleteIntake(ids[0])                       // already gone counts as undone
        stub.on("deleteIntake", .status(500))
        await #expect(throws: FoodFetchError.self) { try await food().deleteIntake(ids[0]) }
    }

    @Test func anIntakeIdThePhoneCannotReadFailsLoudlyInsteadOfKeepingAnEmptyList() async throws {
        stub.on("getProtocol", .json(200, #"{"active":{"id":"cc7f5b29-83a4-4f7f-8b29-4e6ebd8b7c08","version":1,"builtAt":"2026-11-01T06:00:00Z","status":"active","items":[{"id":"dd805c3a-94b5-4080-9c3a-5f7fce9c8d09","pantryItemId":"\#(pantryId)","slotKey":"morning","pinned":false,"placementSource":"rule"}]},"history":[]}"#))
        stub.on("logIntake", .json(201, #"{"id":"not-an-id","pantryItemId":"\#(pantryId)","takenAt":"2026-11-13T07:30:00Z","takenDate":"2026-11-13"}"#))
        await #expect(throws: FoodFetchError.server) { try await food().tickGroupIntakes(daypart: "morning") }
    }

    @Test func stashNamesTheSupplementsTheProtocolRowsPointAt() async throws {
        let macros = #"{"kcal":0,"p":0,"c":0,"f":0}"#
        stub.on("getPantry", .json(200, #"""
        {"ingredients":[],"imports":[],"suggestions":[],"stash":[
          {"id":"\#(pantryId)","name":"D3-vitamin","brand":null,"type":"supplement","category":null,"dose":"4000 NE","form":null,"protocol":"","timing":"","taken":false,"macros":\#(macros),"catalogId":"\#(pantryId)","catalogEditable":false},
          {"id":"ff027e5c-b6d7-42a2-be5c-719e1abeaf0b","name":"Magnézium","brand":null,"type":"supplement","category":null,"dose":"","form":null,"protocol":"","timing":"","taken":false,"macros":\#(macros),"catalogId":"\#(pantryId)","catalogEditable":false}]}
        """#))
        let rows = try await food().stash()
        #expect(rows == [StashRow(id: UUID(uuidString: pantryId)!, name: "D3-vitamin", dose: "4000 NE"),
                         StashRow(id: UUID(uuidString: "ff027e5c-b6d7-42a2-be5c-719e1abeaf0b")!, name: "Magnézium", dose: nil)])
    }

    @Test func photoIsNilWhenTheMealHasNone() async throws {
        stub.on("getMealPhoto", .status(404))
        let none = try await food().photo(mealId: UUID(uuidString: mealId)!)
        #expect(none == nil)
    }

    @Test func sensitivityRoundTripsLevelsAndAllergenStates() async throws {
        stub.on("getSensitivityProfile", .json(200, #"{"items":[{"key":"milk","level":"allergy"},{"key":"mustár ízű","level":"avoid","note":"nem szeretem"}],"novaRule":{"enabled":true,"maxLevel":2}}"#))
        let f = try food()
        let p = try await f.sensitivity()
        #expect(p.items.map(\.level) == [.allergy, .avoid])
        #expect(p.novaRule == NovaRule(enabled: true, maxLevel: 2))
        stub.on("setSensitivityProfile", .json(200, #"{"items":[],"novaRule":{"enabled":false,"maxLevel":2}}"#))
        _ = try await f.setSensitivity(SensitivityProfile(items: [SensitivityItem(key: "gluten", level: .intolerance, note: nil)], novaRule: NovaRule(enabled: false, maxLevel: 2)))
        let sent = fields(stub.sent.last?.body)
        let level = (sent["items"] as? [[String: Any]])?.first?["level"] as? String
        #expect(level == "intolerance" && (sent["novaRule"] as? [String: Any])?["enabled"] as? Bool == false)
        #expect(AllergenState(wire: "CONTAINS") == .contains)
        #expect(AllergenState(wire: "valami új") == .unknown)
    }

    @Test func unauthorizedAndOfflineAreTold() async throws {
        stub.on("getFuelPlan", .status(401))
        stub.on("getFuelPlan", .fail(URLError(.notConnectedToInternet)))
        let f = try food()
        await #expect(throws: FoodFetchError.unauthorized) { _ = try await f.plan(date(2026, 11, 13)) }
        await #expect(throws: FoodFetchError.offline) { _ = try await f.plan(date(2026, 11, 13)) }
    }

    @Test func recipeImportReturnsNilWhenNothingReadable() async throws {
        stub.on("importRecipeFromUrl", .json(200, #"{"result":null}"#))
        stub.on("importRecipeFromText", .json(200, #"{"result":{"name":"Gulyás","category":"lunch","servings":4,"steps":["Főzd meg."],"needsReview":true,"lines":[{"source":"estimate","name":"marhahús","amount":500,"unit":"g","match":{"catalogId":"33359b8f-e90a-45d5-8b8f-a4c13d1d0f2f","confidence":0.9,"needsReview":false},"sourceText":"50 dkg marhahús"}]}}"#))
        let f = try food()
        #expect(try await f.importRecipe(.url("https://pelda.hu/r")) == nil)
        let d = try #require(try await f.importRecipe(.text("Gulyás: 50 dkg marhahús")))
        #expect(d.name == "Gulyás" && d.lines[0].catalogId == UUID(uuidString: "33359b8f-e90a-45d5-8b8f-a4c13d1d0f2f"))
        #expect(d.needsReview && d.steps == ["Főzd meg."])
    }
}

struct SensitivityRulesTests {
    @Test func badgeForUnknownStateSaysNincsAdat() {
        for level in [SensitivityLevel.allergy, .intolerance, .avoid] {
            #expect(SensitivityRules.badge(for: nil, level: level)?.text == "nincs adat")
            #expect(SensitivityRules.badge(for: .unknown, level: level)?.text == "nincs adat")
        }
        // Never the word "free": an absent key is not a statement.
        #expect(SensitivityRules.badge(for: nil, level: .allergy)?.severity == .noData)
    }

    @Test func containsAndTracesFollowTheThreeLevels() {
        #expect(SensitivityRules.badge(for: .contains, level: .allergy)?.severity == .block)
        #expect(SensitivityRules.badge(for: .traces, level: .allergy)?.severity == .block)
        #expect(SensitivityRules.badge(for: .contains, level: .intolerance)?.severity == .warn)
        #expect(SensitivityRules.badge(for: .traces, level: .intolerance)?.severity == .notice)
        #expect(SensitivityRules.badge(for: .contains, level: .avoid)?.severity == .warn)
        #expect(SensitivityRules.badge(for: .traces, level: .avoid) == nil)
    }

    @Test func badgesWalkTheProfileAndSkipFreeTextKeys() {
        let profile = SensitivityProfile(items: [
            SensitivityItem(key: "milk", level: .allergy, note: nil),
            SensitivityItem(key: "gluten", level: .intolerance, note: nil),
            SensitivityItem(key: "paprika", level: .avoid, note: nil)],
            novaRule: NovaRule(enabled: true, maxLevel: 2))
        let badges = SensitivityRules.badges(allergens: ["milk": .contains], profile: profile)
        #expect(badges.map(\.key) == ["milk", "gluten"])
        #expect(badges[1].text == "nincs adat")
    }
}
