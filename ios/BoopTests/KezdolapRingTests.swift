import Foundation
import Testing
import BoopCore
@testable import Boop

/// The home ring's numbers (`mezo-r36n9.152`, `.153`, `.158`): a learning brief blanks Forma alone, the Étel orb carries the
/// Étel room's own number, the Pénz orb the week's remaining share, the Súly orb the weight-pace score.
struct KezdolapRingTests {
    private func brief(state: String) throws -> Brief {
        let metrics = [("forma", "null", "x"), ("alvas", "78", "x"), ("mozgas", "40", "x"),
                       ("fuel", "64", "x"), ("pulzus", "66", "57")].map {
            #"{"key":"\#($0.0)","score":\#($0.1),"display":"\#($0.2)","headline":"h","sentence":"s"}"#
        }.joined(separator: ",")
        let json = #"""
        {"date":"2026-11-24","generatedAt":"2026-11-24T05:30:00Z","state":"\#(state)","nightsKnown":9,
         "metrics":[\#(metrics)],"brief":[],"energy":{"hourly":[],"dipHour":null},"tonightTip":"t","nextMealTip":null,"conflict":null,
         "day":{"sleep":null,"bedtimeTarget":null,"deepSleepWeek":[],"restingHrWeek":[],
           "steps":null,"stepsGoal":10000,"activeKcal":null,"session":null,"meals":[],
           "kcalSoFar":0,"kcalTarget":2400,"proteinG":0,"proteinTarget":150,"carbsG":0,"fatG":0,
           "checkins":[],"intention":{"creed":null,"foci":[]},"observations":[],
           "calendar":{"count":0,"busySlots":[true,false,false,true]},"recovery":null}}
        """#
        return try Brief(json: Data(json.utf8))
    }

    private func meal(score: Double?) -> BoopCore.Meal {
        BoopCore.Meal(id: UUID(), slot: "lunch", loggedAt: Date(), mealDate: "2026-11-24", title: "Étel",
                      macros: Macros(kcal: 500, p: 30, c: 50, f: 15), score: score, breakdown: nil)
    }

    private func day(_ meals: [BoopCore.Meal]) -> FoodDay {
        FoodDay(date: "2026-11-24", targets: MacroSet(kcal: 2350, p: 165, c: 250, f: 78, water: 3000),
                consumed: MacroSet(kcal: 500, p: 30, c: 50, f: 15, water: 0), meals: meals, fuelMode: nil, skippedKcal: 0)
    }

    private func allowance(remaining: Int64, budget: Int64) -> PenzAllowance {
        PenzAllowance(date: "2026-11-24",
                      month: .init(month: "2026-11", free: .huf(31_400_000), spent: .huf(21_900_000), remaining: .huf(9_500_000)),
                      week: .init(start: "2026-11-23", end: "2026-11-29", budget: .huf(budget), spent: .huf(budget - remaining),
                                  remaining: .huf(remaining), perDay: .huf(862_500)),
                      lines: [])
    }

    @Test func learningBlanksFormaAloneOnTheRing() throws {
        let b = try brief(state: "learning")
        #expect(ringItem(.forma, brief: b).display == "–")
        #expect(ringItem(.alvas, brief: b).display == "78")
        #expect(ringItem(.edzes, brief: b).display == "40")
        #expect(ringItem(.energia, brief: b).display == "57")
        #expect(ringItem(.energia, brief: b).level == 0.66)
        #expect(ringItem(.alvas, brief: b).level == 0.78)
    }

    @Test func etelOrbIsTheRoomsNumberNotTheBriefs() throws {
        let b = try brief(state: "okay")
        // no day yet: "–" even though the brief carries a fuel score
        #expect(ringItem(.etel, brief: b).display == "–")
        #expect(ringItem(.etel, brief: b, foodDay: day([])).display == "–")
        let d = day([meal(score: 0.7), meal(score: 0.8), meal(score: nil)])
        #expect(etelDayPoints(d) == 75)
        #expect(ringItem(.etel, brief: b, foodDay: d).display == "75")
        #expect(ringItem(.etel, brief: nil, foodDay: d).display == "75")
        #expect(ringItem(.etel, brief: b, foodDay: d).level == 0.75)
    }

    @Test func penzOrbIsLiveAndShowsTheWeeksRemainingShare() throws {
        #expect(Area.penz.live)
        let item = ringItem(.penz, brief: nil, penz: allowance(remaining: 3_450_000, budget: 7_700_000))
        #expect(item.live && item.display == "45" && item.level == 0.45)
        #expect(ringItem(.penz, brief: nil).display == "–")
        #expect(ringItem(.penz, brief: nil, penz: allowance(remaining: 0, budget: 0)).display == "–")
        #expect(ringItem(.penz, brief: nil, penz: allowance(remaining: 0, budget: 7_700_000)).display == "0")
    }

    /// The ninth orb (owner 2026-11-24, `mezo-r36n9.158`) and the tenth (2026-11-27, `.196`, decision #132): Évad
    /// between Energia and Súly, live, its number this week's adherence.
    @Test func ringHasElevenAreasWithSportAfterEdzes() {
        #expect(Area.allCases.map(\.name) == ["Nap", "Alvás", "Étel", "Edzés", "Sport", "Energia", "Évad", "Súly", "Forma", "Pénz", "Levél"])
        #expect(Area.suly.world == .suly && Area.suly.hue == nil)
        #expect(Area.evad.world == .evad && Area.evad.hue == nil && Area.evad.live)
    }

    @Test func evadOrbShowsTheWeekScore() {
        let i = ringItem(.evad, brief: nil, evad: 78)
        #expect(i.display == "78" && abs(i.level - 0.78) < 0.001 && i.live)
    }

    /// No season, or nothing judged yet this week: „–", never 0.
    @Test func evadOrbWithoutSeasonIsDash() { #expect(ringItem(.evad, brief: nil).display == "–") }

    @Test func sulyOrbIsLiveAndShowsThePaceScore() {
        let item = ringItem(.suly, brief: nil, suly: 84)
        #expect(item.live && item.display == "84" && item.level == 0.84)
        #expect(ringItem(.suly, brief: nil, suly: 0).display == "0")
    }

    @Test func sulyOrbWithoutStoreIsDash() {
        let item = ringItem(.suly, brief: nil)
        #expect(item.live && item.display == "–" && item.level == 0.12)
    }

    @Test func dayOrbStillFillsWithTheDay() throws {
        let b = try brief(state: "learning")
        #expect(ringItem(.nap, brief: b).display == "50")
    }
}
