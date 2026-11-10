import Foundation
import Observation
import UserNotifications

// MARK: - The notification centre, behind a seam (tests use a fake)

/// What the system allows for Boop's notifications.
enum ReminderPermission: Equatable, Sendable { case notDetermined, allowed, denied }

/// The few things the bedtime reminder needs from the notification centre.
protocol ReminderCenter: Sendable {
    func status() async -> ReminderPermission
    /// Shows the system prompt; true = allowed.
    func request() async -> Bool
    /// A notification every day at hour:minute (replaces the one with the same id).
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws
    func cancel(id: String)
}

/// The real centre: local notifications, no server.
struct SystemReminderCenter: ReminderCenter {
    func status() async -> ReminderPermission {
        switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
        case .notDetermined: .notDetermined
        case .denied: .denied
        default: .allowed
        }
    }

    func request() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
    }

    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        // a repeating clock time: crossing midnight needs no date arithmetic, and it holds after a relaunch
        let trigger = UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: hour, minute: minute), repeats: true)
        try await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    func cancel(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }
}

// MARK: - When it rings (pure)

/// The reminder rings half an hour before the bedtime target ("HH:mm", local). A target after midnight belongs to the
/// night that closes the day, so "00:15" rings at 23:45 the evening before.
enum BedtimeTime {
    static let lead = 30

    static func trigger(for target: String) -> (hour: Int, minute: Int)? {
        let p = target.split(separator: ":")
        guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]), (0..<24).contains(h), (0..<60).contains(m) else { return nil }
        let t = ((h * 60 + m - lead) % 1440 + 1440) % 1440
        return (t / 60, t % 60)
    }

    /// "22:15" for a 22:45 target.
    static func label(for target: String) -> String? {
        trigger(for: target).map { String(format: "%02d:%02d", $0.hour, $0.minute) }
    }

    /// The next time it rings after `now`: tonight's (before-06:00 targets count as tonight's), else tomorrow's.
    static func nextFire(target: String, now: Date, calendar: Calendar = .current) -> Date? {
        let p = target.split(separator: ":")
        guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]) else { return nil }
        var t = h * 60 + m
        if t < 6 * 60 { t += 1440 }
        let start = calendar.startOfDay(for: now)
        guard var fire = calendar.date(byAdding: .minute, value: t - lead, to: start) else { return nil }
        if fire <= now, let next = calendar.date(byAdding: .day, value: 1, to: fire) { fire = next }
        return fire
    }
}

// MARK: - The reminder

/// The words around the reminder.
enum BedtimeText {
    static let off = "Lefekvés-emlékeztető kikapcsolva"
    static let denied = "Rendben, nem zavarlak. Ha mégis kéred, a Beállításokban engedélyezd a Boop értesítéseit."
    static let noTarget = "Még nincs lefekvési célod, így nem tudok időben szólni."
    static let failed = "Most nem sikerült beállítani, próbáld újra egy kicsit később."
    static let title = "Fél óra múlva lefekvés"
    static let body = "Tedd le a telefont, és kezdd a levezetést. Holnap hálás leszel érte."
    static func on(_ time: String) -> String { "Emlékeztetlek \(time)-kor" }
}

/// The Alvás pill while the reminder is on.
func reminderPillTitle(_ time: String) -> String { BedtimeText.on(time) }

/// Alvás's bedtime reminder (spec §5.1a): the first tap asks for permission, then a local notification rings every
/// evening half an hour before the bedtime target; a second tap turns it off. The on/off state and the clock time
/// are kept across launches, and a new target moves the reminder with it.
@MainActor @Observable
final class BedtimeReminder {
    static let id = "boop.bedtime"
    private static let onKey = "bedtimeReminder.on", timeKey = "bedtimeReminder.time"

    private(set) var isOn: Bool
    /// The clock time it rings, "22:15".
    private(set) var time: String?
    @ObservationIgnored private let center: ReminderCenter
    @ObservationIgnored private let defaults: UserDefaults

    init(center: ReminderCenter = SystemReminderCenter(), defaults: UserDefaults = .standard) {
        self.center = center
        self.defaults = defaults
        isOn = defaults.bool(forKey: Self.onKey)
        time = defaults.string(forKey: Self.timeKey)
    }

    /// The pill or the card was tapped. Returns the toast to show.
    func toggle(target: String?) async -> String {
        if isOn {
            center.cancel(id: Self.id)
            set(on: false, time: nil)
            return BedtimeText.off
        }
        guard let target, let label = BedtimeTime.label(for: target) else { return BedtimeText.noTarget }
        switch await center.status() {
        case .denied: return BedtimeText.denied
        case .notDetermined: if !(await center.request()) { return BedtimeText.denied }
        case .allowed: break
        }
        guard await schedule(target) else { return BedtimeText.failed }
        set(on: true, time: label)
        return BedtimeText.on(label)
    }

    /// A new brief: follow a changed target; turn off if notifications were withdrawn in Settings.
    func refresh(target: String?) async {
        guard isOn else { return }
        if await center.status() != .allowed { set(on: false, time: nil); return }
        guard let target, let label = BedtimeTime.label(for: target), label != time else { return }
        if await schedule(target) { set(on: true, time: label) }
    }

    private func schedule(_ target: String) async -> Bool {
        guard let t = BedtimeTime.trigger(for: target) else { return false }
        do {
            try await center.schedule(id: Self.id, hour: t.hour, minute: t.minute, title: BedtimeText.title, body: BedtimeText.body)
            return true
        } catch { return false }
    }

    private func set(on: Bool, time: String?) {
        isOn = on
        self.time = time
        defaults.set(on, forKey: Self.onKey)
        defaults.set(time, forKey: Self.timeKey)
    }
}
