import Foundation
import Testing
import BoopCore
@testable import Boop

/// The composer's drink mode (`mezo-r36n9.160`): whatever door the drink came through, it is saved with the drink
/// slot; the clock's window never wins.
@MainActor
struct MealComposerDrinkTests {
    private actor Saves { var slots: [String] = []; func add(_ s: String) { slots.append(s) } }
    private struct Drafter: MealDrafting {
        func draft(date: Date, text: String?, photo: Data?, barcode: String?) async throws -> MealDraft {
            MealDraft(date: "2026-11-24", slot: "snack", title: text,
                      items: [DraftItem(source: .estimate, name: "Zabtej", amount: 200, unit: "ml", per: 100, basisUnit: "ml",
                                        kcal: 45, proteinG: 1, carbsG: 7, fatG: 1.5)])
        }
    }

    private func model(_ saves: Saves, kind: MealKind) -> MealComposerModel {
        MealComposerModel(drafter: Drafter(), saver: { d, _, at in
            await saves.add(d.slot)
            return BoopCore.Meal(id: UUID(), slot: d.slot, loggedAt: at, mealDate: d.date, title: d.title, macros: d.total, score: nil, hasPhoto: false)
        }, outbox: nil, kind: kind)
    }

    @Test func aTypedDrinkIsSavedAsADrink() async {
        let saves = Saves()
        let m = model(saves, kind: .drink)
        m.text = "gombakávé zabtejjel mézzel"
        await m.submit()
        #expect(m.draft?.slot == "drink")
        _ = await m.save()
        #expect(await saves.slots == ["drink"])
    }

    @Test func aMealKeepsTheDraftersWindow() async {
        let saves = Saves()
        let m = model(saves, kind: .meal)
        m.text = "alma"
        await m.submit()
        #expect(m.draft?.slot == "snack")
    }

    @Test func aUsualDrinkStaysADrinkAtAnyHour() async {
        let saves = Saves()
        let m = model(saves, kind: .drink)
        let usual = UsualMeal(key: "drink:fehérjeturmix", title: "Fehérjeturmix", slot: "drink", count: 3, lastLoggedAt: Date(),
                              mealId: nil, kcal: 180,
                              items: [DraftItem(source: .estimate, name: "Fehérjepor", amount: 30, unit: "g", per: 100, basisUnit: "g",
                                                kcal: 380, proteinG: 75, carbsG: 8, fatG: 6)])
        await m.chooseUsual(usual)
        #expect(m.draft?.slot == "drink")
        #expect(m.draft?.title == "Fehérjeturmix")
    }


    /// The Recept and Kamra doors in drink mode (the owner's addition to the spec): a recipe's serving or a shelf
    /// food picked on the Ital sheet is a drink too; on the meal sheet the clock's window stays.
    @Test func aRecipeOrShelfFoodThroughTheDrinkDoorIsADrink() {
        let m = model(Saves(), kind: .drink)
        m.use(DraftItem(source: .recipe, name: "Fehérjeturmix", amount: 1, unit: "adag", per: 1, basisUnit: "adag",
                        kcal: 180, proteinG: 30, carbsG: 8, fatG: 3))
        #expect(m.draft?.slot == "drink")
        let meal = model(Saves(), kind: .meal)
        meal.use(DraftItem(source: .pantry, name: "Alma", amount: 150, unit: "g", per: 100, basisUnit: "g",
                           kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2))
        #expect(meal.draft?.slot != "drink")
    }

    /// The chips above the words survive a visit to the Szokásos page: that page lists everything, the chips keep
    /// the drinks only.
    @Test func theDrinkChipsKeepOnlyDrinksAfterTheUsualsPage() async {
        let tea = UsualMeal(key: "drink:tea", title: "Tea", slot: "drink", count: 2, lastLoggedAt: Date(), mealId: nil, kcal: 5, items: [])
        let soup = UsualMeal(key: "lunch:leves", title: "Leves", slot: "lunch", count: 4, lastLoggedAt: Date(), mealId: nil, kcal: 300, items: [])
        let m = MealComposerModel(drafter: Drafter(), saver: { d, _, at in
            BoopCore.Meal(id: UUID(), slot: d.slot, loggedAt: at, mealDate: d.date, title: d.title, macros: d.total, score: nil, hasPhoto: false)
        }, usuals: { [tea, soup] }, outbox: nil, kind: .drink)
        await m.loadUsualDrinks()
        #expect(m.usualDrinks.map(\.key) == ["drink:tea"])
        m.show(.usuals)
        await m.loadLists()
        #expect(m.usuals?.count == 2)
        #expect(m.usualDrinks.map(\.key) == ["drink:tea"])
    }

    /// A drink card reopened from the Étel room (failed, or ready for a tap) opens the composer in drink mode.
    @Test func aDrinkCardReopensInDrinkMode() {
        let failed = PendingDraft(id: UUID(), capturedAt: Date(), date: "2026-11-24", text: "fehérjeturmix", barcode: nil,
                                  photoRef: nil, state: .failed("Nincs net"), kind: .drink)
        #expect(MealStart(entrance: .pick, card: failed).kind == .drink)
        let meal = PendingDraft(id: UUID(), capturedAt: Date(), date: "2026-11-24", text: "alma", barcode: nil, photoRef: nil, state: .waiting)
        #expect(MealStart(entrance: .pick, card: meal).kind == .meal)
        #expect(MealStart(entrance: .drink).kind == .drink)
    }
}
