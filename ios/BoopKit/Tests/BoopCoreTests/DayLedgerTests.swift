import Foundation
import Testing
@testable import BoopCore

func temporaryDirectory() -> URL {
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent("boop-tests-\(UUID().uuidString)")
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
}

@MainActor
final class DayLedgerTests {
    let dir = temporaryDirectory()
    let date = "2026-11-10"
    deinit { try? FileManager.default.removeItem(at: dir) }

    func checkIn(_ slot: String, _ h: Int, _ m: Int, energy: Int?, pending: Bool = false) -> LedgerCheckIn {
        LedgerCheckIn(id: UUID(), slot: slot, capturedAt: at(h, m), values: energy.map { ["energy": $0] } ?? [:],
                      pending: pending)
    }

    @Test func pendingLocalCheckInWinsOverServer() throws {
        let store = LedgerStore(directory: dir)
        let local = checkIn("10:00", 12, 40, energy: 7, pending: true)
        try store.saveCheckIn(local, date: date)
        var server = DayLedger(date: date)
        server.checkIns = [checkIn("10:00", 11, 0, energy: 3), checkIn("06:30", 8, 0, energy: 5)]
        store.merge(server: server, fetchedAt: at(23, 0))
        let merged = store.ledger(for: date)
        #expect(merged.checkIns.count == 2)
        #expect(merged.checkIns.first { $0.slot == "10:00" } == local)
        #expect(merged.checkIns.first { $0.slot == "06:30" }?.values["energy"] == 5)
    }

    @Test func serverRowReplacesSentLocal() throws {
        let store = LedgerStore(directory: dir)
        let local = checkIn("10:00", 12, 40, energy: 7, pending: true)
        try store.saveCheckIn(local, date: date)
        store.markSent(local.id, date: date)
        #expect(store.ledger(for: date).checkIns.first?.pending == false)
        var server = DayLedger(date: date)
        let row = checkIn("10:00", 12, 40, energy: 8)
        server.checkIns = [row]
        store.merge(server: server, fetchedAt: at(23, 0))
        #expect(store.ledger(for: date).checkIns == [row])
    }

    @Test func savingTheSameSlotReplacesIt() throws {
        let store = LedgerStore(directory: dir)
        try store.saveCheckIn(checkIn("10:00", 11, 0, energy: 4, pending: true), date: date)
        let again = checkIn("10:00", 12, 40, energy: 7, pending: true)
        try store.saveCheckIn(again, date: date)
        #expect(store.ledger(for: date).checkIns == [again])
    }

    @Test func pendingGoalCloseAndJournalWinUntilSent() throws {
        let store = LedgerStore(directory: dir)
        let goal = LedgerGoal(id: UUID(), text: "Röpi este", setAt: at(7, 30), pending: true)
        let close = LedgerClose(id: UUID(), capturedAt: at(21, 0), eveningEnergy: 4, dayRating: 4, pending: true)
        let note = LedgerJournal(id: UUID(), capturedAt: at(21, 1), text: "Jó nap volt.", pending: true)
        try store.setGoal(goal, date: date)
        try store.setClose(close, date: date)
        try store.addJournal(note, date: date)
        var server = DayLedger(date: date)
        server.goal = LedgerGoal(id: UUID(), text: "Régi cél", setAt: at(6, 0))
        let webNote = LedgerJournal(id: UUID(), capturedAt: at(13, 0), text: "Webről.")
        server.journal = [webNote]
        store.merge(server: server, fetchedAt: at(23, 0))
        var day = store.ledger(for: date)
        #expect(day.goal == goal)
        #expect(day.close == close)
        #expect(day.journal.map(\.id) == [webNote.id, note.id])

        store.markSent(goal.id, date: date)
        store.markSent(close.id, date: date)
        store.merge(server: server, fetchedAt: at(23, 0))
        day = store.ledger(for: date)
        #expect(day.goal?.text == "Régi cél")
        #expect(day.close == nil)
        #expect(day.journal.map(\.id) == [webNote.id, note.id]) // the note is still pending
    }

    @Test func curvePointsSortedByCapturedAt() throws {
        var day = DayLedger(date: date)
        day.checkIns = [checkIn("14:00", 16, 2, energy: 4, pending: true),
                        checkIn("06:30", 8, 0, energy: 6),
                        checkIn("10:00", 12, 40, energy: nil)]
        let points = day.curvePoints
        #expect(points.map(\.energy) == [6, 4])
        #expect(points.map(\.capturedAt) == [at(8, 0), at(16, 2)])
        #expect(points.map(\.pending) == [false, true])
    }

    @Test func survivesRelaunchAndKeepsCachedPlans() throws {
        let store = LedgerStore(directory: dir)
        let local = checkIn("06:30", 8, 0, energy: 6, pending: true)
        try store.saveCheckIn(local, date: date)
        store.cachePlans([CheckInPlanLite(slot: "10:00", adaptiveItem: "hunger", adaptiveWhy: "Miért")], date: date)
        var server = DayLedger(date: date)
        server.checkIns = []
        store.merge(server: server, fetchedAt: at(23, 0)) // the server day carries no plans; the cache stays

        let reopened = LedgerStore(directory: dir)
        let day = reopened.ledger(for: date)
        #expect(day.checkIns == [local])
        #expect(day.plans["10:00"]?.adaptiveItem == "hunger")
        #expect(reopened.ledger(for: "2026-11-09") == DayLedger(date: "2026-11-09"))
    }

    @Test func sentCheckInNewerThanTheFetchStays() throws {
        let store = LedgerStore(directory: dir)
        let early = checkIn("06:30", 8, 0, energy: 5, pending: true)
        let late = checkIn("14:00", 16, 2, energy: 4, pending: true)
        try store.saveCheckIn(early, date: date); try store.saveCheckIn(late, date: date)
        store.markSent(early.id, date: date); store.markSent(late.id, date: date)
        store.merge(server: DayLedger(date: date), fetchedAt: at(16, 0)) // the fetch left before the 16:02 capture
        #expect(store.ledger(for: date).checkIns.map(\.id) == [late.id])
    }

    @Test func unreadableDayIsMovedAsideNotOverwritten() throws {
        let garbage = Data("{ broken".utf8)
        try garbage.write(to: dir.appendingPathComponent("\(date).json"))
        let store = LedgerStore(directory: dir)
        #expect(store.ledger(for: date) == DayLedger(date: date))
        try store.saveCheckIn(checkIn("06:30", 8, 0, energy: 5, pending: true), date: date)
        let aside = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasPrefix("\(date).corrupt-") }
        #expect(aside.count == 1)
        #expect(try Data(contentsOf: dir.appendingPathComponent(aside[0])) == garbage)
        #expect(LedgerStore(directory: dir).ledger(for: date).checkIns.count == 1) // the aside file is not reloaded
    }
}
