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
    func ids(_ s: [PathStep]) -> [String] { s.map(\.id) }
    func build(_ key: MetricKey?, _ f: BriefFixture, now: Date, evening: Bool = false) throws -> [PathStep] {
        PathBuilder.steps(for: key, brief: try f.brief(), now: now, evening: evening, calendar: budapest)
    }

    @Test func formaListsAllCheckIns() throws {
        var f = BriefFixture(); f.checkins = allCheckins
        let s = try build(.forma, f, now: at(10))
        #expect(["checkin-morning", "checkin-midday", "checkin-afternoon", "checkin-evening"].allSatisfy(ids(s).contains))
        #expect(s.first { $0.id == "checkin-evening" }?.time == "21:30")
        #expect(ids(s).contains("intention"))
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
        #expect(!ids(full).contains("session"))
        #expect(ids(full).contains("easy-walk") && ids(full).contains("water"))
        #expect(full.first { $0.id == "bedtime" }?.title == "Korai lefekvés")
        var g = f; g.recovery = "null"
        #expect(ids(try build(.mozgas, g, now: at(10))).contains("session"))
    }

    @Test func eveningFormaPillIsEveningCheckin() throws {
        var f = BriefFixture(); f.checkins = allCheckins
        let b = try f.brief()
        let eve = Lens.action(for: .forma, brief: b, now: at(21, 40), evening: true)
        #expect(eve?.kind == .eveningCheckin)
        var m = BriefFixture(); m.checkins = #"[{"slot":"morning","time":"08:00","done":false}]"#
        #expect(Lens.action(for: .forma, brief: try m.brief(), now: at(9), evening: false)?.kind == .checkin)
        let s = try build(.forma, f, now: at(21, 40), evening: true)
        #expect(!ids(s).contains("intention"))
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
}
