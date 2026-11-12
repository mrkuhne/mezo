import Foundation
import Observation

/// The daily loop's full-screen moments.
enum RitmusCover: String, Identifiable, Sendable {
    /// The check-in (`boop://checkin` as the notifications' internal route name).
    case checkin
    /// The evening close (`boop://este`).
    case este
    var id: String { rawValue }

    /// The internal route name a notification carries (`boop://checkin` / `boop://este`); no URL scheme is registered.
    init?(route: String) {
        switch route {
        case "boop://checkin": self = .checkin
        case "boop://este": self = .este
        default: return nil
        }
    }
}

/// Which daily-loop cover is asked for (B3 ruling: no URL scheme). Ma's rows, the lens pill, *Kitöltöm*, the "+" sheet —
/// and Task 14's notification delegate — set `cover`; the shell presents it at page level (boop-ios.md §9) and clears it
/// on close. One app-wide instance, so code outside the view tree (the notification delegate) can reach it.
@MainActor @Observable
final class RitmusRouter {
    static let shared = RitmusRouter()

    var cover: RitmusCover?

    func open(_ cover: RitmusCover) { self.cover = cover }
    func close() { cover = nil }

    /// Takes the cover that is asked for but not shown yet (a notification tap that landed before the shell was up, or
    /// while a sheet was open) and clears it, so the shell can present it once nothing else is in the way.
    func takePending() -> RitmusCover? {
        defer { cover = nil }
        return cover
    }
}
