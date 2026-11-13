import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Kiegészítők list (B4 Task 14): the daypart groups, the one-tap tick, and — owner decision 18, the stack is stale —
/// adding, removing and re-dosing an item on the phone.
@MainActor
struct SupplementGroupTests {
    let transport = ScriptedTransport()
    let d3 = "dd805c3a-94b5-4080-9c3a-5f7fce9c8d09", omega = "ab036d4c-0aa1-4aa1-8c4b-6a8aaed0a00b", mag = "ee916d4b-a5c6-4191-ad4b-608d0fad9e0a"
    let pD3 = "22b49e70-d8f9-44c4-9a7e-93b1c0cdc12d", pOmega = "11a38d6f-c7e8-43b3-8f6d-82a0bfbcb01c", pMag = "ff027e5c-b6d7-42a2-be5c-719e1abeaf0b"
    let pNew = "9a8b7c6d-1111-4222-8333-444455556666", itemNew = "55556666-aaaa-4bbb-8ccc-ddddeeee0001"
    /// The protocol rows the scripted server holds; the handlers below read and change it like the real one.
    private final class Rows: @unchecked Sendable {
        private let lock = NSLock(); private var rows: [String]
        init(_ rows: [String]) { self.rows = rows }
        var all: [String] { lock.withLock { rows } }
        func add(_ r: String) { lock.withLock { rows.append(r) } }
        func remove(id: String) { lock.withLock { rows.removeAll { $0.contains(id) } } }
    }

    nonisolated private func row(_ id: String, _ pantry: String, _ slot: String, dose: String? = nil) -> String {
        #"{"id":"\#(id)","pantryItemId":"\#(pantry)","slotKey":"\#(slot)",\#(dose.map { "\"dose\":\"\($0)\"," } ?? "")"pinned":false,"placementSource":"user"}"#
    }

