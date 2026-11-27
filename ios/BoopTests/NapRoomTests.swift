import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Nap room's head (`mezo-r36n9.196`, decision #135): Ma says how full the day is (never an invented percent),
/// Napok explains the list.
struct NapRoomTests {
    private func brief(busy: [Bool]) throws -> Brief {
        let slots = busy.map { $0 ? "true" : "false" }.joined(separator: ",")
        let json = #"""
        {"date":"2026-11-24","generatedAt":"2026-11-24T05:30:00Z","state":"okay","nightsKnown":20,
         "metrics":[],"brief":[],"energy":{"hourly":[],"dipHour":null},"tonightTip":"t","nextMealTip":null,"conflict":null,
         "day":{"sleep":null,"bedtimeTarget":null,"deepSleepWeek":[],"restingHrWeek":[],
           "steps":null,"stepsGoal":10000,"activeKcal":null,"session":null,"meals":[],
           "kcalSoFar":0,"kcalTarget":2400,"proteinG":0,"proteinTarget":150,"carbsG":0,"fatG":0,
           "checkins":[],"intention":{"creed":null,"foci":[]},"observations":[],
           "calendar":{"count":0,"busySlots":[\#(slots)]},"recovery":null}}
        """#
        return try Brief(json: Data(json.utf8))
    }

    @Test func napHeadMaSaysHowFullTheDayIs() throws {
        let b = try brief(busy: [true, true, true, true, false, false, false, false, false, false])
        #expect(napRoomHead(b, tab: .ma).sentence == "A napod 40 %-a foglalt.")
    }

    @Test func napHeadWithoutCalendarHasNoInventedPercent() throws {
        #expect(napRoomHead(try brief(busy: []), tab: .ma).sentence == "")
        #expect(napRoomHead(nil, tab: .ma).sentence == "")
    }

    @Test func napHeadNapokIsFixedCopy() {
        let h = napRoomHead(nil, tab: .napok)
        #expect(h.headline == "Két hét visszafelé")
        #expect(h.sentence == "Minden nap egy sor: mit ettél, edzettél, hogy aludtál. Egy napra koppintva megnyílik.")
    }

    @Test func napTabsAreMaAndNapok() { #expect(NapTab.allCases.map(\.rawValue) == ["Ma", "Napok"]) }
}
