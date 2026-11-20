import Foundation
import Testing
@testable import BoopCore

@Suite("Évad — the words")
struct EvadLogicTests {
    @Test func maintainInBandSaysTartod() {
        let o = EvadFixtures.overview(status: "in_band", trajectory: "maintain", band: #"{"lowKg":81,"highKg":83}"#)
        let v = evadVerdict(o)
        #expect(v.headline == "Tartod a súlyod")
        #expect(v.sentence.contains("81–83 kg"))
        #expect(!v.sentence.contains("fogysz"))
    }

    @Test func verdictFollowsTheStatus() {
        #expect(evadVerdict(EvadFixtures.overview(status: "on_course")).headline == "Jó úton vagy")
        #expect(evadVerdict(EvadFixtures.overview(status: "on_course")).sentence.contains("heti *0,4 kg-ot* fogysz"))
        #expect(evadVerdict(EvadFixtures.overview(status: "slower")).headline == "Lassabban megy, mint terveztük")
        #expect(evadVerdict(EvadFixtures.overview(status: "faster")).headline == "Gyorsabban megy, mint terveztük")
        #expect(evadVerdict(EvadFixtures.overview(status: "no_data")).headline == "Még kevés a mérés")
        #expect(evadVerdict(EvadFixtures.overview(status: "out_of_band", trajectory: "maintain")).headline
                == "Kicsit kijjebb mentél a sávból")
        #expect(evadVerdict(EvadFixtures.overview(status: "a_status_from_the_future")).headline == "Még kevés a mérés")
    }

    @Test func restDayTextSaysNincsWithoutARestDay() {
        #expect(restDayText(nil) == "nincs")
        #expect(restDayText(2270) == "2270 kcal")
    }

