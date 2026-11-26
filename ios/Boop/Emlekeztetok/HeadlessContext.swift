import BoopCore
import Foundation
import os

/// The signed-in user's stores built straight from files, for when no UI exists (an alarm button pressed while Boop
/// is not running: `LiveActivityIntent`s run in the app's process, launched in the background, with no `RootView`).
/// The queued writes are only *written down* here; the outbox sends them on the next flush of a live session.
@MainActor
enum HeadlessContext {
    nonisolated private static let log = Logger(subsystem: "hu.mezo.boop", category: "HeadlessContext")

    /// Never sends: a headless outbox only keeps the item; the live one delivers it (no network call in this path).
    private struct KeepOnly: OutboxSender {
        func send(_ item: OutboxItem) async -> OutboxSendResult { .offline }
    }

    /// Everything one user's alarm button needs.
    @MainActor struct Parts {
        let userId: UUID
        let store: ReminderStore
        let outbox: Outbox
        let taken: SupplementTakenStore
        let calendar: Calendar

        /// A supplement group taken: counts as taken at once and is queued (same item as `captureSupplementTick`).
        /// Already taken (the room before the alarm, a double tap) queues nothing more. Returns false when the phone could
        /// not keep it.
        @discardableResult
        func tick(daypart: String, at date: Date) async -> Bool {
            let day = HeadlessContext.day(of: date, calendar: calendar)
            guard taken.taken(day: day)[daypart] == nil else { return true }
            do {
                try await outbox.enqueue(SupplementTickHub.item(day: day, daypart: daypart, capturedAt: date), rollbackOnFailure: true)
                taken.markTaken(day: day, daypart: daypart, ids: nil)
                return true
            } catch {
                HeadlessContext.log.error("could not queue the supplement tick: \(error.localizedDescription, privacy: .public)")
                return false
            }
        }
    }

    /// nil when nobody is remembered as signed in.
    static func parts(userId: UUID? = BackgroundSyncHost.lastUserId, base: URL = .applicationSupportDirectory,
                      calendar: Calendar = .current) -> Parts? {
        guard let userId else { return nil }
        let root = RitmusEnvironment.userRoot(for: userId, base: base)
        let dirs = RitmusEnvironment.directories(for: userId, base: base)
        return Parts(userId: userId,
                     store: ReminderStore(fileURL: root.appendingPathComponent("reminders.json")),
                     outbox: Outbox(directory: dirs.outbox, sender: KeepOnly()),
                     taken: SupplementTakenStore(fileURL: root.appendingPathComponent("supplements-taken.json")),
                     calendar: calendar)
    }

    static func reminderStore() -> ReminderStore? { parts()?.store }
    /// The same per-user queue file the UI's outbox uses; nil when signed out.
    static func outbox() -> Outbox? { parts()?.outbox }

    /// A scheduler over the real alarm and notification centres, for a process with no `ReminderHub`.
    static func scheduler(for parts: Parts) -> ReminderScheduler {
        ReminderScheduler(store: parts.store, alarms: SystemAlarmScheduler(userKey: parts.userId.uuidString),
                          center: SystemReminderCenter())
    }

    nonisolated static func day(of date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
