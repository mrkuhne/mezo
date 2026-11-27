import BoopCore
import BoopShared
import Foundation
import WidgetKit

/// Keeps the widgets' snapshot true (`mezo-r36n9.172`, spec §7.2): written into the shared Keychain (the free team
/// has no App Group) whenever the day's plan arrives or a reminder changes — also from a background tick (alarm,
/// notification, widget), where only the reminders are rebuilt and the plan rows last written are kept.
@MainActor enum WidgetSnapshotWriter {
    /// The day's plan arrived (or changed): the whole snapshot. A brief for another day writes nothing.
    static func write(brief: Brief, store: ReminderStore, now: Date = Date(), calendar: Calendar = .current) {
        guard brief.date == ReminderPlanner.dayString(now, calendar: calendar) else { return refreshReminders(store: store, now: now, calendar: calendar) }
        save(WidgetSnapshotBuilder.make(rows: DayPlan.rows(brief), reminders: store.file, owner: owner, now: now, calendar: calendar))
    }

    /// A reminder changed: today's plan rows stay as last written (when they are today's), the reminders are rebuilt.
    static func refreshReminders(store: ReminderStore, now: Date = Date(), calendar: Calendar = .current) {
        let fresh = WidgetSnapshotBuilder.make(rows: nil, reminders: store.file, owner: owner, now: now, calendar: calendar)
        if let old = WidgetSnapshotStore.load(), old.day == fresh.day, old.hasPlan, old.owner == owner {
            save(WidgetSnapshot(writtenAt: old.writtenAt, owner: owner, day: old.day, hasPlan: true, items: old.items,
                                reminders: fresh.reminders))
        } else {
            save(fresh)
        }
    }

    /// Signed out: nothing of the account stays on the Home or Lock Screen.
    static func clear() {
        WidgetSnapshotStore.clear()
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// The signed-in user (live, else the last one a background wake works for).
    private static var owner: String? { ReminderHub.userKey ?? BackgroundSyncHost.lastUserId?.uuidString }

    private static func save(_ s: WidgetSnapshot) {
        if let old = WidgetSnapshotStore.load(), old.owner == s.owner, old.day == s.day, old.hasPlan == s.hasPlan, old.items == s.items,
           old.reminders == s.reminders { return }     // nothing a widget would show differently: no reload spent
        WidgetSnapshotStore.save(s)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
