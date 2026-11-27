import Foundation
import Testing
import BoopCore
@testable import Boop

/// mezo-r36n9.184 — deleting a logged meal: it goes at once, Visszavonás brings it back without the server, the server
/// call fires once on commit, and a refused delete puts everything back.
@MainActor
struct EtelStoreDeleteTests {
    let transport = ScriptedTransport()
    let mealA = "5b0e8a52-1c3d-4e0e-9a52-7d9d4c1a0b01", mealB = "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c02"

    private func meal(_ id: String, _ at: String, kcal: Int) -> String {
        #"{"id":"\#(id)","slot":"lunch","loggedAt":"2026-11-13T\#(at):00+01:00","mealDate":"2026-11-13","title":"Étel","macros":{"kcal":\#(kcal),"p":30,"c":50,"f":15},"score":{"value":0.8},"items":[],"hasPhoto":false}"#
    }

    private func loaded() async -> EtelStore {
        transport.on("getFuelDay", 200, #"{"date":"2026-11-13","targets":{"kcal":2400,"p":150,"c":260,"f":70,"water":2500},"consumed":{"kcal":1000,"p":60,"c":100,"f":30,"water":500},"meals":[\#(meal(mealA, "08:00", kcal: 400)),\#(meal(mealB, "12:40", kcal: 600))],"skippedKcal":0}"#)
        transport.on("getFuelPlan", 200, #"{"date":"2026-11-13","windows":[{"slot":"lunch","kind":"meal","label":"Ebéd","from":"12:00","to":"14:00","budget":{"kcal":700,"p":50,"c":80,"f":20},"state":"done","loggedMealIds":["\#(mealB)"]}],"remaining":{"kcal":1400,"p":90,"c":160,"f":40}}"#)
        transport.on("getMealCoachForDay", 200, #"{"verdicts":[]}"#)
        transport.on("getProtocol", 200, #"{"active":null,"history":[]}"#)
        transport.on("getPantry", 200, #"{"ingredients":[],"imports":[],"suggestions":[],"stash":[]}"#)
        // Its own taken file and no reminders: never the process-global hub other suites drive in parallel.
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("etel-delete-\(UUID().uuidString)/supplements-taken.json")
        let store = EtelStore(taken: SupplementTakenStore(fileURL: file), tick: { _, _ in }, reminders: { nil })
        await store.load(food: FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)), now: Date())
        return store
    }

    private func b(_ s: EtelStore) throws -> BoopCore.Meal { try #require(s.day?.meals.first { $0.id.uuidString.lowercased() == mealB }) }

    @Test func removingTakesTheMealAndItsNumbersAtOnce() async throws {
        let store = await loaded(); let m = try b(store)
        #expect(store.removeLocally(m))
        #expect(store.day?.meals.map(\.id).contains(m.id) == false)
        #expect(store.day?.consumed.kcal == 400 && store.day?.consumed.p == 30)
        #expect(store.plan?.remaining?.kcal == 2000)
        #expect(store.plan?.windows.first?.loggedMealIds.isEmpty == true)
        #expect(store.isPendingDelete(m.id))
        #expect(!store.removeLocally(m))   // a second route for the same meal is a no-op
    }

    @Test func undoPutsEverythingBackWithoutTheServer() async throws {
        let store = await loaded(); let m = try b(store)
        let day = store.day, plan = store.plan
        store.removeLocally(m)
        store.undoDelete(m.id)
        #expect(store.day == day && store.plan == plan)
        #expect(transport.count("deleteMeal") == 0 && !store.isPendingDelete(m.id))
    }

    @Test func commitDeletesOnceEvenWhenAskedTwice() async throws {
        let store = await loaded(); let m = try b(store)
        transport.on("deleteMeal", 204)
        store.removeLocally(m)
        async let first = store.commitDelete(m.id)
        async let second = store.commitDelete(m.id)
        let (r1, r2) = await (first, second)
        #expect(r1 == nil && r2 == nil)
        #expect(transport.count("deleteMeal") == 1)
        #expect(!store.isPendingDelete(m.id))
        #expect(store.day?.meals.map(\.id).contains(m.id) == false)
    }

    @Test func aRefusedDeletePutsTheMealBack() async throws {
        let store = await loaded(); let m = try b(store)
        let day = store.day, plan = store.plan
        transport.on("deleteMeal", 500)
        store.removeLocally(m)
        let line = await store.commitDelete(m.id)
        #expect(line == "Nem sikerült törölni — visszatettem.")
        #expect(store.day == day && store.plan == plan)
    }

    @Test func aReloadWhileTheDeleteWaitsKeepsTheMealHidden() async throws {
        let store = await loaded(); let m = try b(store)
        store.removeLocally(m)
        await store.load(food: FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)), now: Date())
        #expect(store.day?.meals.map(\.id).contains(m.id) == false)
        #expect(store.day?.consumed.kcal == 400)
        store.undoDelete(m.id)
        #expect(store.day?.meals.count == 2 && store.day?.consumed.kcal == 1000)
    }

    @Test func commitAllSendsEveryWaitingDelete() async throws {
        let store = await loaded(); let m = try b(store)
        let a = try #require(store.day?.meals.first { $0.id != m.id })
        transport.on("deleteMeal", 204)
        store.removeLocally(m); store.removeLocally(a)
        await store.commitAllDeletes()
        #expect(transport.count("deleteMeal") == 2)
        #expect(store.day?.meals.isEmpty == true && store.day?.consumed.kcal == 0)
    }
}
