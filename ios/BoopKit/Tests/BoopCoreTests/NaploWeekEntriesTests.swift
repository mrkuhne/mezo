import Foundation
import Testing
@testable import BoopCore

/// The Napló lists today and the previous six days always (`mezo-r36n9.159`, spec §3.4): an empty day is a row too.
struct NaploWeekEntriesTests {
    private func row(_ date: String) -> NaploDayRow {
        NaploDayRow(date: date, ratingWord: "Jó", goalText: nil, goalOutcomeLabel: nil, points: [], journalLine: nil,
                    web: false, pending: false)
    }

    @Test func theWeekIsAlwaysThereNewestFirst() {
        let out = NaploDays.weekEntries(rows: [row("2026-11-23"), row("2026-11-15")], today: "2026-11-24")
        #expect(out.map(\.id) == ["2026-11-24", "2026-11-23", "2026-11-22", "2026-11-21", "2026-11-20", "2026-11-19", "2026-11-18", "2026-11-15"])
        #expect(out[0] == .empty(date: "2026-11-24"))
        if case .day(let r) = out[1] { #expect(r.date == "2026-11-23") } else { Issue.record("yesterday should be a day row") }
        #expect(out[2] == .empty(date: "2026-11-22"))
        if case .day = out[7] {} else { Issue.record("an older day with content stays") }
    }

    @Test func anOlderEmptyDayIsNotListed() {
        let out = NaploDays.weekEntries(rows: [], today: "2026-11-24")
        #expect(out.count == 7)
        #expect(out.allSatisfy { if case .empty = $0 { return true } else { return false } })
    }
}
