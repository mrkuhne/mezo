import Foundation

/// One dated ring of a reminder. Repeats are expanded into dated one-offs so an early tick can cancel one day's ring.
public struct ReminderOccurrence: Equatable, Sendable {
    public let reminderId: UUID
    /// `yyyy-MM-dd` in the calendar's zone.
    public let day: String
    public let fireAt: Date

    public init(reminderId: UUID, day: String, fireAt: Date) {
        self.reminderId = reminderId
        self.day = day
        self.fireAt = fireAt
    }

    public var key: String { "\(reminderId.uuidString)|\(day)" }
}

public struct ReminderPlan: Equatable, Sendable {
    public var alarms: [ReminderOccurrence]
    public var notifications: [ReminderOccurrence]
    /// True when today's notifications alone exceed the cap (the tail of today will not ring).
    public var todayOverflow: Bool

    public init(alarms: [ReminderOccurrence], notifications: [ReminderOccurrence], todayOverflow: Bool) {
        self.alarms = alarms
        self.notifications = notifications
        self.todayOverflow = todayOverflow
    }
}

public enum ReminderPlanner {
    public static func plan(_ reminders: [Reminder], done: Set<String>, now: Date, calendar: Calendar,
                            alarmDays: Int = 7, notificationDays: Int = 3, notificationCap: Int = 24,
                            alarmsAllowed: Bool) -> ReminderPlan {
        let strength = Dictionary(reminders.map { ($0.id, $0.strength) }, uniquingKeysWith: { a, _ in a })
        let today = calendar.startOfDay(for: now)
        var alarms: [ReminderOccurrence] = []
        var notifications: [ReminderOccurrence] = []
        var todayNotifications = 0
        for offset in 0..<max(alarmDays, notificationDays, 0) {
            guard let date = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
            let day = dayString(date, calendar: calendar)
            for occ in occurrences(on: day, reminders, calendar: calendar)
            where occ.fireAt > now && !done.contains(occ.key) {
                let isAlarm = strength[occ.reminderId] == .alarm && alarmsAllowed
                if isAlarm {
                    if offset < alarmDays { alarms.append(occ) }
                } else if offset < notificationDays {
                    notifications.append(occ)
                    if offset == 0 { todayNotifications += 1 }
                }
            }
        }
        alarms.sort { ($0.fireAt, $0.key) < ($1.fireAt, $1.key) }
        notifications.sort { ($0.fireAt, $0.key) < ($1.fireAt, $1.key) }
        return ReminderPlan(alarms: alarms,
                            notifications: Array(notifications.prefix(max(notificationCap, 0))),
                            todayOverflow: todayNotifications > notificationCap)
    }

    /// Every enabled reminder's occurrence on that local day (ignores done / now).
    public static func occurrences(on day: String, _ reminders: [Reminder], calendar: Calendar) -> [ReminderOccurrence] {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
              let start = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { return [] }
        let weekday = (calendar.component(.weekday, from: start) + 5) % 7 + 1 // ISO: 1 = Monday ... 7 = Sunday
        var result: [ReminderOccurrence] = []
        for reminder in reminders where reminder.enabled {
            switch reminder.repeats {
            case .once(let d): if d != day { continue }
            case .daily: break
            case .weekdays(let set): if !set.contains(weekday) { continue }
            }
            guard let fireAt = calendar.date(bySettingHour: reminder.hour, minute: reminder.minute, second: 0, of: start) else { continue }
            result.append(ReminderOccurrence(reminderId: reminder.id, day: day, fireAt: fireAt))
        }
        return result
    }

    public static func dayString(_ date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