    @Test func mapLinkLinesForTheLitPillar() {
        let o = EvadFixtures.overview()
        let lines = mapLinkLines(o, lit: "edzes")
        #expect(lines == [
            EvadLinkLine(from: "Edzés", to: "Étel", text: "edzésnapon +290 kcal"),
            EvadLinkLine(from: "Edzés", to: "Alvás", text: "több alvás kell"),
            EvadLinkLine(from: "Étel", to: "Edzés", text: "szénhidrát az erőhöz"),
            EvadLinkLine(from: "Alvás", to: "Edzés", text: "kipihenten jobban edzel"),
        ])
        #expect(mapLinkLines(o, lit: "suly").map(\.text) == ["\u{2212}0,4 kg/hét"],
                "an unknown link key is left out, and so is sleep → food without the server's number")
        #expect(mapLinkLines(o, lit: nil).count == 5)
    }

    @Test func linkWithoutANumberNeverInventsOne() {
        let o = EvadFixtures.overview(trajectory: "maintain", links: #"""
        [{"from":"edzes","to":"etel","key":"train_food","value":null},{"from":"etel","to":"suly","key":"food_weight","value":0}]
        """#)
        #expect(mapLinkLines(o, lit: nil).map(\.text) == ["edzésnapon több étel kell", "így tartod a súlyod"])
    }

    @Test func pillarDetailUsesTheSeasonNumbers() {
        let o = EvadFixtures.overview()
        #expect(evadPillarDetail(o, lit: "edzes")
                == "A heti 4 edzés és a 2 sportnap miatt edzésnapon 2440, pihenőnapon 2270 kcal-t ehetsz. Minél többet edzel, annál több étel és alvás kell.")
        #expect(evadPillarDetail(o, lit: "alvas").hasPrefix("Ehhez a terheléshez 8 ó 6 p alvás kell."))
        #expect(evadPillarDetail(o, lit: nil).hasPrefix("Ha az egyik változik"))
    }

    @Test func formattingIsHungarian() {
        #expect(evadKg(84.1) == "84,1" && evadKg(82) == "82")
        #expect(evadSignedKg(-0.4) == "\u{2212}0,4" && evadSignedKg(0.3) == "+0,3" && evadSignedKg(0.01) == "0")
        #expect(evadHM(486) == "8 ó 6 p" && evadHM(480) == "8 ó")
        #expect(evadShortDate("2027-01-01") == "jan. 1.")
        #expect(evadDayList([3, 1]) == "kedden és csütörtökön")
        #expect(evadEyebrow(EvadFixtures.overview().head) == "Őszi fogyás · 12 hétből a 7.")
        #expect(evadPaceWord("feasible") == "reális" && evadPaceWord(nil) == nil)
    }

    @Test func foodRowWithoutARestDay() {
        let o = EvadFixtures.overview()
        #expect(evadFoodRow(o.pillars.food)?.title == "Étel · 2440 / 2270 kcal")
        let noRest = try! JSONDecoder().decode(EvadFoodPillar.self, from: Data(#"{"trainDayKcal":2460,"restDayKcal":null,"proteinG":170,"allowedCount":0,"novaMax":4}"#.utf8))
        #expect(evadFoodRow(noRest)?.title == "Étel · 2460 kcal")
        #expect(evadFoodRow(noRest)?.sub.contains("nincs pihenőnap") == true)
    }

    @Test func gymDaysStepperAvoidsSportDays() {
        let more = evadAdjustGymDays([0, 2, 4, 5], to: 5, avoiding: [1, 3])
        #expect(more.count == 5 && more.contains(6), "the free non-sport day is used first")
        #expect(evadAdjustGymDays([0, 2, 4, 5], to: 3, avoiding: [1, 3]) == [0, 2, 4])
        #expect(evadAdjustGymDays([0, 2, 4, 5, 6], to: 6, avoiding: [1, 3]).count == 6)
    }

    static func numbers(_ week: Int?, train: Int = 2440, rest: Int? = 2270) -> EvadNumbers {
        let json = EvadFixtures.numbers(train: train, rest: rest.map(String.init) ?? "null")
            .replacingOccurrences(of: #""gymPerWeek""#, with: #""weekKcal":\#(week.map(String.init) ?? "null"),"gymPerWeek""#)
        return try! JSONDecoder().decode(EvadNumbers.self, from: Data(json.utf8))
    }

    @Test func acceptOnlyWithAPreviewOfTheDraftOnScreen() {
        let d = EvadClientTests.draft
        var moved = d; moved.gymDays = [0, 2, 4]
        #expect(evadCanAccept(previewOf: moved, current: moved))
        #expect(!evadCanAccept(previewOf: d, current: moved), "a preview made for the draft before the last tap")
        #expect(!evadCanAccept(previewOf: nil, current: moved), "no preview yet")
    }

    @Test func gymDaysLockedWhenBlockRuns() {
        #expect(evadGymDaysLocked(EvadFixtures.overview()), "the fixture season's block m1 is running")
        let noBlock = EvadFixtures.overview(blockId: "null")
        #expect(!evadGymDaysLocked(noBlock))
        #expect(evadGymDaysLockedLine.hasPrefix("Amíg fut az edzésblokk, az edzésnapok maradnak"))
    }

    @Test func compareRowsCarryTheWeeklyTotal() {
        let rows = evadCompareRows(Self.numbers(17_080), Self.numbers(17_440, train: 2460, rest: nil))
        let week = rows.first { $0.label == "Heti összesen" }
        #expect(week?.left == "17\u{00A0}080 kcal" && week?.right == "17\u{00A0}440 kcal")
        #expect(rows.first { $0.label == "Pihenőnapon" }?.right == "nincs")
        #expect(rows.first { $0.label == "Edzésnapon" }?.left == "2440 kcal", "a day's kcal stays ungrouped")
        #expect(!evadCompareRows(Self.numbers(nil), Self.numbers(nil)).contains { $0.label == "Heti összesen" },
                "no weekly total from the server, no row")
    }
    // MARK: S2 — the server's sleep → food number, Hogy megy

    @Test func sleepFoodLinkUsesTheServerNumberOrIsLeftOut() {
        let link = { (v: Double?) in EvadMapLink(from: "alvas", to: "etel", key: "sleep_food", value: v) }
        #expect(evadLinkText(link(nil), trajectory: "cut") == nil, "no computed effect, no line")
        #expect(evadLinkText(link(283), trajectory: "cut") == "rövid éjszaka után +280 kcal", "rounded to 10 kcal")
        #expect(evadLinkText(link(-120), trajectory: "cut") == "rövid éjszaka után \u{2212}120 kcal")
    }

    @Test func adherenceFactsArePlainCounts() {
        let a = EvadAdherence(foodInBand: 5, foodJudged: 6, sessionsDone: 3, sessionsPlanned: 4, nightsOk: 4, nightsJudged: 7, excusedDays: 1)
        let facts = evadAdherenceFacts(a)
        #expect(facts == [EvadFact(value: "5", target: "6", label: "napon belefértél a keretbe"),
                          EvadFact(value: "3", target: "4", label: "edzés megvolt"),
                          EvadFact(value: "4", target: "7", label: "éjjel aludtál eleget")],
                "a night counts at the need minus 15 minutes, so the label claims no hours")
        // a fact with nothing to count is left out, never a 0 / 0
        let quiet = EvadAdherence(foodInBand: 0, foodJudged: 0, sessionsDone: 0, sessionsPlanned: 2, nightsOk: 0, nightsJudged: 0, excusedDays: 0)
        #expect(evadAdherenceFacts(quiet).map(\.label) == ["edzés megvolt"])
    }

    @Test func excusedLineOnlyWhenADayWasLeftOut() {
        #expect(evadExcusedLine(0) == "Ez nem pontszám, csak összesítés.")
        #expect(evadExcusedLine(1) == "1 kímélő nap nem számít bele. Ez nem pontszám, csak összesítés.")
        #expect(evadExcusedLine(2) == "2 kímélő nap nem számít bele. Ez nem pontszám, csak összesítés.")
    }
}
