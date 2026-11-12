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
    /// A one-time notification on that calendar day (replaces the one with the same id). `route` is what a tap opens
    /// (`RitmusCover` route name). The daily loop's reminders use it: a repeating clock time cannot skip a day that is done.
    /// No default: every centre decides what a dated request means.
    func scheduleOnce(id: String, on day: DateComponents, hour: Int, minute: Int, title: String, body: String, route: String) async throws
    func cancel(id: String)
    /// Whether a request with this id is still waiting to ring.
    func isPending(id: String) async -> Bool
    /// The ids of the waiting requests that start with `prefix` (the daily loop clears and re-adds its whole family).
    func pendingIds(withPrefix prefix: String) async -> [String]
    /// Takes already delivered notifications with these ids out of the notification centre.
    func removeDelivered(ids: [String])
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
        let request = UNNotificationRequest(identifier: id, content: content, trigger: Self.trigger(hour: hour, minute: minute))
        try await UNUserNotificationCenter.current().add(request)
    }

    func scheduleOnce(id: String, on day: DateComponents, hour: Int, minute: Int, title: String, body: String, route: String) async throws {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default                // no badge, no category: a quiet nudge
        content.userInfo = ["route": route]
        var when = DateComponents(year: day.year, month: day.month, day: day.day, hour: hour, minute: minute)
        when.calendar = .current
        let request = UNNotificationRequest(identifier: id, content: content,
                                            trigger: UNCalendarNotificationTrigger(dateMatching: when, repeats: false))
        try await UNUserNotificationCenter.current().add(request)
    }

    /// A repeating local clock time: crossing midnight and DST need no date arithmetic, and it holds after a relaunch.
    static func trigger(hour: Int, minute: Int) -> UNCalendarNotificationTrigger {
        UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: hour, minute: minute), repeats: true)
    }

    func cancel(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }

    func isPending(id: String) async -> Bool {
        await UNUserNotificationCenter.current().pendingNotificationRequests().contains { $0.identifier == id }
    }

    func pendingIds(withPrefix prefix: String) async -> [String] {
        await UNUserNotificationCenter.current().pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
    }

    func removeDelivered(ids: [String]) {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
    }
}

/// Boop's notification delegate, installed once at launch (`BoopApp`; the centre holds it weakly, so this one lives for
/// the process): the bedtime reminder shows while Boop is open, the daily loop's reminders stay quiet there (Ma already
/// offers the check-in / the close), and a tap on a daily-loop reminder opens its cover through the shared router.
final class ReminderPresenter: NSObject, UNUserNotificationCenterDelegate, Sendable {
    static let shared = ReminderPresenter()
    static let foregroundOptions: UNNotificationPresentationOptions = [.banner, .sound]

    static func install() { UNUserNotificationCenter.current().delegate = shared }

    /// What to show while the app is open: nothing for the daily loop's reminders, a banner for the rest.
    static func presentation(for id: String) -> UNNotificationPresentationOptions {
        id.hasPrefix(RitmusReminders.idPrefix) ? [] : foregroundOptions
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async
        -> UNNotificationPresentationOptions { Self.presentation(for: notification.request.identifier) }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else { return }
        await handleTap(route: response.notification.request.content.userInfo["route"] as? String)
    }

