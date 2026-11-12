import Foundation
import OSLog
import BoopCore

/// Which cover a notification's `route` opens (no URL scheme: the route name travels in the notification's userInfo).
enum RitmusNotificationRoute {
    static func cover(for userInfo: [AnyHashable: Any]) -> RitmusCover? {
        (userInfo["route"] as? String).flatMap(RitmusCover.init(route:))
    }
}

/// The daily loop's local reminders (spec §7.8): a check-in nudge at 07:30 / 12:30 / 16:00 for each moment not done yet,
/// and the close at the bedtime target − 75 minutes (21:30 without a target) while the day is open. They are one-time
/// notifications on a rolling seven-day horizon (a repeating clock time cannot skip a done day, and a one-shot per day
/// would fall silent after a day without the app): every refresh clears the whole family and adds back what should
/// still ring — a done moment or a closed evening is left out of its own day only. Rescheduled on every save, every
/// return to the app and every background wake. No badge, no guilt copy. The bedtime reminder is a separate request.
@MainActor
final class RitmusReminders {
    nonisolated static let idPrefix = "boop.ritmus."
    nonisolated static func checkInId(_ moment: CheckInMoment, day: String) -> String { idPrefix + "checkin." + moment.rawValue + "." + day }
    nonisolated static func closeId(day: String) -> String { idPrefix + "close." + day }

    /// How many days ahead (today included) are planned: 7 × 4 = 28 requests, far under the system's 64.
    static let horizonDays = 7
    static let closeLead = 75
    static let closeFallback = (hour: 21, minute: 30)
    static let checkInBody = "Mennyi energia van benned most? · 6 kérdés, fél perc"
    static let closeTitle = "Zárjuk le a napot"
    static let closeBody = "Egy perc: hogy vagy, sikerült-e a nap célja, milyen volt a nap."

    /// One reminder to ring.
    struct Plan: Equatable {
        let id: String
        let route: String
        let title: String
        let body: String
        let day: DateComponents
        let hour: Int
        let minute: Int
    }

    private static let log = Logger(subsystem: "io.mrkuhne.boop", category: "ritmus-reminders")
    private let center: ReminderCenter
    private let calendar: Calendar
    private let clock: @Sendable () -> Date
    /// The last bedtime target a brief gave: a refresh without one (a background wake) counts back from it.
    private var lastTarget: String?
    /// The refresh in flight; the next one waits for it, so two never interleave their cancel-and-add.
    private var inFlight: Task<Void, Never>?

    init(center: ReminderCenter = SystemReminderCenter(), calendar: Calendar = .current, clock: @escaping @Sendable () -> Date = { Date() }) {
        self.center = center
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        greg.locale = Locale(identifier: "en_US_POSIX")
        self.calendar = greg
        self.clock = clock
    }

    /// Puts the reminders in line with the ledger (and the bedtime target; nil = the last known one). `askPermission`:
    /// the system prompt may appear (once, after the first saved check-in or close); otherwise nothing is scheduled until
    /// the owner allowed it. Queued behind a refresh already running; a cancelled caller stops its own run.
    func refresh(ledger: LedgerStore, bedtimeTarget: String?, askPermission: Bool) async {
        if let bedtimeTarget { lastTarget = bedtimeTarget }
        let previous = inFlight
        let task = Task { [weak self] in
            await previous?.value
            guard let self, !Task.isCancelled else { return }
            await self.run(ledger: ledger, askPermission: askPermission)
        }
        inFlight = task
        await withTaskCancellationHandler { await task.value } onCancel: { task.cancel() }
    }

