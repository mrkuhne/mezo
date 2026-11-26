import BoopCore
import Foundation
import Observation
import os

/// What the page shows for one reminder's arming.
enum ArmState: Equatable {
    case armed(until: Date?)
    case fellBackToNotification
    case failed(String)
    case notificationsDenied
}

/// The one owner of "what is armed" for the user's own reminders: clears and re-adds the whole `boop.rem.` family
/// (alarms for the next 7 days, dated notifications for the next 3), serialized through a task chain like
/// `RitmusReminders.refresh`.
@MainActor @Observable
final class ReminderScheduler {
    nonisolated static let prefix = "boop.rem."
    nonisolated static let route = "boop://emlekeztetok"
    private static let log = Logger(subsystem: "hu.mezo.boop", category: "ReminderScheduler")

    private(set) var state: [UUID: ArmState] = [:]

    @ObservationIgnored private let store: ReminderStore
    @ObservationIgnored private let alarms: AlarmScheduling
    /// Which alarms are ours, and what each was armed as.
    @ObservationIgnored private let book: AlarmIdBook
    @ObservationIgnored private let center: ReminderCenter
    @ObservationIgnored private let clock: @Sendable () -> Date
    /// nil = follow the device: a fresh calendar in the current time zone for every run (travel is respected).
    @ObservationIgnored private let injectedCalendar: Calendar?
    @ObservationIgnored private var inFlight: Task<Void, Never>?

    init(store: ReminderStore, alarms: AlarmScheduling, center: ReminderCenter, book: AlarmIdBook? = nil,
         clock: @escaping @Sendable () -> Date = { Date() }, calendar: Calendar? = nil,
         startingAfter: Task<Void, Never>? = nil) {
        self.inFlight = startingAfter
        self.store = store
        self.alarms = alarms
        self.book = book ?? AlarmIdBook.inMemory()
        self.center = center
        self.clock = clock
        self.injectedCalendar = calendar
    }

    /// Gregorian in the zone the phone is in right now (or the injected calendar's zone).
    private func makeCalendar() -> Calendar {
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = injectedCalendar?.timeZone ?? TimeZone.autoupdatingCurrent
        greg.locale = Locale(identifier: "en_US_POSIX")
        return greg
    }

    /// Puts what is armed in line with the store. `askPermission`: the system prompts may appear (after an edit);
    /// otherwise nothing is requested. Queued behind a refresh already running.
    func refresh(askPermission: Bool) async {
        await enqueue { await $0.run(askPermission: askPermission) }
    }

    /// Sign-out / user switch: cancels every alarm and notification of the family.
    func signedOut() async {
        await enqueue { await $0.clearAll(); $0.state = [:] }
    }

    private func enqueue(_ work: @escaping @MainActor (ReminderScheduler) async -> Void) async {
        let previous = inFlight
        let task = Task { [weak self] in
            await previous?.value
            guard let self, !Task.isCancelled else { return }
            await work(self)
        }
        inFlight = task
        await withTaskCancellationHandler { await task.value } onCancel: { task.cancel() }
    }

    /// Sign-out: every alarm and notification of the family goes (a ringing one too: it belongs to the account that left),
    /// and what already rang is taken out of the notification centre.
    private func clearAll() async {
        for id in book.entries.keys {
            await alarms.cancel(id: id)
            book.forget(id)
        }
        for id in await center.pendingIds(withPrefix: Self.prefix) { center.cancel(id: id) }
        center.removeDelivered(withPrefix: Self.prefix)
    }

    /// What an alarm was armed as: a ring with the same id but another moment or words must be armed again.
    private static func fingerprint(_ o: ReminderOccurrence, title: String, secondary: String) -> String {
        "\(Int(o.fireAt.timeIntervalSince1970))|\(title)|\(secondary)"
    }

    private static func secondaryTitle(_ r: Reminder) -> String {
        if case .supplement = r.link { "Bevettem" } else { "Kész" }
    }

    private func run(askPermission: Bool) async {
        let calendar = makeCalendar()
        let reminders = store.file.reminders.filter(\.enabled)
        let byId = Dictionary(reminders.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })

        var alarmAuth = await alarms.authorization()
        if alarmAuth == .notDetermined, askPermission, reminders.contains(where: { $0.strength == .alarm }) {
            alarmAuth = await alarms.requestAuthorization()
        }
        let alarmsAllowed = alarmAuth == .allowed

        let plan = ReminderPlanner.plan(store.file.reminders, done: store.file.done, now: clock(), calendar: calendar,
                                        alarmsAllowed: alarmsAllowed)

