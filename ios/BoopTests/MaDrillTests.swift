import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// The domain room (B2 Task 7): the day rows of section 3.
struct MaDrillTests {
    private func brief(deep: String, hr: String) throws -> Brief {
        let metrics = ["forma", "alvas", "mozgas", "fuel", "pulzus"].map {
            #"{"key":"\#($0)","score":70,"display":"70","headline":"h","sentence":"s"}"#
        }.joined(separator: ",")
        let json = #"""
        {"date":"2026-11-10","generatedAt":"2026-11-10T05:30:00Z","state":"okay","nightsKnown":12,
         "metrics":[\#(metrics)],"brief":[],"energy":{"hourly":[],"dipHour":null},"tonightTip":"t","nextMealTip":null,"conflict":null,
         "day":{"sleep":null,"bedtimeTarget":null,"deepSleepWeek":[\#(deep)],"restingHrWeek":[\#(hr)],
           "steps":null,"stepsGoal":10000,"activeKcal":null,"session":null,"meals":[],
           "kcalSoFar":0,"kcalTarget":2400,"proteinG":0,"proteinTarget":150,"carbsG":0,"fatG":0,
           "checkins":[],"intention":{"creed":null,"foci":[]},"observations":[],
           "calendar":{"count":0,"busySlots":[]},"recovery":null}}
        """#
        return try Brief(json: Data(json.utf8))
    }

    @Test func alvasDaysFromDeepWeek() throws {
        let days = drillDays(.alvas, try brief(deep: "72,64,80,80,70,76,96", hr: ""))
        #expect(days.count == 7)
        #expect(days.last?.today == true)
        #expect(days.dropLast().allSatisfy { !$0.today })
        #expect(days.last?.value == "96 p")
        #expect(days.last?.day == "Kedd")          // 2026-11-10 is a Tuesday
        #expect(days.first?.day == "Szerda")
        #expect(days.last?.fill == 1)
    }

    @Test func pulzusFillRelativeToMax() throws {
        let days = drillDays(.pulzus, try brief(deep: "", hr: "60,50,40,60,30,45,57"))
        #expect(days.count == 7)
        #expect(days[0].value == "60 bpm")
        #expect(days[0].fill == 1)
        #expect(days[4].fill == 0.5)
        #expect(days.last?.value == "57 bpm")
    }

    @Test func otherOrbsHaveNoDays() throws {
        let b = try brief(deep: "72,64,80,80,70,76,96", hr: "60,50,40,60,30,45,57")
        for h in [Hue.forma, .mozgas, .fuel] { #expect(drillDays(h, b).isEmpty) }
    }

    @Test func nilDayShowsDash() throws {
        let days = drillDays(.alvas, try brief(deep: "72,null,80,80,70,76,96", hr: ""))
        #expect(days[1] == DrillDay(day: "Csütörtök", value: "–", fill: 0, today: false))
    }

    @Test func emptyWeekHasNoDays() throws {
        #expect(drillDays(.alvas, try brief(deep: "null,null", hr: "")).isEmpty)
        #expect(drillDays(.pulzus, try brief(deep: "", hr: "")).isEmpty)
    }

    @Test func moveProposalBelongsToMozgas() {
        #expect(proposalHue(.moveSession(to: "18:30")) == .mozgas)
    }
}
