import Foundation
import BoopCore

// The Sunday review's one local notification (`mezo-r36n9.196`, spec §4.3): Sunday 18:00 local, one per week, only
// while a season exists and only when notifications are already allowed — the app never asks for it.

@MainActor final class WeeklyReviewReminder {
    static let route = "boop://heti-atnezes"
    static let title = "Kész a heti átnézés"
    static let body = "Öt rövid lépés a hetedről — két perc."

    private let center: ReminderCenter
    private let log: EvadReviewLog
    private let calendar: Calendar

    init(center: ReminderCenter, log: EvadReviewLog, calendar: Calendar = .current) {
        self.center = center
        self.log = log
        self.calendar = calendar
    }

    /// Arms next Sunday's notification (or clears every pending one without a season). Other weeks' pending requests
    /// go, so only one ever waits.
    func refresh(now: Date, hasSeason: Bool) async {
        let allowed = hasSeason ? await center.status() == .allowed : false
        switch evadReviewReminder(now: now, hasSeason: hasSeason, allowed: allowed, done: log.doneWeeks, calendar: calendar) {
        case .cancelAll:
            for id in await center.pendingIds(withPrefix: evadReviewReminderPrefix) { center.cancel(id: id) }
        case .keep:
            break
        case .schedule(let id, let fireAt):
            for old in await center.pendingIds(withPrefix: evadReviewReminderPrefix) where old != id { center.cancel(id: old) }
            let day = calendar.dateComponents([.year, .month, .day], from: fireAt)
            try? await center.scheduleOnce(id: id, on: day, hour: 18, minute: 0, title: Self.title, body: Self.body,
                                           route: Self.route)
        }
    }
}

extension WeeklyReviewReminder {
    /// Sign-out: the request id carries no user, so the waiting Sunday request and a delivered one go with the account.
    static func signedOut(center: ReminderCenter) async {
        for id in await center.pendingIds(withPrefix: evadReviewReminderPrefix) { center.cancel(id: id) }
        center.removeDelivered(withPrefix: evadReviewReminderPrefix)
    }
}

/// The signed-in user's review log on this phone.
@MainActor func weeklyReviewLog() -> EvadReviewLog {
    EvadReviewLog(defaults: .standard, userKey: ReminderHub.userKey ?? "anon")
}
