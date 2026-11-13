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

    @Test func everyPlusSheetFoodChipRoutesToItsComposerEntrance() {
        // pick -> MealStart (what the shell opens) -> the composer's first stage
        func stage(_ pick: CapturePick) -> MealComposerModel.Stage? { pick.mealStart?.entrance.openingStage }
        let byTitle = Dictionary(uniqueKeysWithValues: CaptureSheet.foodChips.map { ($0.title, $0.pick) })
        #expect(CaptureSheet.foodChips.map(\.title) == ["Fotó", "Szöveg", "Vonalkód", "Recept", "Kamra"])
        #expect(byTitle["Vonalkód"]!.mealStart?.entrance == .barcode)
        #expect(stage(byTitle["Vonalkód"]!) == .barcode)
        #expect(stage(byTitle["Recept"]!) == .recipes)
        #expect(stage(byTitle["Kamra"]!) == .pantry)
        #expect(byTitle["Fotó"]!.mealStart?.entrance == .photo && byTitle["Szöveg"]!.mealStart?.entrance == .text)
        #expect(CapturePick.soon("Súly").mealStart == nil && CapturePick.cover(.checkin).mealStart == nil)
    }

    @Test func aGuessedSupplementClockIsHedgedAndAnUnknownDaypartHasNone() {
        let plan = FuelPlan(date: "2026-11-13", windows: [], remaining: nil)
        let wake = etelStations([], plan: plan, groups: [SupplementGroup(key: "wake", label: "Ébredéskor", count: 1, summary: "D3")], taken: [])
        #expect(wake[0].time == "~07:00")
        let odd = etelStations([st("a", "08:00")], plan: plan, groups: [SupplementGroup(key: "zzz", label: "Zzz", count: 1, summary: "x")], taken: [])
        #expect(odd.last?.id == "etel-supplements-zzz" && odd.last?.time == "")
        // a daypart tied to a plan window takes the window's start, still hedged
        let withWindow = FuelPlan(date: "2026-11-13", windows: [window("breakfast", "Reggeli", "07:30", "09:00", .done)], remaining: nil)
        let b = etelStations([], plan: withWindow, groups: [groups[0]], taken: [])
        #expect(b[0].time == "~07:30")
    }

    @Test func naploSaysWhyThereIsNoPhoto() {
        #expect(naploPhotoNote(loaded: false, failed: false, mealCount: 0, photoMeals: 0, photosMissing: 0) == "Az étkezések betöltése folyamatban")
        #expect(naploPhotoNote(loaded: true, failed: true, mealCount: 0, photoMeals: 0, photosMissing: 0) == "Az étkezéseid képeit most nem látom.")
        #expect(naploPhotoNote(loaded: true, failed: false, mealCount: 3, photoMeals: 0, photosMissing: 0) == "Erről a napról nincs étkezési fotód.")
        #expect(naploPhotoNote(loaded: true, failed: false, mealCount: 0, photoMeals: 0, photosMissing: 0) == nil)
        #expect(naploPhotoNote(loaded: true, failed: false, mealCount: 3, photoMeals: 2, photosMissing: 1) == "Egy-két képet most nem tudtam betölteni.")
        #expect(naploPhotoNote(loaded: true, failed: false, mealCount: 3, photoMeals: 2, photosMissing: 0) == nil)
    }
}
