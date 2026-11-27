import Foundation

/// What Boop's widgets show, written by the app on every relevant change (spec §7.2, `mezo-r36n9.172`): today's plan
/// rows, today's and tomorrow's reminder occurrences with their done state. The widgets never compute the plan; they
/// only pick what is still ahead at the moment of each timeline entry (`WidgetDay`).
public struct WidgetSnapshot: Codable, Equatable, Sendable {
    public struct Item: Codable, Equatable, Sendable {
        public let at: Date
        public let title: String
        /// `BoopDesign.Hue` raw value: the sky the widget paints behind it.
        public let hue: Int

        public init(at: Date, title: String, hue: Int) {
            self.at = at
            self.title = title
            self.hue = hue
        }
    }

    public struct ReminderRow: Codable, Equatable, Sendable {
        /// The occurrence key the app ticks (`<reminderId>|<yyyy-MM-dd>`).
        public let key: String
        public let day: String
        public let at: Date
        public let title: String
        public var done: Bool
        /// A supplement group's reminder: the widget says „Bevettem”, and the tick also logs the intake.
        public let supplement: Bool

        public init(key: String, day: String, at: Date, title: String, done: Bool, supplement: Bool) {
            self.key = key
            self.day = day
            self.at = at
            self.title = title
            self.done = done
            self.supplement = supplement
        }
    }

    public let writtenAt: Date
    /// The signed-in user the snapshot was written for: another account's plan rows are never kept.
    public let owner: String?
    /// The local day (`yyyy-MM-dd`) the plan rows belong to.
    public let day: String
    /// False when the day's plan could not be loaded: the widgets then show the reminders only.
    public var hasPlan: Bool
    /// Today's plan rows with a clock time, in clock order (past ones included; the widget drops them per entry).
    public let items: [Item]
    /// Today's and tomorrow's reminder occurrences.
    public var reminders: [ReminderRow]

    public init(writtenAt: Date, owner: String? = nil, day: String, hasPlan: Bool, items: [Item], reminders: [ReminderRow]) {
        self.writtenAt = writtenAt
        self.owner = owner
        self.day = day
        self.hasPlan = hasPlan
        self.items = items
        self.reminders = reminders
    }

    public static func encode(_ s: WidgetSnapshot) throws -> Data {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .secondsSince1970
        return try e.encode(s)
    }

    public static func decode(_ data: Data) throws -> WidgetSnapshot {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .secondsSince1970
        return try d.decode(WidgetSnapshot.self, from: data)
    }
}

/// One thing coming up: a plan row or an open reminder.
public struct WidgetThing: Equatable, Sendable {
    public let at: Date
    public let title: String
    public let hue: Int
    public let isReminder: Bool
}

/// What a widget shows at one moment.
public struct WidgetDay: Equatable, Sendable {
    public enum State: Equatable, Sendable {
        /// The plan and the reminders.
        case normal
        /// The plan is not today's (or never loaded): reminders only, with „Nyisd meg a Boopot a mai tervhez”.
        case stale
        /// Nothing is left today: „Mára nincs több teendő” and tomorrow's first thing.
        case empty
    }

    public let state: State
    /// Today's plan rows still ahead.
    public let upcoming: [WidgetThing]
    /// Today's reminders, done ones included, in clock order.
    public let reminders: [WidgetSnapshot.ReminderRow]
    /// The earliest open thing (a plan row or an unticked reminder).
    public let next: WidgetThing?
    /// The earliest unticked reminder.
    public let nextReminder: WidgetSnapshot.ReminderRow?
    public let tomorrowFirst: WidgetThing?

    /// The hue reminders are painted in (Forma: the day's own world).
    public static let reminderHue = 0

    public static func make(_ s: WidgetSnapshot?, at now: Date, calendar: Calendar) -> WidgetDay {
        let today = dayString(now, calendar)
        guard let s else {
            return WidgetDay(state: .stale, upcoming: [], reminders: [], next: nil, nextReminder: nil, tomorrowFirst: nil)
        }
        let fresh = s.hasPlan && s.day == today
        let upcoming = fresh ? s.items.filter { $0.at >= now }.map { WidgetThing(at: $0.at, title: $0.title, hue: $0.hue, isReminder: false) } : []
        let reminders = s.reminders.filter { $0.day == today }.sorted { $0.at < $1.at }
        // An unticked reminder stays "next" until ticked, even past its time, but only for an hour (then it is old news).
        let open = reminders.filter { !$0.done && $0.at >= now.addingTimeInterval(-3600) }
        let openThings = open.map { WidgetThing(at: $0.at, title: $0.title, hue: reminderHue, isReminder: true) }
        let next = (upcoming + openThings).min { $0.at < $1.at }
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)).map { dayString($0, calendar) }
        let tomorrowFirst = s.reminders.filter { $0.day == tomorrow }.min { $0.at < $1.at }
            .map { WidgetThing(at: $0.at, title: $0.title, hue: reminderHue, isReminder: true) }
        let state: State = !fresh ? .stale : (next == nil ? .empty : .normal)
        return WidgetDay(state: state, upcoming: upcoming, reminders: reminders, next: next, nextReminder: open.first,
                         tomorrowFirst: tomorrowFirst)
    }

    /// Timeline entry dates: now, every item and reminder time still ahead today, a ten-minute grid for the "még …"
    /// line, and midnight (the day turns over).
    public static func timeline(_ s: WidgetSnapshot?, now: Date, calendar: Calendar) -> [Date] {
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now.addingTimeInterval(86_400)
        var dates: Set<Date> = [now, midnight]
        for d in (s?.items.map(\.at) ?? []) + (s?.reminders.map(\.at) ?? []) where d > now && d < midnight { dates.insert(d) }
        // an hour after each reminder, an unticked one stops being "next"
        for r in s?.reminders ?? [] { let d = r.at.addingTimeInterval(3601); if d > now && d < midnight { dates.insert(d) } }
        var t = now.addingTimeInterval(600)
        while t < midnight { dates.insert(t); t.addTimeInterval(600) }
        return dates.sorted()
    }

    /// "még 1 ó 20 p", "még 25 p", "még 2 ó", "most".
    public static func timeLeft(to target: Date, from now: Date) -> String {
        let minutes = Int((target.timeIntervalSince(now) / 60).rounded(.up))
        guard minutes > 0 else { return "most" }
        let h = minutes / 60, m = minutes % 60
        if h == 0 { return "még \(m) p" }
        return m == 0 ? "még \(h) ó" : "még \(h) ó \(m) p"
    }

    public static func dayString(_ date: Date, _ calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
