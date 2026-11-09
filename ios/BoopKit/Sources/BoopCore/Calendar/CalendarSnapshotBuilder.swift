import Foundation
import BoopAPI

/// Today + tomorrow as two calendar days (Boop S2). An event overlapping a day is listed on it with
/// its real start/end (so one spanning midnight appears on both); a day without events is still sent
/// empty, which clears stale rows on the server. Titles are cut to the contract's 200 characters.
public func buildCalendarDays(_ items: [CalendarItem], today: Date, calendar: Calendar) -> [Components.Schemas.CalendarDayIn] {
    let start = calendar.startOfDay(for: today)
    return (0..<2).map { offset in
        let dayStart = calendar.date(byAdding: .day, value: offset, to: start)!
        let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart)!
        let events = items
            .filter { $0.end > dayStart && $0.start < dayEnd }
            .sorted { $0.start < $1.start }
            .map { Components.Schemas.CalendarEventIn(
                title: String($0.title.prefix(200)), startAt: $0.start, endAt: $0.end,
                allDay: $0.allDay, calendarName: String($0.calendar.prefix(80))) }
        return .init(date: dayString(dayStart, calendar), events: events)
    }
}
