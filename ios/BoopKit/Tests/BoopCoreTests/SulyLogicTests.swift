import Foundation
import Testing
@testable import BoopCore

/// The Súly orb's number (owner 2026-11-24, `mezo-r36n9.158`): how well the weight follows the season's plan.
@Suite("Súly — the pace score")
struct SulyLogicTests {
    private func cut(_ actual: Double?, _ planned: Double? = -0.5) -> Int? {
        sulyPaceScore(actualKgPerWeek: actual, plannedKgPerWeek: planned, course: .cut, trendKg: nil, bandLowKg: nil, bandHighKg: nil)
    }
    private func maintain(_ trend: Double?, low: Double? = 83, high: Double? = 85) -> Int? {
        sulyPaceScore(actualKgPerWeek: nil, plannedKgPerWeek: nil, course: .maintain, trendKg: trend, bandLowKg: low, bandHighKg: high)
    }

    @Test func cutAtPlannedPaceIs100() { #expect(cut(-0.5) == 100) }
    @Test func cutAtHalfPaceIs50() { #expect(cut(-0.25) == 50) }
    @Test func cutStandingStillIs0() { #expect(cut(0) == 0) }
    @Test func cutWrongWayIs0() { #expect(cut(0.2) == 0) }
    @Test func cutFasterCostsHalf() {
        #expect(cut(-0.6) == 90)
        #expect(cut(-1.0) == 50)
    }
    @Test func bulkMirrorsCut() {
        #expect(sulyPaceScore(actualKgPerWeek: 0.25, plannedKgPerWeek: 0.25, course: .bulk, trendKg: nil, bandLowKg: nil, bandHighKg: nil) == 100)
        #expect(sulyPaceScore(actualKgPerWeek: -0.1, plannedKgPerWeek: 0.25, course: .bulk, trendKg: nil, bandLowKg: nil, bandHighKg: nil) == 0)
    }
    @Test func plannedZeroIsNil() { #expect(cut(-0.4, 0) == nil) }
    @Test func maintainInsideBand() {
        #expect(maintain(84) == 100)
        #expect(maintain(85) == 80)
        #expect(maintain(84.5) == 90)
    }
    @Test func maintainOutsideBand() {
        #expect(maintain(86) == 0)
        #expect(maintain(85.5) == 40)
    }
    @Test func maintainDegenerateBandIsNil() {
        #expect(maintain(84, low: 85, high: 85) == nil)
        #expect(maintain(84, low: nil, high: 85) == nil)
    }
    @Test func missingInputsAreNil() {
        #expect(cut(nil) == nil)
        #expect(cut(-0.4, nil) == nil)
        #expect(maintain(nil) == nil)
    }

    @Test func courseReadsTheTrajectory() {
        #expect(SulyCourse(trajectory: "cut") == .cut)
        #expect(SulyCourse(trajectory: "bulk") == .bulk)
        #expect(SulyCourse(trajectory: "maintain") == .maintain)
        #expect(SulyCourse(trajectory: nil) == .maintain)
        #expect(SulyCourse(trajectory: "anything") == .maintain)
    }

    @Test func paceWordFollowsTheScore() {
        #expect(sulyPaceWord(score: 84, course: .cut) == "pályán vagy")
        #expect(sulyPaceWord(score: 60, course: .cut) == "lassabb a tervnél")
        #expect(sulyPaceWord(score: 20, course: .cut) == "elmaradsz a tervtől")
        #expect(sulyPaceWord(score: nil, course: .cut) == "még nincs adat")
        #expect(sulyPaceWord(score: 90, course: .maintain) == "a sávban vagy")
    }

    @Test func kgIsOneDecimalWithAComma() {
        #expect(sulyKg(84.64) == "84,6")
        #expect(sulyKg(82) == "82,0")
        #expect(sulyKg(-0.42) == "-0,4")
    }
}

/// The head's words: the server's status first, the course's own line when there is no season.
@Suite("Súly — the head")
struct SulyHeadTests {
    private func head(_ status: String?, course: SulyCourse = .cut, season: Bool = true,
                      trend: Double? = 84.6, target: Double? = 82, date: String? = "2027-02-14",
                      actual: Double? = -0.42, planned: Double? = -0.5) -> SulyHead {
        sulyHead(status: status, course: course, trendKg: trend, targetKg: target, targetDate: date,
                 actualKgPerWeek: actual, plannedKgPerWeek: planned, hasSeason: season)
    }

    @Test func onCourse() {
        let h = head("on_course")
        #expect(h.headline == "Pályán vagy a súlycélhoz")
        #expect(h.sentence.contains("0,4") && h.sentence.contains("0,5") && h.sentence.contains("82"))
    }
    @Test func slowerAndFaster() {
        #expect(head("slower").headline == "Lassabb a tervnél")
        #expect(head("faster").headline == "Gyorsabb a tervnél")
    }
    @Test func maintainBands() {
        #expect(head("in_band", course: .maintain, target: nil, actual: nil, planned: nil).headline == "A sávban vagy")
        #expect(head("out_of_band", course: .maintain, target: nil, actual: nil, planned: nil).headline == "Kint a sávból")
    }
    @Test func noDataAndNoSeason() {
        #expect(head("no_data").headline == "Még kevés a mérés")
        let none = head(nil, season: false)
        #expect(none.headline == "Nincs évad")
        #expect(none.sentence.contains("Évad"))
    }
    /// The direction is the trend's own, never the course's: a cut whose trend rises says so.
    @Test func wrongWayIsSaidPlainly() {
        let h = head("slower", actual: 0.3)
        #expect(h.sentence.contains("megy felfelé") && !h.sentence.contains("megy lefelé"))
        #expect(h.sentence.contains("a terv 0,5 lefelé"))
        let b = head("faster", course: .bulk, actual: 0.4, planned: 0.25)
        #expect(b.sentence.contains("felfelé") && b.sentence.contains("izom"))
    }

    @Test func unknownStatusFallsBackToTheWord() {
        #expect(head("something_new").headline == "A súlyod")
    }
}
