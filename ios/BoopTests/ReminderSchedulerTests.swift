import Foundation
import SwiftUI
import Testing
import BoopCore
@testable import Boop

fileprivate final class FakeAlarms: AlarmScheduling, @unchecked Sendable {
    var auth: AlarmAuth
    var grants = true
    var requests = 0
    var scheduled: [ReminderOccurrence] = []
    var cancelAlls: [String] = []
    var failWith: AlarmArmError?
    var active = 0
    var overlapped = false
    var delay: Duration = .zero
    var losesAll = false
    var unreadable = false
    init(_ auth: AlarmAuth = .allowed) { self.auth = auth }

    func authorization() async -> AlarmAuth { auth }
    func requestAuthorization() async -> AlarmAuth {
        requests += 1
        auth = grants ? .allowed : .denied
        return auth
    }
    func schedule(_ o: ReminderOccurrence, title: String, secondaryTitle: String, tint: Color) async throws {
        active += 1
        if active > 1 { overlapped = true }
        defer { active -= 1 }
        if delay > .zero { try? await Task.sleep(for: delay) }
        if let failWith { throw failWith }
        scheduled.append(o)
    }
    func cancelAll(prefix: String) async {
        active += 1
        if active > 1 { overlapped = true }
        defer { active -= 1 }
        if delay > .zero { try? await Task.sleep(for: delay) }
        cancelAlls.append(prefix)
        scheduled = []
    }
    func scheduledIds() async -> Set<String>? {
        if unreadable { return nil }
        return losesAll ? [] : Set(scheduled.map { $0.alarmId.uuidString })
    }
}

fileprivate final class SchedCenter: ReminderCenter, @unchecked Sendable {
    var permission: ReminderPermission
    var requests: [(id: String, day: DateComponents, hour: Int, minute: Int, route: String)] = []
    var cancelled: [String] = []
    var pending: Set<String> = []
    init(_ p: ReminderPermission = .allowed) { permission = p }
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
}

@MainActor
struct ReminderSchedulerTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone.current
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }()
    var now: Date { cal.date(from: DateComponents(year: 2026, month: 11, day: 26, hour: 6))! }

    func store() -> ReminderStore {
        let n = now
        return ReminderStore(fileURL: FileManager.default.temporaryDirectory
            .appendingPathComponent("rsch-\(UUID().uuidString)/reminders.json"), clock: { n }, calendar: cal)
    }

    fileprivate func scheduler(_ s: ReminderStore, _ a: FakeAlarms, _ c: SchedCenter) -> ReminderScheduler {
        let n = now
        return ReminderScheduler(store: s, alarms: a, center: c, clock: { n }, calendar: cal)
    }

    func alarmReminder(hour: Int = 8) -> Reminder {
        Reminder(title: "Ébresztő", hour: hour, minute: 0, repeats: .daily, strength: .alarm)
    }
    func noteReminder() -> Reminder { Reminder(title: "Víz", hour: 9, minute: 0, repeats: .daily) }

    @Test func refreshClearsAndReaddsTheFamily() async {
        let s = store(), a = FakeAlarms(), c = SchedCenter()
        let r = alarmReminder(), n = noteReminder()
        s.upsert(r); s.upsert(n)
        c.pending = ["boop.rem.stale.2026-01-01", "other.keep"]
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: false)
        await sch.refresh(askPermission: false)
        #expect(a.cancelAlls == ["boop.rem.", "boop.rem."])
        #expect(a.scheduled.count == 7)
        #expect(c.cancelled.contains("boop.rem.stale.2026-01-01"))
        #expect(!c.cancelled.contains("other.keep"))
        #expect(c.pending.filter { $0.hasPrefix("boop.rem.") }.count == 3)
        #expect(c.requests.first?.id == "boop.rem.\(n.id.uuidString).2026-11-26")
        #expect(c.requests.first?.route == "boop://emlekeztetok")
        #expect(c.requests.first?.hour == 9)
        if case .armed(let until) = sch.state[r.id] { #expect(until != nil) } else { Issue.record("alarm not armed") }
    }

    @Test func alarmPermissionAskedOnlyWhenAskPermission() async {
        let s = store(), a = FakeAlarms(.notDetermined), c = SchedCenter()
        s.upsert(alarmReminder())
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: false)
        #expect(a.requests == 0)
        await sch.refresh(askPermission: true)
        #expect(a.requests == 1)
        #expect(a.scheduled.count == 7)
    }

    @Test func deniedAlarmsFallBackAndSayIt() async {
        let s = store(), a = FakeAlarms(.denied), c = SchedCenter()
        let r = alarmReminder()
        s.upsert(r)
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: false)
        #expect(sch.state[r.id] == .fellBackToNotification)
        #expect(a.scheduled.isEmpty)
        #expect(c.requests.count == 3)
    }

    @Test func limitErrorMarksTheRow() async {
        let s = store(), a = FakeAlarms(), c = SchedCenter()
        a.failWith = .limit
        let r = alarmReminder()
        s.upsert(r)
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: false)
        if case .failed = sch.state[r.id] {} else { Issue.record("expected failed, got \(String(describing: sch.state[r.id]))") }
    }

    @Test func lostAlarmsAreMarkedAfterTheCompare() async {
        let s = store(), a = FakeAlarms(), c = SchedCenter()
        a.losesAll = true
        let r = alarmReminder()
        s.upsert(r)
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: false)
        if case .failed = sch.state[r.id] {} else { Issue.record("expected failed") }
    }

    @Test func tickedTodayIsNotArmed() async {
        let s = store(), a = FakeAlarms(), c = SchedCenter()
        let r = alarmReminder()
        s.upsert(r)
        s.tick("\(r.id.uuidString)|2026-11-26")
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: false)
        #expect(a.scheduled.count == 6)
        #expect(!a.scheduled.contains { $0.day == "2026-11-26" })
    }

    @Test func notificationsDeniedIsSaid() async {
        let s = store(), a = FakeAlarms(), c = SchedCenter(.denied)
        let n = noteReminder()
        s.upsert(n)
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: true)
        #expect(sch.state[n.id] == .notificationsDenied)
        #expect(c.requests.isEmpty)
    }

    @Test func signOutCancelsEverything() async {
        let s = store(), a = FakeAlarms(), c = SchedCenter()
        s.upsert(alarmReminder()); s.upsert(noteReminder())
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: false)
        c.pending.insert("other.keep")
        await sch.signedOut()
        #expect(a.scheduled.isEmpty)
        #expect(c.pending == ["other.keep"])
        #expect(sch.state.isEmpty)
    }

    @Test func refreshesNeverOverlap() async {
        let s = store(), a = FakeAlarms(), c = SchedCenter()
        a.delay = .milliseconds(3)
        s.upsert(alarmReminder())
        let sch = scheduler(s, a, c)
        async let one: Void = sch.refresh(askPermission: false)
        async let two: Void = sch.refresh(askPermission: false)
        _ = await (one, two)
        #expect(!a.overlapped)
        #expect(a.scheduled.count == 7)
    }

    @Test func revokedLaterFallsBackOnNextRefresh() async {
        let s = store(), a = FakeAlarms(), c = SchedCenter()
        let r = alarmReminder()
        s.upsert(r)
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: false)
        if case .armed = sch.state[r.id] {} else { Issue.record("expected armed") }
        a.auth = .denied
        await sch.refresh(askPermission: false)
        #expect(sch.state[r.id] == .fellBackToNotification)
        #expect(a.scheduled.isEmpty)
        #expect(c.requests.count == 3) // the first refresh armed alarms only
    }

    @Test func unreadableSystemListDoesNotFailRows() async {
        let s = store(), a = FakeAlarms(), c = SchedCenter()
        a.unreadable = true
        let r = alarmReminder()
        s.upsert(r)
        let sch = scheduler(s, a, c)
        await sch.refresh(askPermission: false)
        if case .armed = sch.state[r.id] {} else { Issue.record("expected armed") }
    }
}

