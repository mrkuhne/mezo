import Foundation
import Testing
import BoopCore
@testable import Boop

/// Records what the reminders asked of the notification centre (dated, one-shot requests).
private final class FakeRitmusCenter: ReminderCenter, @unchecked Sendable {
    struct Request: Equatable { let id: String; let day: DateComponents; let hour: Int; let minute: Int; let route: String; let title: String; let body: String }
    var permission: ReminderPermission
    var grants = true
    var requests = 0
    var scheduled: [Request] = []
    var cancelled: [String] = []
    var removedDelivered: [String] = []
    /// Holds each `status()` answer this long, so two refreshes can overlap.
    var delay: Duration = .zero
    var events: [String] = []
    init(_ permission: ReminderPermission = .allowed) { self.permission = permission }

    func status() async -> ReminderPermission {
        if delay > .zero { try? await Task.sleep(for: delay) }
        return permission
    }
    func request() async -> Bool { requests += 1; permission = grants ? .allowed : .denied; return grants }
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws { Issue.record("repeating schedule used") }
    func scheduleOnce(id: String, on day: DateComponents, hour: Int, minute: Int, title: String, body: String, route: String) async throws {
        events.append("add")
        scheduled.removeAll { $0.id == id }
        scheduled.append(Request(id: id, day: day, hour: hour, minute: minute, route: route, title: title, body: body))
    }
    func cancel(id: String) { events.append("cancel"); cancelled.append(id); scheduled.removeAll { $0.id == id } }
    func isPending(id: String) async -> Bool { scheduled.contains { $0.id == id } }
    func pendingIds(withPrefix prefix: String) async -> [String] { scheduled.map(\.id).filter { $0.hasPrefix(prefix) } }
    func removeDelivered(ids: [String]) { removedDelivered += ids }

    func request(_ id: String) -> Request? { scheduled.first { $0.id == id } }
}

@MainActor
final class RitmusRemindersTests {
    nonisolated private static let budapest: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    nonisolated private static func at(_ h: Int, _ m: Int = 0, day: Int = 12) -> Date {
        budapest.date(from: DateComponents(year: 2026, month: 11, day: day, hour: h, minute: m))!
    }
    private static func day(_ d: Int) -> DateComponents { DateComponents(year: 2026, month: 11, day: d) }
    private static func id(_ m: CheckInMoment, _ d: Int) -> String { RitmusReminders.checkInId(m, day: String(format: "2026-11-%02d", d)) }
    private static func close(_ d: Int) -> String { RitmusReminders.closeId(day: String(format: "2026-11-%02d", d)) }

    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("ritmus-reminders-\(UUID().uuidString)")
    private let center = FakeRitmusCenter()
    deinit { try? FileManager.default.removeItem(at: root) }

    private func reminders(now: Date, center custom: FakeRitmusCenter? = nil) -> (RitmusReminders, LedgerStore) {
        let ledger = LedgerStore(directory: root)
        return (RitmusReminders(center: custom ?? center, calendar: Self.budapest, clock: { now }), ledger)
    }

    private func checkIn(_ moment: CheckInMoment, at: Date) -> LedgerCheckIn {
        LedgerCheckIn(id: UUID(), slot: moment.slotId, capturedAt: at, values: ["energy": 6], askedItems: ["energy"])
    }

    private func time(_ r: FakeRitmusCenter.Request?) -> [Int]? { r.map { [$0.hour, $0.minute] } }

    // MARK: - Check-ins

    @Test func schedulesOnlyUndoneMoments() async throws {
        let (r, ledger) = reminders(now: Self.at(6, 50))
        try ledger.saveCheckIn(checkIn(.delben, at: Self.at(6, 40)), date: "2026-11-12")    // délben is done already
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)

