import Foundation
import BoopCore

/// Which cover a notification's `route` opens (no URL scheme: the route name travels in the notification's userInfo).
enum RitmusNotificationRoute {
    static func cover(for userInfo: [AnyHashable: Any]) -> RitmusCover? {
        (userInfo["route"] as? String).flatMap(RitmusCover.init(route:))
    }
}

/// The daily loop's local reminders (spec §7.8): a check-in nudge at 07:30 / 12:30 / 16:00 for each moment not done yet,
/// and the close at the bedtime target − 75 minutes (21:30 without a target) while the day is open. Each is a one-time
/// notification on the next day it should ring — today when its time is still ahead and it is not done, otherwise
/// tomorrow — so a done moment stays quiet today without losing tomorrow's, and nothing repeats or nags. Rescheduled on
/// every save and every return to the app. No badge, no guilt copy. The bedtime reminder is a separate request.
@MainActor
final class RitmusReminders {
    nonisolated static let idPrefix = "boop.ritmus."
    nonisolated static let closeId = idPrefix + "este"
    nonisolated static func checkInId(_ moment: CheckInMoment) -> String { idPrefix + "checkin." + moment.rawValue }
    nonisolated static let allIds = CheckInMoment.allCases.map { checkInId($0) } + [closeId]

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

    private let center: ReminderCenter
    private let calendar: Calendar
    private let clock: @Sendable () -> Date

    init(center: ReminderCenter = SystemReminderCenter(), calendar: Calendar = .current, clock: @escaping @Sendable () -> Date = { Date() }) {
        self.center = center
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        greg.locale = Locale(identifier: "en_US_POSIX")
        self.calendar = greg
        self.clock = clock
    }

    /// Puts the day's reminders in line with the ledger (and the bedtime target). `askPermission`: the system prompt may
    /// appear (once, the first time a check-in has been saved); otherwise nothing is scheduled until the owner allowed it.
    func refresh(ledger: LedgerStore, bedtimeTarget: String?, askPermission: Bool) async {
        switch await center.status() {
        case .allowed: break
        case .denied: Self.allIds.forEach(center.cancel(id:)); return
        case .notDetermined:
            guard askPermission, await center.request() else { return }
        }
        let plans = plan(ledger: ledger, bedtimeTarget: bedtimeTarget)
        for id in Self.allIds {
            guard let p = plans.first(where: { $0.id == id }) else { center.cancel(id: id); continue }
            // a request for a later day replaces today's: the cancel makes the "done, so not today" visible to the centre
            if p.day != todayComponents() { center.cancel(id: id) }
            try? await center.scheduleOnce(id: p.id, on: p.day, hour: p.hour, minute: p.minute, title: p.title, body: p.body, route: p.route)
        }
    }

    // MARK: - What rings when (pure given the ledger and the clock)

    func plan(ledger: LedgerStore, bedtimeTarget: String?) -> [Plan] {
        let now = clock()
        var plans: [Plan] = []
        for moment in CheckInMoment.allCases {
            let t = Self.checkInTime(moment)
            let day = nextDay(hour: t.hour, minute: t.minute, now: now) { d in
                ledger.ledger(for: dayString(d)).checkIns.contains { $0.slot == moment.slotId }
            }
            plans.append(Plan(id: Self.checkInId(moment), route: "boop://checkin", title: Self.checkInTitle(moment),
                              body: Self.checkInBody, day: components(day), hour: t.hour, minute: t.minute))
        }
        let t = Self.closeTime(bedtimeTarget: bedtimeTarget)
        let day = nextDay(hour: t.hour, minute: t.minute, now: now) { d in
            // before 04:00 the evening still belongs to the day before
            let evening = t.hour < 4 ? calendar.date(byAdding: .day, value: -1, to: d) ?? d : d
            return ledger.ledger(for: dayString(evening)).close != nil
        }
        plans.append(Plan(id: Self.closeId, route: "boop://este", title: Self.closeTitle, body: Self.closeBody,
                          day: components(day), hour: t.hour, minute: t.minute))
        return plans
    }

    /// The first calendar day (today or tomorrow) the reminder should ring: its time must still be ahead and the thing
    /// not already done on that day.
    private func nextDay(hour: Int, minute: Int, now: Date, isDone: (Date) -> Bool) -> Date {
        let today = calendar.startOfDay(for: now)
        let ringsToday = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: today).map { $0 > now } ?? false
        if ringsToday, !isDone(today) { return today }
        return calendar.date(byAdding: .day, value: 1, to: today) ?? today
    }

    private func components(_ day: Date) -> DateComponents { calendar.dateComponents([.year, .month, .day], from: day) }
    private func todayComponents() -> DateComponents { components(clock()) }
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
