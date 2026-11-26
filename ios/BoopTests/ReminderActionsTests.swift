import Foundation
import Testing
import BoopCore
@testable import Boop

fileprivate final class SnoozeCenter: ReminderCenter, @unchecked Sendable {
    var requests: [(id: String, day: DateComponents, hour: Int, minute: Int, title: String, route: String)] = []
    func status() async -> ReminderPermission { .allowed }
    func request() async -> Bool { true }
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws {}
    func scheduleOnce(id: String, on day: DateComponents, hour: Int, minute: Int, title: String, body: String, route: String) async throws {
        requests.append((id, day, hour, minute, title, route))
    }
    var cancelled: [String] = []
    func cancel(id: String) { cancelled.append(id) }
    func isPending(id: String) async -> Bool { false }
    func pendingIds(withPrefix prefix: String) async -> [String] { [] }
    func removeDelivered(ids: [String]) {}
}

@MainActor
struct ReminderActionsTests {
    let base = FileManager.default.temporaryDirectory.appendingPathComponent("ractions-\(UUID().uuidString)")
    let now = Date(timeIntervalSince1970: 1_795_089_600)
    let userId = UUID()

    private func parts() -> HeadlessContext.Parts {
        HeadlessContext.parts(userId: userId, base: base)!
    }

    @Test func doneTicksTheOccurrence() async {
        let p = parts()
        let r = Reminder(title: "Víz", hour: 10, minute: 0, repeats: .daily)
        p.store.upsert(r)
        var refreshed = 0
        await ReminderActions.done(key: "\(r.id.uuidString)|2026-11-26", store: p.store, supplement: nil, refresh: { refreshed += 1 }, now: now)
        #expect(p.store.file.done == ["\(r.id.uuidString)|2026-11-26"])
        #expect(refreshed == 1)
        #expect(await p.outbox.pending.isEmpty)
    }

    @Test func doneOnLinkedReminderAlsoQueuesTheSupplementTick() async {
        let p = parts()
        let r = Reminder(title: "Reggeli", hour: 8, minute: 0, repeats: .daily, strength: .alarm, link: .supplement(daypart: "morning"))
        p.store.upsert(r)
        let day = HeadlessContext.day(of: now, calendar: p.calendar)
        await ReminderActions.done(key: "\(r.id.uuidString)|\(day)", store: p.store,
                                   supplement: { press in await p.tick(press) }, refresh: {}, now: now)
        let pending = await p.outbox.pending
        #expect(pending.map(\.kind) == [.supplementTick])
        #expect(p.taken.taken(day: day) == ["morning": []])
        // the same press again (or the room first): nothing more is queued
        await ReminderActions.done(key: "\(r.id.uuidString)|\(day)", store: p.store,
                                   supplement: { press in await p.tick(press) }, refresh: {}, now: now)
        #expect(await p.outbox.pending.count == 1)
        // a freshly built context sees the same files (what the next launch reads)
        #expect(await parts().outbox.pending.count == 1)
        #expect(parts().store.file.done.contains("\(r.id.uuidString)|\(day)"))
    }

    // MARK: the day comes from the occurrence, not from the press (final review I7)

    @Test func doneOnYesterdaysNotificationTakesYesterdaysSupplement() async {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = .current
        let p = parts()
        let r = Reminder(title: "Reggeli", hour: 8, minute: 0, repeats: .daily, strength: .notification, link: .supplement(daypart: "morning"))
        p.store.upsert(r)
        let morning = cal.date(from: DateComponents(year: 2026, month: 11, day: 27, hour: 7, minute: 10))!   // next morning
        var got: [SupplementPress] = []
        await ReminderActions.done(key: "\(r.id.uuidString)|2026-11-26", store: p.store, supplement: { got.append($0) },
                                   refresh: {}, now: morning, calendar: cal)
        #expect(got.count == 1)
        #expect(got.first?.day == "2026-11-26")
        // logged at yesterday's ring, not at this morning's press
        #expect(got.first?.capturedAt == cal.date(from: DateComponents(year: 2026, month: 11, day: 26, hour: 8)))
        #expect(p.store.file.done == ["\(r.id.uuidString)|2026-11-26"])     // today's ring still rings
    }

