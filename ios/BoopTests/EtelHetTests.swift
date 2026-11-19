import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Étel room's `Hét` tab (B4 Task 13): seven days against the target waterline, the protein, the day scores, the
/// skipped meals and the kímélő days, and the week's totals.
struct EtelHetTests {
    private func set(_ k: Double, _ p: Double = 100, target: Bool = false) -> MacroSet {
        MacroSet(kcal: k, p: p, c: 200, f: 60, water: 0)
    }

    /// 2026-11-07 (szombat) … 2026-11-13 (péntek, ma).
    private func week(mode: [String: String] = [:], skipped: [String: Int] = [:], planned: [String: Int] = [:],
                      kcal: [Double] = [2200, 2620, 2390, 2150, 2410, 2280, 1443], targets: [Double]? = nil) -> FuelWeek {
        let dates = ["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]
        let t = targets ?? Array(repeating: 2350, count: 7)
        return FuelWeek(start: "2026-11-07", days: dates.indices.map { i in
            FuelDayRollup(date: dates[i], targets: MacroSet(kcal: t[i], p: 165, c: 280, f: 70, water: 3000), consumed: set(kcal[i], 140),
                          fuelMode: mode[dates[i]], skippedKcal: skipped[dates[i]] ?? 0, plannedMovementKcal: planned[dates[i]])
        })
    }

    @Test func weekShowsTargetWaterlineAndSkippedDays() {
        let w = hetWeek(week(skipped: ["2026-11-09": 300], planned: ["2026-11-08": 300],
                             targets: [2350, 2650, 2350, 2350, 2350, 2350, 2350]), scores: [:], today: "2026-11-13")
        #expect(w.days.count == 7)
        #expect(w.days.map(\.label) == ["Szo", "V", "H", "K", "Sze", "Cs", "P"])
        #expect(w.days.last?.isToday == true)
        // the waterline is the target the days are read against: the mean of the seven day-targets, rounded
        #expect(w.waterline == 2393)
        #expect(w.waterlineLine.contains("2\u{00A0}393"))
        // a skipped meal is said on its day, with what it took off the budget; the room does not know WHICH meal
        let skippedDay = w.days[2]
        #expect(skippedDay.skippedKcal == 300)
        #expect(skippedDay.note.contains("kihagy"))
        #expect(skippedDay.note.contains("300"))
        #expect(w.skippedDays == 1)
        #expect(w.skippedKcal == 300)
        // a training day says it made room
        #expect(w.days[1].note.contains("+300 kcal keret"))
        // the bars are the kcal, the protein is its own series with its own target
        #expect(w.kcalValues.compactMap { $0 }.count == 7)
        #expect(w.proteinValues.last == 140)
        #expect(w.proteinTarget == 165)
    }

    @Test func todayIsStillGoingAndNeverPullsTheAverageDown() {
        let w = hetWeek(week(), scores: [:], today: "2026-11-13")
        let today = w.days.last!
        #expect(today.note.contains("még tart"))
        #expect(today.judged == false)
        // the six finished days: (2200 + 2620 + 2390 + 2150 + 2410 + 2280) / 6
        #expect(w.averageKcal == 2342)
        #expect(w.judgedDays == 6)
    }

    @Test func kimeloDayIsMarkedAndNotJudged() {
        let w = hetWeek(week(mode: ["2026-11-10": "GUIDANCE"]), scores: ["2026-11-09": 80, "2026-11-10": 70], today: "2026-11-13")
        let k = w.days[3]
        #expect(k.kimelo)
        #expect(k.judged == false)
        #expect(k.note.contains("kímélő"))
        #expect(k.note.contains("nem értékelem"))
        // not judged means: no verdict words at all, no score, and the week's averages leave it out
        for word in ["kevés", "sok", "fölött", "alatt", "elmaradt", "túl"] { #expect(!k.note.lowercased().contains(word)) }
        #expect(k.scorePoints == nil)
        #expect(w.kimeloDays == 1)
        #expect(w.judgedDays == 5)
        #expect(w.averageKcal == (2200 + 2620 + 2390 + 2410 + 2280) / 5)
        // the bar for it is marked so the chart does not read it as a miss
        #expect(w.markedIndices == [3])
    }

    @Test func aMaintenanceDayIsKimeloToo() {
        let w = hetWeek(week(mode: ["2026-11-12": "MAINTENANCE"]), scores: [:], today: "2026-11-13")
        #expect(w.days[5].kimelo)
        #expect(w.days[5].judged == false)
    }

    @Test func dayScoresComeFromTheDaysOwnMealsAndAMissingOneIsNotAZero() {
        let w = hetWeek(week(), scores: ["2026-11-07": 71, "2026-11-08": 64], today: "2026-11-13")
        #expect(w.days[0].scorePoints == 71)
        #expect(w.days[1].scorePoints == 64)
        #expect(w.days[2].scorePoints == nil)
        #expect(w.averageScore == 68)   // (71 + 64) / 2 rounded
        #expect(hetWeek(week(), scores: [:], today: "2026-11-13").averageScore == nil)
    }

    @Test func aDayWithNothingLoggedIsMissingNotZero() {
        var base = week()
        base.days[4].consumed = set(0, 0)
        let w = hetWeek(base, scores: [:], today: "2026-11-13")
        #expect(w.kcalValues[4] == nil)
        #expect(w.days[4].note.contains("nincs rögzítés"))
        #expect(w.days[4].judged == false)
        #expect(w.judgedDays == 5)
    }

    @Test func aWeekWithNoDaysReadsAsNoData() {
        let w = hetWeek(FuelWeek(start: "2026-11-07", days: []), scores: [:], today: "2026-11-13")
        #expect(w.days.isEmpty)
        #expect(w.waterline == nil)
        #expect(w.averageKcal == nil)
        #expect(w.isEmpty)
    }

    @Test func tappingADayOpensItByItsDate() {
        let w = hetWeek(week(), scores: [:], today: "2026-11-13")
        #expect(w.days[0].date == "2026-11-07")
        #expect(w.days[0].name == "Szombat")
        #expect(w.days.last?.name == "Ma")
    }

    @Test func aFailedDayReadIsSaidAndNeverLooksLikeADayWithoutAScore() {
        let w = hetWeek(week(), scores: ["2026-11-07": 71], today: "2026-11-13", scoreFailures: ["2026-11-08", "2026-11-09"])
        #expect(w.scoreGaps == 2)
        #expect(w.days[1].note.contains("pontszám most nem jött meg"))
        #expect(w.days[2].note.contains("pontszám most nem jött meg"))
        // a day whose read worked but had no scored meal says nothing about a failure
        #expect(!w.days[0].note.contains("nem jött meg"))
        #expect(!w.days[4].note.contains("nem jött meg"))
        // the average is of the days that DID score, and the totals line says how many are missing
        #expect(w.averageScore == 71)
        #expect(w.scoreGapLine == "2 nap pontszáma most nem jött meg — az átlag csak a többiből van")
        #expect(hetWeek(week(), scores: [:], today: "2026-11-13").scoreGapLine == nil)
    }

    @Test func aKimeloDayHasNoScoreToMissEvenWhenItsReadFailed() {
        let w = hetWeek(week(mode: ["2026-11-10": "GUIDANCE"]), scores: [:], today: "2026-11-13", scoreFailures: ["2026-11-10"])
        #expect(w.scoreGaps == 0)
        #expect(!w.days[3].note.contains("nem jött meg"))
    }

    // MARK: the warm tab (mezo-r36n9.109)

    @Test func theObservationNamesTheProteinGapOverJudgedDaysOnly() {
        let w = HetWeek(days: [
            HetDay(date: "2026-11-10", label: "H", name: "Hétfő", kcal: 2300, target: 2400, proteinG: 120, isToday: false, kimelo: false, judged: true, skippedKcal: 0, scorePoints: 70, note: ""),
            HetDay(date: "2026-11-11", label: "K", name: "Kedd", kcal: 2350, target: 2400, proteinG: 130, isToday: false, kimelo: false, judged: true, skippedKcal: 0, scorePoints: 72, note: ""),
            HetDay(date: "2026-11-12", label: "Sze", name: "Ma", kcal: 400, target: 2400, proteinG: 20, isToday: true, kimelo: false, judged: false, skippedKcal: 0, scorePoints: nil, note: "")],
            waterline: 2400, proteinTarget: 160, averageKcal: 2325, averageProtein: 125, averageScore: 71, judgedDays: 2,
            kimeloDays: 0, skippedDays: 0, skippedKcal: 0, targetsVary: false, scoreGaps: 0)
        let o = hetObservation(w)
        #expect(o?.title == "A fehérje mind a 2 értékelt napon elmaradt")
        #expect(o?.sub.contains("35 g") == true, "the mean gap over the judged days only: (40 + 30) / 2")
    }

    @Test func tooFewJudgedDaysSayNothing() {
        let w = HetWeek(days: [HetDay(date: "2026-11-12", label: "Sze", name: "Ma", kcal: 400, target: 2400, proteinG: 20, isToday: true,
                                      kimelo: false, judged: false, skippedKcal: 0, scorePoints: nil, note: "")],
                        waterline: 2400, proteinTarget: 160, averageKcal: nil, averageProtein: nil, averageScore: nil, judgedDays: 0,
                        kimeloDays: 0, skippedDays: 0, skippedKcal: 0, targetsVary: false, scoreGaps: 0)
        #expect(hetObservation(w) == nil)
        #expect(hetVerdict(w, level: 0.2).headline == "Még kevés a rögzítés a héten")
        #expect(hetDateLabel("2026-11-18") == "november 18.")
    }
}
