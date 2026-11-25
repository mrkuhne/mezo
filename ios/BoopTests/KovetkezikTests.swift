import Foundation
import Testing
import BoopCore
@testable import Boop

// The Következik card's words (mezo-r36n9.113, screen 7): every number and date is the server's plan; the card only
// turns them into Hungarian. Invented plans.
struct KovetkezikTests {
    private func plan(next: String? = #"{"blockId":"b2","startsOn":"2026-11-23","reason":"last_week"}"#,
                      b1: String = "running", b1Last: String = "2026-11-22") -> WireYearPlan {
        let json = """
        {"id":"p","status":"active","startDate":"2026-10-12","endDate":"2027-10-10","blockWeeks":6,"consolidationWeeks":2,
         "emphasis":[],"currentWeek":6,"loadingBlocks":8,"bufferWeeks":2,"overrunWeeks":0,
         "blocks":[
          {"id":"b1","ordinal":1,"kind":"upper","focus":["back","biceps"],"weeks":6,"plannedStart":"2026-10-12","lastDay":"\(b1Last)","status":"\(b1)","adopted":true,"canMoveEarlier":false,"skipConsequence":[]},
          {"id":"b2","ordinal":2,"kind":"lower","focus":["glute","quad"],"weeks":6,"plannedStart":"2026-11-23","lastDay":"2027-01-03","status":"planned","adopted":false,"canMoveEarlier":false,"skipConsequence":[]},
          {"id":"c","ordinal":9,"kind":"consolidation","focus":[],"weeks":2,"plannedStart":"2027-09-27","lastDay":"2027-10-10","status":"planned","adopted":false,"canMoveEarlier":false,"skipConsequence":[]}],
         "relaxed":[],"warnings":[],"focusCount":{},
         \(next.map { "\"next\":\($0)," } ?? "")
         "review":{"blocksDone":0,"blocksSkipped":0,"focused":[],"unfocused":[]}}
        """
        return try! JSONDecoder().decode(WireYearPlan.self, from: Data(json.utf8))
    }

    @Test func lastWeekCardReadsTheServersBlock() throws {
        let c = try #require(KovetkezikContent(plan: plan(), today: "2026-11-21"))
        #expect(c.blockId == "b2")
        #expect(c.title == "Comb + far")
        #expect(c.meta == "6 hét · nov. 23-tól · 2. blokk a 8-ból")
        #expect(c.sentence == "A mostani blokkod holnap ér véget. Most a comb és a far kerül fókuszba, minden más Tartáson marad.")
        #expect(c.emphasized == "Comb, far")
        #expect(c.loads.count == 6 && c.deloadLast)
        #expect(c.caption == "5 terhelő hét + 1 könnyítő")
    }

    @Test func theEndDayIsSaidAsADay() {
        #expect(kovetkezikEndDay("2026-11-22", today: "2026-11-22") == "ma")
        #expect(kovetkezikEndDay("2026-11-22", today: "2026-11-21") == "holnap")
        #expect(kovetkezikEndDay("2026-11-22", today: "2026-11-18") == "vasárnap")
        #expect(kovetkezikEndDay("2026-11-21", today: "2026-11-17") == "szombaton")
        #expect(kovetkezikEndDay("2026-11-23", today: "2026-11-17") == "hétfőn")
        // Already past (an active block running over): today is the honest word.
        #expect(kovetkezikEndDay("2026-11-15", today: "2026-11-17") == "ma")
        // Further than a week: the date.
        #expect(kovetkezikEndDay("2026-12-06", today: "2026-11-17") == "dec. 6-án")
    }

    @Test func withoutARunningYearBlockTheEndIsTheDayBeforeTheNext() throws {
        // The running block is not linked to the year: the day before the next block's start ends it.
        let c = try #require(KovetkezikContent(plan: plan(b1: "done"), today: "2026-11-18"))
        #expect(c.sentence?.hasPrefix("A mostani blokkod vasárnap ér véget.") == true)
    }

    @Test func noBlockSentence() throws {
        let c = try #require(KovetkezikContent(plan: plan(next: #"{"blockId":"b2","startsOn":"2026-11-23","reason":"no_block"}"#, b1: "done"),
                                               today: "2026-11-21"))
        #expect(c.sentence == "Most nincs futó blokkod. A terv szerint a comb és a far jön, minden más Tartáson marad.")
    }

    @Test func aBlockStartingTodayReadsMatol() throws {
        // The server's no_block start for a due block is today.
        let c = try #require(KovetkezikContent(plan: plan(next: #"{"blockId":"b2","startsOn":"2026-11-25","reason":"no_block"}"#, b1: "done"),
                                               today: "2026-11-25"))
        #expect(c.meta == "6 hét · mától · 2. blokk a 8-ból")
        let closing = try #require(KovetkezikContent(plan: plan(next: #"{"blockId":"c","startsOn":"2027-09-29","reason":"no_block"}"#),
                                                     today: "2027-09-29"))
        #expect(closing.meta == "2 hét · mától · lezárás")
    }

    @Test func consolidationCard() throws {
        let c = try #require(KovetkezikContent(plan: plan(next: #"{"blockId":"c","startsOn":"2027-09-27","reason":"no_block"}"#),
                                               today: "2027-09-25"))
        #expect(c.consolidation)
        #expect(c.title == "Év végi lezárás")
        #expect(c.meta == "2 hét · szept. 27-től · lezárás")
        #expect(c.sentence == "Az év végi lezárás: minden izom Tartáson, könnyű szinten.")
        #expect(c.loads.isEmpty && c.caption == nil, "no timeline for the consolidation")
        #expect(c.emphasized == nil)
    }

    @Test func noCardWithoutANextBlockTheServerKnows() {
        #expect(KovetkezikContent(plan: plan(next: nil), today: "2026-11-21") == nil)
        #expect(KovetkezikContent(plan: plan(next: #"{"blockId":"zz","startsOn":"2026-11-23","reason":"last_week"}"#), today: "2026-11-21") == nil)
        // An unknown reason keeps the card but says no sentence.
        let odd = KovetkezikContent(plan: plan(next: #"{"blockId":"b2","startsOn":"2026-11-23","reason":"later"}"#), today: "2026-11-21")
        #expect(odd != nil && odd?.sentence == nil)
    }

    @Test func intakeHeadNamesTheYearBlock() {
        let loading = YearBlockPrefill(yearBlockId: "b2", tiers: [:], weeks: 6, consolidation: false, startDate: nil,
                                       ordinal: 3, focus: ["shoulder", "chest"])
        #expect(ujBlokkYearSentence(loading) == "Az éves terved 3. blokkja: Mell + váll. Kitöltöttem, amit tudok; átállíthatod.")
        let closing = YearBlockPrefill(yearBlockId: "c", tiers: [:], weeks: 2, consolidation: true, startDate: nil, ordinal: 9)
        #expect(ujBlokkYearSentence(closing) == "Az éves terved lezárása. A hossza és a szintek a tervből jönnek.")
        #expect(ujBlokkStartText(.planned("2026-12-14")) == "dec. 14-től")
        #expect(ujBlokkStartText(.nextMonday) == "Jövő hétfőn" && ujBlokkStartText(.today) == "Ma")
    }
}
