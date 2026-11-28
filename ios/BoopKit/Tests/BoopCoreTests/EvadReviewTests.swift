import Foundation
import Testing
@testable import BoopCore

@Suite("Évad — the Sunday review's rules")
struct EvadReviewTests {
    private static var bud: Calendar {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }

    /// "2026-11-29T18:00" in Budapest.
    private static func at(_ s: String) -> Date {
        let p = s.split(whereSeparator: { "-T:".contains($0) }).compactMap { Int($0) }
        return bud.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: p[3], minute: p[4]))!
    }

    @Test func windowEdges() {   // the week of Mon 2026-11-23
        #expect(evadReviewWindow(now: Self.at("2026-11-29T17:59"), calendar: Self.bud) == nil)
        #expect(evadReviewWindow(now: Self.at("2026-11-29T18:00"), calendar: Self.bud)
                == EvadReviewWindow(weekMonday: "2026-11-23", nextMonday: "2026-11-30"))
        #expect(evadReviewWindow(now: Self.at("2026-11-30T23:59"), calendar: Self.bud)?.weekMonday == "2026-11-23")
        #expect(evadReviewWindow(now: Self.at("2026-12-01T00:00"), calendar: Self.bud) == nil)
        #expect(evadReviewWindow(now: Self.at("2026-11-28T20:00"), calendar: Self.bud) == nil, "Saturday is not in it")
    }

    @Test func windowAcrossDST() {
        // Sunday 2026-10-25: the clocks went back at 03:00
        #expect(evadReviewWindow(now: Self.at("2026-10-25T17:59"), calendar: Self.bud) == nil)
        #expect(evadReviewWindow(now: Self.at("2026-10-25T18:00"), calendar: Self.bud)?.weekMonday == "2026-10-19")
        #expect(evadReviewWindow(now: Self.at("2026-10-26T12:00"), calendar: Self.bud)?.nextMonday == "2026-10-26")
    }

    @Test func reminderNeedsASeason() {
        #expect(evadReviewReminder(now: Self.at("2026-11-25T10:00"), hasSeason: false, allowed: true, done: [], calendar: Self.bud) == .cancelAll)
    }

    @Test func reminderNeverPrompts() {
        #expect(evadReviewReminder(now: Self.at("2026-11-25T10:00"), hasSeason: true, allowed: false, done: [], calendar: Self.bud) == .keep)
    }

    @Test func reminderSkipsADoneWeek() {
        let r = evadReviewReminder(now: Self.at("2026-11-30T10:00"), hasSeason: true, allowed: true,
                                   done: ["2026-11-23"], calendar: Self.bud)
        #expect(r == .schedule(id: "boop.heti-atnezes.2026-11-30", fireAt: Self.at("2026-12-06T18:00")))
        // a done week further on is skipped too
        let r2 = evadReviewReminder(now: Self.at("2026-11-25T10:00"), hasSeason: true, allowed: true,
                                    done: ["2026-11-23"], calendar: Self.bud)
        #expect(r2 == .schedule(id: "boop.heti-atnezes.2026-11-30", fireAt: Self.at("2026-12-06T18:00")))
    }

    @Test func reminderOnWednesdayIsThisSunday() {
        let r = evadReviewReminder(now: Self.at("2026-11-25T10:00"), hasSeason: true, allowed: true, done: [], calendar: Self.bud)
        #expect(r == .schedule(id: "boop.heti-atnezes.2026-11-23", fireAt: Self.at("2026-11-29T18:00")))
        // Sunday 18:00 itself is not strictly after → next week
        let r2 = evadReviewReminder(now: Self.at("2026-11-29T18:00"), hasSeason: true, allowed: true, done: [], calendar: Self.bud)
        #expect(r2 == .schedule(id: "boop.heti-atnezes.2026-11-30", fireAt: Self.at("2026-12-06T18:00")))
    }

    @Test func leavingNeverMarksDone() {
        var p = EvadReviewProgress()
        #expect(p.page == 1)
        p.next(); p.next()
        #expect(p.page == 3 && !p.canFinish())
        p.back()
        #expect(p.page == 2)
        p.next(); p.next(); p.next(); p.next()
        #expect(p.page == 5 && p.canFinish(), "never past the last page")
    }

    @Test func logRemembersDoneWeeksPerUser() {
        let d = UserDefaults(suiteName: "evad-review-\(UUID().uuidString)")!
        let a = EvadReviewLog(defaults: d, userKey: "a"), b = EvadReviewLog(defaults: d, userKey: "b")
        #expect(a.last == nil)
        a.markDone("2026-11-16", takeaway: "Régi")
        a.markDone("2026-11-23", takeaway: "Erre figyelj: korábban feküdj le.")
        #expect(a.isDone("2026-11-23") && !b.isDone("2026-11-23"))
        #expect(a.doneWeeks == ["2026-11-16", "2026-11-23"])
        #expect(a.last?.week == "2026-11-23" && a.last?.takeaway == "Erre figyelj: korábban feküdj le.")
    }

    @Test func reviewCardOnlyInWindow() throws {
        let w = EvadReviewWindow(weekMonday: "2026-11-23", nextMonday: "2026-11-30")
        #expect(evadReviewCandidate(window: nil, hasSeason: true, done: false) == nil)
        #expect(evadReviewCandidate(window: w, hasSeason: true, done: true) == nil)
        #expect(evadReviewCandidate(window: w, hasSeason: false, done: false) == nil)
        let c = try #require(evadReviewCandidate(window: w, hasSeason: true, done: false))
        #expect(c.id == "evad-review-2026-11-23" && c.role == .improves && c.rank == 0.9)
        #expect(c.text == "*Kész a heti átnézés*" && c.primary == "Átnézem")
        #expect(c.sub == "Öt rövid lépés: hogy ment, mit tanult Boop, mi jön.")
        #expect(evadWallIsReview(c.id) && evadWallTarget(c.id) == .review)
        // it rides the Évad source
        let all = evadCandidates(EvadFixtures.overview(), review: c, now: Self.at("2026-11-29T19:00"), calendar: Self.bud)
        #expect(all.contains { $0.id == c.id })
    }

    @Test func datesStayGregorianOnAnotherPhoneCalendar() throws {
        var buddhist = Calendar(identifier: .buddhist)
        buddhist.timeZone = TimeZone(identifier: "Europe/Budapest")!
        var g = Calendar(identifier: .gregorian); g.timeZone = buddhist.timeZone
        let sunday = try #require(g.date(from: DateComponents(year: 2026, month: 11, day: 29, hour: 19)))
        #expect(evadYMD(sunday, calendar: buddhist) == "2026-11-29")
        #expect(evadReviewWindow(now: sunday, calendar: buddhist) == EvadReviewWindow(weekMonday: "2026-11-23", nextMonday: "2026-11-30"))
    }
}