    @Test func doneOnTodaysRingIsLoggedAtThePress() async {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = .current
        let p = parts()
        let r = Reminder(title: "Reggeli", hour: 8, minute: 0, repeats: .daily, strength: .alarm, link: .supplement(daypart: "morning"))
        p.store.upsert(r)
        let press = cal.date(from: DateComponents(year: 2026, month: 11, day: 26, hour: 8, minute: 3))!
        var got: [SupplementPress] = []
        await ReminderActions.done(key: "\(r.id.uuidString)|2026-11-26", store: p.store, supplement: { got.append($0) },
                                   refresh: {}, now: press, calendar: cal)
        #expect(got == [SupplementPress(daypart: "morning", day: "2026-11-26", capturedAt: press)])
    }

    @Test func headlessTickFilesTheIntakeOnTheOccurrencesDay() async {
        let p = parts()
        let r = Reminder(title: "Reggeli", hour: 8, minute: 0, repeats: .daily, strength: .alarm, link: .supplement(daypart: "morning"))
        p.store.upsert(r)
        let at = Date(timeIntervalSince1970: 1_795_089_600)
        #expect(await p.tick(SupplementPress(daypart: "morning", day: "2026-11-20", capturedAt: at)))
        let pending = await p.outbox.pending
        #expect(pending.map(\.date) == ["2026-11-20"])
        #expect(p.taken.taken(day: "2026-11-20") == ["morning": []])
        // only that day's linked occurrence is done
        #expect(p.store.file.done == ["\(r.id.uuidString)|2026-11-20"])
    }

    @Test func silenceNeverTicks() async throws {
        let p = parts()
        let r = Reminder(title: "Reggeli", hour: 8, minute: 0, repeats: .daily, strength: .alarm, link: .supplement(daypart: "morning"))
        // (ReminderHub is process-global and BedtimeReminder's default seams read it: binding it here would leak into
        // parallel tests, so the unchanged state is checked on the headless stores the same press would have used.)
        p.store.upsert(r)
        _ = try await ReminderSilenceIntent().perform()
        #expect(p.store.file.done.isEmpty)
        #expect(parts().store.file.done.isEmpty)
        #expect(await p.outbox.pending.isEmpty)
        #expect(p.taken.taken(day: HeadlessContext.day(of: now, calendar: p.calendar)).isEmpty)
    }

    @Test func doneCancelsThePendingSnooze() async {
        let p = parts()
        let r = Reminder(title: "Víz", hour: 10, minute: 0, repeats: .daily)
        p.store.upsert(r)
        let center = SnoozeCenter()
        await ReminderActions.done(key: "\(r.id.uuidString)|2026-11-26", store: p.store, supplement: nil, center: center, refresh: {}, now: now)
        #expect(center.cancelled == ["boop.rem.snooze.\(r.id.uuidString)"])
    }

    @Test func snoozeAcrossMidnightTicksTheOriginalDay() async {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = .current
        let late = cal.date(from: DateComponents(year: 2026, month: 11, day: 26, hour: 23, minute: 55))!
        let id = UUID()
        let key = "\(id.uuidString)|2026-11-26"
        let center = SnoozeCenter()
        let p = parts()
        let r = Reminder(id: id, title: "Víz", hour: 23, minute: 55, repeats: .daily)
        p.store.upsert(r)
        await ReminderActions.snooze(reminderId: id, key: key, title: "Víz", store: p.store, center: center, now: late, calendar: cal)
        let q = center.requests[0]
        #expect(q.day.day == 27 && q.hour == 0 && q.minute == 5)       // fires after midnight
        // what the centre stores for that notification is the ORIGINATING key
        #expect(SystemReminderCenter.reminderKey(id: q.id, day: q.day, route: q.route) == key)
        // "Kész" on it ticks yesterday's occurrence, not tomorrow's
        await ReminderActions.done(key: key, store: p.store, supplement: nil, refresh: {}, now: late)
        #expect(p.store.file.done == [key])
        #expect(!p.store.file.done.contains("\(id.uuidString)|2026-11-27"))
    }

