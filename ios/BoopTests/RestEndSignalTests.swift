import Foundation
import SwiftUI
import Testing
import BoopCore
@testable import Boop

fileprivate final class RestAlarms: AlarmScheduling, @unchecked Sendable {
    var restAt: [Date] = []          // every scheduleRest call
    var live: Date?                  // what the system holds now
    var cancels = 0
    func authorization() async -> AlarmAuth { .allowed }
    func requestAuthorization() async -> AlarmAuth { .allowed }
    func schedule(_ o: ReminderOccurrence, title: String, secondaryTitle: String, tint: Color) async throws {}
    func cancel(id: String) async {}
    func scheduledIds() async -> Set<String>? { [] }
    func alertingIds() async -> Set<String> { [] }
    func scheduleRest(at: Date, title: String, tint: Color) async throws { restAt.append(at); live = at }
    func cancelRest() async { cancels += 1; live = nil }
}

fileprivate final class RestCenter: ReminderCenter, @unchecked Sendable {
    var live: (id: String, at: Date, title: String, body: String)?
    var adds = 0
    func status() async -> ReminderPermission { .allowed }
    func request() async -> Bool { true }
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws {}
    func scheduleOnce(id: String, on day: DateComponents, hour: Int, minute: Int, title: String, body: String, route: String) async throws {}
    func scheduleAt(id: String, fireAt: Date, title: String, body: String) async throws { adds += 1; live = (id, fireAt, title, body) }
    func cancel(id: String) { if live?.id == id { live = nil } }
    func isPending(id: String) async -> Bool { live?.id == id }
    func pendingIds(withPrefix prefix: String) async -> [String] { live.map { [$0.id] } ?? [] }
    func removeDelivered(ids: [String]) {}
}

@MainActor
struct RestEndSignalTests {
    let now = Date()

    func session(sets: Int = 3) -> WorkoutSession {
        let sets = (0..<sets).map { _ in PrescribedSet(kind: .working, targetKg: 60, targetReps: 8) }
        let e = PlannedExercise(id: UUID(), name: "Fekvenyomás", muscle: "chest", type: .compound, sets: sets,
                                warmupCount: 0, workingCount: sets.count, repMin: 6, repMax: 10, targetRIR: 2, anchorKg: 60)
        return WorkoutSession(TodayWorkout(exercises: [e]), startedAt: now)
    }

    func resting(_ s: WorkoutSession? = nil) -> WorkoutSession {
        var s = s ?? session()
        s.log(kg: 60, reps: 8, rir: 2, now: now)
        return s
    }

    fileprivate func make(_ mode: RestEndMode = .vibrate) -> (RestEndSignal, RestAlarms, RestCenter) {
        let a = RestAlarms(), c = RestCenter()
        return (RestEndSignal(alarms: a, center: c, mode: { mode }, clock: { now }), a, c)
    }

    @Test func restStartArmsAtRestEnd() async {
        let (sig, _, c) = make()
        let s = resting()
        await sig.sessionChanged(s, now: now)
        #expect(c.live?.id == "boop.rest")
        #expect(c.live?.at == s.restEndsAt)
        #expect(c.live?.title == "Lejárt a pihenő")
        #expect(c.live?.body == "Fekvenyomás · 2. sorozat")
    }

    @Test func addRestRearms() async {
        let (sig, _, c) = make()
        var s = resting()
        await sig.sessionChanged(s, now: now)
        let first = c.live?.at
        s.addRest(15, now: now)
        await sig.sessionChanged(s, now: now)
        #expect(c.live?.at == first?.addingTimeInterval(15))
        #expect(c.adds == 2)
    }

    @Test func skipRestCancels() async {
        let (sig, _, c) = make()
        var s = resting()
        await sig.sessionChanged(s, now: now)
        s.skipRest()
        await sig.sessionChanged(s, now: now)
        #expect(c.live == nil)
    }

    @Test func endWorkoutCancels() async {
        let (sig, _, c) = make()
        await sig.sessionChanged(resting(), now: now)
        await sig.sessionChanged(nil, now: now)
        #expect(c.live == nil)
    }

    @Test func pastRestEndArmsNothing() async {
        let (sig, a, c) = make()
        // the rest started ten minutes ago and ran out
        var s = session()
        s.log(kg: 60, reps: 8, rir: 2, now: now.addingTimeInterval(-600))
        await sig.sessionChanged(s, now: now)
        #expect(c.live == nil && c.adds == 0 && a.live == nil)
    }

    @Test func alarmModeCancelsInForegroundAndRearmsInBackground() async {
        let (sig, a, c) = make(.alarm)
        let s = resting()
        await sig.sessionChanged(s, now: now)                 // app is open: nothing rings
        #expect(a.live == nil && c.live == nil)
        await sig.foregroundChanged(false)
        #expect(a.live == s.restEndsAt)
        #expect(c.live == nil)
        await sig.foregroundChanged(true)
        #expect(a.live == nil)
    }

    @Test func signOutCancelsBoth() async {
        let (sig, a, c) = make(.alarm)
        await sig.foregroundChanged(false)
        await sig.sessionChanged(resting(), now: now)
        #expect(a.live != nil)
        await sig.signedOut()
        #expect(a.live == nil && c.live == nil)
        let (sig2, _, c2) = make()
        await sig2.sessionChanged(resting(), now: now)
        await sig2.signedOut()
        #expect(c2.live == nil)
    }

    @Test func modeIsStoredPerUserAndDefaultsToVibrate() {
        let d = UserDefaults(suiteName: "restend-\(UUID().uuidString)")!
        #expect(RestEndMode.load(userKey: "a", defaults: d) == .vibrate)
        RestEndMode.save(.alarm, userKey: "a", defaults: d)
        #expect(RestEndMode.load(userKey: "a", defaults: d) == .alarm)
        #expect(RestEndMode.load(userKey: "b", defaults: d) == .vibrate)
    }

    @Test func theForegroundDoesNotShowTheRestNotification() {
        #expect(ReminderPresenter.presentation(for: "boop.rest") == [])
    }
}
