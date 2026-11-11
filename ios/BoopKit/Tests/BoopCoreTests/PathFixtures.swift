import Foundation
@testable import BoopCore
import BoopAPI

/// Builds a Brief through the generated type so tests exercise the same mapping the app uses.
struct BriefFixture {
    var sleep = "null"
    var bedtimeTarget = "null"
    var session = "null"
    var meals = "[]"
    var checkins = "[]"
    var creed = "null"
    var observations = "[]"
    var busyRuns: [ClosedRange<Int>] = []
    var dipHour = "null"
    var recovery = "null"
    var conflict = "null"
    var nextMealTip = "null"
    var tonightTip = "t"
    var formaScore = "null"
    var alvasScore = "null"
    var alvasDisplay = "–"
    var kcalTarget = 2400
    var proteinG = 0
    var proteinTarget = 150

    var json: String {
        let slots = (0..<72).map { i in busyRuns.contains { $0.contains(i) } ? "true" : "false" }.joined(separator: ",")
        let hourly = Array(repeating: "0.6", count: 19).joined(separator: ",")
        let keys = ["forma", "alvas", "mozgas", "fuel", "pulzus"]
        let metrics = keys.map { k -> String in
            let score = k == "forma" ? formaScore : k == "alvas" ? alvasScore : "null"
            let display = k == "alvas" ? alvasDisplay : "–"
            return #"{"key":"\#(k)","score":\#(score),"display":"\#(display)","headline":"h","sentence":"s"}"#
        }.joined(separator: ",")
        return #"""
        {"date":"2026-11-10","generatedAt":"2026-11-10T05:30:00Z","state":"okay","nightsKnown":9,
         "metrics":[\#(metrics)],"brief":[],
         "energy":{"hourly":[\#(hourly)],"dipHour":\#(dipHour)},
         "tonightTip":"\#(tonightTip)","nextMealTip":\#(nextMealTip),"conflict":\#(conflict),
         "day":{"sleep":\#(sleep),"bedtimeTarget":\#(bedtimeTarget),"deepSleepWeek":[],"restingHrWeek":[],
           "steps":0,"stepsGoal":10000,"activeKcal":0,"session":\#(session),"meals":\#(meals),
           "kcalSoFar":0,"kcalTarget":\#(kcalTarget),"proteinG":\#(proteinG),"proteinTarget":\#(proteinTarget),"carbsG":0,"fatG":0,
           "checkins":\#(checkins),"intention":{"creed":\#(creed),"foci":[]},"observations":\#(observations),
           "calendar":{"count":\#(busyRuns.count),"busySlots":[\#(slots)]},"recovery":\#(recovery)}}
        """#
    }

    func brief() throws -> Brief {
        let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601
        return Brief(try d.decode(Components.Schemas.BoopBrief.self, from: Data(json.utf8)))
    }
}

let budapest: Calendar = {
    var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
}()
func at(_ h: Int, _ m: Int = 0) -> Date {
    budapest.date(from: DateComponents(year: 2026, month: 11, day: 10, hour: h, minute: m))!
}
