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
    init(_ permission: ReminderPermission = .allowed) { self.permission = permission }

    func status() async -> ReminderPermission { permission }
    func request() async -> Bool { requests += 1; permission = grants ? .allowed : .denied; return grants }
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws { Issue.record("repeating schedule used") }
    func scheduleOnce(id: String, on day: DateComponents, hour: Int, minute: Int, title: String, body: String, route: String) async throws {
        scheduled.removeAll { $0.id == id }
        scheduled.append(Request(id: id, day: day, hour: hour, minute: minute, route: route, title: title, body: body))
    }
    func cancel(id: String) { cancelled.append(id); scheduled.removeAll { $0.id == id } }
    func isPending(id: String) async -> Bool { scheduled.contains { $0.id == id } }

    func request(_ id: String) -> Request? { scheduled.first { $0.id == id } }
}

@MainActor
final class RitmusRemindersTests {
    nonisolated private static let budapest: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    nonisolated private static func at(_ h: Int, _ m: Int = 0) -> Date {
        budapest.date(from: DateComponents(year: 2026, month: 11, day: 12, hour: h, minute: m))!
    }
    private static let today = DateComponents(year: 2026, month: 11, day: 12)
    private static let tomorrow = DateComponents(year: 2026, month: 11, day: 13)

    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("ritmus-reminders-\(UUID().uuidString)")
    private let center = FakeRitmusCenter()
    deinit { try? FileManager.default.removeItem(at: root) }

    private func reminders(now: Date) -> (RitmusReminders, LedgerStore) {
        let ledger = LedgerStore(directory: root)
        return (RitmusReminders(center: center, calendar: Self.budapest, clock: { now }), ledger)
    }

    private func checkIn(_ moment: CheckInMoment, at: Date) -> LedgerCheckIn {
        LedgerCheckIn(id: UUID(), slot: moment.slotId, capturedAt: at, values: ["energy": 6], askedItems: ["energy"])
    }

    // MARK: - Check-ins

    @Test func schedulesOnlyUndoneMoments() async throws {
        let (r, ledger) = reminders(now: Self.at(6, 50))
        try ledger.saveCheckIn(checkIn(.delben, at: Self.at(6, 40)), date: "2026-11-12")    // délben is done already
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)

