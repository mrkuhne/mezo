import Foundation
import Testing
@testable import BoopCore

struct CalendarSnapshotTests {
    var cal: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c }
    func at(_ d: Int, _ h: Int, _ m: Int = 0) -> Date { cal.date(from: DateComponents(year: 2026, month: 11, day: d, hour: h, minute: m))! }
    func item(_ t: String, _ a: Date, _ b: Date) -> CalendarItem { CalendarItem(title: t, start: a, end: b, allDay: false, calendar: "Munka") }
    var today: Date { at(9, 6, 50) }

    @Test func alwaysTwoDays() {
        let days = buildCalendarDays([item("Egyeztetés", at(9, 9), at(9, 9, 30))], today: today, calendar: cal)
        #expect(days.map(\.date) == ["2026-11-09", "2026-11-10"])
        #expect(days[0].events.count == 1)
        #expect(days[0].events[0].calendarName == "Munka")
    }

    @Test func eventAcrossMidnightAppearsOnBothDays() {
        let days = buildCalendarDays([item("Éjszakai ügyelet", at(9, 22), at(10, 2))], today: today, calendar: cal)
        #expect(days[0].events.count == 1)
        #expect(days[1].events.count == 1)
        #expect(days[1].events[0].startAt == at(9, 22))
    }

    @Test func emptyDayIsSentEmpty() {
        let days = buildCalendarDays([], today: today, calendar: cal)
        #expect(days.count == 2)
        #expect(days.allSatisfy { $0.events.isEmpty })
    }

    @Test func longTitleIsTrimmed() {
        let days = buildCalendarDays([item(String(repeating: "x", count: 250), at(9, 9), at(9, 10))], today: today, calendar: cal)
        #expect(days[0].events[0].title.count == 200)
    }

    @Test func eventsOutsideTheTwoDaysAreLeftOut() {
        let days = buildCalendarDays([item("Holnapután", at(11, 9), at(11, 10))], today: today, calendar: cal)
        #expect(days.allSatisfy { $0.events.isEmpty })
    }

    // Final review I1: the contract needs a title of 1…200 UTF-16 units.
    @Test func blankTitleGetsAPlaceholder() {
        let days = buildCalendarDays([item("  ", at(9, 9), at(9, 10))], today: today, calendar: cal)
        #expect(days[0].events[0].title == "(cím nélkül)")
    }
    @Test func longTitleFitsTwoHundredUTF16Units() {
        let days = buildCalendarDays([item(String(repeating: "🏋️", count: 150), at(9, 9), at(9, 10))], today: today, calendar: cal)
        #expect(days[0].events[0].title.utf16.count <= 200)
        #expect(!days[0].events[0].title.isEmpty)
    }
}
