import Testing
import BoopCore
@testable import Boop

struct ConnectCopyTests {
    @Test func summaryLineNamesTheCounts() {
        let line = summaryLine(.init(nights: 58, days: 60, workouts: 21, events: 4))
        #expect(line?.0 == "Megvan: ")
        #expect(line?.1 == "58 éjszaka")
        #expect(line?.2 == ", 60 nap mozgás és 21 edzés.")
    }
    @Test func nothingFromHealthShowsTheNoDataCard() {
        #expect(summaryLine(.init(nights: 0, days: 0, workouts: 0, events: 3)) == nil)
    }
    @Test func countsChipShowsTheLastSummary() {
        #expect(countsChip(.init(nights: 58, days: 60, workouts: 21, events: 4)) == "58 éjszaka · 60 nap · 21 edzés")
        #expect(countsChip(.init(nights: 0, days: 0, workouts: 0, events: 2)) == "nincs adat")
    }
}
