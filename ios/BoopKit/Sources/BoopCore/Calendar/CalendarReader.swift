import Foundation

/// One event from the device calendar (the iPhone's accounts, Google included).
///
/// `externalId` is the stable server key of this occurrence: EventKit's
/// `calendarItemExternalIdentifier` (fallback `eventIdentifier`) + "|" + the occurrence start (ISO 8601),
/// see `calendarExternalId`.
public struct CalendarItem: Sendable, Equatable {
    public let externalId: String
    public let title: String
    public let start: Date
    public let end: Date
    public let allDay: Bool
    public let calendar: String
    public init(externalId: String, title: String, start: Date, end: Date, allDay: Bool, calendar: String) {
        self.externalId = externalId; self.title = title; self.start = start; self.end = end; self.allDay = allDay; self.calendar = calendar
    }
}

public enum CalendarAccess: Sendable, Equatable { case granted, denied, notDetermined }

/// What Boop reads from the device calendar (read-only). `CalendarKitReader` is the EventKit one.
public protocol CalendarReader: Sendable {
    func access() async -> CalendarAccess
    func requestAccess() async -> CalendarAccess
    func items(from: Date, to: Date) async throws -> [CalendarItem]
}

/// `<EventKit id>|<occurrence start, ISO 8601 UTC>`, at most 200 characters (the contract's limit; a
/// very long EventKit id is cut, the occurrence part always stays).
public func calendarExternalId(itemId: String, occurrenceStart: Date) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    let suffix = "|" + f.string(from: occurrenceStart)
    return String(itemId.prefix(200 - suffix.count)) + suffix
}