    private func store(_ initial: [String]) async -> (EtelStore, Rows) {
        let rows = Rows(initial)
        transport.on("getFuelDay", 200, #"{"date":"2026-11-13","targets":{"kcal":2400,"p":150,"c":260,"f":70,"water":2500},"consumed":{"kcal":0,"p":0,"c":0,"f":0,"water":0},"meals":[],"skippedKcal":0}"#)
        transport.on("getFuelPlan", 200, #"{"date":"2026-11-13","windows":[],"remaining":{"kcal":2400,"p":150,"c":260,"f":70}}"#)
        transport.on("getMealCoachForDay", 200, #"{"verdicts":[]}"#)
        transport.on("getProtocol") { _ in
            (200, #"{"active":{"id":"cc7f5b29-83a4-4f7f-8b29-4e6ebd8b7c08","version":1,"builtAt":"2026-11-01T06:00:00Z","status":"active","items":[\#(rows.all.joined(separator: ","))]},"history":[]}"#)
        }
        func stash(_ id: String, _ name: String, _ dose: String) -> String {
            #"{"id":"\#(id)","name":"\#(name)","brand":null,"type":"supplement","category":null,"dose":"\#(dose)","form":null,"protocol":"","timing":"","taken":false,"macros":{"kcal":0,"p":0,"c":0,"f":0},"catalogId":"\#(id)","catalogEditable":false}"#
        }
        transport.on("getPantry", 200, #"{"ingredients":[],"imports":[],"suggestions":[],"stash":[\#(stash(pD3, "D3-vitamin", "4000 NE")),\#(stash(pOmega, "Omega-3", "2 g")),\#(stash(pMag, "Magnézium", "400 mg")),\#(stash(pNew, "Cink", "15 mg"))]}"#)
        transport.on("logIntake") { body in (201, #"{"id":"\#(UUID().uuidString.lowercased())","pantryItemId":"\#(self.pD3)","takenAt":"2026-11-13T07:00:00Z","takenDate":"2026-11-13"}"#) }
        transport.on("deleteProtocolItem") { _ in (204, "") }
        let s = EtelStore()
        await s.load(food: FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)), now: Date())
        return (s, rows)
    }

    @Test func oneTapTicksTheWholeGroup() async {
        let (s, _) = await store([row(d3, pD3, "morning"), row(omega, pOmega, "morning"), row(mag, pMag, "evening", dose: "2 db")])
        #expect(s.groups.map(\.count) == [2, 1])
        let morning = s.groups[0]
        let toast = await s.toggle(morning)
        #expect(toast.contains("mind a 2"))
        #expect(transport.count("logIntake") == 2)
        let ticked = Set(transport.compactBodies("logIntake").compactMap { b in [pD3, pOmega].first { b.contains($0) } })
        #expect(ticked == [pD3, pOmega])
        #expect(s.isTaken(morning) && !s.isTaken(s.groups[1]))
    }

    @Test func droppingOneItemTicksTheRest() async {
        let (s, rows) = await store([row(d3, pD3, "morning"), row(omega, pOmega, "morning"), row(mag, pMag, "evening")])
        transport.on("deleteProtocolItem") { _ in rows.remove(id: self.d3); return (204, "") }
        #expect(await s.removeSupplement(UUID(uuidString: d3)!) == "Kivettem a listádról")
        #expect(transport.count("deleteProtocolItem") == 1)
        #expect(s.groups.first?.count == 1)
        _ = await s.toggle(s.groups[0])
        // exactly one intake, and it is the one that stayed
        #expect(transport.count("logIntake") == 1)
        let body = transport.compactBodies("logIntake")[0]
        #expect(body.contains(pOmega) && !body.contains(pD3))
    }

    @Test func itemCanBeAddedAndRemovedOnThePhone() async {
        let (s, rows) = await store([row(d3, pD3, "morning")])
        transport.on("createPantryItem") { _ in (201, #"{"id":"\#(self.pNew)","catalogId":"\#(self.pNew)","kind":"supplement","name":"Cink"}"#) }
        transport.on("addProtocolItem") { body in
            rows.add(self.row(self.itemNew, self.pNew, "bedtime", dose: "15 mg"))
            return (201, self.row(self.itemNew, self.pNew, "bedtime", dose: "15 mg"))
        }
        #expect(await s.addSupplement(name: "  Cink ", dose: "15 mg", slotKey: "bedtime") == "Cink a listádon")
        let created = transport.compactBodies("createPantryItem")[0]
        #expect(created.contains(#""kind":"supplement""#) && created.contains(#""name":"Cink""#))
        let added = transport.compactBodies("addProtocolItem")[0]
        #expect(added.contains(pNew) && added.contains(#""slotKey":"bedtime""#) && added.contains(#""dose":"15 mg""#))
        #expect(s.groups.map(\.key) == ["morning", "bedtime"])
        #expect(s.protocolRows.first { $0.id == UUID(uuidString: itemNew) }?.name == "Cink")

        transport.on("patchProtocolItem") { body in (200, self.row(self.itemNew, self.pNew, "bedtime", dose: "30 mg")) }
        #expect(await s.setSupplementDose(UUID(uuidString: itemNew)!, dose: "30 mg") == "Az adag: 30 mg")
        #expect(transport.compactBodies("patchProtocolItem")[0].contains(#""dose":"30 mg""#))

        transport.on("deleteProtocolItem") { _ in rows.remove(id: self.itemNew); return (204, "") }
        _ = await s.removeSupplement(UUID(uuidString: itemNew)!)
        #expect(s.groups.map(\.key) == ["morning"])
    }

    @Test func aNameAlreadyOnTheListOrABlankOneIsNotAdded() async {
        let (s, _) = await store([row(d3, pD3, "morning")])
        #expect(await s.addSupplement(name: "   ", dose: "", slotKey: "evening") == "Írd be a kiegészítő nevét")
        #expect(await s.addSupplement(name: "d3-vitamin", dose: "", slotKey: "evening") == "D3-vitamin már a listádon van")
        #expect(transport.count("createPantryItem") == 0 && transport.count("addProtocolItem") == 0)
    }

    @Test func aRefusedRemovalLeavesTheListAsItWasAndSaysSo() async {
        let (s, _) = await store([row(d3, pD3, "morning")])
        transport.on("deleteProtocolItem", 500)
        #expect(await s.removeSupplement(UUID(uuidString: d3)!).contains("Nem sikerült"))
        #expect(s.groups.first?.count == 1)
    }

    @Test func theRealDaypartKeysGetHungarianNamesInDayOrder() {
        let items = ["bedtime", "wake", "post_workout", "breakfast"].enumerated().map { n, key in
            ProtocolItem(id: UUID(), pantryItemId: UUID(), slotKey: key)
        }
        let groups = supplementGroups(items, names: [:])
        #expect(groups.map(\.key) == ["wake", "breakfast", "post_workout", "bedtime"])
        #expect(groups.map(\.label) == ["Ébredéskor", "Reggeli mellé", "Edzés után", "Lefekvés előtt"])
    }
}
