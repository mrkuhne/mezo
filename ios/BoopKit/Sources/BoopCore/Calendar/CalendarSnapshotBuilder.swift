import Foundation
import BoopAPI

/// Today + tomorrow as two calendar days (Boop S2). An event overlapping a day is listed on it with
/// its real start/end (so one spanning midnight appears on both); a day without events is still sent
/// empty, which clears stale rows on the server. Titles follow the contract: 1…200 UTF-16 units.
public func buildCalendarDays(_ items: [CalendarItem], today: Date, calendar: Calendar) -> [Components.Schemas.CalendarDayIn] {
    let start = calendar.startOfDay(for: today)
    return (0..<2).map { offset in
        let dayStart = calendar.date(byAdding: .day, value: offset, to: start)!
        let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart)!
        let events = items
            .filter { $0.end > dayStart && $0.start < dayEnd }
            .sorted { $0.start < $1.start }
            .map { Components.Schemas.CalendarEventIn(
                title: contractTitle($0.title), startAt: $0.start, endAt: $0.end,
                allDay: $0.allDay, calendarName: String($0.calendar.prefix(80))) }
        return .init(date: dayString(dayStart, calendar), events: events)
    }
}

/// Blank → "(cím nélkül)"; long → cut on a character boundary to at most 200 UTF-16 units (the server counts those).
func contractTitle(_ raw: String) -> String {
    let t = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !t.isEmpty else { return "(cím nélkül)" }
    var out = ""
    for ch in t {
        if out.utf16.count + String(ch).utf16.count > 200 { break }
        out.append(ch)
    }
    return out.isEmpty ? "(cím nélkül)" : out
}
