import BoopAPI
import Foundation
import Testing
@testable import BoopCore

private func capacity(verdict: Components.Schemas.BoopCapacity.verdictPayload = .rendben, tanulo: Bool = false,
                      days: Int = 20, calendarKnown: Bool = true, reason: String = "Három megbeszélés",
                      demand: [Components.Schemas.BoopCapacityDemandItem] = [],
                      factors: [Components.Schemas.BoopCapacityFactor] = []) -> Components.Schemas.BoopCapacity {
    .init(verdict: verdict, reason: reason, ratio: 0.8, tanulo: tanulo, labelledDays: days,
          calendarKnown: calendarKnown, demand: demand, factors: factors)
}

struct KapacitasLogicTests {
    @Test func tulSokReadsTulSokLenne() {
        #expect(verdictLine(capacity(verdict: .tulSok)).word == "Túl sok lenne")
        #expect(verdictLine(capacity(verdict: .laza)).word == "Laza nap")
        #expect(verdictLine(capacity(verdict: .rendben)).word == "Rendben lesz")
        #expect(verdictLine(capacity(verdict: .szoros)).word == "Szoros, de belefér")
    }

    @Test func learningLineShowsCount() {
        #expect(verdictLine(capacity(tanulo: true, days: 7)).learning == "Még tanulom, mennyit bírsz: 7 napnyi adatom van.")
        #expect(verdictLine(capacity(tanulo: false)).learning == nil)
    }

    @Test func noCalendarAddsNaptarNelkul() {
        #expect(verdictLine(capacity(calendarKnown: false)).reason == "Három megbeszélés · naptár nélkül")
        #expect(verdictLine(capacity(calendarKnown: true)).reason == "Három megbeszélés")
    }

    // K2 final fix: no reason of the server's and no calendar → no dangling separator
    @Test func emptyReasonWithoutCalendarReadsNaptarNelkulAlone() {
        #expect(verdictLine(capacity(calendarKnown: false, reason: "")).reason == "naptár nélkül")
        #expect(verdictLine(capacity(calendarKnown: false, reason: "  ")).reason == "naptár nélkül")
        #expect(verdictLine(capacity(calendarKnown: true, reason: "")).reason == "")
    }

    // K2 final fix: his label comes back from the server, so the row shows it after a relaunch too
    @Test func demandRowCarriesHisLabel() {
        let start = Date(timeIntervalSince1970: 0)
        let items: [Components.Schemas.BoopCapacityDemandItem] = [
            .init(label: "Tervezés", start: start, kind: "meeting", level: .kicsi, eventKey: "e1", effect: .neutral),
            .init(label: "Hívás", start: start, kind: "call", level: .nagy, eventKey: "e2"),
        ]
        let rows = demandRows(capacity(demand: items), timeZone: TimeZone(identifier: "UTC")!)
        #expect(rows[0].effect == .neutral)
        #expect(rows[0].labelSub == "te: semleges")
        #expect(rows[1].effect == nil && rows[1].labelSub == "")
        #expect(KapacitasRow(title: "x", sub: "", value: "", hot: false, glyph: "", effect: .drains).labelSub == "te: merít")
        #expect(KapacitasRow(title: "x", sub: "", value: "", hot: false, glyph: "", effect: .feeds).labelSub == "te: feltölt")
    }

    @Test func briefJSONCarriesTheLabel() throws {
        let block = #""capacity":{"verdict":"rendben","reason":"","ratio":0.7,"tanulo":false,"labelledDays":20,"calendarKnown":true,"demand":[{"label":"Tervezés","start":"2026-11-10T08:00:00Z","kind":"meeting","level":"kicsi","eventKey":"cal-1","effect":"feeds"}],"factors":[]},"#
        let b = try Brief(json: Data(briefJSON(conflict: block).utf8))
        #expect(b.capacity?.demand.first?.effect == .feeds)
    }

