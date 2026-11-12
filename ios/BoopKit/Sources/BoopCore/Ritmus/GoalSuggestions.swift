import Foundation

/// A calendar event as the goal chips need it. Built on the phone from EventKit; its title never leaves the phone here.
public struct CalendarEventLite: Sendable, Equatable {
    public let title: String
    public let start: Date
    public let end: Date
    public let allDay: Bool
    /// Invited people (0 when the event has none or the calendar does not say).
    public let attendees: Int

    public init(title: String, start: Date, end: Date, allDay: Bool = false, attendees: Int = 0) {
        self.title = title; self.start = start; self.end = end; self.allDay = allDay; self.attendees = attendees
    }

    public init(_ item: CalendarItem) {
        self.init(title: item.title, start: item.start, end: item.end, allDay: item.allDay, attendees: item.attendees)
    }
}

/// One chip under "MI MA A LEGFONTOSABB?": the goal text a tap sets, and Boop's small "why".
public struct GoalSuggestion: Sendable, Equatable, Identifiable {
    public let text: String
    public let why: String
    public var id: String { text }
    public init(text: String, why: String) { self.text = text; self.why = why }
}

/// Boop's goal-of-the-day suggestions (spec §5.1), deterministic and built on the phone, no model: the day's biggest
/// calendar event ("a naptárból"), today's planned session ("a heti terv"), and a goal the owner typed on at least two
/// past days but not in the last seven ("N napja nem volt"). At most three, in that order, each text once.
public enum GoalSuggestions {
    public static let limit = 3

    /// `today` is the local day (`yyyy-MM-dd`); `calendar` decides which events fall on it and their clock times.
    public static func suggest(brief: Brief, calendar events: [CalendarEventLite], pastGoals: [(date: String, text: String)],
                               today: String, in calendar: Calendar = .current) -> [GoalSuggestion] {
        var out: [GoalSuggestion] = []
        func add(_ s: GoalSuggestion?) {
            guard let s, out.count < limit, !out.contains(where: { key($0.text) == key(s.text) }) else { return }
            out.append(s)
        }
        add(biggestEvent(events, today: today, calendar: calendar))
        add(session(brief, today: today))
        for s in overdue(pastGoals, today: today) { add(s) }
        return out
    }

    /// The timed event of the day with the most people, then the longest, then the earliest: "<title> HH:mm".
    static func biggestEvent(_ events: [CalendarEventLite], today: String, calendar: Calendar) -> GoalSuggestion? {
        let todays = events.filter { e in
            !e.allDay && !e.title.trimmingCharacters(in: .whitespaces).isEmpty && dayString(e.start, calendar) == today
        }
        let best = todays.max { a, b in
            if a.attendees != b.attendees { return a.attendees < b.attendees }
            let la = a.end.timeIntervalSince(a.start), lb = b.end.timeIntervalSince(b.start)
            if la != lb { return la < lb }
            return a.start > b.start
        }
        guard let best else { return nil }
        let c = calendar.dateComponents([.hour, .minute], from: best.start)
        let time = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
        return GoalSuggestion(text: "\(best.title.trimmingCharacters(in: .whitespaces)) \(time)", why: "a naptárból")
    }

    /// Today's planned session, not yet done: "<title> HH:mm" (the moved time if any).
    static func session(_ brief: Brief, today: String) -> GoalSuggestion? {
        guard brief.date == today, let s = brief.day.session, !s.done else { return nil }
        let time = s.time ?? s.plannedTime
        return GoalSuggestion(text: time.map { "\(s.title) \($0)" } ?? s.title, why: "a heti terv")
    }

    /// Goals seen on ≥ 2 past days and not in the last 7: the most often typed first, then the most recent. The text is
    /// the latest spelling.
    static func overdue(_ past: [(date: String, text: String)], today: String) -> [GoalSuggestion] {
        guard let todayIndex = dayIndex(today) else { return [] }
        struct Seen { var days: Set<Int> = []; var last = Int.min; var text = "" }
        var seen: [String: Seen] = [:]
        for (date, raw) in past {
            let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty, let d = dayIndex(date), d < todayIndex else { continue }
            var s = seen[key(text)] ?? Seen()
            s.days.insert(d)
            if d >= s.last { s.last = d; s.text = text }
            seen[key(text)] = s
        }
        return seen.values
            .filter { $0.days.count >= 2 && todayIndex - $0.last > 7 }
            .sorted { ($0.days.count, $0.last) > ($1.days.count, $1.last) }
            .map { GoalSuggestion(text: $0.text, why: "\(todayIndex - $0.last) napja nem volt") }
    }

    private static func key(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private static func dayString(_ date: Date, _ calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Days since 1970-01-01 of a `yyyy-MM-dd` day (zone-free, so differences are whole days).
    static func dayIndex(_ day: String) -> Int? {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        guard let date = utc.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return nil }
        return Int((date.timeIntervalSince1970 / 86_400).rounded())
    }
}
