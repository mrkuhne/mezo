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
    public var bedtimeEnabled = false
    public var bedtimeMinutesBefore = 30

    public init() {}

    /// A file written before a key existed decodes with that key's default (bedtime stays opt-in).
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = BoopReminderSettings()
        morning = try c.decodeIfPresent(Slot.self, forKey: .morning) ?? d.morning
        noon = try c.decodeIfPresent(Slot.self, forKey: .noon) ?? d.noon
        afternoon = try c.decodeIfPresent(Slot.self, forKey: .afternoon) ?? d.afternoon
        closeEnabled = try c.decodeIfPresent(Bool.self, forKey: .closeEnabled) ?? d.closeEnabled
        closeMinutesBeforeBed = try c.decodeIfPresent(Int.self, forKey: .closeMinutesBeforeBed) ?? d.closeMinutesBeforeBed
        bedtimeEnabled = try c.decodeIfPresent(Bool.self, forKey: .bedtimeEnabled) ?? d.bedtimeEnabled
        bedtimeMinutesBefore = try c.decodeIfPresent(Int.self, forKey: .bedtimeMinutesBefore) ?? d.bedtimeMinutesBefore
    }
}