        #expect(center.request("boop.ritmus.checkin.reggel").map { [$0.day, DateComponents(hour: $0.hour, minute: $0.minute)] }
                == [Self.today, DateComponents(hour: 7, minute: 30)])
        #expect(center.request("boop.ritmus.checkin.delutan").map { [$0.day, DateComponents(hour: $0.hour, minute: $0.minute)] }
                == [Self.today, DateComponents(hour: 16, minute: 0)])
        // the done moment does not ring today: its next ring is tomorrow's 12:30
        let noon = try #require(center.request("boop.ritmus.checkin.delben"))
        #expect(noon.day == Self.tomorrow && noon.hour == 12 && noon.minute == 30)
        #expect(center.cancelled.contains("boop.ritmus.checkin.delben"))
        #expect(center.scheduled.allSatisfy { $0.route == "boop://checkin" || $0.route == "boop://este" })
    }

    @Test func savingCancelsThatMomentsReminder() async throws {
        let (r, ledger) = reminders(now: Self.at(7, 10))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.request("boop.ritmus.checkin.reggel")?.day == Self.today)

        try ledger.saveCheckIn(checkIn(.reggel, at: Self.at(7, 12)), date: "2026-11-12")
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.cancelled.last == "boop.ritmus.checkin.reggel" || center.cancelled.contains("boop.ritmus.checkin.reggel"))
        #expect(center.request("boop.ritmus.checkin.reggel")?.day == Self.tomorrow)
        #expect(center.request("boop.ritmus.checkin.delben")?.day == Self.today)    // the others are untouched
    }

    @Test func aMomentAlreadyPastRingsTomorrow() async {
        let (r, ledger) = reminders(now: Self.at(13, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.request("boop.ritmus.checkin.reggel")?.day == Self.tomorrow)
        #expect(center.request("boop.ritmus.checkin.delben")?.day == Self.tomorrow)    // 12:30 has passed at 13:00
        #expect(center.request("boop.ritmus.checkin.delutan")?.day == Self.today)
    }

    @Test func checkInCopyIsQuietAndPerMoment() async throws {
        let (r, ledger) = reminders(now: Self.at(6, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.request("boop.ritmus.checkin.reggel")?.title == "Reggeli kitöltés")
        #expect(center.request("boop.ritmus.checkin.delben")?.title == "Déli kitöltés")
        #expect(center.request("boop.ritmus.checkin.delutan")?.title == "Délutáni kitöltés")
        #expect(center.request("boop.ritmus.checkin.reggel")?.body == "Mennyi energia van benned most? · 6 kérdés, fél perc")
    }

    // MARK: - The close

    @Test func closeAtBedtimeMinus75() async throws {
        let (r, ledger) = reminders(now: Self.at(9, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: "23:00", askPermission: false)
        let close = try #require(center.request("boop.ritmus.este"))
        #expect(close.day == Self.today && close.hour == 21 && close.minute == 45 && close.route == "boop://este")
        #expect(close.title == "Zárjuk le a napot")
        #expect(close.body == "Egy perc: hogy vagy, sikerült-e a nap célja, milyen volt a nap.")
    }

    @Test func closeBeforeMidnightForAPostMidnightTarget() async throws {
        let (r, ledger) = reminders(now: Self.at(9, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: "00:15", askPermission: false)
        let close = try #require(center.request("boop.ritmus.este"))
        #expect(close.hour == 23 && close.minute == 0 && close.day == Self.today)
    }

    @Test func closeFallback2130WithoutBedtime() async throws {
        let (r, ledger) = reminders(now: Self.at(9, 0))
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        let close = try #require(center.request("boop.ritmus.este"))
        #expect(close.hour == 21 && close.minute == 30 && close.day == Self.today)
    }

    @Test func aClosedDayDoesNotRingTonight() async throws {
        let (r, ledger) = reminders(now: Self.at(20, 0))
        try ledger.setClose(LedgerClose(id: UUID(), capturedAt: Self.at(19, 55), eveningEnergy: 6, dayRating: 7), date: "2026-11-12")
        await r.refresh(ledger: ledger, bedtimeTarget: nil, askPermission: false)
        #expect(center.request("boop.ritmus.este")?.day == Self.tomorrow)
        #expect(center.cancelled.contains("boop.ritmus.este"))
    }

    @Test func idsDifferFromTheBedtimeReminder() {
        #expect(RitmusReminders.allIds.allSatisfy { $0.hasPrefix("boop.ritmus.") && $0 != BedtimeReminder.id })
    }

    // MARK: - Permission

    @Test func notAskingWithoutACheckInSave() async {
        let c = FakeRitmusCenter(.notDetermined)
        let r = RitmusReminders(center: c, calendar: Self.budapest, clock: { Self.at(6, 0) })
        await r.refresh(ledger: LedgerStore(directory: root), bedtimeTarget: nil, askPermission: false)
        #expect(c.requests == 0 && c.scheduled.isEmpty)
    }

    @Test func askingOnceAtTheFirstSave() async {
        let c = FakeRitmusCenter(.notDetermined)
        let r = RitmusReminders(center: c, calendar: Self.budapest, clock: { Self.at(6, 0) })
        await r.refresh(ledger: LedgerStore(directory: root), bedtimeTarget: nil, askPermission: true)
        #expect(c.requests == 1 && c.scheduled.count == 4)
    }

    @Test func deniedSchedulesNothingAndClearsWhatWasThere() async {
        let c = FakeRitmusCenter(.denied)
        let r = RitmusReminders(center: c, calendar: Self.budapest, clock: { Self.at(6, 0) })
        await r.refresh(ledger: LedgerStore(directory: root), bedtimeTarget: nil, askPermission: true)
        #expect(c.requests == 0 && c.scheduled.isEmpty)
        #expect(Set(c.cancelled) == Set(RitmusReminders.allIds))
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
