import Foundation
import Testing
@testable import BoopCore

struct DayPlanTests {
    let checkins = #"""
    [{"slot":"morning","time":"08:00","done":false},
     {"slot":"evening","time":"21:30","done":false}]
    """#
    let meals = #"""
    [{"time":"08:30","title":"Reggeli","kcal":420,"proteinG":38,"logged":true},
     {"time":"13:00","title":"Ebéd","kcal":0,"proteinG":0,"logged":false},
     {"time":"19:30","title":"Vacsora","kcal":0,"proteinG":0,"logged":false}]
    """#
    func session(time: String = "18:00", planned: String = "18:00") -> String {
        #"{"title":"Felsőtest edzés","time":"\#(time)","plannedTime":"\#(planned)","minutes":75,"exercises":[]}"#
    }
    func full() -> BriefFixture {
        var f = BriefFixture()
        f.checkins = checkins; f.meals = meals; f.session = session()
        f.bedtimeTarget = #""22:45""#; f.proteinG = 38; f.proteinTarget = 165
        return f
    }

    @Test func rowsFullDayInClockOrder() throws {
        let rows = DayPlan.rows(try full().brief())
        #expect(rows.map(\.time) == ["08:00", "13:00", "18:00", "19:30", "21:30", "22:45"])
        #expect(rows.map(\.title) == ["Reggeli check-in", "Ebéd · legalább 64 g fehérje", "Felsőtest edzés",
                                      "Vacsora · legalább 64 g fehérje", "Esti zárás", "Lefekvés"])
        #expect(rows[0].sub == "fél perc")
        #expect(rows[1].sub == "a mai keret 2\u{00A0}400 kcal")
        #expect(rows[2].sub == "75 perc")
        #expect(rows[4].sub == "egy perc")
        #expect(rows[5].sub == "7 és fél óra alvásért")
        #expect(Set(rows.map(\.id)).count == rows.count)
    }

    @Test func rowsOmitMissingSessionAndBedtime() throws {
        var f = full(); f.session = "null"; f.bedtimeTarget = "null"
        let rows = DayPlan.rows(try f.brief())
        #expect(rows.map(\.title) == ["Reggeli check-in", "Ebéd · legalább 64 g fehérje",
                                      "Vacsora · legalább 64 g fehérje", "Esti zárás"])
    }

    @Test func rowsMarkMovedSession() throws {
        var f = full(); f.session = session(time: "18:30", planned: "18:00")
        let row = try #require(DayPlan.rows(try f.brief()).first { $0.title == "Felsőtest edzés" })
        #expect(row.time == "18:30")
        #expect(row.sub.contains("áttéve 18:30-ra"))
    }

    @Test func proteinSplitOverUnloggedMeals() throws {
        var f = full(); f.proteinTarget = 165; f.proteinG = 38     // 127 left over two meals = 63.5 → 64
        let rows = DayPlan.rows(try f.brief())
        #expect(rows.filter { $0.title.contains("legalább") }.allSatisfy { $0.title.hasSuffix("legalább 64 g fehérje") })
    }

    @Test func goalsProteinMet() throws {
        var f = full(); f.proteinG = 170
        let g = DayPlan.goals(try f.brief())
        #expect(g[0].title == "165 g fehérje")
        #expect(g[0].result == "170 g")
        #expect(g[0].met == true)
        var h = full(); h.proteinG = 100
        #expect(DayPlan.goals(try h.brief())[0].met == false)
    }

    @Test func goalsWithoutSessionHasTwoItems() throws {
        let g = DayPlan.goals(try full().brief())
        #expect(g.count == 3)
        #expect(g[1].title.contains("Felsőtest edzés") && g[1].title.contains("18:00") && g[1].met == nil)
        #expect(g[2].met == nil)
        var f = full(); f.session = "null"
        #expect(DayPlan.goals(try f.brief()).count == 2)
    }

    @Test func learningBriefYieldsNoCrash() throws {
        let rows = DayPlan.rows(try BriefFixture().brief())
        #expect(rows.isEmpty)
        #expect(DayPlan.goals(try BriefFixture().brief()).count == 1)
    }
}