        var notifStatus = await center.status()
        if notifStatus == .notDetermined, askPermission, !plan.notifications.isEmpty {
            notifStatus = await center.request() ? .allowed : .denied
        }
        let notificationsAllowed = notifStatus == .allowed
        guard !Task.isCancelled else { return }

        // From here on the run finishes arming even if its caller is cancelled.
        // Alarms: what already stands as planned stays; everything else of ours goes — except an alarm ringing right now
        // (a refresh from a Health wake or an unrelated edit must never silence it; it leaves once he silenced it).
        let alerting = await alarms.alertingIds()
        let held = await alarms.scheduledIds()
        var planned: [String: String] = [:]
        for occ in plan.alarms {
            guard let r = byId[occ.reminderId] else { continue }
            planned[occ.alarmId.uuidString] = Self.fingerprint(occ, title: r.title, secondary: Self.secondaryTitle(r))
        }
        var standing: Set<String> = []
        for (id, fp) in book.entries where !alerting.contains(id) {
            if planned[id] == fp, held?.contains(id) == true { standing.insert(id); continue }
            await alarms.cancel(id: id)
            book.forget(id)
        }
        // Notifications are re-added whole; the owner's „10 perc múlva” one-offs stay.
        for id in await center.pendingIds(withPrefix: Self.prefix) where !id.hasPrefix(ReminderActions.snoozePrefix) {
            center.cancel(id: id)
        }

        // alarms
        var failed: [UUID: String] = [:]
        var alarmUntil: [UUID: Date] = [:]
        var expectedAlarmIds: [UUID: Set<String>] = [:]
        for occ in plan.alarms {
            guard failed[occ.reminderId] == nil, let r = byId[occ.reminderId] else { continue }
            let secondary = Self.secondaryTitle(r)
            let id = occ.alarmId.uuidString
            if standing.contains(id) || alerting.contains(id) {
                alarmUntil[occ.reminderId] = occ.fireAt
                if standing.contains(id) { expectedAlarmIds[occ.reminderId, default: []].insert(id) }
                continue
            }
            do {
                // remembered before the system call: an alarm the call left behind can still be cancelled later
                book.remember(id, fingerprint: Self.fingerprint(occ, title: r.title, secondary: secondary))
                try await alarms.schedule(occ, title: r.title, secondaryTitle: secondary, tint: ReminderLook.hue(r).glow)
                alarmUntil[occ.reminderId] = occ.fireAt
                expectedAlarmIds[occ.reminderId, default: []].insert(occ.alarmId.uuidString)
            } catch AlarmArmError.limit {
                failed[occ.reminderId] = "Az iPhone nem enged több ébresztőt."
            } catch {
                Self.log.error("alarm failed: \(String(describing: error), privacy: .public)")
                failed[occ.reminderId] = "Nem sikerült beállítani az ébresztőt."
            }
        }
        // compare the system's list with ours (AlarmKit can lose alarms silently)
        if !expectedAlarmIds.isEmpty {
            if let held = await alarms.scheduledIds() {
                for (rid, ids) in expectedAlarmIds where failed[rid] == nil && !ids.isSubset(of: held) {
                    failed[rid] = "Az ébresztő nem maradt beállítva."
                }
            }
        }

        // notifications
        var notifUntil: [UUID: Date] = [:]
        if notificationsAllowed {
            for occ in plan.notifications {
                guard let r = byId[occ.reminderId] else { continue }
                let c = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: occ.fireAt)
                do {
                    try await center.scheduleOnce(id: "\(Self.prefix)\(occ.reminderId.uuidString).\(occ.day)",
                                                  on: DateComponents(year: c.year, month: c.month, day: c.day),
                                                  hour: c.hour ?? 0, minute: c.minute ?? 0,
                                                  title: r.title, body: r.note ?? "", route: Self.route)
                    notifUntil[occ.reminderId] = occ.fireAt
                } catch {
                    Self.log.error("notification failed: \(error.localizedDescription, privacy: .public)")
                    failed[occ.reminderId] = failed[occ.reminderId] ?? "Nem sikerült beállítani az értesítést."
                }
            }
        }

        var next: [UUID: ArmState] = [:]
        for r in reminders {
            if let why = failed[r.id] { next[r.id] = .failed(why); continue }
            if r.strength == .alarm && alarmsAllowed {
                next[r.id] = .armed(until: alarmUntil[r.id])
            } else if !notificationsAllowed {
                next[r.id] = .notificationsDenied
            } else if r.strength == .alarm {
                next[r.id] = .fellBackToNotification
            } else {
                next[r.id] = .armed(until: notifUntil[r.id])
            }
        }
        state = next
    }
}
