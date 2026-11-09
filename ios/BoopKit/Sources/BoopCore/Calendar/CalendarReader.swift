import Foundation

/// One event from the device calendar (the iPhone's accounts, Google included).
public struct CalendarItem: Sendable, Equatable {
    public let title: String
    public let start: Date
    public let end: Date
    public let allDay: Bool
    public let calendar: String
    public init(title: String, start: Date, end: Date, allDay: Bool, calendar: String) {
        self.title = title; self.start = start; self.end = end; self.allDay = allDay; self.calendar = calendar
    }
}

public enum CalendarAccess: Sendable, Equatable { case granted, denied, notDetermined }

/// What Boop reads from the device calendar (read-only). `CalendarKitReader` is the EventKit one.
public protocol CalendarReader: Sendable {
    func access() async -> CalendarAccess
    func requestAccess() async -> CalendarAccess
    func items(from: Date, to: Date) async throws -> [CalendarItem]
}
