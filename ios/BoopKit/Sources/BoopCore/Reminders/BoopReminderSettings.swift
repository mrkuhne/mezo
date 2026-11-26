import Foundation

/// Settings of the built-in (non-user) reminders: the three supplement dayparts, the day close and bedtime nudges.
public struct BoopReminderSettings: Codable, Equatable, Sendable {
    public struct Slot: Codable, Equatable, Sendable {
        public var enabled: Bool
        public var hour: Int
        public var minute: Int

        public init(enabled: Bool, hour: Int, minute: Int) {
            self.enabled = enabled
            self.hour = hour
            self.minute = minute
        }
    }

    public var morning = Slot(enabled: true, hour: 7, minute: 30)
    public var noon = Slot(enabled: true, hour: 12, minute: 30)
    public var afternoon = Slot(enabled: true, hour: 16, minute: 0)
    public var closeEnabled = true
    public var closeMinutesBeforeBed = 75
    public var bedtimeEnabled = true
    public var bedtimeMinutesBefore = 30

    public init() {}
}
