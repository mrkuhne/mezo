import BoopCore
import Foundation

/// What the buttons that work without opening the app do (the alarm's „Kész” / „Bevettem”, the notification's
/// „Kész” and „10 perc múlva”). Silencing an alarm is NOT here on purpose: it never ticks (spec D8).
@MainActor
enum ReminderActions {
    static let snoozeSeconds = 600
    static let snoozePrefix = "boop.rem.snooze."

    /// The reminder an occurrence key (`<uuid>|<yyyy-MM-dd>`) belongs to.
    nonisolated static func reminderId(ofKey key: String) -> UUID? {
        key.split(separator: "|").first.flatMap { UUID(uuidString: String($0)) }
    }

    /// Done for one occurrence, from wherever the press came: prefers the live stores of this process, else builds them
    /// from the files of the last signed-in user. Nothing to do when nobody is signed in.
    static func done(key: String) async {
        if let store = ReminderHub.store {
            let supplement: ((String, Date) async -> Void)?
            if let env = BackgroundSyncHost.ritmus {
                supplement = { daypart, at in try? await env.captureSupplementTick(daypart: daypart, at: at) }
            } else if let parts = HeadlessContext.parts() {
                supplement = { daypart, at in await parts.tick(daypart: daypart, at: at) }
            } else {
                supplement = nil
            }
            let scheduler = ReminderHub.scheduler
            await done(key: key, store: store, supplement: supplement, refresh: { await scheduler?.refresh(askPermission: false) })
            return
        }
        guard let parts = HeadlessContext.parts() else { return }
        let scheduler = HeadlessContext.scheduler(for: parts)
        await done(key: key, store: parts.store, supplement: { daypart, at in await parts.tick(daypart: daypart, at: at) },
                   refresh: { await scheduler.refresh(askPermission: false) })
    }

    /// Tick, then the supplement tick if the reminder is linked to a group, then the scheduler refresh.
    static func done(key: String, store: ReminderStore, supplement: ((String, Date) async -> Void)?,
                     refresh: () async -> Void, now: Date = Date()) async {
        store.tick(key)
        if let id = reminderId(ofKey: key), let r = store.file.reminders.first(where: { $0.id == id }),
           case .supplement(let daypart) = r.link {
            await supplement?(daypart, now)
        }
        await refresh()
    }

    /// „10 perc múlva”: one more notification at now + 600 s, carrying the same title, category and occurrence key
    /// (the centre derives the key from the day it is given; a snooze across midnight lands on the next day's key).
    static func snooze(reminderId: UUID, title: String, center: ReminderCenter, now: Date, calendar: Calendar = .current) async {
        let at = now.addingTimeInterval(TimeInterval(snoozeSeconds))
        let c = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: at)
        try? await center.scheduleOnce(id: "\(snoozePrefix)\(reminderId.uuidString)",
                                       on: DateComponents(year: c.year, month: c.month, day: c.day),
                                       hour: c.hour ?? 0, minute: c.minute ?? 0,
                                       title: title, body: "", route: ReminderScheduler.route)
    }
}
