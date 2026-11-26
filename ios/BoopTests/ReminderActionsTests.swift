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
    func cancel(id: String) {}
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
                                   supplement: { daypart, at in await p.tick(daypart: daypart, at: at) }, refresh: {}, now: now)
        let pending = await p.outbox.pending
        #expect(pending.map(\.kind) == [.supplementTick])
        #expect(p.taken.taken(day: day) == ["morning": []])
        // the same press again (or the room first): nothing more is queued
        await ReminderActions.done(key: "\(r.id.uuidString)|\(day)", store: p.store,
                                   supplement: { daypart, at in await p.tick(daypart: daypart, at: at) }, refresh: {}, now: now)
        #expect(await p.outbox.pending.count == 1)
        // a freshly built context sees the same files (what the next launch reads)
        #expect(await parts().outbox.pending.count == 1)
        #expect(parts().store.file.done.contains("\(r.id.uuidString)|\(day)"))
    }

    @Test func silenceNeverTicks() async throws {
        let p = parts()
        let r = Reminder(title: "Víz", hour: 10, minute: 0, repeats: .daily)
        p.store.upsert(r)
        _ = try await ReminderSilenceIntent().perform()
        #expect(p.store.file.done.isEmpty)
    }

    @Test func snoozeSchedulesTenMinutesLater() async {
        let center = SnoozeCenter()
        let id = UUID()
        await ReminderActions.snooze(reminderId: id, title: "Víz", center: center, now: now)
        let at = now.addingTimeInterval(600)
        let c = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: at)
        #expect(center.requests.count == 1)
        let q = center.requests[0]
        #expect(q.id == "boop.rem.snooze.\(id.uuidString)")
        #expect(q.day.year == c.year && q.day.month == c.month && q.day.day == c.day)
        #expect(q.hour == c.hour && q.minute == c.minute)
        #expect(q.title == "Víz")
    }

    @Test func headlessWithNoUserDoesNothing() {
        #expect(HeadlessContext.parts(userId: nil, base: base) == nil)
    }

    @Test func reminderKeyFollowsTheNotificationId() {
        let id = UUID()
        let day = DateComponents(year: 2026, month: 11, day: 27)
        #expect(SystemReminderCenter.reminderKey(id: "boop.rem.\(id.uuidString).2026-11-26", day: day) == "\(id.uuidString)|2026-11-26")
        #expect(SystemReminderCenter.reminderKey(id: "boop.rem.snooze.\(id.uuidString)", day: day) == "\(id.uuidString)|2026-11-27")
        #expect(SystemReminderCenter.reminderKey(id: "boop.bedtime", day: day) == nil)
    }
}
