import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// Ma's three phases (B2 Task 6): the Napközben timeline, the section anchors, the empty day, dismissed proposals.
struct MaPhasesTests {
    private static let budapest: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    private func at(_ h: Int, _ m: Int = 0) -> Date {
        Self.budapest.date(from: DateComponents(year: 2026, month: 11, day: 10, hour: h, minute: m))!
    }

    /// A full day: sleep, three meals, a session, check-ins, a meeting block and a bedtime.
    private func fullDay() throws -> Brief {
        let slots = (0..<72).map { (16..<20).contains($0) || (40..<44).contains($0) ? "true" : "false" }.joined(separator: ",")
        let hourly = Array(repeating: "0.6", count: 19).joined(separator: ",")
        let metrics = ["forma", "alvas", "mozgas", "fuel", "pulzus"].map {
            #"{"key":"\#($0)","score":70,"display":"70","headline":"h","sentence":"s"}"#
        }.joined(separator: ",")
        let json = #"""
        {"date":"2026-11-10","generatedAt":"2026-11-10T05:30:00Z","state":"okay","nightsKnown":12,
         "metrics":[\#(metrics)],"brief":[],
         "energy":{"hourly":[\#(hourly)],"dipHour":15},
         "tonightTip":"t","nextMealTip":"Ebédre fehérje.","conflict":{"text":"Ütközik.","suggestedTime":"18:30"},
         "day":{"sleep":{"bedtime":"23:05","wakeup":"06:17","totalMin":432,"deepMin":88,"remMin":96,"lightMin":238,"awakeMin":30,"hypnogram":[]},
           "bedtimeTarget":"22:30","deepSleepWeek":[],"restingHrWeek":[],
           "steps":3000,"stepsGoal":10000,"activeKcal":100,
           "session":{"title":"Vállak és hát","time":"17:30","plannedTime":"17:30","minutes":60,"exercises":[]},
           "meals":[{"time":"08:00","title":"Zabkása","kcal":420,"proteinG":22,"logged":true},
                    {"time":"12:30","title":"Csirkés rizs","kcal":650,"proteinG":48,"logged":false},
                    {"time":"19:30","title":"Lazac","kcal":450,"proteinG":38,"logged":false}],
           "kcalSoFar":420,"kcalTarget":2400,"proteinG":22,"proteinTarget":150,"carbsG":0,"fatG":0,
           "checkins":[{"slot":"morning","time":"08:00","done":true,"summary":"energia 8"},
                       {"slot":"midday","time":"13:00","done":false},{"slot":"evening","time":"21:30","done":false}],
           "intention":{"creed":null,"foci":[]},"observations":[],
           "calendar":{"count":2,"busySlots":[\#(slots)]},"recovery":null}}
        """#
        return try Brief(json: Data(json.utf8))
    }

    @Test func napkozbenNowOpensOnlyWithProposals() throws {
        let b = try fullDay()
        let with = napkozbenStations(b, now: at(13, 40), evening: false, hasProposals: true, calendar: Self.budapest)
        let without = napkozbenStations(b, now: at(13, 40), evening: false, hasProposals: false, calendar: Self.budapest)
        #expect(with.filter(\.isNow).count == 1)
        #expect(with.first(where: \.isNow)?.opens == true)
        #expect(without.first(where: \.isNow)?.opens == false)
        // only MOST ever opens: the other stations stay quiet rows
        #expect(with.filter { !$0.isNow }.allSatisfy { !$0.opens })
        #expect(with.map(\.id) == without.map(\.id))
    }

    @Test func napkozbenKeepsClockOrder() throws {
        let st = napkozbenStations(try fullDay(), now: at(13, 40), evening: false, hasProposals: true, calendar: Self.budapest)
        // the day opens with last night (fell asleep 23:05 the evening before); from waking on, strict clock order
        #expect(st.first?.id == "sleep-in")
        let times = st.drop { $0.id != "wake" }.map(\.time).filter { $0.count == 5 && $0.contains(":") }
        #expect(times.count >= 6)
        #expect(times == times.sorted())
        #expect(st.contains { $0.id == "session" })
        #expect(st.contains { $0.id.hasPrefix("meal-") })
        // MOST sits between 12:30 lunch and the 17:30 session
        let now = try #require(st.firstIndex { $0.isNow })
        let session = try #require(st.firstIndex { $0.id == "session" })
        #expect(now < session)
        #expect(st[now].time == "13:40")
    }

    @Test func phaseSectionIds() {
        #expect(phaseSectionId(.reggel) == "reggel")
        #expect(phaseSectionId(.napkozben) == "napkozben")
        #expect(phaseSectionId(.este) == "este")
    }

    @Test func emptyDayShowsOnlyNow() throws {
        let now = PathStation(id: "now", time: "13:40", glyph: "sun-ink", title: "Most", sub: "", done: false, isNow: true)
        let meal = PathStation(id: "meal-0", time: "12:30", glyph: "bowl-cream", title: "Ebéd", sub: "", done: false, isNow: false)
        #expect(isEmptyDay([now]))
        #expect(isEmptyDay([]))
        #expect(!isEmptyDay([meal, now]))
        #expect(!isEmptyDay(napkozbenStations(try fullDay(), now: at(13, 40), evening: false, hasProposals: false,
                                              calendar: Self.budapest)))
    }

    @Test func napkozbenRangeIsTheTimelinesRealSpan() throws {
        let st = napkozbenStations(try fullDay(), now: at(13, 40), evening: false, hasProposals: false, calendar: Self.budapest)
        #expect(timelineSpan(st) == "23:05 – 22:30")
        let now = PathStation(id: "now", time: "13:40", glyph: "sun-ink", title: "Most", sub: "", done: false, isNow: true)
        #expect(timelineSpan([now]) == nil)
        #expect(timelineSpan([]) == nil)
        // MOST itself and timeless stations never set an end
        let session = PathStation(id: "session", time: "–", glyph: "dumbbell-ink", title: "Edzés", sub: "", done: false, isNow: false)
        let meal = PathStation(id: "meal-0", time: "12:30", glyph: "bowl-cream", title: "Ebéd", sub: "", done: false, isNow: false)
        #expect(timelineSpan([meal, now, session]) == "12:30 – 12:30")
    }

    @Test func dismissStorageRoundTrip() {
        let keys: Set<String> = [Proposals.dismissKey(date: "2026-11-10", id: "move-session"), "2026-11-09|move-session"]
        let raw = dismissedString(keys)
        #expect(dismissedSet(from: raw) == keys)
        #expect(dismissedSet(from: "") == [])
        #expect(dismissedSet(from: "\n2026-11-10|a\n\n") == ["2026-11-10|a"])
        #expect(dismissedString([]) == "")
    }

    @Test func stationsOpenTheirDomainDrill() {
        #expect(stationTap("meal-1") == .drill(.fuel))
        #expect(stationTap("water") == .drill(.fuel))
        #expect(stationTap("session") == .drill(.mozgas))
        #expect(stationTap("dip-walk") == .drill(.mozgas))
        #expect(stationTap("easy-walk") == .drill(.mozgas))
        #expect(stationTap("wake") == .drill(.alvas))
        #expect(stationTap("bedtime") == .drill(.alvas))
        #expect(stationTap("sleep-night") == .drill(.alvas))
        #expect(stationTap("wind-down") == .drill(.alvas))
        #expect(stationTap("checkin-midday") == .drill(.forma))
        #expect(stationTap("intention") == .drill(.forma))
        #expect(stationTap("observations") == .drill(.forma))
        #expect(stationTap("busy-block") == .daySheet)
        #expect(stationTap("calendar") == .daySheet)
        #expect(stationTap("now") == nil)
    }
}
