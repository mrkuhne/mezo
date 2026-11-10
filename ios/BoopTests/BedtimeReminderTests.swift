import Foundation
import Testing
import UserNotifications
@testable import Boop

/// Records what the reminder asked of the notification centre.
private final class FakeCenter: ReminderCenter, @unchecked Sendable {
    var permission: ReminderPermission
    var grants: Bool
    var requests = 0
    var scheduled: [(id: String, hour: Int, minute: Int)] = []
    var cancelled: [String] = []
    var pending: Set<String> = []
    /// Holds the permission prompt open this long (a second tap lands while it is up).
    var promptDelay: Duration = .zero
    init(_ permission: ReminderPermission = .notDetermined, grants: Bool = true) { self.permission = permission; self.grants = grants }

    func status() async -> ReminderPermission { permission }
    func request() async -> Bool {
        requests += 1
        if promptDelay > .zero { try? await Task.sleep(for: promptDelay) }
        permission = grants ? .allowed : .denied
        return grants
    }
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws {
        scheduled.append((id, hour, minute))
        pending.insert(id)
    }
    func cancel(id: String) { cancelled.append(id); pending.remove(id) }
    func isPending(id: String) async -> Bool { pending.contains(id) }
}

private func defaults() -> UserDefaults {
    let name = "bedtime-tests-\(UUID().uuidString)"
    let d = UserDefaults(suiteName: name)!
    d.removePersistentDomain(forName: name)
    return d
}

@MainActor
struct BedtimeReminderTests {
    @Test func triggerIsHalfAnHourBeforeTheTarget() {
        #expect(BedtimeTime.trigger(for: "22:45")?.hour == 22)
        #expect(BedtimeTime.trigger(for: "22:45")?.minute == 15)
        #expect(BedtimeTime.trigger(for: "23:10")?.minute == 40)
        #expect(BedtimeTime.trigger(for: "22:10").map { "\($0.hour):\($0.minute)" } == "21:40")
        #expect(BedtimeTime.trigger(for: "nem idő") == nil)
        #expect(BedtimeTime.label(for: "22:45") == "22:15")
    }

    @Test func aTargetAfterMidnightRemindsThePreviousEvening() async {
        #expect(BedtimeTime.label(for: "00:15") == "23:45")
        // what production hands the notification centre for a 00:15 bedtime: 23:45, the evening before
        let center = FakeCenter(.allowed)
        _ = await BedtimeReminder(center: center, defaults: defaults()).toggle(target: "00:15")
        #expect(center.scheduled.first?.hour == 23 && center.scheduled.first?.minute == 45)
    }

    @Test func theSystemTriggerRepeatsAtTheWallClockTime() {
        // the real trigger: a repeating local clock time (crosses midnight and DST without date maths)
        let t = SystemReminderCenter.trigger(hour: 23, minute: 45)
        #expect(t.repeats)
        #expect(t.dateComponents.hour == 23 && t.dateComponents.minute == 45)
        #expect(t.dateComponents.day == nil)
        let next = t.nextTriggerDate().map { Calendar.current.dateComponents([.hour, .minute], from: $0) }
        #expect(next?.hour == 23 && next?.minute == 45)
    }

    @Test func foregroundRemindersShowAsABannerWithSound() {
        #expect(ReminderPresenter.foregroundOptions == [.banner, .sound])
    }

    @Test func firstTapAsksThenSchedulesHalfAnHourBefore() async {
        let center = FakeCenter()
        let r = BedtimeReminder(center: center, defaults: defaults())
        let toast = await r.toggle(target: "22:45")
        #expect(center.requests == 1)
        #expect(center.scheduled.count == 1)
        #expect(center.scheduled.first?.hour == 22 && center.scheduled.first?.minute == 15)
        #expect(r.isOn)
        #expect(r.time == "22:15")
        #expect(toast?.text == "Emlékeztetlek 22:15-kor")
        #expect(toast?.opensSettings == false)
        #expect(reminderPillTitle("22:15") == "Emlékeztetlek 22:15-kor")
    }

    @Test func untapCancels() async {
        let center = FakeCenter(.allowed)
        let store = defaults()
        let r = BedtimeReminder(center: center, defaults: store)
        _ = await r.toggle(target: "22:30")
        let toast = await r.toggle(target: "22:30")
        #expect(!r.isOn)
        #expect(center.cancelled == [BedtimeReminder.id])
        #expect(center.requests == 0)          // already allowed: no second prompt
        #expect(toast?.text == BedtimeText.off)
        #expect(BedtimeReminder(center: center, defaults: store).isOn == false)
    }

