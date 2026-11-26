import Foundation

/// One in-app reminder (Apple-Reminders-style list); it rings as an AlarmKit alarm or a local notification.
public struct Reminder: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var title: String
    public var note: String?
    public var hour: Int
    public var minute: Int
    public var repeats: ReminderRepeat
    public var strength: ReminderStrength
    public var enabled: Bool
    public var link: ReminderLink

    public init(id: UUID = UUID(), title: String, note: String? = nil, hour: Int, minute: Int,
                repeats: ReminderRepeat, strength: ReminderStrength = .notification,
                enabled: Bool = true, link: ReminderLink = .none) {
        self.id = id
        self.title = title
        self.note = note
        self.hour = hour
        self.minute = minute
        self.repeats = repeats
        self.strength = strength
        self.enabled = enabled
        self.link = link
    }
}

public enum ReminderRepeat: Codable, Equatable, Sendable {
    /// A single day, `yyyy-MM-dd` in the device zone.
    case once(String)
    case daily
    /// ISO weekdays: 1 = Monday ... 7 = Sunday.
    case weekdays(Set<Int>)
}

public enum ReminderStrength: String, Codable, Sendable {
    case alarm, notification
}

public enum ReminderLink: Codable, Equatable, Sendable {
    case none
    case supplement(daypart: String)
}
