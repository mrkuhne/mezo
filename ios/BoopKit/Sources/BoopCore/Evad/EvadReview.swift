import Foundation

// The Sunday weekly review's rules (`mezo-r36n9.196` step 2, spec §4): when it is open, when its one notification is
// armed, the per-week done log on the phone, the five-page progress and its Ma-wall card. No server state — the done
// mark lives only on the phone (spec §11.4).

/// The review is open: the week it looks back on (`weekMonday`) and the week it plans (`nextMonday`).
public struct EvadReviewWindow: Equatable, Sendable {
    public let weekMonday: String
    public let nextMonday: String
    public init(weekMonday: String, nextMonday: String) { self.weekMonday = weekMonday; self.nextMonday = nextMonday }
}

/// Sunday 18:00 … Monday 23:59:59 in `calendar.timeZone`; a Sunday looks back on its own week (Monday six days
/// earlier), a Monday on the week before. Outside the window → nil.
public func evadReviewWindow(now: Date, calendar: Calendar = .current) -> EvadReviewWindow? {
    let today = calendar.startOfDay(for: now)
    let weekday = calendar.component(.weekday, from: now)   // 1 = Sunday, 2 = Monday (gregorian)
    switch weekday {
    case 1:
        guard calendar.component(.hour, from: now) >= 18,
              let monday = calendar.date(byAdding: .day, value: -6, to: today),
              let next = calendar.date(byAdding: .day, value: 1, to: today) else { return nil }
        return EvadReviewWindow(weekMonday: evadYMD(monday, calendar: calendar), nextMonday: evadYMD(next, calendar: calendar))
    case 2:
        guard let monday = calendar.date(byAdding: .day, value: -7, to: today) else { return nil }
        return EvadReviewWindow(weekMonday: evadYMD(monday, calendar: calendar), nextMonday: evadYMD(today, calendar: calendar))
    default:
        return nil
    }
}

/// What the Sunday notification should do now.
public enum EvadReviewReminder: Equatable, Sendable { case schedule(id: String, fireAt: Date), cancelAll, keep }

/// The notification id prefix; the id ends with the reviewed week's Monday.
public let evadReviewReminderPrefix = "boop.heti-atnezes."

/// No season → .cancelAll. Notifications not allowed → .keep (the app never prompts for it). Otherwise the first Sunday
/// 18:00 strictly after `now` whose week is not done → .schedule.
public func evadReviewReminder(now: Date, hasSeason: Bool, allowed: Bool, done: Set<String>,
                               calendar: Calendar = .current) -> EvadReviewReminder {
    guard hasSeason else { return .cancelAll }
    guard allowed else { return .keep }
    var after = now
    for _ in 0..<4 {
        guard let sunday = calendar.nextDate(after: after, matching: DateComponents(hour: 18, minute: 0, second: 0, weekday: 1),
                                             matchingPolicy: .nextTime),
              let monday = calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: sunday)) else { return .keep }
        let week = evadYMD(monday, calendar: calendar)
        if !done.contains(week) { return .schedule(id: evadReviewReminderPrefix + week, fireAt: sunday) }
        after = sunday
    }
    return .keep
}

/// The per-user done log on the phone (`UserDefaults` key "boop.review.<userKey>"): week Monday → the takeaway sentence.
public final class EvadReviewLog: @unchecked Sendable {
    private let defaults: UserDefaults
    private let key: String

    public init(defaults: UserDefaults, userKey: String) {
        self.defaults = defaults
        self.key = "boop.review.\(userKey)"
    }

    private var entries: [String: String] { defaults.dictionary(forKey: key) as? [String: String] ?? [:] }

    public func isDone(_ weekMonday: String) -> Bool { entries[weekMonday] != nil }

    public func markDone(_ weekMonday: String, takeaway: String) {
        var e = entries
        e[weekMonday] = takeaway
        // keep a year of weeks at most
        if e.count > 60 { for k in e.keys.sorted().prefix(e.count - 60) { e[k] = nil } }
        defaults.set(e, forKey: key)
    }

    public var doneWeeks: Set<String> { Set(entries.keys) }

    /// The latest reviewed week and its takeaway.
    public var last: (week: String, takeaway: String)? {
        let e = entries
        guard let k = e.keys.max(), let t = e[k] else { return nil }
        return (k, t)
    }
}

/// The flow's position: five pages; leaving („Később") never marks anything — only finishing on page 5 does.
public struct EvadReviewProgress: Equatable, Sendable {
    public static let pageCount = 5
    public private(set) var page: Int

    public init(page: Int = 1) { self.page = min(max(1, page), Self.pageCount) }
    public mutating func next() { page = min(Self.pageCount, page + 1) }
    public mutating func back() { page = max(1, page - 1) }
    public func canFinish() -> Bool { page == Self.pageCount }
}

/// The Ma-wall card: in the window, with a season, not done yet → an `.improves` card that opens the review.
public func evadReviewCandidate(window: EvadReviewWindow?, hasSeason: Bool, done: Bool) -> WallCandidate? {
    guard let window, hasSeason, !done else { return nil }
    return WallCandidate(
        id: EvadWallID.review + window.weekMonday, role: .improves, kind: .teendo, area: WallSources.evad, rank: 0.9,
        text: "*Kész a heti átnézés*",
        sub: "Öt rövid lépés: hogy ment, mit tanult Boop, mi jön.",
        primary: "Átnézem",
        settled: "Heti átnézés megnyitva",
        why: "Vasárnap este és hétfőn átnézheted a hetet: mi ment jól, mit tanult Boop, és milyen lesz a jövő hét.")
}

/// Is this wall card the weekly review's?
public func evadWallIsReview(_ id: String) -> Bool { id.hasPrefix(EvadWallID.review) }
