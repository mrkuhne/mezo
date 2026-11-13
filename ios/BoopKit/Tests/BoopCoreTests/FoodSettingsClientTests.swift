import Foundation
import Testing
@testable import BoopCore

private let pantryId = "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c02"
private let itemId = "dd805c3a-94b5-4080-9c3a-5f7fce9c8d09"

private func compact(_ body: String?) -> String {
    guard let data = body?.data(using: .utf8), let obj = try? JSONSerialization.jsonObject(with: data),
          let out = try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys, .withoutEscapingSlashes]) else { return body ?? "" }
    return String(decoding: out, as: UTF8.self)
}

/// The settings, kímélő and supplement-list operations (B4 Task 14): what goes on the wire for each.
@MainActor
struct FoodSettingsClientTests {
    let stub = StubTransport()
    let tokens = MemoryTokenStore()
    func food() throws -> FoodClient {
        try tokens.write("t0")
        let tz = TimeZone(identifier: "Europe/Budapest")!
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        return FoodClient(client: makeClient(tokens: tokens, transport: stub, timeZone: tz), calendar: cal)
    }

    @Test func aDraftIsPreviewedWithoutBeingSavedAndOnlyACustomSplitSendsItsShares() async throws {
        stub.on("previewDietSettings", .json(200, #"{"kcal":2650,"proteinG":205,"carbsG":280,"fatG":75,"source":"goal"}"#))
        stub.on("previewDietSettings", .json(200, #"{"kcal":2400,"proteinG":150,"carbsG":260,"fatG":70,"source":"config"}"#))
        let f = try food()
        var draft = DietSettings(proteinTier: "high", proteinPctX10: 300, carbsPctX10: 400, fatPctX10: 300)
        let p = try await f.previewDietSettings(draft)
        #expect(p == DietPreview(kcal: 2650, proteinG: 205, carbsG: 280, fatG: 75, fromGoal: true))
        #expect(!stub.ops.contains("setDietSettings"))
        // a preset split must not carry stale custom shares
        #expect(stub.sent[0].body?.contains("proteinPctX10") == false)
        draft.splitPreset = "custom"
        let config = try await f.previewDietSettings(draft)
        #expect(config.fromGoal == false)
        #expect(compact(stub.sent[1].body).contains(#""proteinPctX10":300"#) == true)
    }

    @Test func savingDietAndFuelSettingsReadsBackTheStoredValues() async throws {
        stub.on("setDietSettings", .json(200, #"{"splitPreset":"low_carb","proteinTier":"high","waterMl":3000,"fiberG":35,"dayTypeShiftKcal":100,"learningEnabled":false}"#))
        stub.on("setFuelSettings", .json(200, #"{"mealsPerDay":4,"caffeineCutoff":"13:30"}"#))
        stub.on("getFuelSettings", .json(200, #"{"mealsPerDay":5,"caffeineCutoff":"14:00"}"#))
        let f = try food()
        let diet = try await f.setDietSettings(DietSettings(splitPreset: "low_carb", proteinTier: "high", waterMl: 3000, fiberG: 35, dayTypeShiftKcal: 100, learningEnabled: false))
        #expect(diet.splitPreset == "low_carb" && diet.waterMl == 3000 && diet.learningEnabled == false && diet.dayTypeShiftKcal == 100)
        #expect(try await f.fuelSettings() == FuelSettings(mealsPerDay: 5, caffeineCutoff: "14:00"))
        #expect(try await f.setFuelSettings(FuelSettings(mealsPerDay: 4, caffeineCutoff: "13:30")).caffeineCutoff == "13:30")
        stub.on("setDietSettings", .status(400))
        await #expect(throws: FoodFetchError.rejected) { _ = try await f.setDietSettings(DietSettings()) }
    }

    @Test func theSupplementListIsEditedThroughThePantryAndTheProtocol() async throws {
        stub.on("createPantryItem", .json(201, #"{"id":"\#(pantryId)","catalogId":"\#(pantryId)","kind":"supplement","name":"Cink"}"#))
        stub.on("addProtocolItem", .json(201, #"{"id":"\#(itemId)","pantryItemId":"\#(pantryId)","slotKey":"bedtime","dose":"15 mg","pinned":true,"placementSource":"user"}"#))
        stub.on("patchProtocolItem", .json(200, #"{"id":"\#(itemId)","pantryItemId":"\#(pantryId)","slotKey":"bedtime","dose":"30 mg","pinned":true,"placementSource":"user"}"#))
        stub.on("deleteProtocolItem", .status(204))
        stub.on("deleteProtocolItem", .status(404))
        let f = try food()
        let made = try await f.createSupplement(name: " Cink ", dose: "15 mg")
        #expect(made == UUID(uuidString: pantryId))
        #expect(compact(stub.sent[0].body).contains(#""kind":"supplement""#) == true && compact(stub.sent[0].body).contains(#""name":"Cink""#) == true)
        let item = try await f.addProtocolItem(pantryItemId: made, slotKey: "bedtime", dose: "15 mg")
        #expect(item.slotKey == "bedtime" && item.dose == "15 mg")
        #expect(try await f.setProtocolDose(item.id, dose: "30 mg").dose == "30 mg")
        #expect(stub.sent[2].path.hasSuffix("/api/fuel/protocol/items/\(itemId)"))
        try await f.removeProtocolItem(item.id)
        try await f.removeProtocolItem(item.id)   // already gone counts as removed
    }

    @Test func kimeloModeOnlyOpensSeriousCategoriesAndAnOldPeriodEndsWithBetter() async throws {
        let f = try food()
        await #expect(throws: FoodFetchError.rejected) { try await f.startKimelo(.tired) }
        #expect(stub.ops.isEmpty)
        stub.on("getRecovery", .json(200, #"{"period":{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","category":"ILLNESS","estimate":"TODAY","startDate":"2026-11-10","dayIndex":4,"estimateExpired":false,"checkedInToday":false,"releasedDates":[],"releasedUnlightened":[]},"protectedDates":[]}"#))
        let period = try #require(try await f.recovery())
        #expect(period == KimeloPeriod(category: "ILLNESS", startDate: "2026-11-10", dayIndex: 4))
        stub.on("recoveryCheckIn", .json(200, #"{"protectedDates":[]}"#))
        try await f.endKimelo(period, today: Date(timeIntervalSince1970: 1_794_000_000))
        #expect(stub.ops.last == "recoveryCheckIn")
        // a period that already ended is no open kímélő mode
        stub.on("getRecovery", .json(200, #"{"period":{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","category":"ILLNESS","estimate":"TODAY","startDate":"2026-11-10","endedOn":"2026-11-13","dayIndex":4,"estimateExpired":false,"checkedInToday":true,"releasedDates":[],"releasedUnlightened":[]},"protectedDates":[]}"#))
        #expect(try await f.recovery() == nil)
    }
}
