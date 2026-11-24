import Foundation
import Testing
import BoopCore
@testable import Boop

/// The quick sheets date their payloads from the Mikor row (`mezo-r36n9.159`): the chosen day and, for a sport, the
/// chosen clock time reach the server unchanged.
struct QuickSheetsWhenTests {
    @Test func theSportPayloadCarriesTheChosenDayAndClock() {
        let moment = Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 23, hour: 18, minute: 30))!
        let p = SportSheet.payload(sport: .volleyball, minutes: 60, rpe: 6, day: "2026-11-23", moment: moment)
        #expect(p.date == "2026-11-23")
        #expect(p.time == "18:30")
        #expect(p.durationMinutes == 60)
        #expect(p.rpe == 6)
    }

    @Test func theNightIsFiledOnTheChosenMorning() {
        let p = SleepLogSheet.payload(bed: "23:00", wake: "07:00", hours: 8, quality: 7, morning: "2026-11-23")
        #expect(p.date == "2026-11-23")
        #expect(p.bedtime == "23:00")
        #expect(p.wakeup == "07:00")
        #expect(p.quality == 7)
    }
}
