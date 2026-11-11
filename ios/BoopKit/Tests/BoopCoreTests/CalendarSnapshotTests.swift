import Foundation
import Testing
import BoopAPI
@testable import BoopCore

struct CalendarSnapshotTests {
    var cal: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c }
    func at(_ d: Int, _ h: Int, _ m: Int = 0) -> Date { cal.date(from: DateComponents(year: 2026, month: 11, day: d, hour: h, minute: m))! }
    func item(_ t: String, _ a: Date, _ b: Date) -> CalendarItem {
        CalendarItem(externalId: calendarExternalId(itemId: "id-\(t)", occurrenceStart: a), title: t, start: a, end: b, allDay: false, calendar: "Munka")
    }
    var today: Date { at(9, 6, 50) }
    /// Today + tomorrow (the range the tests below were written for).
    func buildCalendarDays(_ items: [CalendarItem], today: Date, calendar: Calendar) -> [Components.Schemas.CalendarDayIn] {
        BoopCore.buildCalendarDays(items, from: today, through: calendar.date(byAdding: .day, value: 1, to: today)!, calendar: calendar)
    }

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

    // MARK: - B1: calendar history

    @Test func externalIdIsItemIdPlusOccurrenceStart() {
        #expect(calendarExternalId(itemId: "7F3A@google.com", occurrenceStart: at(9, 9)) == "7F3A@google.com|2026-11-09T08:00:00Z")
        let long = calendarExternalId(itemId: String(repeating: "x", count: 300), occurrenceStart: at(9, 9))
        #expect(long.count == 200)
        #expect(long.hasSuffix("|2026-11-09T08:00:00Z"))
    }

    @Test func eventKeepsItsKeyOnEveryDayItSpans() {
        let e = item("Éjszakai ügyelet", at(9, 22), at(10, 2))
        let days = buildCalendarDays([e], today: today, calendar: cal)
        #expect(days[0].events[0].externalId == e.externalId)
        #expect(days[1].events[0].externalId == e.externalId)
    }

    @Test func rangeIsInclusiveOfBothEnds() {
        let days = BoopCore.buildCalendarDays([], from: at(8, 12), through: at(10, 1), calendar: cal)
        #expect(days.map(\.date) == ["2026-11-08", "2026-11-09", "2026-11-10"])
    }
}