    // K2 final fix: „A 4. hét", but „Az 1. hét" / „Az 5. hét" (the spoken numeral starts with a vowel)
    @Test func hungarianArticleFollowsTheSpokenNumeral() {
        for n in [1, 5, 50, 52, 59, 500, 1000, 1999, 5000] { #expect(hungarianArticle(n) == "Az", "\(n)") }
        for n in [2, 3, 4, 6, 9, 10, 11, 15, 19, 20, 49, 60, 100, 199, 2000] { #expect(hungarianArticle(n) == "A", "\(n)") }
    }

    @Test func seasonFootnoteSaysPlannedWeeksAreTrainingOnly() {
        #expect(evadLoadFootnote(nowWeek: 4)
                == "A teher az edzés és a naptárad együtt. A pihenés az alvásodból és a pulzusodból jön. A 4. hét után a terv, halványan: csak az edzés.")
        #expect(evadLoadFootnote(nowWeek: 1).hasSuffix("Az 1. hét után a terv, halványan: csak az edzés."))
        #expect(evadLoadFootnote(nowWeek: 5).contains("Az 5. hét után"))
    }

    @Test func demandRowsFormatTimeKindAndLevel() {
        let start = Date(timeIntervalSince1970: 1_795_000_000) // fixed instant
        let tz = TimeZone(identifier: "Europe/Budapest")!
        let items: [Components.Schemas.BoopCapacityDemandItem] = [
            .init(label: "Csapat egyeztetés", start: start, kind: "meeting", level: .nagy, eventKey: "e1"),
            .init(label: "Futás", start: start, kind: "sport", level: .kicsi),
            .init(label: "Kávé", start: start, kind: "social", level: .tolt),
        ]
        let rows = demandRows(capacity(demand: items), timeZone: tz)
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        let c = cal.dateComponents([.hour, .minute], from: start)
        let hhmm = String(format: "%02d:%02d", c.hour!, c.minute!)
        #expect(rows[0] == KapacitasRow(title: "Csapat egyeztetés", sub: "\(hhmm) · megbeszélés", value: "nagy", hot: true,
                                        glyph: "clock-ink", eventKey: "e1"))
        #expect(rows[1].glyph == "dumbbell-ink" && rows[1].sub.hasSuffix("fizikai") && !rows[1].hot)
        #expect(rows[2].glyph == "heart-cream" && rows[2].value == "tölt")
    }

    @Test func demandTimeFollowsTimeZone() {
        let start = ISO8601DateFormatter().date(from: "2026-11-21T08:00:00Z")!
        let items: [Components.Schemas.BoopCapacityDemandItem] = [.init(label: "X", start: start, kind: "call", level: .kozepes)]
        let utc = demandRows(capacity(demand: items), timeZone: TimeZone(identifier: "UTC")!)
        let bud = demandRows(capacity(demand: items), timeZone: TimeZone(identifier: "Europe/Budapest")!)
        #expect(utc[0].sub == "08:00 · hívás")
        #expect(bud[0].sub == "09:00 · hívás")
        #expect(bud[0].value == "közepes")
    }

    @Test func factorRowsMapEffectAndGlyph() {
        let f: [Components.Schemas.BoopCapacityFactor] = [
            .init(key: "sleep", label: "Alvás", value: "7 ó 10 p", effect: .jo),
            .init(key: "hrv", label: "HRV", value: "42 ms", effect: .rossz),
            .init(key: "fuel", label: "Tankolás", value: "rendben", effect: .semleges),
        ]
        let rows = factorRows(capacity(factors: f))
        #expect(rows[0] == KapacitasRow(title: "Alvás", sub: "7 ó 10 p", value: "jó", hot: false, glyph: "moon-ink"))
        #expect(rows[1].value == "gyenge" && rows[1].glyph == "heart-cream")
        #expect(rows[2].value == "rendben" && rows[2].glyph == "bowl-sage")
    }

    @Test func levelClampsTheRatioToOnePointTwo() {
        #expect(capacityLevel(0.6) == 0.5)
        #expect(capacityLevel(1.5) == 1)
        #expect(capacityLevel(-1) == 0)
        #expect(capacityLevel(.nan) == 0)
        #expect(capacityTicks.map(\.label) == ["szoros", "határ"])
        #expect(abs(capacityTicks[1].at - 1.0 / 1.2) < 1e-12)
    }

    @Test func sentenceFollowsTheVerdictWithoutANumber() {
        for v in [Components.Schemas.BoopCapacity.verdictPayload.laza, .rendben, .szoros, .tulSok] {
            #expect(!capacitySentence(v).contains { $0.isNumber })
        }
        #expect(capacitySentence(.szoros).hasPrefix("A mai terhed majdnem annyi"))
    }

    @Test func briefCarriesCapacityAndStaysNilWithout() throws {
        // the wire's capacity block lands on Brief; an old payload (no block) leaves it nil
        let block = #""capacity":{"verdict":"szoros","reason":"rövid éjszaka","ratio":0.94,"tanulo":true,"labelledDays":9,"calendarKnown":true,"demand":[{"label":"Tervezés","start":"2026-11-10T08:00:00Z","kind":"meeting","level":"nagy","eventKey":"cal/1:x"}],"factors":[]},"#
        let with = try Brief(json: Data(briefJSON(conflict: block).utf8))
        #expect(with.capacity?.verdict == .szoros)
        #expect(with.capacity?.demand.first?.eventKey == "cal/1:x")
        #expect(try Brief(json: Data(briefJSON().utf8)).capacity == nil)
    }

    @Test func trainingItemReadsEdzesWithTheDumbbell() {
        let item = Components.Schemas.BoopCapacityDemandItem(label: "Lábnap", start: Date(timeIntervalSince1970: 0),
                                                            kind: "training", level: .kozepes, eventKey: nil)
        let row = demandRows(capacity(demand: [item]), timeZone: TimeZone(identifier: "UTC")!)[0]
        #expect(row.sub == "00:00 · edzés" && row.glyph == "dumbbell-ink" && row.eventKey == nil)
    }

    @Test func seasonStatsHideMoveFiguresWithoutMoves() {
        let none = kapacitasSeasonStats(KapacitasSeasonStats(overloadedDays4w: 2, moves: 0, movesGood: 0))
        #expect(none.map(\.label) == ["túl sok nap az elmúlt 4 hétben"])
        #expect(none[0].value == "2")
        let some = kapacitasSeasonStats(KapacitasSeasonStats(overloadedDays4w: 0, moves: 11, movesGood: 8))
        #expect(some.map(\.value) == ["0", "11", "8"])
        #expect(some[2].target == "11" && some[1].hot)
    }

    // MARK: - K4: outcomes and learned patterns

    @Test func patternRowsShowEvidence() {
        let rows = kapacitasPatternRows([
            KapacitasPattern(key: "weekday-overload:THURSDAY", line: "A sűrű csütörtökök",
                             body: "például: 4 csütörtökből 3 volt túl sok.", evidence: 4, consistent: 3, weekday: "THURSDAY"),
            KapacitasPattern(key: "move-kind-works:MOVE_SESSION_DAY", line: "Az áttett edzések", evidence: 3, consistent: 2),
        ])
        #expect(rows.map(\.title) == ["A sűrű csütörtökök", "Az áttett edzések"])
        #expect(rows[0].body == "például: 4 csütörtökből 3 volt túl sok.")
        #expect(rows[1].body == "3 esetből 2-szer.", "no sentence from the server: the counts still show")
    }

    private static func hDay(_ d: String) -> KapacitasWeekDay {
        KapacitasWeekDay(date: d, verdict: "rendben", label: "rendben", ratio: 0.7, calendarKnown: true)
    }

    @Test func historyRowsShowOutcomeWordsAndEarlierWeeks() {
        let lived = KapacitasProposal(id: "p1", kind: "MOVE_SESSION_DAY", day: "2026-11-24", status: "accepted",
                                      title: "Hátedzés: kedd → szerda", move: "", effectLines: [], why: [], effects: [],
                                      outcomeWord: "jól", outcomeSub: "megvolt")
        let pending = KapacitasProposal(id: "p2", kind: "SHIFT_BEDTIME", day: "2026-11-27", status: "accepted",
                                        title: "Lefekvés 23:30", move: "", effectLines: [], why: [], effects: [],
                                        outcomeWord: "még nem tudom")
        let week = KapacitasWeek(monday: "2026-11-23", days: [Self.hDay("2026-11-23")], proposals: [lived, pending],
            adjustments: [
                KapacitasAdjustment(id: "a1", date: "2026-11-24", kind: "MOVE_SESSION_DAY", bundleId: "b1", proposalId: "p1", state: "done"),
                KapacitasAdjustment(id: "a2", date: "2026-11-27", kind: "SHIFT_BEDTIME", bundleId: "b2", proposalId: "p2", state: "active"),
            ],
            history: [
                KapacitasHistoryItem(proposalId: "p0", kind: "SHORTEN_SESSION", day: "2026-11-13", status: "accepted",
                                     title: "Rövidebb lábnap", word: "félig", sub: "rövid edzés", good: false),
                KapacitasHistoryItem(proposalId: "p9", kind: "MOVE_SESSION_DAY", day: "2026-11-06", status: "declined",
                                     title: "Lábnap csütörtök → péntek", word: "maradt így"),
                // a proposal already listed from this week's ledger is not repeated
                KapacitasHistoryItem(proposalId: "p1", kind: "MOVE_SESSION_DAY", day: "2026-11-24", status: "accepted",
                                     title: "dupla", word: "jól"),
            ])
        let rows = kapacitasHistory(week, shown: [])
        #expect(rows.map(\.title) == ["Hátedzés: kedd → szerda", "Lefekvés 23:30", "Rövidebb lábnap", "Lábnap csütörtök → péntek"])
        #expect(rows[0].value == "jól" && rows[0].valueSub == "megvolt" && rows[0].state == "done")
        #expect(rows[1].value == "érvényben" && rows[1].state == "live", "not lived yet: the ledger state")
        #expect(rows[2].value == "félig" && rows[2].valueSub == "rövid edzés" && rows[2].state == "done")
        #expect(rows[3].value == "maradt így" && rows[3].state == "gone")
    }

    @Test func weekDecodesWithoutK4FieldsAndWithThem() throws {
        let old = #"{"monday":"2026-11-23","days":[],"proposals":[],"adjustments":[],"patterns":[{"key":"k","line":"L","evidence":3}]}"#
        let w = try PlanJSON.decoder.decode(KapacitasWeek.self, from: Data(old.utf8))
        #expect(w.history.isEmpty && w.patterns[0].consistent == 0 && w.patterns[0].body == nil)
        let new = #"""
        {"monday":"2026-11-23","days":[],"proposals":[{"id":"p","kind":"SKIP_SESSION","day":"2026-11-24","status":"accepted",
          "title":"t","move":"m","effectLines":[],"why":[],"effects":[],"steps":[],"touchedDays":[],"outcomeWord":"jól","outcomeSub":"megvolt"}],
         "adjustments":[],"patterns":[{"key":"k","line":"L","body":"B","evidence":4,"consistent":3,"weekday":"THURSDAY"}],
         "history":[{"proposalId":"x","kind":"SKIP_SESSION","day":"2026-11-10","status":"undone","title":"t","word":"visszavontad","sub":null,"good":null}]}
        """#
        let n = try PlanJSON.decoder.decode(KapacitasWeek.self, from: Data(new.utf8))
        #expect(n.proposals[0].outcomeWord == "jól" && n.proposals[0].outcomeSub == "megvolt")
        #expect(n.patterns[0].body == "B" && n.patterns[0].weekday == "THURSDAY" && n.patterns[0].consistent == 3)
        #expect(n.history.count == 1 && n.history[0].word == "visszavontad" && n.history[0].sub == nil)
    }

    @Test func wallMondayTurnsToNextWeekOnSundayEvening() {
        let zone = TimeZone(identifier: "Europe/Budapest")!
        var cal = Calendar(identifier: .gregorian); cal.timeZone = zone
        func at(_ d: Int, _ h: Int, _ m: Int = 0) -> Date {
            cal.date(from: DateComponents(year: 2026, month: 11, day: d, hour: h, minute: m))!
        }
        #expect(kapacitasWallMonday(at(29, 17, 59), timeZone: zone) == "2026-11-23")
        #expect(kapacitasWallMonday(at(29, 18), timeZone: zone) == "2026-11-30")
        #expect(kapacitasWallMonday(at(29, 23, 50), timeZone: zone) == "2026-11-30")
        #expect(kapacitasWallMonday(at(30, 0, 10), timeZone: zone) == "2026-11-30")
        #expect(kapacitasWallMonday(at(28, 20), timeZone: zone) == "2026-11-23", "Saturday evening stays this week")
    }
}
