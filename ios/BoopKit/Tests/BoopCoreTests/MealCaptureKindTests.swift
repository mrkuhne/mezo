import Foundation
import Testing
@testable import BoopCore

/// A drink captured without the net must come back as a drink (`mezo-r36n9.160`, Review Focus 1): the queued
/// capture carries its kind, an older queue without one is a meal, and the slot follows the kind.
struct MealCaptureKindTests {
    @Test func theKindRoundTripsAndDefaultsToMeal() throws {
        let drink = MealCapture(text: "gombakávé zabtejjel mézzel", kind: .drink)
        let data = try JSONEncoder().encode(drink)
        #expect(try JSONDecoder().decode(MealCapture.self, from: data).kind == .drink)
        let old = Data(#"{"text":"csirke rizzsel","barcode":null,"photoRef":null}"#.utf8)
        #expect(try JSONDecoder().decode(MealCapture.self, from: old).kind == .meal)
    }

    @Test func theSlotFollowsTheKind() {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        let tenThirty = cal.date(from: DateComponents(year: 2026, month: 11, day: 24, hour: 10, minute: 30))!
        #expect(FoodClient.slot(at: tenThirty, cal: cal, kind: .meal) == "snack")
        #expect(FoodClient.slot(at: tenThirty, cal: cal, kind: .drink) == "drink")
        #expect(MealKind.drink.fixedSlot == "drink")
        #expect(MealKind.meal.fixedSlot == nil)
    }
}
