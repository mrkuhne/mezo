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
}
