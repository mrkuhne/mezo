#if canImport(EventKit)
import EventKit
import Foundation

/// EventKit reader: every calendar on the device (Google accounts added in iOS Settings included).
/// Boop only reads; it never writes to the calendar.
public final class CalendarKitReader: CalendarReader, @unchecked Sendable {
    private let store = EKEventStore()
    public init() {}

    public func access() async -> CalendarAccess {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .fullAccess: .granted
        case .notDetermined: .notDetermined
        default: .denied
        }
    }

    public func requestAccess() async -> CalendarAccess {
        _ = try? await store.requestFullAccessToEvents()
        return await access()
    }

    public func items(from: Date, to: Date) async throws -> [CalendarItem] {
        let predicate = store.predicateForEvents(withStart: from, end: to, calendars: nil)
        return store.events(matching: predicate).map {
            CalendarItem(externalId: calendarExternalId(
                             itemId: $0.calendarItemExternalIdentifier ?? $0.eventIdentifier ?? $0.calendarItemIdentifier,
                             occurrenceStart: $0.startDate),
                         title: $0.title ?? "", start: $0.startDate, end: $0.endDate,
                         allDay: $0.isAllDay, calendar: $0.calendar?.title ?? "")
        }
    }
}
#endif
