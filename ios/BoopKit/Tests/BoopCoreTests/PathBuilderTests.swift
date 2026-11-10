import Foundation
import Testing
@testable import BoopCore

struct PathBuilderTests {
    let allCheckins = #"""
    [{"slot":"morning","time":"08:00","done":true,"summary":"energia 8 · hangulat 8"},
     {"slot":"midday","time":"12:30","done":false},
     {"slot":"afternoon","time":"16:00","done":false},
     {"slot":"evening","time":"21:30","done":false}]
    """#
    let obs = #"[{"id":"6f1d7a52-2b7e-4c0e-8a52-7d9d4c1a0001","lead":"a","bold":"b","tail":"c","strength":3}]"#
    let sleep = #"{"bedtime":"22:48","wakeup":"06:53","totalMin":425,"hypnogram":[]}"#
    func ids(_ s: [PathStep]) -> [String] { s.map(\.id) }
    func build(_ key: MetricKey?, _ f: BriefFixture, now: Date, evening: Bool = false) throws -> [PathStep] {
        PathBuilder.steps(for: key, brief: try f.brief(), now: now, evening: evening, calendar: budapest)
    }

    @Test func formaListsAllCheckIns() throws {
        var f = BriefFixture(); f.checkins = allCheckins
        let s = try build(.forma, f, now: at(10))
        #expect(ids(s) == ["checkin-morning", "now", "intention", "checkin-midday", "checkin-afternoon", "checkin-evening"])
        #expect(s.map(\.title) == ["Reggeli check-in", "Most", "Mai szándék", "Déli check-in", "Délutáni check-in", "Esti check-in · napzárás"])
        #expect(s.last?.time == "21:30")
        var g = f; g.observations = obs
        #expect(ids(try build(.forma, g, now: at(10))) == ["checkin-morning", "now", "intention", "observations", "checkin-midday", "checkin-afternoon", "checkin-evening"])
    }

    @Test func fuelShowsOnlyMeals() throws {
        var f = BriefFixture()
        f.meals = #"[{"time":"08:00","title":"Zabkása","kcal":420,"proteinG":24,"logged":true},{"time":"13:00","title":"Ebéd","kcal":700,"proteinG":45,"logged":false}]"#
        f.checkins = allCheckins; f.session = #"{"title":"Váll","time":"17:30","plannedTime":"17:30","exercises":[]}"#
        let s = try build(.fuel, f, now: at(10))
        #expect(ids(s) == ["meal-0", "now", "meal-1"])
        #expect(s.first?.sub.contains("420 kcal") == true)
    }

    @Test func mozgasWithoutSessionHasOnlyTheWalk() throws {
        var f = BriefFixture(); f.dipHour = "15"
        let s = try build(.mozgas, f, now: at(10))
        #expect(ids(s) == ["now", "dip-walk"])
        #expect(s[1].time == "15:00")
    }

    @Test func nowSitsAtTheRightPlace() throws {
        var f = BriefFixture()
        f.meals = #"[{"time":"08:00","title":"A","kcal":1,"proteinG":1,"logged":true},{"time":"13:00","title":"B","kcal":1,"proteinG":1,"logged":false},{"time":"19:00","title":"C","kcal":1,"proteinG":1,"logged":false}]"#
        let s = try build(.fuel, f, now: at(14, 5))
        #expect(ids(s) == ["meal-0", "meal-1", "now", "meal-2"])
        #expect(s[2].time == "14:05" && s[2].isNow)
    }

    @Test func doneCheckInCarriesSummary() throws {
        var f = BriefFixture(); f.checkins = allCheckins
        let s = try build(.forma, f, now: at(10))
        let c = try #require(s.first { $0.id == "checkin-morning" })
        #expect(c.done && c.sub == "energia 8 · hangulat 8")
    }

    @Test func recoveryDropsTheSession() throws {
        var f = BriefFixture()
        f.session = #"{"title":"Váll","time":"17:30","plannedTime":"17:30","exercises":[]}"#
        f.recovery = #"{"reason":"influenza","day":2}"#; f.bedtimeTarget = #""22:45""#
        let full = try build(nil, f, now: at(10))
        // the full day keeps the 08:00 intention at its clock time, before MOST
        #expect(ids(full) == ["intention", "now", "water", "easy-walk", "bedtime"])
        #expect(full.first { $0.id == "bedtime" }?.title == "Korai lefekvés")
        var g = f; g.recovery = "null"
        #expect(ids(try build(.mozgas, f, now: at(10))) == ["now", "easy-walk"])
        #expect(ids(try build(.mozgas, g, now: at(10))) == ["now", "session"])
    }

    @Test func eveningFormaPillIsEveningCheckin() throws {
        var f = BriefFixture(); f.checkins = allCheckins
        let b = try f.brief()
        let eve = Lens.action(for: .forma, brief: b, now: at(21, 40), evening: true)
        #expect(eve?.kind == .eveningCheckin)
        var m = BriefFixture(); m.checkins = #"[{"slot":"morning","time":"08:00","done":false}]"#
        #expect(Lens.action(for: .forma, brief: try m.brief(), now: at(9), evening: false)?.kind == .checkin)
        let s = try build(.forma, f, now: at(21, 40), evening: true)
        // past and undone check-ins are due: they wait at MOST, in slot order, labelled "most"
        #expect(ids(s) == ["now", "checkin-midday", "checkin-afternoon", "checkin-evening"])
        #expect(s.dropFirst().allSatisfy { $0.time == "most" })
        #expect(Lens.action(for: .alvas, brief: b, now: at(21, 40), evening: true)?.kind == .windDown)
    }

    @Test func emptyBriefStillHasNow() throws {
        let f = BriefFixture()
        for key in [nil] + MetricKey.allCases.map(Optional.some) {
            for evening in [false, true] {
                let s = try build(key, f, now: at(9, 30), evening: evening)
                #expect(s.filter(\.isNow).count == 1, "\(String(describing: key)) \(evening)")
                #expect(s.first { $0.isNow }?.time == "09:30")
            }
        }
    }

    @Test func alvasOrder() throws {
        var f = BriefFixture(); f.sleep = sleep; f.bedtimeTarget = #""22:45""#
        let s = try build(.alvas, f, now: at(10))
        #expect(ids(s) == ["sleep-in", "sleep-night", "wake", "now", "bedtime"])
        #expect(s.map(\.time) == ["22:48", "02:50", "06:53", "10:00", "22:45"])
        #expect(s[1].sub == "7 ó 5 p")
    }

    /// Final review I3: a night without times has no stations on the path, the rest of the day still builds.
    @Test func alvasNightWithoutTimesSkipsItsStations() throws {
        var f = BriefFixture(); f.sleep = #"{"bedtime":null,"wakeup":null,"totalMin":420,"hypnogram":[]}"#
        f.bedtimeTarget = #""22:45""#
        #expect(ids(try build(.alvas, f, now: at(10))) == ["now", "bedtime"])
    }

    @Test func pulzusBreathPrecedesDensestBlock() throws {
        var f = BriefFixture()
        f.busyRuns = [4...4, 32...39, 50...51]   // 07:00 (1 slot), 14:00-16:00, 18:30-19:00
        let s = try build(.pulzus, f, now: at(10))
        #expect(ids(s) == ["now", "breath", "busy-block"])
        #expect(s[1].time == "13:55" && s[2].time == "14:00" && s[2].sub == "14:00–16:00")
        // at 15:00 the 14:00 block is under way: the next block that has not started yet (18:30) wins
        let later = try build(.pulzus, f, now: at(15))
        #expect(ids(later) == ["now", "breath", "busy-block"])
        #expect(later[1].time == "18:25" && later[2].sub == "18:30–19:00")
        var one = BriefFixture(); one.busyRuns = [4...4]
        #expect(ids(try build(.pulzus, one, now: at(10))) == ["now"])
    }

    @Test func nowIsFirstBeforeSixAndLastAfterEverything() throws {
        var f = BriefFixture()
        f.meals = #"[{"time":"08:00","title":"A","kcal":1,"proteinG":1,"logged":false},{"time":"19:00","title":"B","kcal":1,"proteinG":1,"logged":false}]"#
        #expect(ids(try build(.fuel, f, now: at(5, 10))) == ["now", "meal-0", "meal-1"])
        #expect(ids(try build(.fuel, f, now: at(23, 50))) == ["meal-0", "meal-1", "now"])
    }

    @Test func eveningFuelPulzusAlvas() throws {
        var f = BriefFixture()
        f.meals = #"[{"time":"08:00","title":"A","kcal":1,"proteinG":1,"logged":true},{"time":"13:00","title":"B","kcal":1,"proteinG":1,"logged":true},{"time":"19:00","title":"C","kcal":1,"proteinG":1,"logged":false}]"#
        f.sleep = sleep; f.bedtimeTarget = #""22:45""#; f.busyRuns = [32...39]
        #expect(ids(try build(.fuel, f, now: at(18), evening: true)) == ["now", "meal-2"])
        let p = try build(.pulzus, f, now: at(21), evening: true)
        #expect(ids(p) == ["now", "breath"] && p[1].title == "Esti légzés" && p[1].time == "21:15")
        let a = try build(.alvas, f, now: at(21), evening: true)
        #expect(ids(a) == ["now", "wind-down", "bedtime"])
        #expect(a.map(\.time) == ["21:00", "22:15", "22:45"])
    }

    @Test func afterMidnightTargetsStayAfterNow() throws {
        var f = BriefFixture(); f.bedtimeTarget = #""00:30""#
        let a = try build(.alvas, f, now: at(22), evening: true)
        #expect(ids(a) == ["now", "wind-down", "bedtime"])
        #expect(a.map(\.time) == ["22:00", "00:00", "00:30"])
        let p = try build(.pulzus, BriefFixture(), now: at(23, 50), evening: true)
        #expect(ids(p) == ["now", "breath"] && p[1].time == "00:05")
    }

    @Test func blockEndingAtMidnightReads2400() throws {
        var f = BriefFixture(); f.busyRuns = [60...71]   // 21:00-24:00
        #expect(try build(.pulzus, f, now: at(10)).last?.sub == "21:00–24:00")
    }

    @Test func sameTimeMealsGetDistinctIds() throws {
        var f = BriefFixture()
        f.meals = #"[{"time":"13:00","title":"A","kcal":1,"proteinG":1,"logged":false},{"time":"13:00","title":"B","kcal":1,"proteinG":1,"logged":false}]"#
        #expect(ids(try build(.fuel, f, now: at(10))) == ["now", "meal-0", "meal-1"])
        var g = BriefFixture()
        g.checkins = #"[{"slot":"midday","time":"12:00","done":false},{"slot":"midday","time":"12:30","done":false}]"#
        #expect(ids(try build(.forma, g, now: at(10))) == ["now", "intention", "checkin-midday", "checkin-midday-2"])
    }

    @Test func pastUndoneFormaStationsReadMost() throws {
        var f = BriefFixture(); f.checkins = #"[{"slot":"morning","time":"08:00","done":false}]"#
        let late = try build(.forma, f, now: at(14, 5))
        #expect(ids(late) == ["now", "checkin-morning", "intention"])
        #expect(late[1].time == "most" && late[2].time == "most")
        let early = try build(.forma, f, now: at(7))
        #expect(ids(early) == ["now", "checkin-morning", "intention"])
        #expect(early[1].time == "08:00" && early[2].time == "08:00")
    }

    @Test func pastUndoneLaterCheckInsJoinTheMorningStackAtMost() throws {
        var f = BriefFixture(); f.creed = #""Egyenletesen.""#
        f.checkins = #"[{"slot":"morning","time":"08:00","done":false},{"slot":"midday","time":"13:00","done":false},{"slot":"evening","time":"21:30","done":false}]"#
        let s = try build(.forma, f, now: at(15, 21))
        #expect(ids(s) == ["intention", "now", "checkin-morning", "checkin-midday", "checkin-evening"])
        #expect(s[2].time == "most" && s[3].time == "most")
        #expect(s[4].time == "21:30")
        #expect(s[3].opens)
    }

    @Test func pulzusPrefersTheUpcomingBlockOverAnEarlierEqualOne() throws {
        var f = BriefFixture()
        f.busyRuns = [16...19, 40...43]          // 10:00–11:00 and 16:00–17:00, equal length
        let s = try build(.pulzus, f, now: at(15, 21))
        #expect(ids(s) == ["now", "breath", "busy-block"])
        #expect(s[1].time == "15:55" && s[2].sub == "16:00–17:00")
    }

    @Test func pulzusWithNoUpcomingBlockShowsTheDensestPastOneWithoutBreath() throws {
        var f = BriefFixture()
        f.busyRuns = [16...19, 40...43]
        let s = try build(.pulzus, f, now: at(20))
        #expect(ids(s) == ["busy-block", "now"])
        #expect(s[0].done)
    }

    // MARK: A napom (key == nil): the whole day in clock order

    @Test func fullDayKeepsEveryClockTimeAndNothingWaitsAtMost() throws {
        var f = BriefFixture(); f.observations = obs
        f.checkins = #"[{"slot":"morning","time":"08:00","done":false},{"slot":"midday","time":"13:00","done":false},{"slot":"evening","time":"21:30","done":false}]"#
        let s = try build(nil, f, now: at(15, 21))
        #expect(ids(s) == ["checkin-morning", "intention", "observations", "checkin-midday", "now", "checkin-evening"])
        #expect(s.map(\.time) == ["08:00", "08:00", "08:00", "13:00", "15:21", "21:30"])
        #expect(!s.contains { $0.time == "most" })
        // the per-orb path keeps its Task 12 behaviour
        #expect(try build(.forma, f, now: at(15, 21)).contains { $0.time == "most" })
    }

    @Test func fullDayCalendarIsOneMeetingsStationAtTheFirstMeeting() throws {
        var f = BriefFixture()
        f.busyRuns = [16...19, 40...43]          // 10:00–11:00 and 16:00–17:00
        let s = try build(nil, f, now: at(15, 21))
        #expect(ids(s) == ["intention", "calendar", "now"])
        #expect(s[1].title == "Megbeszélések · 2 esemény")
        #expect(s[1].time == "10:00" && s[1].sub == "10:00–17:00")
        #expect(!s[1].done)
        #expect(!s.contains { $0.id == "breath" || $0.id == "busy-block" })
        let late = try build(nil, f, now: at(20))
        #expect(ids(late) == ["intention", "calendar", "now"] && late[1].done)
        // per-orb Pulzus is unchanged
        #expect(ids(try build(.pulzus, f, now: at(15, 21))) == ["now", "breath", "busy-block"])
    }

    @Test func fullDayWithAnEmptyCalendarHasNoMeetingsStation() throws {
        let s = try build(nil, BriefFixture(), now: at(10))
        #expect(!s.contains { $0.id == "calendar" })
    }
}
