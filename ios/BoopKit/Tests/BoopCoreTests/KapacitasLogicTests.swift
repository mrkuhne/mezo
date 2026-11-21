import BoopAPI
import Foundation
import Testing
@testable import BoopCore

private func capacity(verdict: Components.Schemas.BoopCapacity.verdictPayload = .rendben, tanulo: Bool = false,
                      days: Int = 20, calendarKnown: Bool = true,
                      demand: [Components.Schemas.BoopCapacityDemandItem] = [],
                      factors: [Components.Schemas.BoopCapacityFactor] = []) -> Components.Schemas.BoopCapacity {
    .init(verdict: verdict, reason: "Három megbeszélés", ratio: 0.8, tanulo: tanulo, labelledDays: days,
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
}
