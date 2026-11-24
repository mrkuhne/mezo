import Foundation
import Testing
@testable import BoopCore

/// The "Mikor" row's pure rules (`mezo-r36n9.159`): today and the previous six days, never the future; the resolved day
/// said in the owner's words; the toast names the day when it is not today.
struct WhenTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Budapest")!
        c.locale = Locale(identifier: "hu_HU")
        return c
    }()

    /// "2026-11-24 13:11" in Budapest.
    func at(_ s: String) -> Date {
        let f = DateFormatter()
        f.calendar = cal; f.timeZone = cal.timeZone; f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f.date(from: s)!
    }

    @Test func earliestIsSixDaysBackAtMidnight() {
        #expect(whenEarliest(now: at("2026-11-24 13:11"), calendar: cal) == at("2026-11-18 00:00"))
    }

    @Test func clampKeepsTheWindow() {
        let now = at("2026-11-24 13:11")
        #expect(whenClamp(at("2026-11-10 10:00"), now: now, calendar: cal) == at("2026-11-18 00:00"))
        #expect(whenClamp(at("2026-11-25 10:00"), now: now, calendar: cal) == now)
        #expect(whenClamp(at("2026-11-20 08:15"), now: now, calendar: cal) == at("2026-11-20 08:15"))
    }

    @Test func dayLabels() {
        let now = at("2026-11-24 13:11")
        #expect(whenLabel(.now, now: now, withTime: false, calendar: cal) == "ma")
        #expect(whenLabel(.yesterday, now: now, withTime: false, calendar: cal) == "tegnap")
        #expect(whenLabel(.other(at("2026-11-22 09:00")), now: now, withTime: false, calendar: cal) == "nov. 22. · vasárnap")
        #expect(whenLabel(.other(at("2026-11-24 09:00")), now: now, withTime: false, calendar: cal) == "ma")
    }

    @Test func timeLabels() {
        let now = at("2026-11-24 13:11")
        #expect(whenLabel(.now, now: now, withTime: true, calendar: cal) == "most")
        #expect(whenLabel(.yesterday, now: now, withTime: true, calendar: cal) == "tegnap · 13:11")
        #expect(whenLabel(.other(at("2026-11-24 08:15")), now: now, withTime: true, calendar: cal) == "ma · 08:15")
        #expect(whenLabel(.other(at("2026-11-22 08:15")), now: now, withTime: true, calendar: cal) == "nov. 22. · 08:15")
    }

    @Test func resolvedFollowsTheChoiceInsideTheWindow() {
        let now = at("2026-11-24 13:11")
        #expect(whenResolved(.now, now: now, calendar: cal) == now)
        #expect(whenResolved(.yesterday, now: now, calendar: cal) == at("2026-11-23 13:11"))
        #expect(whenResolved(.other(at("2026-11-01 10:00")), now: now, calendar: cal) == at("2026-11-18 00:00"))
    }

    @Test func yesterdayAtTwentyThreeThirtyStaysYesterday() {
        let now = at("2026-11-24 23:30")
        #expect(whenDayString(whenResolved(.yesterday, now: now, calendar: cal), calendar: cal) == "2026-11-23")
        #expect(whenDayString(whenResolved(.now, now: now, calendar: cal), calendar: cal) == "2026-11-24")
    }

    @Test func toastNamesTheDayWhenNotToday() {
        let now = at("2026-11-24 13:11")
        #expect(whenToast("Súly 81,4 kg rögzítve", choice: .now, now: now, calendar: cal) == "Súly 81,4 kg rögzítve")
        #expect(whenToast("Súly 81,4 kg rögzítve", choice: .yesterday, now: now, calendar: cal) == "Súly 81,4 kg rögzítve · tegnap")
        #expect(whenToast("x", choice: .other(at("2026-11-22 08:00")), now: now, calendar: cal) == "x · nov. 22.")
        #expect(whenToast("x", choice: .other(at("2026-11-24 08:00")), now: now, calendar: cal) == "x")
    }

    /// The Alvás sheet's note under the row: only a past morning needs the "Health keeps its times" warning.
    @Test func sleepNoteOnlyForAPastMorning() {
        #expect(whenSleepNote(.now) == nil)
        #expect(whenSleepNote(.yesterday) == "Ha az órád már mérte ezt az éjszakát, csak a minősítésed kerül mellé.")
        #expect(whenSleepNote(.other(Date(timeIntervalSince1970: 0))) != nil)
    }
}
