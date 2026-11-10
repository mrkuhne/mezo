import Foundation
import Testing
@testable import Boop

/// Records what the reminder asked of the notification centre.
private final class FakeCenter: ReminderCenter, @unchecked Sendable {
    var permission: ReminderPermission
    var grants: Bool
    var requests = 0
    var scheduled: [(id: String, hour: Int, minute: Int)] = []
    var cancelled: [String] = []
    init(_ permission: ReminderPermission = .notDetermined, grants: Bool = true) { self.permission = permission; self.grants = grants }

    func status() async -> ReminderPermission { permission }
    func request() async -> Bool {
        requests += 1
        permission = grants ? .allowed : .denied
        return grants
    }
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws {
        scheduled.append((id, hour, minute))
    }
    func cancel(id: String) { cancelled.append(id) }
}

private func defaults() -> UserDefaults {
    let name = "bedtime-tests-\(UUID().uuidString)"
    let d = UserDefaults(suiteName: name)!
    d.removePersistentDomain(forName: name)
    return d
}

private var budapest: Calendar {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "Europe/Budapest")!
    return c
}

private func at(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
    budapest.date(from: DateComponents(year: 2026, month: 11, day: day, hour: hour, minute: minute))!
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

    @Test func aTargetAfterMidnightRemindsThePreviousEvening() {
        #expect(BedtimeTime.label(for: "00:15") == "23:45")
        // in the evening of the 10th, a 00:15 bedtime (the night into the 11th) fires at 23:45 on the 10th
        #expect(BedtimeTime.nextFire(target: "00:15", now: at(10, 20), calendar: budapest) == at(10, 23, 45))
        #expect(BedtimeTime.nextFire(target: "00:40", now: at(10, 20), calendar: budapest) == at(11, 0, 10))
    }

    @Test func aPassedTriggerMovesToTheNextEvening() {
        #expect(BedtimeTime.nextFire(target: "22:30", now: at(10, 8), calendar: budapest) == at(10, 22))
        #expect(BedtimeTime.nextFire(target: "22:30", now: at(10, 22, 5), calendar: budapest) == at(11, 22))
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
        #expect(toast == "Emlékeztetlek 22:15-kor")
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
        #expect(toast == BedtimeText.off)
        #expect(BedtimeReminder(center: center, defaults: store).isOn == false)
    }

    @Test func deniedPermissionStaysOffWithAGentleWord() async {
        let center = FakeCenter(grants: false)
        let r = BedtimeReminder(center: center, defaults: defaults())
        let toast = await r.toggle(target: "22:30")
        #expect(!r.isOn)
        #expect(center.scheduled.isEmpty)
        #expect(toast == BedtimeText.denied)
        #expect(toast.contains("Beállítások"))
        // denied before: no prompt again, same word
        let again = await BedtimeReminder(center: FakeCenter(.denied), defaults: defaults()).toggle(target: "22:30")
        #expect(again == BedtimeText.denied)
    }

    @Test func noTargetNoReminder() async {
        let center = FakeCenter(.allowed)
        let r = BedtimeReminder(center: center, defaults: defaults())
        #expect(await r.toggle(target: nil) == BedtimeText.noTarget)
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
}
