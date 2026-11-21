import Foundation
import BoopAPI

/// Every local day from `from` through `through` (both inclusive) as a calendar day (Boop S2, B1).
/// An event overlapping a day is listed on it with its real start/end and its stable `externalId` (so
/// one spanning midnight appears on both days, under the same key); a day without events is still sent
/// empty, which cancels stale rows of that day on the server. Titles follow the contract: 1…200 UTF-16 units.
public func buildCalendarDays(_ items: [CalendarItem], from: Date, through: Date, calendar: Calendar) -> [Components.Schemas.CalendarDayIn] {
    let start = calendar.startOfDay(for: from)
    let last = calendar.startOfDay(for: through)
    let count = (calendar.dateComponents([.day], from: start, to: last).day ?? 0) + 1
    return (0..<max(count, 0)).map { offset in
        let dayStart = calendar.date(byAdding: .day, value: offset, to: start)!
        let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart)!
        let events = items
            .filter { $0.end > dayStart && $0.start < dayEnd }
            .sorted { $0.start < $1.start }
            .map { Components.Schemas.CalendarEventIn(
                externalId: $0.externalId, title: contractTitle($0.title), startAt: $0.start, endAt: $0.end,
                allDay: $0.allDay, calendarName: String($0.calendar.prefix(80)),
                attendeeCount: max($0.attendees, $0.attendeeNames.count),
                attendeeNames: Array($0.attendeeNames.prefix(50).map { String($0.prefix(120)) }),
                organizerIsMe: $0.organizerIsMe, location: $0.location.map { String($0.prefix(200)) },
                recurring: $0.recurring, availability: .init(rawValue: $0.availability) ?? .busy,
                notes: $0.notes.map { String($0.prefix(2000)) }) }
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
