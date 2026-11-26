import BoopCore
import Foundation
import os

/// What the buttons that work without opening the app do (the alarm's „Kész” / „Bevettem”, the notification's
/// „Kész” and „10 perc múlva”). Silencing an alarm is NOT here on purpose: it never ticks (spec D8).
@MainActor
enum ReminderActions {
    static let snoozeSeconds = 600
    static let snoozePrefix = "boop.rem.snooze."
    private static let log = Logger(subsystem: "hu.mezo.boop", category: "ReminderActions")

    /// The route a snooze carries: the originating occurrence key rides in its query (a snooze across midnight must
    /// still act on the day it came from).
    nonisolated static func snoozeRoute(key: String) -> String {
        var c = URLComponents(string: ReminderScheduler.route)!
        c.queryItems = [URLQueryItem(name: "key", value: key)]
        return c.string ?? ReminderScheduler.route
    }

    nonisolated static func key(inRoute route: String) -> String? {
        URLComponents(string: route)?.queryItems?.first { $0.name == "key" }?.value
    }

    /// The reminder an occurrence key (`<uuid>|<yyyy-MM-dd>`) belongs to.
    nonisolated static func reminderId(ofKey key: String) -> UUID? {
        key.split(separator: "|").first.flatMap { UUID(uuidString: String($0)) }
    }

    /// Done for one occurrence, from wherever the press came: prefers the live stores of this process, else builds them
    /// from the files of the last signed-in user. Nothing to do when nobody is signed in.
    static func done(key: String) async {
        let env = BackgroundSyncHost.ritmus
        let parts = (ReminderHub.store == nil || env == nil) ? HeadlessContext.parts() : nil
        guard let store = ReminderHub.store ?? parts?.store else { return }
        if ReminderHub.store == nil { store.reload() }
        let supplement: ((String, Date) async -> Void)?
        if let env {
            supplement = { daypart, at in
                do { try await env.captureSupplementTick(daypart: daypart, at: at) }
                catch { log.error("supplement tick failed: \(error.localizedDescription, privacy: .public)") }
            }
        } else if let parts {
            supplement = { daypart, at in
                if !(await parts.tick(daypart: daypart, at: at)) { log.error("headless supplement tick not kept") }
            }
        } else {
            supplement = nil
        }
        let scheduler = ReminderHub.scheduler ?? parts.map { HeadlessContext.scheduler(for: $0) }
        await done(key: key, store: store, supplement: supplement, center: SystemReminderCenter(),
                   refresh: { await scheduler?.refresh(askPermission: false) })
    }

    /// Tick, cancel a pending snooze of the reminder, then the supplement tick if linked to a group, then the refresh.
    static func done(key: String, store: ReminderStore, supplement: ((String, Date) async -> Void)?,
                     center: ReminderCenter? = nil, refresh: () async -> Void, now: Date = Date()) async {
        store.tick(key)
        if let id = reminderId(ofKey: key) {
            center?.cancel(id: "\(snoozePrefix)\(id.uuidString)")
            if let r = store.file.reminders.first(where: { $0.id == id }), case .supplement(let daypart) = r.link {
                await supplement?(daypart, now)
            }
        }
        await refresh()
    }

    /// „10 perc múlva”: one more notification at now + 600 s, carrying the same title, category and occurrence key
    /// (the originating key rides in the route's query).
    static func snooze(reminderId: UUID, key: String, title: String, center: ReminderCenter, now: Date, calendar: Calendar = .current) async {
        let at = now.addingTimeInterval(TimeInterval(snoozeSeconds))
        let c = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: at)
        try? await center.scheduleOnce(id: "\(snoozePrefix)\(reminderId.uuidString)",
                                       on: DateComponents(year: c.year, month: c.month, day: c.day),
                                       hour: c.hour ?? 0, minute: c.minute ?? 0,
                                       title: title, body: "", route: snoozeRoute(key: key))
    }
}
