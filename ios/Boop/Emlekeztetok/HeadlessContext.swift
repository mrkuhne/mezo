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

    private static var cached: (userId: UUID, base: URL, parts: Parts)?
    /// The one scheduler of the cached parts: back-to-back presses (two alarms in the same minute, an alarm and a
    /// notification) queue on one chain instead of re-arming side by side.
    private static var cachedScheduler: (userId: UUID, scheduler: ReminderScheduler)?

    /// Forget the cached parts (sign-out); a user change is noticed by the cache key itself. Returns the retired headless
    /// scheduler's last queued work, for whoever clears after it.
    @discardableResult
    static func invalidate() -> Task<Void, Never>? {
        cached = nil
        return handOver()
    }

    /// The live scheduler takes over: the headless one is retired (its queued work still finishes) and its last queued
    /// work is returned so the live one starts after it.
    @discardableResult
    static func handOver() -> Task<Void, Never>? {
        guard let c = cachedScheduler else { return nil }
        cachedScheduler = nil
        c.scheduler.retire()
        return c.scheduler.tail
    }

    /// nil when nobody is remembered as signed in. One `Outbox` actor per user (back-to-back presses share it).
    static func parts(userId: UUID? = BackgroundSyncHost.lastUserId, base: URL = .applicationSupportDirectory,
                      calendar: Calendar = .current) -> Parts? {
        guard let userId else { return nil }
        if let c = cached, c.userId == userId, c.base == base { return c.parts }
        let p = build(userId: userId, base: base, calendar: calendar)
        cached = (userId, base, p)
        if let s = cachedScheduler, s.userId != userId { handOver() }
        return p
    }

    private static func build(userId: UUID, base: URL, calendar: Calendar) -> Parts {
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

    /// The one scheduler for a process with no `ReminderHub` (over the real alarm and notification centres unless a test
    /// hands in its own); built once per user and reused by every headless press and background wake.
    static func scheduler(for parts: Parts, alarms: AlarmScheduling? = nil, center: ReminderCenter? = nil,
                          book: AlarmIdBook? = nil) -> ReminderScheduler {
        if let c = cachedScheduler, c.userId == parts.userId { return c.scheduler }
        let s = ReminderScheduler(store: parts.store, alarms: alarms ?? SystemAlarmScheduler(), center: center ?? SystemReminderCenter(),
                                  book: book ?? AlarmIdBook(userKey: parts.userId.uuidString))
        cachedScheduler = (parts.userId, s)
        return s
    }

    /// Who keeps the reminders armed right now: the live scheduler, else (a cold background launch, an alarm button with
    /// the app killed) the headless one over the files of the last signed-in user, re-read first. nil when nobody is signed in.
    static func activeScheduler(userId: UUID? = BackgroundSyncHost.lastUserId,
                                base: URL = .applicationSupportDirectory) -> ReminderScheduler? {
        if let live = ReminderHub.scheduler { return live }
        guard let p = parts(userId: userId, base: base) else { return nil }
        p.store.reload()
        return scheduler(for: p)
    }

    nonisolated static func day(of date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
