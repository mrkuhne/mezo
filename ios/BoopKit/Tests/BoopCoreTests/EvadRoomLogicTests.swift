import Foundation
import Testing
@testable import BoopCore

@Suite("Évad room — the pure builders")
struct EvadRoomLogicTests {
    private static func day(_ date: String, judged: Bool = true, excused: Bool = false, food: Bool? = true,
                            planned: Bool = false, done: Bool? = nil, sleep: Bool? = true) -> EvadAdherenceDay {
        EvadAdherenceDay(date: date, judged: judged, excused: excused, excuse: excused ? "kimelo" : nil,
                         foodInBand: food, sessionPlanned: planned, sessionDone: done, sleepOk: sleep)
    }

    private static func adherence(food: (Int, Int) = (4, 4), sessions: (Int, Int) = (2, 2),
                                  nights: (Int, Int) = (4, 4)) -> EvadAdherence {
        EvadAdherence(foodInBand: food.0, foodJudged: food.1, sessionsDone: sessions.0, sessionsPlanned: sessions.1,
                      nightsOk: nights.0, nightsJudged: nights.1, excusedDays: 0)
    }

    @Test func dayDotsCoverEveryState() {
        // week of Mon 2026-11-23, today Thursday 11-26
        let days = [Self.day("2026-11-23", planned: true, done: true),
                    Self.day("2026-11-24", food: false),
                    Self.day("2026-11-25", excused: true)]
        let dots = evadDayDots(monday: "2026-11-23", days: days, today: "2026-11-26")
        #expect(dots.map(\.state) == [.inPlan, .out, .kimelo, .today, .future, .future, .future])
        #expect(dots.map(\.date).first == "2026-11-23" && dots.map(\.date).last == "2026-11-29")
        // a day with nothing logged, and a missing day, are unjudged — never „out"
        let quiet = evadDayDots(monday: "2026-11-23", days: [Self.day("2026-11-24", judged: false)], today: "2026-11-26")
        #expect(quiet[0].state == .unjudged && quiet[1].state == .unjudged)
        // a planned session not done, or a short night, slips the day
        let slips = evadDayDots(monday: "2026-11-23", days: [Self.day("2026-11-23", planned: true, done: false),
                                                           Self.day("2026-11-24", sleep: false)], today: "2026-11-26")
        #expect(slips[0].state == .out && slips[1].state == .out)
    }

    @Test func dayDotLettersAreHungarian() {
        let dots = evadDayDots(monday: "2026-11-23", days: [], today: "2026-11-23")
        #expect(dots.map(\.letter) == ["H", "K", "Sze", "Cs", "P", "Szo", "V"])
        #expect(evadDayDotsSpoken(dots).hasPrefix("hétfő ma, kedd még jön"))
    }

    @Test func barsLeaveOutEmptyParts() {
        let bars = evadMostBars(Self.adherence(sessions: (0, 0)))
        #expect(bars.map(\.key) == ["etel", "alvas"])
        #expect(bars[0].label == "nap a kereten belül" && bars[1].label == "éjszaka elég")
        #expect(evadMostBars(Self.adherence(food: (0, 0), sessions: (0, 0), nights: (0, 0))).isEmpty)
    }

    @Test func mostSentenceEarly() {
        #expect(evadMostSentence(nil) == "Még nincs mit nézni — a hét most kezdődött")
        #expect(evadMostSentence(Self.adherence(food: (0, 0), sessions: (0, 0), nights: (0, 0))) == evadMostEarlySentence)
    }

    @Test func mostSentenceOneLagging() {
        #expect(evadMostSentence(Self.adherence(nights: (1, 4))) == "Jól megy a hét, csak az alvás csúszik.")
        #expect(evadMostSentence(Self.adherence(food: (1, 4), nights: (1, 4))) == "Ezen a héten több minden csúszik — nézd meg, mi.")
        #expect(evadMostSentence(Self.adherence(food: (3, 4))) == "Nagyjából tartod a hetet.")
    }

    @Test func mostSentenceAllGood() {
        #expect(evadMostSentence(Self.adherence()) == "Jól megy a hét.")
    }

    @Test func seasonWeeksMarkDeload() {
        // the fixture: week 7 of 12, a deload at week 10
        let cells = evadSeasonWeeks(EvadFixtures.overview())
        #expect(cells.count == 12)
        #expect(cells[9].lighter && cells[9].reason == "erre a hétre nem fogyunk")
        #expect(cells.filter(\.lighter).count == 1)
        #expect(cells[6].current && cells.filter(\.current).count == 1)
        #expect(cells[11].last && !cells[10].last)
    }

    private static func plan(start: String, overrun: Int = 0) -> WireYearPlan {
        let json = #"""
        {"status":"active","startDate":"\#(start)","endDate":"2027-11-28","blockWeeks":6,"consolidationWeeks":2,
         "loadingBlocks":7,"bufferWeeks":0,"overrunWeeks":\#(overrun),
         "blocks":[{"ordinal":1,"kind":"upper","weeks":6,"plannedStart":"\#(start)","lastDay":"2026-01-11","status":"done"},
                   {"ordinal":2,"kind":"lower","weeks":6,"plannedStart":"2026-01-12","lastDay":"2026-02-22","status":"running"}]}
        """#
        return try! JSONDecoder().decode(WireYearPlan.self, from: Data(json.utf8))
    }

    @Test func bracketCoversTwoBlocks() {
        // plan from Mon 2025-12-01; a season 2026-01-05 … 2026-02-01 spans the block boundary on 01-12
        let r = evadSeasonBracket(plan: Self.plan(start: "2025-12-01"), seasonStart: "2026-01-05", seasonEnd: "2026-02-01")
        #expect(r == 6...9)
        // clamped at the strip's ends
        #expect(evadSeasonBracket(plan: Self.plan(start: "2025-12-01"), seasonStart: "2025-11-01", seasonEnd: "2025-12-10") == 1...2)
        #expect(evadSeasonBracket(plan: Self.plan(start: "2025-12-01"), seasonStart: "2026-11-16", seasonEnd: "2027-02-01") == 51...52)
    }

    @Test func bracketWithoutPlanIsNil() {
        #expect(evadSeasonBracket(plan: nil, seasonStart: "2026-01-05", seasonEnd: "2026-02-01") == nil)
        // a season wholly outside the year
        #expect(evadSeasonBracket(plan: Self.plan(start: "2025-12-01"), seasonStart: "2025-09-01", seasonEnd: "2025-10-01") == nil)
        #expect(evadSeasonBracket(plan: Self.plan(start: "2025-12-01"), seasonStart: "2027-03-01", seasonEnd: "2027-04-01") == nil)
    }

    @Test func wallTargets() {
        #expect(evadWallTarget(EvadWallID.learned + "s1-2026-W48") == .evad(tab: "Terv", sub: "modositas"))
        #expect(evadWallTarget(EvadWallID.menu + "s1") == .etelMenu)
        #expect(evadWallTarget(EvadWallID.proposal + "x1") == .evad(tab: "Kísérlet", sub: nil))
        #expect(evadWallTarget(EvadWallID.result + "x2") == .evad(tab: "Kísérlet", sub: "kiserlet:x2"))
        #expect(evadWallTarget(EvadWallID.end + "s1") == .evad(tab: "Terv", sub: nil))
        #expect(evadWallTarget(EvadWallID.review + "2026-11-23") == .review)
        #expect(evadWallTarget("etel-tip-1") == nil)
    }
}
