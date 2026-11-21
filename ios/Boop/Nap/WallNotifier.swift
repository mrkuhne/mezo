import Foundation
import UserNotifications
import BoopCore

// MARK: - The notification centre, behind a seam (tests use a fake)

/// The few things the wall's notifier needs from the notification centre.
protocol WallRinger: Sendable {
    func status() async -> ReminderPermission
    /// Shows the system prompt; true = allowed.
    func request() async -> Bool
    /// One notification at that moment (replaces the one with the same id).
    func schedule(id: String, at: Date, title: String, body: String) async throws
    /// The ids of the waiting requests that start with `prefix`.
    func pendingIds(withPrefix prefix: String) async -> [String]
    func cancel(ids: [String])
}

/// The real centre: local notifications, no server.
struct SystemWallRinger: WallRinger {
    func status() async -> ReminderPermission { await SystemReminderCenter().status() }
    func request() async -> Bool { await SystemReminderCenter().request() }

    func schedule(id: String, at: Date, title: String, body: String) async throws {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: id, content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(1, at.timeIntervalSinceNow), repeats: false))
        try await UNUserNotificationCenter.current().add(request)
    }

    func pendingIds(withPrefix prefix: String) async -> [String] {
        await UNUserNotificationCenter.current().pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
    }

    func cancel(ids: [String]) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ids)
    }
}

// MARK: - When it rings (pure)

enum WallRingTime {
    /// A deadline within this long rings at once; a farther one rings this long before it.
    static let lead: TimeInterval = 12 * 3600
    static let earliestHour = 8, latestHour = 21

    /// When the request for a card ending at `expiresAt` should ring, or nil if no allowed moment is before the end.
    /// `now` if the end is within 12 h, else 12 h before the end — moved into 08:00–21:00 local: earlier than 08:00 waits
    /// for 08:00; later than 21:00 rings at 21:00 (when that is still ahead) or waits for the next 08:00.
    static func fire(expiresAt: Date, now: Date, calendar: Calendar) -> Date? {
        let raw = expiresAt.timeIntervalSince(now) <= lead ? now : expiresAt.addingTimeInterval(-lead)
        guard let start = calendar.date(bySettingHour: earliestHour, minute: 0, second: 0, of: raw),
              let end = calendar.date(bySettingHour: latestHour, minute: 0, second: 0, of: raw) else { return nil }
        var t = raw
        if raw < start { t = start }
        else if raw > end {
            if end > now { t = end }
            else if let next = calendar.date(byAdding: .day, value: 1, to: start) { t = next }
        }
        return t < expiresAt ? t : nil
    }
}

// MARK: - The notifier

/// The wall's way into his pocket (decision #35): at most two a day app-wide, only for what the wall's first slot
/// calls "ami lejár" — from any area — and never for what he has already had on screen.
///
/// Local notifications only; there is no background refresh, so it is reconciled when the wall builds its candidates
/// and when the app becomes active. What rang and what he has seen is kept per phone-calendar day and per user, so
/// tomorrow starts clean and another account never inherits these counters.
@MainActor
final class WallNotifier {
    static let idPrefix = "wall."
    static let cap = 2

    /// `seen` belongs to the day it was seen on (`day`); `rang` is keyed by the day the request FIRES on, so a request
    /// scheduled today for tomorrow counts in tomorrow's cap, not today's.
    private struct Day: Codable { var day: String; var rang: [String: Set<String>] = [:]; var seen: Set<String> = [] }

    private let center: WallRinger
    private let defaults: UserDefaults
    private let userKey: String
    private let calendar: Calendar

    init(center: WallRinger = SystemWallRinger(), defaults: UserDefaults = .standard, userKey: String,
         calendar: Calendar = .current) {
        self.center = center
        self.defaults = defaults
        self.userKey = userKey
        self.calendar = calendar
    }

    private var stateKey: String { "wall.notifier.\(userKey)" }
    private var askedKey: String { "wall.notifier.asked.\(userKey)" }

    private func dayKey(_ date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// The stored state for `now`'s day: what was seen yesterday is forgotten, past fire days are dropped.
    private func load(_ now: Date) -> Day {
        let today = dayKey(now)
        var d = Day(day: today)
        if let data = defaults.data(forKey: stateKey), let old = try? JSONDecoder().decode(Day.self, from: data) {
            d.rang = old.rang.filter { $0.key >= today }
            if old.day == today { d.seen = old.seen }
        }
        return d
    }

    private func save(_ d: Day) {
        defaults.set(try? JSONEncoder().encode(d), forKey: stateKey)
    }

    /// What he has had on screen today.
    func seenToday(now: Date) -> Set<String> { load(now).seen }

    /// These cards were on the wall while it was visible: Boop does not ring for them **today**. A request whose time
    /// falls on a later day is still fair game — he saw the card, not tomorrow's deadline.
    func markSeen(_ ids: [String], now: Date) {
        guard !ids.isEmpty else { return }
        var d = load(now)
        d.seen.formUnion(ids)
        save(d)
    }

    /// Brings the waiting requests in line with the wall: removes the ones whose card is gone, acted on or seen (and
    /// due today), and schedules the next ones each fire day's cap allows.
    func reconcile(_ candidates: [WallCandidate], now: Date, acted: Set<String> = []) async {
        var d = load(now)
        let today = dayKey(now)

        // each card with an allowed moment before its end, with the day that moment falls on
        var timed: [(card: WallCandidate, when: Date, day: String)] = []
        for c in candidates where c.notifiable && !acted.contains(c.id) {
            guard let end = c.expiresAt, let when = WallRingTime.fire(expiresAt: end, now: now, calendar: calendar) else { continue }
            timed.append((c, when, dayKey(when)))
        }
        let live = Set(timed.filter { !(d.seen.contains($0.card.id) && $0.day == today) }.map { Self.idPrefix + $0.card.id })
        let stale = await center.pendingIds(withPrefix: Self.idPrefix).filter { !live.contains($0) }
        if !stale.isEmpty { center.cancel(ids: stale) }

        let everRang = d.rang.values.reduce(into: Set<String>()) { $0.formUnion($1) }
        var plan: [(card: WallCandidate, when: Date, day: String)] = []
        for day in Set(timed.map(\.day)).sorted() {
            let group = timed.filter { $0.day == day && !everRang.contains($0.card.id) }
            let chosen = wallNotifications(group.map(\.card), now: now, acted: acted, alreadyRang: d.rang[day] ?? [],
                                           seen: day == today ? d.seen : [], cap: Self.cap)
            for c in chosen { if let t = group.first(where: { $0.card.id == c.id }) { plan.append(t) } }
        }
        guard !plan.isEmpty, await allowed() else { return }
        for t in plan {
            do {
                try await center.schedule(id: Self.idPrefix + t.card.id, at: t.when, title: Self.plain(t.card.text), body: t.card.sub)
                d.rang[t.day, default: []].insert(t.card.id)
            } catch { continue }
        }
        save(d)
    }

    /// Asks for permission once per user (the system itself asks once); denied means silence.
    private func allowed() async -> Bool {
        switch await center.status() {
        case .allowed: return true
        case .denied: return false
        case .notDetermined:
            guard !defaults.bool(forKey: askedKey) else { return false }
            defaults.set(true, forKey: askedKey)
            return await center.request()
        }
    }

    /// A card's text marks its emphasis with `*…*`; a notification title is plain.
    static func plain(_ text: String) -> String { text.replacingOccurrences(of: "*", with: "") }
}
