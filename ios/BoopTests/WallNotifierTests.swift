import Foundation
import Testing
import BoopCore
@testable import Boop

/// Records what the wall's notifier asked of the notification centre.
private final class FakeRinger: WallRinger, @unchecked Sendable {
    var permission: ReminderPermission
    var grants: Bool
    var requests = 0
    var scheduled: [(id: String, at: Date, title: String, body: String)] = []
    var cancelled: [String] = []
    var pending: Set<String> = []
    var delay: Duration = .zero
    init(_ permission: ReminderPermission = .allowed, grants: Bool = true) { self.permission = permission; self.grants = grants }

    func status() async -> ReminderPermission { permission }
    func request() async -> Bool { requests += 1; permission = grants ? .allowed : .denied; return grants }
    func schedule(id: String, at: Date, title: String, body: String) async throws {
        if delay > .zero { try? await Task.sleep(for: delay) }
        scheduled.append((id, at, title, body)); pending.insert(id)
    }
    func pendingIds(withPrefix prefix: String) async -> [String] { pending.filter { $0.hasPrefix(prefix) }.sorted() }
    func cancel(ids: [String]) { cancelled += ids; pending.subtract(ids) }
}

private var cal: Calendar {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "Europe/Budapest")!
    return c
}
private func at(_ day: Int, _ h: Int, _ m: Int = 0) -> Date {
    cal.date(from: DateComponents(year: 2026, month: 11, day: day, hour: h, minute: m))!
}
private func defaults() -> UserDefaults {
    let d = UserDefaults(suiteName: "wall-notifier-tests-\(UUID().uuidString)")!
    return d
}
private func expiring(_ id: String, _ end: Date, area: String = WallSources.level) -> WallCandidate {
    WallCandidate(id: id, role: .expires, kind: .teendo, area: area, expiresAt: end,
                  text: "Lejáró \(id)", sub: "Hamarosan vége", settled: "Kész", why: "Mert lejár.")
}
@MainActor private func notifier(_ ringer: FakeRinger, _ d: UserDefaults, user: String = "u1") -> WallNotifier {
    WallNotifier(center: ringer, defaults: d, userKey: user, calendar: cal)
}

@MainActor @Suite struct WallNotifierTests {
    @Test func aCandidateExpiringSoonRingsNowWithItsOwnWords() async {
        let r = FakeRinger(), now = at(10, 10)
        await notifier(r, defaults()).reconcile([expiring("level-expires-a", at(10, 18))], now: now)
        #expect(r.scheduled.count == 1)
        #expect(r.scheduled[0].id == "wall.level-expires-a")
        #expect(r.scheduled[0].at == now)
        #expect(r.scheduled[0].title == "Lejáró level-expires-a")
        #expect(r.scheduled[0].body == "Hamarosan vége")
    }

    @Test func aFarDeadlineRingsTwelveHoursBefore() async {
        let r = FakeRinger(), now = at(10, 9)
        await notifier(r, defaults()).reconcile([expiring("a", at(11, 20))], now: now)
        #expect(r.scheduled.map(\.at) == [at(11, 8)])
    }

    @Test func theThirdCandidateOfTheDayIsNotScheduled() async {
        let r = FakeRinger(), now = at(10, 10)
        let cs = [expiring("a", at(10, 14)), expiring("b", at(10, 15)), expiring("c", at(10, 16))]
        await notifier(r, defaults()).reconcile(cs, now: now)
        #expect(r.scheduled.map(\.id) == ["wall.a", "wall.b"])
    }

    @Test func theCapCarriesAcrossReconcilesTheSameDay() async {
        let r = FakeRinger(), d = defaults(), n = notifier(r, d)
        await n.reconcile([expiring("a", at(10, 14)), expiring("b", at(10, 15))], now: at(10, 10))
        await n.reconcile([expiring("a", at(10, 14)), expiring("b", at(10, 15)), expiring("c", at(10, 16))], now: at(10, 11))
        #expect(r.scheduled.map(\.id) == ["wall.a", "wall.b"])
    }

