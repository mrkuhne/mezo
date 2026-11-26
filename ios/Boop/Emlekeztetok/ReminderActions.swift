import BoopCore
import Foundation
import os

/// A supplement group taken from a reminder's „Kész” / „Bevettem”: the day is the occurrence's (a notification cleared the
/// next morning is yesterday's intake), and so is the moment unless the press is on that same day.
struct SupplementPress: Equatable, Sendable {
    let daypart: String
    let day: String
    let capturedAt: Date
}

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
        let supplement: ((SupplementPress) async -> Void)?
        if let env {
            supplement = { press in
                do { try await env.captureSupplementTick(daypart: press.daypart, at: press.capturedAt, day: press.day) }
                catch { log.error("supplement tick failed: \(error.localizedDescription, privacy: .public)") }
            }
        } else if let parts {
            supplement = { press in
                if !(await parts.tick(press)) { log.error("headless supplement tick not kept") }
            }
        } else {
            supplement = nil
        }
        let scheduler = ReminderHub.scheduler ?? parts.map { HeadlessContext.scheduler(for: $0) }  // the one cached headless chain
        await done(key: key, store: store, supplement: supplement, center: SystemReminderCenter(),
                   refresh: { await scheduler?.refresh(askPermission: false) })
    }

    /// A tick from the page or Ma's fold: a done row opens again (reminder only), an open one goes through the same path
    /// as the alarm's „Kész” / „Bevettem” (tick, supplement intake for a linked reminder, snooze cancelled, re-armed).
    static func toggleTick(_ row: TodayRow, store: ReminderStore) {
        if row.done { store.untick(row.key) } else { Task { await done(key: row.key) } }
    }

    /// Tick, cancel a pending snooze of the reminder, then the supplement tick if linked to a group, then the refresh.
    static func done(key: String, store: ReminderStore, supplement: ((SupplementPress) async -> Void)?,
                     center: ReminderCenter? = nil, refresh: () async -> Void, now: Date = Date(),
                     calendar: Calendar = .current) async {
        // Only the signed-in user's own reminder: a notification left by another account ticks nothing.
        guard let rid = reminderId(ofKey: key), store.file.reminders.contains(where: { $0.id == rid }) else { return }
        store.tick(key)
        center?.cancel(id: "\(snoozePrefix)\(rid.uuidString)")
        if let r = store.file.reminders.first(where: { $0.id == rid }), case .supplement(let daypart) = r.link,
           let day = key.split(separator: "|").last.map(String.init) {
            await supplement?(SupplementPress(daypart: daypart, day: day,
                                              capturedAt: capturedAt(day: day, reminder: r, now: now, calendar: calendar)))
        }
        await refresh()
    }

    /// The moment an intake is logged at: the press when it is on the occurrence's day, else the occurrence's own ring
    /// (Boop's data must say when it happened — D8).
    nonisolated static func capturedAt(day: String, reminder r: Reminder, now: Date, calendar: Calendar) -> Date {
        guard ReminderPlanner.dayString(now, calendar: calendar) != day else { return now }
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let start = calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2])),
              let ring = calendar.date(bySettingHour: r.hour, minute: r.minute, second: 0, of: start) else { return now }
        return min(ring, now)
    }

    /// The signed-in user's reminder store (live, else re-read from the files of the last signed-in user); nil when nobody is.
    static func currentStore() -> ReminderStore? {
        if let live = ReminderHub.store { return live }
        guard let p = HeadlessContext.parts() else { return nil }
        p.store.reload()
        return p.store
    }

    /// „10 perc múlva”: one more notification at now + 600 s, carrying the same title, category and occurrence key
    /// (the originating key rides in the route's query). Only for a reminder of the signed-in user (`store`): with nobody
    /// signed in, or another account's notification, nothing rings again (it would show the old account's title).
    static func snooze(reminderId: UUID, key: String, title: String, store: ReminderStore?, center: ReminderCenter, now: Date,
                       calendar: Calendar = .current) async {
        guard let store, store.file.reminders.contains(where: { $0.id == reminderId }) else { return }
        let at = now.addingTimeInterval(TimeInterval(snoozeSeconds))
        let c = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: at)
        try? await center.scheduleOnce(id: "\(snoozePrefix)\(reminderId.uuidString)",
                                       on: DateComponents(year: c.year, month: c.month, day: c.day),
                                       hour: c.hour ?? 0, minute: c.minute ?? 0,
                                       title: title, body: "", route: snoozeRoute(key: key))
    }
}

/// Runs only the last of a burst of changes, after a pause (a time wheel spun through many values re-arms once).
@MainActor
final class Debouncer {
    private let delay: Duration
    private var pending: Task<Void, Never>?
    private var work: (@MainActor () -> Void)?

    init(delay: Duration = .milliseconds(600)) { self.delay = delay }

    func submit(_ work: @escaping @MainActor () -> Void) {
        self.work = work
        pending?.cancel()
        pending = Task { [weak self, delay] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            self?.flush()
        }
    }

    /// Runs what is pending now (the view goes away).
    func flush() {
        pending?.cancel()
        pending = nil
        let w = work
        work = nil
        w?()
    }
}
