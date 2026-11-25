import Foundation
import Testing
import BoopCore
@testable import Boop

/// Drinks on the Étel room's day (`mezo-r36n9.160`): never a window's row, their own ITALOK group, counted in the
/// energy but not among „étkezés a tervből".
struct EtelDrinkRowsTests {
    private func meal(_ slot: String, _ title: String, kcal: Double, hour: Int) -> BoopCore.Meal {
        let at = Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 24, hour: hour))!
        return BoopCore.Meal(id: UUID(), slot: slot, loggedAt: at, mealDate: "2026-11-24", title: title,
                             macros: Macros(kcal: kcal, p: 10, c: 10, f: 5), score: slot == "drink" ? nil : 0.7, hasPhoto: false)
    }

    private func day(_ meals: [BoopCore.Meal]) -> FoodDay {
        FoodDay(date: "2026-11-24", targets: MacroSet(kcal: 2400, p: 150, c: 260, f: 70, water: 2500),
                consumed: MacroSet(kcal: 695, p: 32, c: 86, f: 16, water: 500), meals: meals)
    }

    @Test func drinksLeaveTheWindowsAndFormTheirOwnGroup() {
        let coffee = meal("drink", "Gombakávé", kcal: 95, hour: 9)
        let lunch = meal("lunch", "Csirke rizzsel", kcal: 600, hour: 13)
        let shake = meal("drink", "Fehérjeturmix", kcal: 180, hour: 16)
        let d = day([shake, lunch, coffee])
        let plan = FuelPlan(date: "2026-11-24", windows: [], remaining: nil)
        let items = etelWindowItems(plan: plan, day: d)
        #expect(items.count == 1)
        #expect(etelDrinks(d).map(\.title) == ["Gombakávé", "Fehérjeturmix"])
        #expect(etelDrinkKcal(d) == 275)
        #expect(etelSlotLabel("drink") == "Ital")
        #expect(etelStats(day: d, plan: plan)[2].value == "1")
    }
}