    @Test func aSeenCandidateIsNotScheduled() async {
        let r = FakeRinger(), now = at(10, 10), n = notifier(r, defaults())
        n.markSeen(["a"], now: now)
        await n.reconcile([expiring("a", at(10, 14)), expiring("b", at(10, 15))], now: now)
        #expect(r.scheduled.map(\.id) == ["wall.b"])
    }

    @Test func aSeenCandidateDueTodayAlreadyPendingIsTakenBack() async {
        let r = FakeRinger(), n = notifier(r, defaults())
        let c = expiring("a", at(10, 14))
        await n.reconcile([c], now: at(10, 9))
        #expect(r.pending == ["wall.a"])
        n.markSeen(["a"], now: at(10, 10))
        await n.reconcile([c], now: at(10, 10))
        #expect(r.pending.isEmpty)
    }

    @Test func seenTodayButDueTomorrowIsStillScheduledForTomorrowMorning() async {
        let r = FakeRinger(), n = notifier(r, defaults()), now = at(10, 9)
        n.markSeen(["a"], now: now)
        await n.reconcile([expiring("a", at(11, 18))], now: now)
        #expect(r.scheduled.map(\.id) == ["wall.a"])
        #expect(r.scheduled.map(\.at) == [at(11, 8)])
        // and a later look at it today does not take the request back
        await n.reconcile([expiring("a", at(11, 18))], now: at(10, 12))
        #expect(r.pending == ["wall.a"])
    }

    @Test func seenTodayAndDueTodayIsNotScheduled() async {
        let r = FakeRinger(), n = notifier(r, defaults()), now = at(10, 9)
        n.markSeen(["a"], now: now)
        await n.reconcile([expiring("a", at(10, 14))], now: now)
        #expect(r.scheduled.isEmpty)
    }

    @Test func theCapIsCountedPerFireDay() async {
        let r = FakeRinger(), n = notifier(r, defaults()), now = at(10, 9)
        let tomorrow = [expiring("a", at(11, 18)), expiring("b", at(11, 19)), expiring("c", at(11, 20))]
        await n.reconcile(tomorrow + [expiring("d", at(10, 14))], now: now)
        // tomorrow's two slots are full (c waits), today's own slot is untouched
        #expect(Set(r.scheduled.map(\.id)) == ["wall.a", "wall.b", "wall.d"])
    }

    @Test func theNextDayStartsTheCountOver() async {
        let r = FakeRinger(), n = notifier(r, defaults())
        await n.reconcile([expiring("a", at(10, 14)), expiring("b", at(10, 15))], now: at(10, 10))
        await n.reconcile([expiring("c", at(11, 14)), expiring("d", at(11, 15))], now: at(11, 10))
        #expect(r.scheduled.map(\.id) == ["wall.a", "wall.b", "wall.c", "wall.d"])
    }

    @Test func theNextDayForgetsWhatWasSeen() async {
        let r = FakeRinger(), n = notifier(r, defaults())
        n.markSeen(["a"], now: at(10, 10))
        await n.reconcile([expiring("a", at(11, 14))], now: at(11, 10))
        #expect(r.scheduled.map(\.id) == ["wall.a"])
    }

    @Test func aVanishedCandidatesPendingRequestIsRemoved() async {
        let r = FakeRinger(), n = notifier(r, defaults())
        await n.reconcile([expiring("a", at(11, 20)), expiring("b", at(11, 21))], now: at(10, 9))
        #expect(r.pending == ["wall.a", "wall.b"])
        await n.reconcile([expiring("b", at(11, 21))], now: at(10, 10))
        #expect(r.pending == ["wall.b"])
        #expect(r.cancelled == ["wall.a"])
    }

    @Test func aCandidateActedOnIsRemoved() async {
        let r = FakeRinger(), n = notifier(r, defaults())
        let c = expiring("a", at(11, 20))
        await n.reconcile([c], now: at(10, 9))
        await n.reconcile([c], now: at(10, 10), acted: ["a"])
        #expect(r.pending.isEmpty)
    }

