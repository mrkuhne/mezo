import Foundation
import Testing
import BoopCore
@testable import Boop

// The Éves terv's words and the strip's week maths (mezo-r36n9.113): every number comes from the server's plan.
struct EvesTervKitTests {
    private func note(_ json: String) -> WireYearNote { try! JSONDecoder().decode(WireYearNote.self, from: Data(json.utf8)) }

    private func plan(overrun: Int = 0, consolidationWeeks: Int = 2, consWeeks: Int = 2, buffer: Int = 2,
                      warnings: String = "[]", focusCount: String = #"{"chest":2,"back":2,"shoulder":2,"biceps":1,"triceps":1,"quad":2,"ham":2,"glute":2,"calf":1}"#,
                      block2: String = "planned", currentWeek: String = "9", block2Meso: String = "null",
                      nextYearStart: String = "null") -> WireYearPlan {
        let json = """
        {"id":"p","status":"active","startDate":"2026-09-21","endDate":"2027-09-19","blockWeeks":6,"consolidationWeeks":\(consolidationWeeks),
         "emphasis":[],"currentWeek":\(currentWeek),"loadingBlocks":2,"bufferWeeks":\(buffer),"bufferStart":"2027-08-23","overrunWeeks":\(overrun),
         "blocks":[
          {"id":"b1","ordinal":1,"kind":"upper","focus":["biceps","back"],"weeks":6,"plannedStart":"2026-09-21","lastDay":"2026-11-01","status":"done","adopted":true,"canMoveEarlier":false,"skipConsequence":[]},
          {"id":"b2","ordinal":2,"kind":"lower","focus":["quad","glute"],"weeks":6,"plannedStart":"2026-11-02","lastDay":"2026-12-13","status":"\(block2)","mesocycleId":\(block2Meso),"currentWeek":3,"adopted":false,"canMoveEarlier":false,"skipConsequence":["glute"]},
          {"id":"c","ordinal":3,"kind":"consolidation","focus":[],"weeks":\(consWeeks),"plannedStart":"2027-09-06","lastDay":"2027-09-19","status":"planned","adopted":false,"canMoveEarlier":false,"skipConsequence":[]}],
         "relaxed":[],"warnings":\(warnings),"focusCount":\(focusCount),
         "next":{"blockId":"c","startsOn":"2027-09-06","reason":"last_week"},"nextYearStart":\(nextYearStart),
         "review":{"blocksDone":1,"blocksSkipped":0,"focused":["back"],"unfocused":["calf"]}}
        """
        return try! JSONDecoder().decode(WireYearPlan.self, from: Data(json.utf8))
    }

    @Test func datesReadTheHungarianWay() {
        #expect(evesDate("2026-09-21") == "szept. 21.")
        #expect(evesFrom("2026-12-14") == "dec. 14-től")
        #expect(evesFrom("2026-11-23") == "nov. 23-tól")
        #expect(evesFrom("2027-01-30") == "jan. 30-tól")
        #expect(evesFrom("2027-01-10") == "jan. 10-től")
        #expect(evesFrom("2027-01-06") == "jan. 6-tól")
        #expect(evesYears(plan()) == "2026/27")
    }

    @Test func articlesFollowTheSound() {
        #expect(evesNumArticle(1) == "az")
        #expect(evesNumArticle(5) == "az")
        #expect(evesNumArticle(52) == "az")
        #expect(evesNumArticle(8) == "a")
        #expect(evesNumArticle(10) == "a")
        #expect(evesArticle("ülés") == "az")
        #expect(evesList(["biceps", "triceps", "calf"]) == "a bicepsz, a tricepsz és a vádli")
    }

    @Test func headTitleCountsTheOverrunWeeks() {
        #expect(evesHeadTitle(plan()) == "9. hét az 52-ből")
        #expect(evesHeadTitle(plan(overrun: 1)) == "9. hét az 53-ból")
        #expect(evesHeadTitle(plan(currentWeek: "null")) == "Még nem indult")
    }

    @Test func focusTitleIsInReadingOrder() {
        let p = plan()
        #expect(evesFocusTitle(p.blocks[0]) == "Hát + bicepsz")
        #expect(evesFocusTitle(p.blocks[2]) == "Lezárás · könnyű szinten tartás")
    }