    @Test func snoozeSchedulesTenMinutesLater() async {
        let center = SnoozeCenter()
        let p = parts()
        let r = Reminder(title: "Víz", hour: 10, minute: 0, repeats: .daily)
        p.store.upsert(r)
        let id = r.id
        await ReminderActions.snooze(reminderId: id, key: "\(id.uuidString)|2026-11-26", title: "Víz", store: p.store, center: center, now: now)
        let at = now.addingTimeInterval(600)
        let c = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: at)
        #expect(center.requests.count == 1)
        let q = center.requests[0]
        #expect(q.id == "boop.rem.snooze.\(id.uuidString)")
        #expect(q.day.year == c.year && q.day.month == c.month && q.day.day == c.day)
        #expect(q.hour == c.hour && q.minute == c.minute)
        #expect(q.title == "Víz")
    }

    // MARK: nobody (or somebody else) signed in (final review I3)

    @Test func snoozeWithNobodySignedInSchedulesNothing() async {
        let center = SnoozeCenter()
        let id = UUID()
        await ReminderActions.snooze(reminderId: id, key: "\(id.uuidString)|2026-11-26", title: "Víz", store: nil, center: center, now: now)
        #expect(center.requests.isEmpty)
    }

    @Test func snoozeOfAnotherAccountsReminderSchedulesNothing() async {
        let center = SnoozeCenter()
        let p = parts()                                   // signed in, but this reminder is not his
        let id = UUID()
        await ReminderActions.snooze(reminderId: id, key: "\(id.uuidString)|2026-11-26", title: "Víz", store: p.store, center: center, now: now)
        #expect(center.requests.isEmpty)
    }

    @Test func doneOfAnotherAccountsReminderTicksNothing() async {
        let p = parts()
        var refreshed = 0
        await ReminderActions.done(key: "\(UUID().uuidString)|2026-11-26", store: p.store, supplement: nil, refresh: { refreshed += 1 }, now: now)
        #expect(p.store.file.done.isEmpty)
        #expect(refreshed == 0)
    }

    @Test func theIntentsStayOutOfShortcuts() {
        #expect(ReminderDoneIntent.isDiscoverable == false)
        #expect(ReminderSilenceIntent.isDiscoverable == false)
        #expect(ProbeDoneIntent.isDiscoverable == false)
    }

    @Test func aBurstOfTimeChangesSavesOnce() async {
        var saved: [Int] = []
        let d = Debouncer(delay: .milliseconds(60))
        for v in 1...5 { d.submit { saved.append(v) } }
        try? await Task.sleep(for: .milliseconds(250))
        #expect(saved == [5])
        d.submit { saved.append(6) }
        d.flush()                                           // closing the sheet saves what is pending at once
        #expect(saved == [5, 6])
    }

    @Test func headlessWithNoUserDoesNothing() {
        #expect(HeadlessContext.parts(userId: nil, base: base) == nil)
    }

    @Test func reminderKeyFollowsTheNotificationId() {
        let id = UUID()
        let day = DateComponents(year: 2026, month: 11, day: 27)
        #expect(SystemReminderCenter.reminderKey(id: "boop.rem.\(id.uuidString).2026-11-26", day: day) == "\(id.uuidString)|2026-11-26")
        let route = ReminderActions.snoozeRoute(key: "\(id.uuidString)|2026-11-26")
        #expect(SystemReminderCenter.reminderKey(id: "boop.rem.snooze.\(id.uuidString)", day: day, route: route) == "\(id.uuidString)|2026-11-26")
        #expect(SystemReminderCenter.reminderKey(id: "boop.bedtime", day: day) == nil)
    }
}