    @Test func otherRequestsAreLeftAlone() async {
        let r = FakeRinger(); r.pending = ["boop.bedtime", "ritmus.checkin"]
        await notifier(r, defaults()).reconcile([], now: at(10, 10))
        #expect(r.cancelled.isEmpty)
    }

    @Test func foodExpiresRingsToo() async {
        let r = FakeRinger()
        await notifier(r, defaults()).reconcile([expiring("etel-window", at(10, 13), area: WallSources.etel)], now: at(10, 10))
        #expect(r.scheduled.map(\.id) == ["wall.etel-window"])
    }

    @Test func nonExpiringCardsNeverRing() async {
        let r = FakeRinger()
        let c = WallCandidate(id: "h", role: .happened, kind: .tortent, area: "level", happenedAt: at(10, 8),
                              text: "Megjött", settled: "k", why: "w")
        await notifier(r, defaults()).reconcile([c], now: at(10, 10))
        #expect(r.scheduled.isEmpty && r.requests == 0)
    }

    @Test func aFireTimeBeforeEightIsMovedToEight() async {
        let r = FakeRinger()
        // 06:00 now, expires 10:00: due now, but the phone is not woken before 08:00
        await notifier(r, defaults()).reconcile([expiring("a", at(10, 10))], now: at(10, 6))
        #expect(r.scheduled.map(\.at) == [at(10, 8)])
    }

    @Test func aFarDeadlineLandingAtNightRingsAtNine() async {
        let r = FakeRinger()
        // expires 12:00 on the 11th: 12 h before is 00:00 -> 08:00 (before eight is moved forward)
        await notifier(r, defaults()).reconcile([expiring("a", at(11, 12))], now: at(10, 9))
        #expect(r.scheduled.map(\.at) == [at(11, 8)])
        // expires 10:00 on the 12th: 12 h before is 22:00 on the 11th -> 21:00
        let r2 = FakeRinger()
        await notifier(r2, defaults()).reconcile([expiring("b", at(12, 10))], now: at(10, 9))
        #expect(r2.scheduled.map(\.at) == [at(11, 21)])
    }

    @Test func pastNineInTheEveningWaitsForTheMorning() async {
        let r = FakeRinger()
        await notifier(r, defaults()).reconcile([expiring("a", at(11, 12))], now: at(10, 22))
        #expect(r.scheduled.map(\.at) == [at(11, 8)])
    }

    @Test func aClampedTimeAfterTheExpiryIsSkipped() async {
        let r = FakeRinger()
        // expires 07:00 tomorrow, now 22:00: the first allowed time (08:00) is after it
        await notifier(r, defaults()).reconcile([expiring("a", at(11, 7))], now: at(10, 22))
        #expect(r.scheduled.isEmpty)
        // and a skipped one does not use up a slot of the day
        let r2 = FakeRinger()
        await notifier(r2, defaults()).reconcile(
            [expiring("a", at(11, 7)), expiring("b", at(11, 12)), expiring("c", at(11, 13))], now: at(10, 22))
        #expect(r2.scheduled.map(\.id) == ["wall.b", "wall.c"])
    }

    @Test func differentUsersKeepTheirOwnCounters() async {
        let d = defaults(), r1 = FakeRinger(), r2 = FakeRinger()
        let cs = [expiring("a", at(10, 14)), expiring("b", at(10, 15))]
        await notifier(r1, d, user: "u1").reconcile(cs, now: at(10, 10))
        await notifier(r2, d, user: "u2").reconcile(cs, now: at(10, 10))
        #expect(r1.scheduled.count == 2 && r2.scheduled.count == 2)
        let n2 = notifier(FakeRinger(), d, user: "u2")
        n2.markSeen(["z"], now: at(10, 10))
        #expect(notifier(FakeRinger(), d, user: "u1").seenToday(now: at(10, 10)).isEmpty)
    }

