import Foundation
import Testing
@testable import BoopCore

@MainActor
struct NaploDaysTests {
    static let to = "2026-11-12"
    static let from = "2026-10-30"

    private func close(_ date: String, rating: Int? = 4, web: Bool = false, goal: String? = nil, outcome: String? = nil,
                       journal: String? = nil, pending: Bool = false) -> DayCloseLite {
        DayCloseLite(date: date, dayRating: rating, eveningEnergy: 5, goalText: goal, goalOutcome: outcome,
                     journalText: journal, web: web, pending: pending)
    }

    private func checkIn(_ hour: Int, energy: Int, pending: Bool = false) -> LedgerCheckIn {
        LedgerCheckIn(id: UUID(), slot: "10:00", capturedAt: Date(timeIntervalSince1970: Double(hour) * 3600), values: ["energy": energy],
                      pending: pending)
    }

    @Test func fourteenDaysNewestFirst() {
        let days = NaploDays.days(from: Self.from, to: Self.to)
        #expect(days.count == 14)
        let rows = NaploDays.rows(closes: days.map { close($0) }, checkIns: [:], from: Self.from, to: Self.to)
        #expect(rows.map(\.date) == days.reversed())
        #expect(rows.first?.date == "2026-11-12")
        #expect(rows.last?.date == "2026-10-30")
    }

    @Test func rangeCrossesMonthAndYearEnds() {
        #expect(NaploDays.days(from: "2026-12-30", to: "2027-01-02") == ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"])
        #expect(NaploDays.range(endingOn: "2026-11-12", count: 14) == (from: "2026-10-30", to: "2026-11-12"))
    }

    @Test func emptyDayAbsentNotMissed() {
        let rows = NaploDays.rows(closes: [close("2026-11-12"), close("2026-11-10")], checkIns: [:], from: Self.from, to: Self.to)
        #expect(rows.map(\.date) == ["2026-11-12", "2026-11-10"])
        // nothing for the 11th and a day outside the range: no row at all
        let outside = NaploDays.rows(closes: [close("2026-10-01")], checkIns: ["2026-11-13": [checkIn(9, energy: 6)]],
                                     from: Self.from, to: Self.to)
        #expect(outside.isEmpty)
    }

    @Test func dayWithOnlyCheckInsShowsItsEnergyLine() {
        let rows = NaploDays.rows(closes: [], checkIns: ["2026-11-11": [checkIn(8, energy: 7), checkIn(12, energy: 5, pending: true)]],
                                  from: Self.from, to: Self.to)
        let row = rows.first
        #expect(row?.ratingWord == nil)
        #expect(row?.points.map(\.energy) == [7, 5])
        #expect(row?.points.map(\.pending) == [false, true])
    }

    @Test func ratingWords() {
        #expect(NaploDays.ratingWord(1) == "Nehéz")
        #expect(NaploDays.ratingWord(2) == "Inkább nehéz")
        #expect(NaploDays.ratingWord(3) == "Rendben")
        #expect(NaploDays.ratingWord(4) == "Jó")
        #expect(NaploDays.ratingWord(5) == "Remek")
        #expect(NaploDays.ratingWord(nil) == nil)
        #expect(NaploDays.ratingWord(0) == nil)
        #expect(NaploDays.ratingWord(6) == nil)
    }

    @Test func webDayShown() {
        let rows = NaploDays.rows(closes: [close("2026-11-09", rating: nil, web: true, goal: "Futás", outcome: "partial",
                                                 journal: "\n  Fáradt voltam.\nMásodik sor")],
                                  checkIns: [:], from: Self.from, to: Self.to)
        let row = rows.first
        #expect(rows.count == 1)
        #expect(row?.web == true)
        #expect(row?.ratingWord == nil)
        #expect(row?.goalText == "Futás")
        #expect(row?.goalOutcomeLabel == "Részben")
        #expect(row?.journalLine == "Fáradt voltam.")
    }

    @Test func pendingCloseKeepsItsPendingLook() {
        let rows = NaploDays.rows(closes: [close("2026-11-12", pending: true)], checkIns: [:], from: Self.from, to: Self.to)
        #expect(rows.first?.pending == true)
    }

    @Test func ledgerDaysBecomeClosesAndCheckIns() {
        let journalId = UUID()
        var day = DayLedger(date: "2026-11-11")
        day.checkIns = [checkIn(9, energy: 6)]
        day.close = LedgerClose(id: UUID(), capturedAt: Date(), eveningEnergy: 4, dayRating: 5, goalText: "Prezentáció",
                                goalOutcome: "done", journalId: journalId, pending: true)
        day.journal = [LedgerJournal(id: journalId, capturedAt: Date(), text: "Jól sikerült.")]
        let (closes, checkIns) = NaploDays.sources(from: [day, DayLedger(date: "2026-11-10")])
        #expect(closes.count == 1)
        #expect(closes.first?.journalText == "Jól sikerült.")
        #expect(closes.first?.pending == true)
        #expect(checkIns["2026-11-11"]?.count == 1)
        #expect(checkIns["2026-11-10"] == nil)
    }
}
