import Foundation

/// What Nap · Mai shows before the morning brief exists (S2.5): one state, in priority order
/// offline › not connected › syncing › learning (< 14 nights) › no calendar › ready.
public enum NapEmptyState: Equatable, Sendable {
    case notConnected, syncing(progress: Double), learning(nights: Int), noCalendar, offline, ready

    /// Nights of sleep Boop needs before it gives a score.
    public static let nightsNeeded = 14

    public static func from(connected: Bool, syncProgress: Double?, nights: Int, calendarRows: Int, online: Bool) -> NapEmptyState {
        if !online { return .offline }
        if !connected { return .notConnected }
        if let p = syncProgress { return .syncing(progress: p) }
        if nights < nightsNeeded { return .learning(nights: nights) }
        if calendarRows == 0 { return .noCalendar }
        return .ready
    }
}