    @Test func deniedPermissionStaysOffWithAGentleWord() async {
        let center = FakeCenter(grants: false)
        let r = BedtimeReminder(center: center, defaults: defaults())
        let toast = await r.toggle(target: "22:30")
        #expect(!r.isOn)
        #expect(center.scheduled.isEmpty)
        #expect(toast?.text == BedtimeText.denied)
        #expect(toast?.opensSettings == true)     // the toast carries a "Beállítások" button
        // denied before: no prompt again, same word
        let again = await BedtimeReminder(center: FakeCenter(.denied), defaults: defaults()).toggle(target: "22:30")
        #expect(again?.text == BedtimeText.denied)
        #expect(again?.opensSettings == true)
    }

    @Test func noTargetNoReminder() async {
        let center = FakeCenter(.allowed)
        let r = BedtimeReminder(center: center, defaults: defaults())
        #expect(await r.toggle(target: nil)?.text == BedtimeText.noTarget)
        #expect(!r.isOn && center.scheduled.isEmpty)
    }

    @Test func stateSurvivesARelaunchAndFollowsANewTarget() async {
        let center = FakeCenter(.allowed)
        let store = defaults()
        _ = await BedtimeReminder(center: center, defaults: store).toggle(target: "22:30")
        let relaunched = BedtimeReminder(center: center, defaults: store)
        #expect(relaunched.isOn)
        #expect(relaunched.time == "22:00")
        await relaunched.refresh(target: "23:00")
        #expect(relaunched.time == "22:30")
        #expect(center.scheduled.last?.hour == 22 && center.scheduled.last?.minute == 30)
        // same target again: nothing rescheduled
        let n = center.scheduled.count
        await relaunched.refresh(target: "23:00")
        #expect(center.scheduled.count == n)
    }

    @Test func permissionWithdrawnInSettingsTurnsItOff() async {
        let center = FakeCenter(.allowed)
        let store = defaults()
        _ = await BedtimeReminder(center: center, defaults: store).toggle(target: "22:30")
        center.permission = .denied
        let r = BedtimeReminder(center: center, defaults: store)
        await r.refresh(target: "22:30")
        #expect(!r.isOn)
    }

    @Test func aSecondTapWhileTheFirstIsRunningIsIgnored() async {
        let center = FakeCenter(grants: true)
        center.promptDelay = .milliseconds(200)
        let r = BedtimeReminder(center: center, defaults: defaults())
        async let first = r.toggle(target: "22:30")
        async let second = r.toggle(target: "22:30")
        let (a, b) = await (first, second)
        #expect([a, b].compactMap { $0 }.count == 1)       // one toast, the other tap ignored
        #expect(center.scheduled.count == 1)
        #expect(center.requests == 1)
        #expect(r.isOn)
    }

    @Test func aDroppedRequestIsScheduledAgainOnLaunch() async {
        let center = FakeCenter(.allowed)
        let store = defaults()
        _ = await BedtimeReminder(center: center, defaults: store).toggle(target: "22:30")
        center.pending.removeAll()          // the system lost it (restore, settings reset)
        let r = BedtimeReminder(center: center, defaults: store)
        await r.refresh(target: "22:30")
        #expect(r.isOn)
        #expect(center.pending.contains(BedtimeReminder.id))
        #expect(center.scheduled.count == 2)
    }

    @Test func aDroppedRequestWithNoKnownTargetTurnsOff() async {
        let center = FakeCenter(.allowed)
        let store = defaults()
        store.set(true, forKey: "bedtimeReminder.on")      // an old install: on, but no target kept
        store.set("22:00", forKey: "bedtimeReminder.time")
        let r = BedtimeReminder(center: center, defaults: store)
        await r.refresh(target: nil)
        #expect(!r.isOn)
        #expect(center.scheduled.isEmpty)
    }

    @Test func aBriefWithoutATargetKeepsTheLastKnownOne() async {
        let center = FakeCenter(.allowed)
        let store = defaults()
        _ = await BedtimeReminder(center: center, defaults: store).toggle(target: "23:00")
        let r = BedtimeReminder(center: center, defaults: store)
        await r.refresh(target: nil)
        #expect(r.isOn)
        #expect(r.time == "22:30")
        #expect(center.pending.contains(BedtimeReminder.id))
        // and it re-derives from that target if the request was lost meanwhile
        center.pending.removeAll()
        await r.refresh(target: nil)
        #expect(center.scheduled.last?.hour == 22 && center.scheduled.last?.minute == 30)
    }
}