        #expect(center.request(Self.id(.reggel, 12))?.day == Self.day(12) && time(center.request(Self.id(.reggel, 12))) == [7, 30])
        #expect(time(center.request(Self.id(.delutan, 12))) == [16, 0])
        // the done moment is absent today only: tomorrow's 12:30 still rings
        #expect(center.request(Self.id(.delben, 12)) == nil)
        #expect(time(center.request(Self.id(.delben, 13))) == [12, 30])
        #expect(center.scheduled.allSatisfy { $0.route == "boop://checkin" || $0.route == "boop://este" })
    }

    @Test func aWeekAheadStaysScheduledAfterADayWithoutTheApp() async throws {
        let (r, ledger) = reminders(now: Self.at(6, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        for d in [13, 14, 15] {      // day + 3 still has all four
            #expect(time(center.request(Self.id(.reggel, d))) == [7, 30])
            #expect(time(center.request(Self.id(.delben, d))) == [12, 30])
            #expect(time(center.request(Self.id(.delutan, d))) == [16, 0])
            #expect(time(center.request(Self.close(d))) == [21, 30])
        }
        #expect(center.scheduled.count == RitmusReminders.horizonDays * 4)
        #expect(center.scheduled.count <= 40)       // far below the system's 64 pending requests
        #expect(center.request(Self.id(.reggel, 12 + RitmusReminders.horizonDays)) == nil)
    }

    @Test func savingCancelsThatMomentsReminderForTodayOnly() async throws {
        let (r, ledger) = reminders(now: Self.at(7, 10))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.request(Self.id(.reggel, 12)) != nil)

        try ledger.saveCheckIn(checkIn(.reggel, at: Self.at(7, 12)), date: "2026-11-12")
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.cancelled.contains(Self.id(.reggel, 12)))
        #expect(center.request(Self.id(.reggel, 12)) == nil)
        #expect(center.request(Self.id(.reggel, 13)) != nil)        // tomorrow's is back
        #expect(center.request(Self.id(.delben, 12)) != nil)        // the others are untouched
        // the nudge already sitting in the notification centre goes too
        #expect(center.removedDelivered == [Self.id(.reggel, 12)])
    }

    @Test func aMomentAlreadyPastDoesNotRingToday() async {
        let (r, ledger) = reminders(now: Self.at(13, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.request(Self.id(.reggel, 12)) == nil && center.request(Self.id(.delben, 12)) == nil)
        #expect(center.request(Self.id(.reggel, 13)) != nil)
        #expect(center.request(Self.id(.delutan, 12)) != nil)
    }

    @Test func checkInCopyIsQuietAndPerMoment() async throws {
        let (r, ledger) = reminders(now: Self.at(6, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.request(Self.id(.reggel, 12))?.title == "Reggeli kitöltés")
        #expect(center.request(Self.id(.delben, 12))?.title == "Déli kitöltés")
        #expect(center.request(Self.id(.delutan, 12))?.title == "Délutáni kitöltés")
        #expect(center.request(Self.id(.reggel, 12))?.body == "Mennyi energia van benned most? · 6 kérdés, fél perc")
    }

    // MARK: - The close

    @Test func closeAtBedtimeMinus75() async throws {
        let (r, ledger) = reminders(now: Self.at(9, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: "23:00", askPermission: false)
        let close = try #require(center.request(Self.close(12)))
        #expect(close.day == Self.day(12) && close.hour == 21 && close.minute == 45 && close.route == "boop://este")
        #expect(close.title == "Zárjuk le a napot")
        #expect(close.body == "Egy perc: hogy vagy, sikerült-e a nap célja, milyen volt a nap.")
    }

    @Test func closeBeforeMidnightForAPostMidnightTarget() async throws {
        let (r, ledger) = reminders(now: Self.at(9, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: "00:15", askPermission: false)
        let close = try #require(center.request(Self.close(12)))
        #expect(close.hour == 23 && close.minute == 0 && close.day == Self.day(12))
    }

    @Test func closeFallback2130WithoutBedtime() async throws {
        let (r, ledger) = reminders(now: Self.at(9, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        let close = try #require(center.request(Self.close(12)))
        #expect(close.hour == 21 && close.minute == 30 && close.day == Self.day(12))
    }

    @Test func aWakeWithoutABriefKeepsTheLastBedtimeTarget() async throws {
        let (r, ledger) = reminders(now: Self.at(9, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: "23:00", askPermission: false)
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)     // a background wake
        #expect(time(center.request(Self.close(12))) == [21, 45])
    }

    @Test func aClosedEveningDoesNotRingTonightOnly() async throws {
        let (r, ledger) = reminders(now: Self.at(20, 0))
        try ledger.setClose(LedgerClose(id: UUID(), capturedAt: Self.at(19, 55), eveningEnergy: 6, dayRating: 7), date: "2026-11-12")
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.request(Self.close(12)) == nil)
        #expect(center.request(Self.close(13)) != nil)
        #expect(center.removedDelivered.contains(Self.close(12)))
    }

    @Test func idsDifferFromTheBedtimeReminder() async {
        let (r, ledger) = reminders(now: Self.at(6, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.scheduled.allSatisfy { $0.id.hasPrefix("boop.ritmus.") && $0.id != BedtimeReminder.id })
    }

    // MARK: - Permission

    @Test func notAskingWithoutASave() async {
        let c = FakeRitmusCenter(.notDetermined)
        let (r, ledger) = reminders(now: Self.at(6, 0), center: c)
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(c.requests == 0 && c.scheduled.isEmpty)
    }

    @Test func askingOnceAtTheFirstSave() async {
        let c = FakeRitmusCenter(.notDetermined)
        let (r, ledger) = reminders(now: Self.at(6, 0), center: c)
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: true)
        #expect(c.requests == 1 && c.scheduled.count == RitmusReminders.horizonDays * 4)
    }

    @Test func deniedSchedulesNothingAndClearsWhatWasThere() async {
        let c = FakeRitmusCenter(.denied)
        let (r, ledger) = reminders(now: Self.at(6, 0), center: c)
        c.scheduled = [FakeRitmusCenter.Request(id: Self.id(.reggel, 12), day: Self.day(12), hour: 7, minute: 30, route: "", title: "", body: "")]
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: true)
        #expect(c.requests == 0 && c.scheduled.isEmpty)
        #expect(c.cancelled == [Self.id(.reggel, 12)])
    }

    // MARK: - Serialised and cancellable

    @Test func twoRefreshesNeverInterleave() async {
        let c = FakeRitmusCenter(.allowed)
        c.delay = .milliseconds(40)
        let (r, ledger) = reminders(now: Self.at(6, 0), center: c)
        async let a: Void = r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        async let b: Void = r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        _ = await (a, b)
        // each run is cancel-all then add-all: after the second run's first cancel no add of the first may follow
        let adds = RitmusReminders.horizonDays * 4
        #expect(c.events == Array(repeating: "add", count: adds) + Array(repeating: "cancel", count: adds) + Array(repeating: "add", count: adds))
        #expect(c.scheduled.count == adds)
    }

    @Test func aCancelledRefreshSchedulesNothing() async {
        let c = FakeRitmusCenter(.allowed)
        c.delay = .milliseconds(80)
        let (r, ledger) = reminders(now: Self.at(6, 0), center: c)
        let task = Task { await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false) }
        try? await Task.sleep(for: .milliseconds(20))
        task.cancel()
        await task.value
        #expect(c.scheduled.isEmpty)
    }
}

/// A tap on a ritmus notification opens the matching cover (no URL scheme; the notification carries the route).
@MainActor
struct RitmusNotificationRoutingTests {
    @Test func routeNamesMapToCovers() {
        #expect(RitmusNotificationRoute.cover(for: ["route": "boop://checkin"]) == .checkin)
        #expect(RitmusNotificationRoute.cover(for: ["route": "boop://este"]) == .este)
        #expect(RitmusNotificationRoute.cover(for: ["route": "boop://nope"]) == nil)
        #expect(RitmusNotificationRoute.cover(for: [:]) == nil)      // e.g. the bedtime reminder
    }

    @Test func aTapSetsTheSharedRouterEvenBeforeTheShellIsUp() async {
        RitmusRouter.shared.close()
        await ReminderPresenter.shared.handleTap(route: "boop://checkin")
        #expect(RitmusRouter.shared.cover == .checkin)       // queued: the shell presents it when it appears
        await ReminderPresenter.shared.handleTap(route: nil)
        #expect(RitmusRouter.shared.cover == .checkin)       // an unrelated tap changes nothing
        RitmusRouter.shared.close()
    }

    @Test func aPendingCoverIsTakenOnceAndClearsTheRouter() {
        let router = RitmusRouter()
        #expect(router.takePending() == nil)
        router.open(.este)
        #expect(router.takePending() == .este)
        #expect(router.cover == nil && router.takePending() == nil)
    }

    @Test func ritmusRemindersStayQuietWhileTheAppIsOpen() {
        #expect(ReminderPresenter.presentation(for: "boop.ritmus.este") == [])
        #expect(ReminderPresenter.presentation(for: BedtimeReminder.id) == [.banner, .sound])
    }
}

/// Counts every delivery attempt; never delivers, so the item stays queued for the next trigger.
private actor CountingSender: OutboxSender {
    private(set) var attempts = 0
    func send(_ item: OutboxItem) async -> OutboxSendResult { attempts += 1; return .retryLater }
}

private final class StepClock: @unchecked Sendable {
    private let lock = NSLock()
    private var current = Date(timeIntervalSince1970: 1_800_000_000)
    var now: Date { lock.withLock { current } }
    func advance(_ s: TimeInterval) { lock.withLock { current = current.addingTimeInterval(s) } }
}

/// The app-wide flush triggers fold into one flush per second.
@MainActor
final class RitmusFlushTriggerTests {
    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("ritmus-flush-\(UUID().uuidString)")
    deinit { try? FileManager.default.removeItem(at: root) }

    private func attempts(_ sender: CountingSender, settledAt n: Int) async -> Int {
        for _ in 0..<100 where await sender.attempts < n { try? await Task.sleep(for: .milliseconds(20)) }
        try? await Task.sleep(for: .milliseconds(100))     // room for a wrongly extra one
        return await sender.attempts
    }

    @Test func triggersWithinASecondMakeOneFlushAndALaterOneAnother() async throws {
        let sender = CountingSender(), clock = StepClock()
        let env = RitmusEnvironment(ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
                                    sender: sender, line: { _, _ in "" }, snapshot: { _ in CheckInSnapshotValue(hrBpm: 70) },
                                    plans: nil, clock: { clock.now })
        try await env.outbox.enqueue(OutboxItem(id: UUID(), kind: .goal, date: env.today, capturedAt: clock.now,
                                                payload: RitmusPayload.encode(GoalPayload(text: "Meal prep"))))
        env.flushOnTrigger(); env.flushOnTrigger()          // foreground + net back at the same moment
        #expect(await attempts(sender, settledAt: 1) == 1)
        clock.advance(2)
        env.flushOnTrigger()                                // a later trigger ignores the backoff and tries again
        #expect(await attempts(sender, settledAt: 2) == 2)
    }
}