    private func run(ledger: LedgerStore, askPermission: Bool) async {
        switch await center.status() {
        case .allowed: break
        case .denied: await clearFamily(); return
        case .notDetermined:
            guard askPermission, await center.request() else { return }
        }
        guard !Task.isCancelled else { return }
        await clearFamily()
        for p in plan(ledger: ledger, bedtimeTarget: lastTarget) {
            guard !Task.isCancelled else { return }
            do {
                try await center.scheduleOnce(id: p.id, on: p.day, hour: p.hour, minute: p.minute, title: p.title, body: p.body, route: p.route)
            } catch {
                Self.log.error("could not schedule \(p.id, privacy: .public): \(error.localizedDescription, privacy: .public)")
            }
        }
        // a moment that is done no longer needs its nudge sitting in the notification centre
        let now = clock()
        let today = dayString(now)
        var delivered = CheckInMoment.allCases.filter { m in ledger.ledger(for: today).checkIns.contains { $0.slot == m.slotId } }
            .map { Self.checkInId($0, day: today) }
        if ledger.ledger(for: today).close != nil { delivered.append(Self.closeId(day: today)) }
        if !delivered.isEmpty { center.removeDelivered(ids: delivered) }
    }

    private func clearFamily() async {
        for id in await center.pendingIds(withPrefix: Self.idPrefix) { center.cancel(id: id) }
    }

    // MARK: - What rings when (pure given the ledger and the clock)

    func plan(ledger: LedgerStore, bedtimeTarget: String?) -> [Plan] {
        let now = clock()
        let today = calendar.startOfDay(for: now)
        var plans: [Plan] = []
        for offset in 0..<Self.horizonDays {
            guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
            let dayKey = dayString(day)
            for moment in CheckInMoment.allCases {
                let t = Self.checkInTime(moment)
                guard rings(on: day, hour: t.hour, minute: t.minute, after: now),
                      !ledger.ledger(for: dayKey).checkIns.contains(where: { $0.slot == moment.slotId }) else { continue }
                plans.append(Plan(id: Self.checkInId(moment, day: dayKey), route: "boop://checkin", title: Self.checkInTitle(moment),
                                  body: Self.checkInBody, day: components(day), hour: t.hour, minute: t.minute))
            }
            let t = Self.closeTime(bedtimeTarget: bedtimeTarget)
            // before 04:00 the evening still belongs to the day before
            let evening = t.hour < 4 ? calendar.date(byAdding: .day, value: -1, to: day) ?? day : day
            guard rings(on: day, hour: t.hour, minute: t.minute, after: now), ledger.ledger(for: dayString(evening)).close == nil else { continue }
            plans.append(Plan(id: Self.closeId(day: dayKey), route: "boop://este", title: Self.closeTitle, body: Self.closeBody,
                              day: components(day), hour: t.hour, minute: t.minute))
        }
        return plans
    }

    private func rings(on day: Date, hour: Int, minute: Int, after now: Date) -> Bool {
        calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day).map { $0 > now } ?? false
    }

    private func components(_ day: Date) -> DateComponents { calendar.dateComponents([.year, .month, .day], from: day) }
    private func dayString(_ day: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: day)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func checkInTime(_ moment: CheckInMoment) -> (hour: Int, minute: Int) {
        switch moment {
        case .reggel: (7, 30)
        case .delben: (12, 30)
        case .delutan: (16, 0)
        }
    }

    static func checkInTitle(_ moment: CheckInMoment) -> String {
        switch moment {
        case .reggel: "Reggeli kitöltés"
        case .delben: "Déli kitöltés"
        case .delutan: "Délutáni kitöltés"
        }
    }

    /// Bedtime target ("HH:mm") minus 75 minutes (a target after midnight rings the evening before), else 21:30.
    static func closeTime(bedtimeTarget: String?) -> (hour: Int, minute: Int) {
        guard let target = bedtimeTarget else { return closeFallback }
        let p = target.split(separator: ":")
        guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]), (0..<24).contains(h), (0..<60).contains(m) else { return closeFallback }
        let t = ((h * 60 + m - closeLead) % 1440 + 1440) % 1440
        return (t / 60, t % 60)
    }
}