    @Test func deniedMeansSilenceAndNoSecondAsk() async {
        let r = FakeRinger(.denied)
        await notifier(r, defaults()).reconcile([expiring("a", at(10, 14))], now: at(10, 10))
        #expect(r.scheduled.isEmpty && r.requests == 0)
    }

    @Test func theFirstRingAsksOnceAndRefusalIsNotAskedAgain() async {
        let r = FakeRinger(.notDetermined, grants: false), d = defaults(), n = notifier(r, d)
        await n.reconcile([expiring("a", at(10, 14))], now: at(10, 10))
        #expect(r.requests == 1 && r.scheduled.isEmpty)
        r.permission = .notDetermined
        await n.reconcile([expiring("a", at(10, 14))], now: at(10, 11))
        #expect(r.requests == 1)
    }

    @Test func aCardNeverRingsTwiceForTheSameDeadline() async {
        let r = FakeRinger(), n = notifier(r, defaults())
        let c = expiring("a", at(11, 8, 45))
        await n.reconcile([c], now: at(10, 20, 40))      // within 12 h: rings at once, on the 10th
        #expect(r.scheduled.count == 1)
        r.pending = []                                    // it has rung and is gone from the pending list
        await n.reconcile([c], now: at(11, 8, 30))        // the 10th's count is gone, the deadline is not
        #expect(r.scheduled.count == 1)
    }

    @Test func overlappingReconcilesNeverBreakTheCap() async {
        let r = FakeRinger(); r.delay = .milliseconds(30)
        let n = notifier(r, defaults())
        let cs = [expiring("a", at(10, 14)), expiring("b", at(10, 15)), expiring("c", at(10, 16))]
        let t1 = Task { await n.reconcile(cs, now: at(10, 10)) }
        let t2 = Task { await n.reconcile(cs, now: at(10, 10)) }
        await t1.value; await t2.value
        #expect(r.scheduled.count == 2)
    }

    @Test func aCardSeenWhileAReconcileRunsIsNotLost() async {
        let r = FakeRinger(); r.delay = .milliseconds(60)
        let n = notifier(r, defaults())
        let t = Task { await n.reconcile([expiring("a", at(10, 14))], now: at(10, 10)) }
        try? await Task.sleep(for: .milliseconds(20))
        n.markSeen(["zz"], now: at(10, 10))
        await t.value
        #expect(n.seenToday(now: at(10, 10)) == ["zz"])
    }

    @Test func aTakenBackRequestFreesItsSlot() async {
        let r = FakeRinger(), n = notifier(r, defaults())
        await n.reconcile([expiring("a", at(10, 14)), expiring("b", at(10, 15))], now: at(10, 10))
        // a is acted on: its request goes and its slot is free for c
        await n.reconcile([expiring("a", at(10, 14)), expiring("b", at(10, 15)), expiring("c", at(10, 16))],
                          now: at(10, 11), acted: ["a"])
        #expect(r.scheduled.map(\.id) == ["wall.a", "wall.b", "wall.c"])
    }

    @Test func aWallRingShowsWhileTheAppIsOpen() {
        #expect(ReminderPresenter.presentation(for: "wall.level-expires-x") == ReminderPresenter.foregroundOptions)
    }

    @Test func clearingOnLogoutCancelsEveryWaitingRequestAndForgetsTheDay() async {
        let r = FakeRinger(), d = defaults(), n = notifier(r, d), now = at(10, 10)
        await n.reconcile([expiring("a", at(10, 14)), expiring("b", at(11, 20))], now: now)
        #expect(Set(r.pending) == ["wall.a", "wall.b"])
        r.pending.insert("other.keep") // not the wall's

        await n.clear()

        #expect(r.pending == ["other.keep"])
        #expect(Set(r.cancelled) == ["wall.a", "wall.b"])
        #expect(n.seenToday(now: now).isEmpty)
        // the next account on this phone starts with an empty cap: the same card may ring again
        await notifier(r, d).reconcile([expiring("a", at(10, 14))], now: now)
        #expect(r.pending.contains("wall.a"))
    }
}