    /// A tap on the notification body: a daily-loop route opens its cover. On a cold launch the router holds it until
    /// the shell appears and presents it.
    @MainActor func handleTap(route: String?) {
        guard let route, let cover = RitmusCover(route: route) else { return }
        RitmusRouter.shared.open(cover)
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
}

// MARK: - The reminder

/// The words around the reminder.
enum BedtimeText {
    static let off = "Lefekvés-emlékeztető kikapcsolva"
    static let denied = "Rendben, nem zavarlak. Ha mégis kéred, a Beállításokban engedélyezd a Boop értesítéseit."
    static let noTarget = "Még nincs lefekvési célod, így nem tudok időben szólni."
    static let settings = "Beállítások"
    static let failed = "Most nem sikerült beállítani, próbáld újra egy kicsit később."
    static let title = "Fél óra múlva lefekvés"
    static let body = "Tedd le a telefont, és kezdd a levezetést. Holnap hálás leszel érte."
    static func on(_ time: String) -> String { "Emlékeztetlek \(time)-kor" }
}

/// What a tap answers: the toast, and whether it carries a "Beállítások" button (notifications denied).
struct ReminderReply: Equatable {
    let text: String
    var opensSettings = false
}

/// The Alvás pill while the reminder is on.
func reminderPillTitle(_ time: String) -> String { BedtimeText.on(time) }

/// Alvás's bedtime reminder (spec §5.1a): the first tap asks for permission, then a local notification rings every
/// evening half an hour before the bedtime target; a second tap turns it off. The on/off state and the clock time
/// are kept across launches, and a new target moves the reminder with it.
///
/// A brief without a target keeps the reminder on the **last known target** (stored with the state): the user asked
/// to be reminded, and a brief that momentarily has no target (still learning, a missing plan) is no reason to go
/// quiet. It is re-derived from that target, never from a bare stored time.
@MainActor @Observable
final class BedtimeReminder {
    static let id = "boop.bedtime"
    private static let onKey = "bedtimeReminder.on", timeKey = "bedtimeReminder.time", targetKey = "bedtimeReminder.target"

    private(set) var isOn: Bool
    /// The clock time it rings, "22:15".
    private(set) var time: String?
    /// The bedtime it counts back from (the last one a brief gave).
    @ObservationIgnored private var target: String?
    /// A tap is being handled (the permission prompt may be up): further taps are ignored.
    @ObservationIgnored private var busy = false
    @ObservationIgnored private let center: ReminderCenter
    @ObservationIgnored private let defaults: UserDefaults

    init(center: ReminderCenter = SystemReminderCenter(), defaults: UserDefaults = .standard) {
        self.center = center
        self.defaults = defaults
        isOn = defaults.bool(forKey: Self.onKey)
        time = defaults.string(forKey: Self.timeKey)
        target = defaults.string(forKey: Self.targetKey)
    }

    /// The pill or the card was tapped. Returns the toast to show; nil = ignored (the previous tap is still running).
    func toggle(target: String?) async -> ReminderReply? {
        guard !busy else { return nil }
        busy = true
        defer { busy = false }
        if isOn {
            center.cancel(id: Self.id)
            set(on: false, time: nil, target: nil)
            return ReminderReply(text: BedtimeText.off)
        }
        guard let target = target ?? self.target, let label = BedtimeTime.label(for: target) else {
            return ReminderReply(text: BedtimeText.noTarget)
        }
        switch await center.status() {
        case .denied: return ReminderReply(text: BedtimeText.denied, opensSettings: true)
        case .notDetermined: if !(await center.request()) { return ReminderReply(text: BedtimeText.denied, opensSettings: true) }
        case .allowed: break
        }
        guard await schedule(target) else { return ReminderReply(text: BedtimeText.failed) }
        set(on: true, time: label, target: target)
        return ReminderReply(text: BedtimeText.on(label))
    }

    /// On launch and with every brief: follow a changed target (none = keep the last known one), put back a request
    /// the system dropped, and turn off if notifications were withdrawn in Settings.
    func refresh(target: String?) async {
        guard isOn, !busy else { return }
        busy = true
        defer { busy = false }
        if await center.status() != .allowed { set(on: false, time: nil, target: nil); return }
        guard let target = target ?? self.target, let label = BedtimeTime.label(for: target) else {
            // on, but nothing to count back from: it cannot ring honestly
            center.cancel(id: Self.id)
            set(on: false, time: nil, target: nil)
            return
        }
        if label == time, target == self.target, await center.isPending(id: Self.id) { return }
        if await schedule(target) { set(on: true, time: label, target: target) }
    }

    private func schedule(_ target: String) async -> Bool {
        guard let t = BedtimeTime.trigger(for: target) else { return false }
        do {
            try await center.schedule(id: Self.id, hour: t.hour, minute: t.minute, title: BedtimeText.title, body: BedtimeText.body)
            return true
        } catch { return false }
    }

    private func set(on: Bool, time: String?, target: String?) {
        isOn = on
        self.time = time
        self.target = target
        defaults.set(on, forKey: Self.onKey)
        defaults.set(time, forKey: Self.timeKey)
        defaults.set(target, forKey: Self.targetKey)
    }
}
