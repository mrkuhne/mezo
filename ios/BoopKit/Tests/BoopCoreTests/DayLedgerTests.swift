import Foundation
import Testing
@testable import BoopCore

func temporaryDirectory() -> URL {
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent("boop-tests-\(UUID().uuidString)")
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
}

@MainActor
struct DayLedgerTests {
    let dir = temporaryDirectory()
    let date = "2026-11-10"

    func checkIn(_ slot: String, _ h: Int, _ m: Int, energy: Int?, pending: Bool = false) -> LedgerCheckIn {
        LedgerCheckIn(id: UUID(), slot: slot, capturedAt: at(h, m), values: energy.map { ["energy": $0] } ?? [:],
                      pending: pending)
    }

    @Test func pendingLocalCheckInWinsOverServer() {
        let store = LedgerStore(directory: dir)
        let local = checkIn("10:00", 12, 40, energy: 7, pending: true)
        store.saveCheckIn(local, date: date)
        var server = DayLedger(date: date)
        server.checkIns = [checkIn("10:00", 11, 0, energy: 3), checkIn("06:30", 8, 0, energy: 5)]
        store.merge(server: server)
        let merged = store.ledger(for: date)
        #expect(merged.checkIns.count == 2)
        #expect(merged.checkIns.first { $0.slot == "10:00" } == local)
        #expect(merged.checkIns.first { $0.slot == "06:30" }?.values["energy"] == 5)
    }

    @Test func serverRowReplacesSentLocal() {
        let store = LedgerStore(directory: dir)
        let local = checkIn("10:00", 12, 40, energy: 7, pending: true)
        store.saveCheckIn(local, date: date)
        store.markSent(local.id, date: date)
        #expect(store.ledger(for: date).checkIns.first?.pending == false)
        var server = DayLedger(date: date)
        let row = checkIn("10:00", 12, 40, energy: 8)
        server.checkIns = [row]
        store.merge(server: server)
        #expect(store.ledger(for: date).checkIns == [row])
    }

    @Test func savingTheSameSlotReplacesIt() {
        let store = LedgerStore(directory: dir)
        store.saveCheckIn(checkIn("10:00", 11, 0, energy: 4, pending: true), date: date)
        let again = checkIn("10:00", 12, 40, energy: 7, pending: true)
        store.saveCheckIn(again, date: date)
        #expect(store.ledger(for: date).checkIns == [again])
    }

    @Test func pendingGoalCloseAndJournalWinUntilSent() {
        let store = LedgerStore(directory: dir)
        let goal = LedgerGoal(id: UUID(), text: "Röpi este", setAt: at(7, 30), pending: true)
        let close = LedgerClose(id: UUID(), capturedAt: at(21, 0), eveningEnergy: 4, dayRating: 4, pending: true)
        let note = LedgerJournal(id: UUID(), capturedAt: at(21, 1), text: "Jó nap volt.", pending: true)
        store.setGoal(goal, date: date)
        store.setClose(close, date: date)
        store.addJournal(note, date: date)
        var server = DayLedger(date: date)
        server.goal = LedgerGoal(id: UUID(), text: "Régi cél", setAt: at(6, 0))
        let webNote = LedgerJournal(id: UUID(), capturedAt: at(13, 0), text: "Webről.")
        server.journal = [webNote]
        store.merge(server: server)
        var day = store.ledger(for: date)
        #expect(day.goal == goal)
        #expect(day.close == close)
        #expect(day.journal.map(\.id) == [webNote.id, note.id])

        store.markSent(goal.id, date: date)
        store.markSent(close.id, date: date)
        store.merge(server: server)
        day = store.ledger(for: date)
        #expect(day.goal?.text == "Régi cél")
        #expect(day.close == nil)
        #expect(day.journal.map(\.id) == [webNote.id, note.id]) // the note is still pending
    }

    @Test func curvePointsSortedByCapturedAt() {
        var day = DayLedger(date: date)
        day.checkIns = [checkIn("14:00", 16, 2, energy: 4, pending: true),
                        checkIn("06:30", 8, 0, energy: 6),
                        checkIn("10:00", 12, 40, energy: nil)]
        let points = day.curvePoints
        #expect(points.map(\.energy) == [6, 4])
        #expect(points.map(\.capturedAt) == [at(8, 0), at(16, 2)])
        #expect(points.map(\.pending) == [false, true])
    }

    @Test func survivesRelaunchAndKeepsCachedPlans() {
        let store = LedgerStore(directory: dir)
        let local = checkIn("06:30", 8, 0, energy: 6, pending: true)
        store.saveCheckIn(local, date: date)
        store.cachePlans([CheckInPlanLite(slot: "10:00", adaptiveItem: "hunger", adaptiveWhy: "Miért")], date: date)
        var server = DayLedger(date: date)
        server.checkIns = []
        store.merge(server: server) // the server day carries no plans; the cache stays

        let reopened = LedgerStore(directory: dir)
        let day = reopened.ledger(for: date)
        #expect(day.checkIns == [local])
        #expect(day.plans["10:00"]?.adaptiveItem == "hunger")
        #expect(reopened.ledger(for: "2026-11-09") == DayLedger(date: "2026-11-09"))
    }
}
