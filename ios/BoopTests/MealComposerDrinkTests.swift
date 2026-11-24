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
}
