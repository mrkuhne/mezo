import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// B4 Task 15: the food rows on Ma's timeline, the meal photos in Napló, the "+" sheet's real food chips.
struct MaFoodRowsTests {
    private func window(_ slot: String, _ label: String, _ from: String, _ to: String, _ state: WindowState, kcal: Double = 600) -> PlanWindow {
        PlanWindow(slot: slot, label: label, from: from, to: to, budget: Macros(kcal: kcal, p: 40, c: 60, f: 20), state: state)
    }
    private func st(_ id: String, _ time: String, now: Bool = false) -> PathStation {
        PathStation(id: id, time: time, glyph: "spark-cream", title: id, sub: "", done: false, isNow: now)
    }
    private let groups = [SupplementGroup(key: "breakfast", label: "Reggeli mellé", count: 3, summary: "D3 · Omega-3"),
                          SupplementGroup(key: "dinner", label: "Vacsora mellé", count: 2, summary: "Magnézium")]

    @Test func timelineShowsTheNextWindowAndTheSupplementGroup() {
        let plan = FuelPlan(date: "2026-11-13", windows: [window("breakfast", "Reggeli", "07:00", "09:00", .done),
                                                           window("lunch", "Ebéd", "12:00", "14:00", .now, kcal: 640),
                                                           window("dinner", "Vacsora", "18:00", "20:00", .pending)], remaining: nil)
        let base = [st("sleep-night", "06:30"), st("checkin-midday", "11:00"), st("now", "12:10", now: true), st("session", "17:00")]
        let out = etelStations(base, plan: plan, groups: groups, taken: [])
        let ids = out.map(\.id)
        #expect(ids.contains("etel-window-lunch"))
        #expect(ids.contains("etel-supplements-breakfast"))
        let w = out.first { $0.id == "etel-window-lunch" }!
        #expect(w.title == "Ebéd" && w.time == "12:00" && w.sub.contains("640"))
        // the supplement group is the first one not taken yet; a moment keeps its glyph (no photo)
        #expect(!ids.contains("etel-supplements-dinner"))
        // clock order is kept: the window sits before the 17:00 session
        #expect(ids.firstIndex(of: "etel-window-lunch")! < ids.firstIndex(of: "session")!)
        #expect(out.count == base.count + 2)
    }

    @Test func aTakenGroupIsDoneAndTheNextOneTakesItsPlace() {
        let plan = FuelPlan(date: "2026-11-13", windows: [], remaining: nil)
        let out = etelStations([], plan: plan, groups: groups, taken: ["breakfast"])
        #expect(out.map(\.id) == ["etel-supplements-dinner"])
        let all = etelStations([], plan: plan, groups: groups, taken: ["breakfast", "dinner"])
        #expect(all.count == 1 && all[0].done && all[0].id == "etel-supplements-done")
    }

    @Test func noPlanNoGroupsNoRowsAndPastWindowsAreNotNext() {
        #expect(etelStations([st("a", "08:00")], plan: nil, groups: [], taken: []).count == 1)
        let plan = FuelPlan(date: "2026-11-13", windows: [window("breakfast", "Reggeli", "07:00", "09:00", .missed),
                                                           window("lunch", "Ebéd", "12:00", "14:00", .skipped)], remaining: nil)
        #expect(etelNextWindow(plan) == nil)
    }

    @Test func foodRowsOpenTheFuelRoom() {
        #expect(stationTap("etel-window-lunch") == .drill(.fuel))
        #expect(stationTap("etel-supplements-breakfast") == .drill(.fuel))
    }

    @Test func naploShowsOnlyTheMealsThatSayTheyHaveAPhoto() {
        func meal(_ photo: Bool) -> BoopCore.Meal {
            BoopCore.Meal(id: UUID(), slot: "lunch", loggedAt: Date(), mealDate: "2026-11-12", title: "Étel",
                          macros: Macros(kcal: 500, p: 30, c: 50, f: 15), score: nil, hasPhoto: photo)
        }
        let with = meal(true)
        let day = FoodDay(date: "2026-11-12", targets: MacroSet(kcal: 2350, p: 165, c: 250, f: 78, water: 3000),
                          consumed: MacroSet(kcal: 1000, p: 60, c: 100, f: 30, water: 0), meals: [meal(false), with])
        #expect(naploPhotoMeals(day).map(\.id) == [with.id])
        #expect(naploPhotoMeals(nil).isEmpty)
    }

    @Test func plusSheetFoodChipsAllOpenTheComposer() {
        let picks = CaptureSheet.foodChips.map(\.pick)
        #expect(picks == [.meal(.photo, text: ""), .meal(.text, text: ""), .meal(.barcode, text: ""), .meal(.recipe, text: ""), .meal(.pantry, text: "")])
        #expect(CaptureSheet.foodChips.map(\.title).prefix(4) == ["Fotó", "Szöveg", "Vonalkód", "Recept"])
    }
}
