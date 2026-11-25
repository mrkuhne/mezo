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

    @Test func blockWeekRowsSayWhereEachDayGoes() {
        let week = EvadBlockWeek(mesocycleId: "m1", title: "Felső-alsó", days: [
            EvadBlockDay(weekday: 0, title: "Felső A", change: "keep", fromWeekday: nil),
            EvadBlockDay(weekday: 2, title: "Alsó A", change: "move", fromWeekday: 1),
            EvadBlockDay(weekday: 4, title: "Felső A", change: "add", fromWeekday: 0),
        ], dropped: [EvadBlockDay(weekday: 3, title: "Felső B", change: "drop", fromWeekday: nil)])

        let rows = evadBlockWeekRows(week)

        #expect(rows.map(\.title) == ["Hétfő · Felső A", "Szerda · Alsó A", "Péntek · Felső A", "Kimarad · Felső B"])
        #expect(rows.map(\.body) == ["Marad a helyén.", "Eddig kedden volt.", "Új nap: a hétfői edzés még egyszer.",
                                      "Eddig csütörtökön volt, a blokk többi napja viszi tovább a hetet."])
    }

    @Test func blockWeekRowsSurviveADayWithoutAWeekday() {
        let week = EvadBlockWeek(mesocycleId: "m1", title: "B", days: [
            EvadBlockDay(weekday: 1, title: "Extra", change: "move", fromWeekday: nil),
        ], dropped: [EvadBlockDay(weekday: -1, title: "Más", change: "drop", fromWeekday: nil)])

        #expect(evadBlockWeekRows(week).map(\.body) == ["Új helyre kerül.",
                                                         "Kimarad, a blokk többi napja viszi tovább a hetet."])
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

    // MARK: mezo-r36n9.131 — a gym + sport day is two sessions

    @Test func adherenceFactsCountTrainingAndSportApart() {
        let a = EvadAdherence(foodInBand: 5, foodJudged: 6, sessionsDone: 5, sessionsPlanned: 7, nightsOk: 4,
                              nightsJudged: 7, excusedDays: 0, trainingDone: 3, trainingPlanned: 4, sportDone: 2,
                              sportPlanned: 3)
        #expect(evadAdherenceFacts(a) == [EvadFact(value: "5", target: "6", label: "napon belefértél a keretbe"),
                                          EvadFact(value: "3", target: "4", label: "edzés megvolt"),
                                          EvadFact(value: "2", target: "3", label: "sport megvolt"),
                                          EvadFact(value: "4", target: "7", label: "éjjel aludtál eleget")])
        let noSport = EvadAdherence(foodInBand: 0, foodJudged: 0, sessionsDone: 2, sessionsPlanned: 4, nightsOk: 0,
                                    nightsJudged: 0, excusedDays: 0, trainingDone: 2, trainingPlanned: 4, sportDone: 0,
                                    sportPlanned: 0)
        #expect(evadAdherenceFacts(noSport).map(\.label) == ["edzés megvolt"], "no sport planned, no 0 / 0")
    }

    @Test func adherenceFromAnOlderServerKeepsTheTotal() throws {
        let a = try JSONDecoder().decode(EvadAdherence.self, from: Data(#"{"foodInBand":0,"foodJudged":0,"sessionsDone":3,"sessionsPlanned":4,"nightsOk":0,"nightsJudged":0,"excusedDays":0}"#.utf8))
        #expect(a.trainingPlanned == nil)
        #expect(evadAdherenceFacts(a) == [EvadFact(value: "3", target: "4", label: "edzés megvolt")])
    }

    @Test func adherenceDayCarriesItsKindAndSessions() throws {
        let d = try JSONDecoder().decode(EvadAdherenceDay.self, from: Data(#"{"date":"2026-11-17","judged":true,"excused":false,"sessionPlanned":true,"sessionDone":false,"dayKind":"edzes_sport","sessions":[{"kind":"gym","excused":false,"done":true},{"kind":"sport","excused":false,"done":false}]}"#.utf8))
        #expect(d.dayKind == "edzes_sport")
        #expect(d.sessions.map(\.kind) == ["gym", "sport"] && d.sessions.map(\.done) == [true, false])
        let old = try JSONDecoder().decode(EvadAdherenceDay.self, from: Data(#"{"date":"2026-11-17","judged":false,"excused":false,"sessionPlanned":false}"#.utf8))
        #expect(old.dayKind == nil && old.sessions.isEmpty)
    }

    @Test func dayKindLabels() {
        #expect(evadDayKindLabel("edzesnap") == "edzésnap")
        #expect(evadDayKindLabel("sport") == "sportnap")
        #expect(evadDayKindLabel("edzes_sport") == "edzés + sport nap")
        #expect(evadDayKindLabel("pihenonap") == "pihenőnap")
        #expect(evadDayKindLabel("valami_uj") == nil)
    }

    @Test func twoSessionDayKcalInEveryKcalSentence() throws {
        let food = try JSONDecoder().decode(EvadFoodPillar.self, from: Data(#"{"trainDayKcal":2440,"trainSportDayKcal":2790,"restDayKcal":2270,"proteinG":170,"allowedCount":0,"novaMax":4}"#.utf8))
        #expect(evadFoodRow(food)?.sub.hasPrefix("edzés- és pihenőnapon · edzés + sport napon 2790 kcal") == true)
        let both = Self.numbers(17_800).with(trainSport: 2790)
        let rows = evadCompareRows(Self.numbers(17_080), both)
        #expect(rows.first { $0.label == "Edzés + sport napon" }.map { [$0.left, $0.right] } == ["–", "2790 kcal"])
        #expect(!evadCompareRows(Self.numbers(1), Self.numbers(1)).contains { $0.label == "Edzés + sport napon" })
        #expect(evadKcalSentence(both) == "Edzésnapon 2440, edzés + sport napon 2790, pihenőnapon 2270 kcal, 170 g fehérje.")
        #expect(evadKcalSentence(Self.numbers(1)) == "Edzésnapon 2440, pihenőnapon 2270 kcal, 170 g fehérje.")
        #expect(evadKcalSentence(Self.numbers(1, rest: nil)) == "Edzésnapon 2440 kcal, pihenőnap nincs, 170 g fehérje.")
    }

    @Test func pillarDetailNamesTheTwoSessionDay() {
        let o = EvadFixtures.overview(food: #"{"trainDayKcal":2440,"trainSportDayKcal":2790,"restDayKcal":2270,"proteinG":170,"allowedCount":24,"recipeCount":53,"novaMax":2}"#)
        #expect(evadPillarDetail(o, lit: "edzes").hasPrefix(
            "A heti 4 edzés és a 2 sportnap miatt edzésnapon 2440, edzés + sport napon 2790, pihenőnapon 2270 kcal-t ehetsz."))
    }

    @Test func excusedLineOnlyWhenADayWasLeftOut() {
        #expect(evadExcusedLine(0) == "Ez nem pontszám, csak összesítés.")
        #expect(evadExcusedLine(1) == "1 kímélő nap nem számít bele. Ez nem pontszám, csak összesítés.")
        #expect(evadExcusedLine(2) == "2 kímélő nap nem számít bele. Ez nem pontszám, csak összesítés.")
    }
}

extension EvadNumbers {
    /// The same figures with a gym + sport day's kcal (tests only).
    func with(trainSport: Int?) -> EvadNumbers {
        var obj = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(self)) as! [String: Any]
        obj["trainSportDayKcal"] = trainSport ?? NSNull()
        return try! JSONDecoder().decode(EvadNumbers.self, from: JSONSerialization.data(withJSONObject: obj))
    }
}