    @Test func statusPillsComeFromTheServer() {
        let p = plan(block2: "running")
        #expect(EvesStatus(p.blocks[0], plan: p).text == "kész")
        #expect(EvesStatus(p.blocks[1], plan: p).text == "fut · 3. hét")
        #expect(EvesStatus(p.blocks[2], plan: p).text == "következik")
        let skipped = plan(block2: "skipped")
        #expect(EvesStatus(skipped.blocks[1], plan: skipped).text == "kihagyva")
        #expect(EvesStatus(skipped.blocks[1], plan: skipped).isLocked == false)
        #expect(EvesStatus(p.blocks[1], plan: p).isLocked)
    }

    @Test func notesUseTheSpecCopyAndIgnoreUnknownCodes() {
        #expect(evesNoteText(note("{\"code\":\"emphasis_once\",\"group\":\"calf\"}"))
                == "Vádli: csak egyszer tudtam fókuszba tenni.")
        #expect(evesNoteText(note("{\"code\":\"pair_relaxed\",\"ordinal\":5}"))
                == "Az 5. blokkban szokatlan párt raktam össze, másképp nem jött ki.")
        #expect(evesNoteText(note("{\"code\":\"mixed_focus\",\"ordinal\":8}"))
                == "A 8. blokk fókusza felsőtest- és lábizmot is vegyít.")
        #expect(evesNoteText(note("{\"code\":\"something_new\",\"group\":\"calf\",\"ordinal\":1}")) == nil)
        #expect(evesNoteText(note("{\"code\":\"no_focus_this_year\",\"group\":\"calf\"}")) == nil)
    }

    @Test func noFocusSuggestionNamesTheBlockAndTheSwap() {
        let p = plan()
        let n = note("{\"code\":\"no_focus_this_year\",\"group\":\"calf\",\"blockId\":\"b2\",\"replaces\":\"glute\"}")
        #expect(evesNoFocusTitle(n) == "Vádli idén nem kap fókuszt")
        #expect(evesNoFocusAction(n, plan: p) == "Áttehetem a 2. blokkba a far helyére")
        #expect(evesNoFocusNewFocus(n, plan: p) == ["quad", "calf"])
        let add = note("{\"code\":\"no_focus_this_year\",\"group\":\"calf\",\"blockId\":\"b2\"}")
        #expect(evesNoFocusAction(add, plan: p) == "Áttehetem a 2. blokkba")
    }

    @Test func mapLinesFollowTheServerFacts() {
        let clean = evesMapLines(plan()).map(\.text)
        #expect(clean.contains("Idén minden izom legalább egyszer fókuszba kerül; a bicepsz, a tricepsz és a vádli egyszer, a többi kétszer."))
        #expect(clean.contains("Egy izom sosem kerül fókuszba két egymást követő blokkban."))
        #expect(clean.contains("A végén 2 hét könnyű szinten tartás, előtte 2 tartalék hét betegségre, nyaralásra."))

        let late = evesMapLines(plan(overrun: 1, consWeeks: 1, buffer: 0,
                                     warnings: #"[{"code":"focus_consecutive","group":"glute","ordinal":2}]"#)).map(\.text)
        #expect(!late.contains("Egy izom sosem kerül fókuszba két egymást követő blokkban."))
        #expect(late.contains("A végén 1 hét könnyű szinten tartás."))
        #expect(late.contains("A lezárás 1 hétre rövidült."))
        #expect(late.contains("A csúszás miatt az év 1 héttel később ér véget."))
    }

    @Test func stripHasFiftyTwoPlusOverrunColumns() {
        let weeks = evesStripWeeks(plan())
        #expect(weeks.count == 52)
        #expect(weeks[0].kind == .upper)
        #expect(weeks[5].light)          // the block's sixth week is light
        #expect(weeks[6].kind == .lower)
        #expect(weeks[12].kind == .empty) // nothing planned there in this fixture
        #expect(weeks[50].kind == .consolidation && weeks[51].kind == .consolidation)
        #expect(evesStripWeeks(plan(overrun: 3)).count == 55) // [RF 4]
    }

    @Test func skippedBlockTakesNoWeeks() {
        let weeks = evesStripWeeks(plan(block2: "skipped"))
        #expect(weeks[6].kind == .empty)
    }

    @Test func rowsPutTheBufferBeforeTheConsolidation() {
        let rows = evesRows(plan())
        #expect(rows.map(\.title) == ["Hát + bicepsz", "Comb + far", "Tartalék hetek", "Lezárás · könnyű szinten tartás"])
        #expect(rows[2].end == "2027-09-05")
        #expect(evesRows(plan(buffer: 0)).count == 3)
    }

    /// „Jövő évi terv" starts where the server says (a late consolidation can outlast the plan's end), never the
    /// plan's end + 1 computed here.
    @Test func nextYearStartIsTheServers() {
        let cal = Calendar(identifier: .gregorian)
        let today = cal.date(from: DateComponents(year: 2027, month: 9, day: 10))!
        #expect(evesNextYearStart(plan(nextYearStart: #""2027-09-27""#), today: today, calendar: cal) == "2027-09-27")
        // An older cached plan without the field: the earliest start a new plan may have.
        #expect(evesNextYearStart(plan(), today: today, calendar: cal) == "2027-09-13")
    }

    @Test func unlinkedBannerTakesTheTitlesArticle() {
        func u(_ title: String, _ status: String = "active") -> WireYearUnlinked {
            try! JSONDecoder().decode(WireYearUnlinked.self, from: Data(#"{"mesocycleId":"m","title":"\#(title)","startDate":"2026-11-02","status":"\#(status)"}"#.utf8))
        }
        #expect(evesUnlinkedText(u("Erő alapozás")) == "Az „Erő alapozás” nov. 2-től fut, de egyik éves blokkhoz sincs kötve.")
        #expect(evesUnlinkedText(u("Nyári blokk")) == "A „Nyári blokk” nov. 2-től fut, de egyik éves blokkhoz sincs kötve.")
        // A planned run does not run yet: it starts on its day.
        #expect(evesUnlinkedText(u("Erő alapozás", "planned")) == "Az „Erő alapozás” nov. 2-től indul, de egyik éves blokkhoz sincs kötve.")
        #expect(evesUnlinkedTitle(u("Erő alapozás")) == "A futó blokkod nincs az éves tervben")
        #expect(evesUnlinkedTitle(u("Erő alapozás", "planned")) == "A tervezett blokkod nincs az éves tervben")
    }

    /// A planned block already linked to a planned run is edited in the block builder; the sheet says so.
    @Test func linkedPlannedBlockPointsToTheBuilder() {
        let linked = plan(block2Meso: #""m2""#)
        let b2 = linked.blocks[1]
        #expect(evesLinkedPlannedText(b2) == "Indul nov. 2-től. A blokkot a blokképítőben tudod módosítani.")
        #expect(evesLinkedPlannedText(plan().blocks[1]) == nil, "an unlinked planned block is edited here")
        #expect(evesLinkedPlannedText(plan(block2: "skipped", block2Meso: #""m2""#).blocks[1]) == nil)
    }

    /// -tól/-től (and -ból/-ből) for every number 1…99, by how it ends when said aloud.
    @Test func suffixFollowsTheSpokenEndingForEveryNumber() {
        let onesTol: Set<Int> = [3, 6, 8]          // három, hat, nyolc
        let tensTol: Set<Int> = [2, 3, 6, 8]       // húsz, harminc, hatvan, nyolcvan
        for n in 1...99 {
            let ones = n % 10, tens = n / 10
            let back = ones == 0 ? tensTol.contains(tens) : onesTol.contains(ones)
            #expect(evesTolTol(n) == (back ? "tól" : "től"), "\(n)")
            #expect(evesBolBol(n) == (back ? "ból" : "ből"), "\(n)")
        }
        #expect(evesTolTol(10) == "től")
        #expect(evesTolTol(40) == "től")
        #expect(evesTolTol(60) == "tól")
        #expect(evesBolBol(80) == "ból")
        #expect(evesBolBol(90) == "ből")
    }

    @Test func yearErrorsSpeakHisLanguage() {
        #expect(evesErrorText(.conflict("TRAIN_YEAR_BLOCK_LOCKED")) == "Ez a blokk már fut vagy lezárult, ezért nem változhat.")
        #expect(evesErrorText(.offline) == planErrorText(.offline))
    }
}
