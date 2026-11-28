import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Sunday weekly review (`mezo-r36n9.196`, plan Task 15): page 5's takeaway, the one local notification, the route.
fileprivate final class ReviewCenter: ReminderCenter, @unchecked Sendable {
    var permission: ReminderPermission
    var requests: [(id: String, day: DateComponents, hour: Int, minute: Int, route: String)] = []
    var cancelled: [String] = []
    var pending: Set<String>
    var removedDeliveredPrefixes: [String] = []
    init(_ p: ReminderPermission = .allowed, pending: Set<String> = []) { permission = p; self.pending = pending }
    func status() async -> ReminderPermission { permission }
    func request() async -> Bool { permission = .allowed; return true }
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws {}
    func scheduleOnce(id: String, on day: DateComponents, hour: Int, minute: Int, title: String, body: String, route: String) async throws {
        requests.append((id, day, hour, minute, route))
        pending.insert(id)
    }
    func cancel(id: String) { cancelled.append(id); pending.remove(id) }
    func isPending(id: String) async -> Bool { pending.contains(id) }
    func pendingIds(withPrefix prefix: String) async -> [String] { pending.filter { $0.hasPrefix(prefix) }.sorted() }
    func removeDelivered(ids: [String]) {}
    func removeDelivered(withPrefix prefix: String) { removedDeliveredPrefixes.append(prefix) }
}

@MainActor
struct WeeklyReviewTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone.current
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }()

    func log() -> EvadReviewLog {
        let suite = "weekly-review-\(UUID().uuidString)"
        return EvadReviewLog(defaults: UserDefaults(suiteName: suite)!, userKey: "t")
    }

    func overview() throws -> EvadOverview {
        let data = try JSONSerialization.data(withJSONObject: EvadPreviewModel(state: "full").overview())
        return try JSONDecoder().decode(EvadOverview.self, from: data)
    }

    func proposal(_ title: String) -> KapacitasProposal {
        KapacitasProposal(id: title, kind: "MOVE_SESSION_DAY", day: "2026-11-26", status: "accepted", title: title,
                          move: "", effectLines: [], why: [], effects: [], steps: [])
    }

    @Test func takeawayPrefersAcceptedProposals() throws {
        let s = weeklyReviewTakeaway(accepted: [proposal("A csütörtöki edzés szombatra"), proposal("Más")], o: try overview())
        #expect(s == "Erre figyelj: A csütörtöki edzés szombatra.")
    }

    @Test func takeawayFallsBackToThePlan() throws {
        let o = try overview()
        let sessions = o.pillars.block.gymDays.count + o.pillars.block.sport.count
        let s = weeklyReviewTakeaway(accepted: [], o: o)
        #expect(sessions > 0)
        #expect(s.hasPrefix("Tartsd a heti \(sessions) edzést"))
        #expect(weeklyReviewTakeaway(accepted: [], o: nil) == "Menj a terv szerint — jövő vasárnap megnézzük, hogy ment.")
    }

    @Test func pagesHaveTheSpecTitles() {
        #expect(weeklyReviewTitles == ["Hogy ment a hét?", "Mit tanult Boop?", "Milyen lesz a jövő hét?", "Mit eszel jövő héten?", "Kész"])
        #expect(weeklyReviewMenuLine(nil) == "Ebben az évadban nincs heti menü.")
    }

    @Test func reminderSchedulesThroughTheCenter() async throws {
        let center = ReviewCenter(.allowed, pending: [evadReviewReminderPrefix + "2026-11-09"])
        let reminder = WeeklyReviewReminder(center: center, log: log(), calendar: cal)
        // Wednesday 2026-11-25 → this week's Sunday 2026-11-29 18:00, week of Monday 2026-11-23
        let wed = try #require(cal.date(from: DateComponents(year: 2026, month: 11, day: 25, hour: 10)))
        await reminder.refresh(now: wed, hasSeason: true)
        #expect(center.requests.count == 1)
        let r = try #require(center.requests.first)
        #expect(r.id == evadReviewReminderPrefix + "2026-11-23")
        #expect(r.day.year == 2026 && r.day.month == 11 && r.day.day == 29)
        #expect(r.hour == 18 && r.minute == 0)
        #expect(r.route == "boop://heti-atnezes")
        #expect(center.cancelled == [evadReviewReminderPrefix + "2026-11-09"], "an older week's request goes")

        await reminder.refresh(now: wed, hasSeason: false)
        #expect(center.pending.isEmpty, "no season → every pending review request is cancelled")
    }

    @Test func reminderNeverAsksForPermission() async throws {
        let center = ReviewCenter(.notDetermined)
        let reminder = WeeklyReviewReminder(center: center, log: log(), calendar: cal)
        let wed = try #require(cal.date(from: DateComponents(year: 2026, month: 11, day: 25, hour: 10)))
        await reminder.refresh(now: wed, hasSeason: true)
        #expect(center.requests.isEmpty && center.permission == .notDetermined)
    }

    @Test func signOutClearsTheReviewNotification() async {
        // review finding: the id carries no user, so a pending Sunday request must not outlive the account
        let center = ReviewCenter(.allowed, pending: [evadReviewReminderPrefix + "2026-11-23", "boop.other"])
        await WeeklyReviewReminder.signedOut(center: center)
        #expect(center.pending == ["boop.other"])
        #expect(center.removedDeliveredPrefixes == [evadReviewReminderPrefix])
    }

    @Test func reviewRouteOpensTheFlow() async {
        RitmusRouter.shared.review = false
        ReminderPresenter.shared.handleTap(route: "boop://heti-atnezes")
        #expect(RitmusRouter.shared.review == true)
        RitmusRouter.shared.review = false
    }
}
