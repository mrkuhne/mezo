import Foundation
import Testing
@testable import BoopCore

/// This week's adherence — the Évad orb's number and the Most tab's range (`mezo-r36n9.196`).
@Suite struct EvadWeekTests {
    static var budapest: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Budapest")!
        return c
    }
    static func date(_ s: String) -> Date {
        let p = s.split(whereSeparator: { "-T:".contains($0) }).map { Int($0)! }
        return budapest.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: p[3], minute: p[4]))!
    }

    @Test func weekScoreAveragesTheJudgedParts() {
        let a = EvadAdherence(foodInBand: 3, foodJudged: 4, sessionsDone: 1, sessionsPlanned: 2, nightsOk: 4, nightsJudged: 4, excusedDays: 0)
        #expect(evadWeekScore(a) == 75)          // (0.75 + 0.5 + 1.0) / 3
    }

    @Test func weekScoreLeavesOutAnEmptyPart() {
        let a = EvadAdherence(foodInBand: 2, foodJudged: 2, sessionsDone: 0, sessionsPlanned: 0, nightsOk: 1, nightsJudged: 2, excusedDays: 1)
        #expect(evadWeekScore(a) == 75)          // (1.0 + 0.5) / 2
    }

    @Test func weekScoreIsNilWhenNothingIsJudged() {
        #expect(evadWeekScore(EvadAdherence(foodInBand: 0, foodJudged: 0, sessionsDone: 0, sessionsPlanned: 0, nightsOk: 0, nightsJudged: 0, excusedDays: 2)) == nil)
    }

    @Test func mondayMorningHasNoRange() {
        #expect(evadMostRange(now: Self.date("2026-11-23T08:00"), calendar: Self.budapest) == nil)
    }

    @Test func thursdayRangeIsMondayToWednesday() {
        let r = evadMostRange(now: Self.date("2026-11-26T10:00"), calendar: Self.budapest)
        #expect(r?.from == "2026-11-23" && r?.to == "2026-11-25")
    }

    @Test func sundayLateRangeEndsSaturday() {
        let r = evadMostRange(now: Self.date("2026-11-29T23:30"), calendar: Self.budapest)
        #expect(r?.from == "2026-11-23" && r?.to == "2026-11-28")
    }

    @Test func calendarStartingSundayStillUsesMonday() {
        var us = Self.budapest
        us.firstWeekday = 1
        let r = evadMostRange(now: Self.date("2026-11-29T12:00"), calendar: us)
        #expect(r?.from == "2026-11-23")
    }
}
