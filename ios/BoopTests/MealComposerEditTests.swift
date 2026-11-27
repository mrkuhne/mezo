import Foundation
import Testing
import BoopCore
@testable import Boop

/// mezo-r36n9.184 — the composer correcting a logged meal: it opens on the draft, saves to the same meal, keeps the time.
actor EditCalls {
    var updated: [(UUID, MealDraft, Date)] = []
    var created = 0
    var fail: FoodFetchError?
    func setFail(_ e: FoodFetchError?) { fail = e }
    func update(_ id: UUID, _ d: MealDraft, _ at: Date) throws { if let fail { throw fail }; updated.append((id, d, at)) }
    func create() { created += 1 }
}

@MainActor
struct MealComposerEditTests {
    let calls = EditCalls()
    let mealCalls = MealCalls()
    let dir: URL = {
        let d = FileManager.default.temporaryDirectory.appendingPathComponent("boop-edit-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    let moment = Date(timeIntervalSince1970: 1_794_000_000)
    let logged = Date(timeIntervalSince1970: 1_794_000_000 - 3 * 3600)

    private func meal() -> BoopCore.Meal {
        BoopCore.Meal(id: UUID(), slot: "lunch", loggedAt: logged, mealDate: "2026-11-13", title: "Ebéd",
                      macros: Macros(kcal: 318, p: 11, c: 46, f: 10), score: 70,
                      items: [MealItem(name: "Zab", source: "estimate", amount: 60, unit: "g", contribution: Macros(kcal: 228, p: 8, c: 40, f: 4), nova: 1),
                              MealItem(name: "Saláta", source: "estimate", amount: 150, unit: "g", contribution: Macros(kcal: 90, p: 3, c: 6, f: 6), nova: 1)],
                      hasPhoto: true)
    }

    private func box() -> FoodOutbox {
        let drafter = MealDrafter(calls: mealCalls)
        return FoodOutbox(outbox: Outbox(directory: dir, sender: MealDraftSender(drafter: drafter, directory: dir)), directory: dir)
    }

    private func model(_ outbox: FoodOutbox) -> MealComposerModel {
        let c = calls
        return MealComposerModel(
            drafter: MealDrafter(calls: mealCalls),
            saver: { d, _, at in
                await c.create()
                return BoopCore.Meal(id: UUID(), slot: d.slot, loggedAt: at, mealDate: d.date, title: d.title, macros: d.total, score: nil)
            },
            updater: { id, d, at in try await c.update(id, d, at) },
            outbox: outbox, online: { true }, clock: { moment })
    }

    @Test func editingOpensOnTheDraftAtTheMealsOwnTime() {
        let m = model(box()); let meal = meal()
        m.beginEdit(meal)
        #expect(m.stage == .draft && m.isEditing)
        #expect(m.draft?.items.count == 2 && m.capturedAt == logged)
    }

    @Test func saveUpdatesTheSameMealOnceAndNeverCreatesOrParks() async throws {
        let outbox = box(); let m = model(outbox); let meal = meal()
        m.beginEdit(meal)
        m.remove(1)
        m.draft?.items[0].amount = 120
        let outcome = await m.save()
        #expect(outcome == .saved("Ebéd javítva · 456 kcal"))
        let updated = await calls.updated
        #expect(updated.count == 1 && updated[0].0 == meal.id && updated[0].2 == logged)
        #expect(updated[0].1.items.map(\.name) == ["Zab"] && updated[0].1.items[0].amount == 120)
        #expect(await calls.created == 0)
        #expect(await outbox.pendingDrafts().isEmpty)
    }

    @Test func aRefusedCorrectionSaysWhyAndAGoneMealSaysSo() async {
        let m = model(box()); m.beginEdit(meal())
        await calls.setFail(.rejected)
        guard case .failed = await m.save() else { Issue.record("expected failure"); return }
        await calls.setFail(.notFound)
        #expect(await m.save() == .failed("Ezt az étkezést közben törölted, nincs mit javítani."))
    }
}
