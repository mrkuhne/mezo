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
    static let prefix = "boop.rem."
    static let route = "boop://emlekeztetok"
    private static let log = Logger(subsystem: "hu.mezo.boop", category: "ReminderScheduler")

    private(set) var state: [UUID: ArmState] = [:]

    @ObservationIgnored private let store: ReminderStore
    @ObservationIgnored private let alarms: AlarmScheduling
    @ObservationIgnored private let center: ReminderCenter
    @ObservationIgnored private let clock: @Sendable () -> Date
    @ObservationIgnored private let calendar: Calendar
    @ObservationIgnored private var inFlight: Task<Void, Never>?

    init(store: ReminderStore, alarms: AlarmScheduling, center: ReminderCenter,
         clock: @escaping @Sendable () -> Date = { Date() }, calendar: Calendar = .current) {
        self.store = store
        self.alarms = alarms
        self.center = center
        self.clock = clock
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        greg.locale = Locale(identifier: "en_US_POSIX")
        self.calendar = greg
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

    private func clearAll() async {
        await alarms.cancelAll(prefix: Self.prefix)
        for id in await center.pendingIds(withPrefix: Self.prefix) { center.cancel(id: id) }
    }

    private func run(askPermission: Bool) async {
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

        await clearAll()

        // alarms
        var failed: [UUID: String] = [:]
        var alarmUntil: [UUID: Date] = [:]
        var expectedAlarmIds: [UUID: Set<String>] = [:]
        for occ in plan.alarms {
            guard !Task.isCancelled else { return }
            guard failed[occ.reminderId] == nil, let r = byId[occ.reminderId] else { continue }
            let secondary: String = { if case .supplement = r.link { return "Bevettem" } else { return "Kész" } }()
            do {
                try await alarms.schedule(occ, title: r.title, secondaryTitle: secondary)
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
            let held = await alarms.scheduledIds()
            for (rid, ids) in expectedAlarmIds where failed[rid] == nil && !ids.isSubset(of: held) {
                failed[rid] = "Az ébresztő nem maradt beállítva."
            }
        }

        // notifications
        var notifUntil: [UUID: Date] = [:]
        if notificationsAllowed {
            for occ in plan.notifications {
                guard !Task.isCancelled else { return }
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