@MainActor @Suite(.serialized)
struct ReminderHubTests {
    let a = UUID(), b = UUID()
    func me(_ id: UUID) -> Me { Me(id: id, name: "T", email: "x@y.z", onboarded: true, timezone: "Europe/Budapest") }

    @Test func rules() {
        #expect(ReminderHub.action(for: .offline, current: a) == .keep)
        #expect(ReminderHub.action(for: .loading, current: a) == .keep)
        #expect(ReminderHub.action(for: .signedOut, current: a) == .deactivate)
        #expect(ReminderHub.action(for: .signedOut, current: nil) == .keep)
        #expect(ReminderHub.action(for: .ready(me(b)), current: a) == .activate(b))
        #expect(ReminderHub.action(for: .ready(me(a)), current: a) == .keep)
        #expect(ReminderHub.action(for: .ready(me(a)), current: nil) == .activate(a))
    }

    @Test func switchCancelsTheOldUsersAlarms() async {
        ReminderHub.deactivate()
        let alarmsA = FakeAlarms(), alarmsB = FakeAlarms()
        let center = SchedCenter()
        func make(_ id: UUID) -> (ReminderStore, AlarmScheduling, ReminderCenter) {
            let st = ReminderStore(fileURL: FileManager.default.temporaryDirectory
                .appendingPathComponent("hub-\(UUID().uuidString)/reminders.json"))
            st.upsert(Reminder(title: "x", hour: 23, minute: 59, repeats: .daily, strength: .alarm))
            return (st, id == a ? alarmsA : alarmsB, center)
        }
        ReminderHub.activate(for: a, make: make)
        await ReminderHub.scheduler!.refresh(askPermission: false)
        #expect(!alarmsA.scheduled.isEmpty)
        ReminderHub.activate(for: b, make: make)
        await ReminderHub.scheduler!.refresh(askPermission: false)
        #expect(alarmsA.scheduled.isEmpty && !alarmsA.cancelAlls.isEmpty)
        #expect(!alarmsB.scheduled.isEmpty)
        // offline keeps B's alarms
        ReminderHub.apply(.offline)
        await ReminderHub.scheduler!.refresh(askPermission: false)
        #expect(!alarmsB.scheduled.isEmpty)
        ReminderHub.apply(.signedOut)
        #expect(ReminderHub.scheduler == nil)
        ReminderHub.deactivate()
    }
}
