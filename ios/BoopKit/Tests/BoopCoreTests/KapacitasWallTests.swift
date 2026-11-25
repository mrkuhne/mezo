import Foundation
import Testing
@testable import BoopCore

/// B7 K3 (`mezo-r36n9.17`, Task 20): the Átrendezés card on the Ma wall. Invented week, „például".
@Suite("Kapacitás — the wall source")
struct KapacitasWallTests {
    private static let zone = TimeZone(identifier: "Europe/Budapest")!
    private static var cal: Calendar {
        var c = Calendar(identifier: .gregorian); c.timeZone = zone; return c
    }

    /// 2026-11-26 is a Thursday; its week starts on Monday 2026-11-23.
    private static func at(_ d: Int, _ h: Int, _ m: Int = 0) -> Date {
        cal.date(from: DateComponents(year: 2026, month: 11, day: d, hour: h, minute: m))!
    }

    private static func day(_ date: String, _ verdict: String, _ label: String, _ ratio: Double) -> KapacitasWeekDay {
        KapacitasWeekDay(date: date, verdict: verdict, label: label, ratio: ratio, calendarKnown: true)
    }

    private static let days = [
        day("2026-11-23", "laza", "laza", 0.4), day("2026-11-24", "rendben", "rendben", 0.7),
        day("2026-11-25", "szoros", "szoros", 0.95), day("2026-11-26", "tulSok", "túl sok", 1.2),
        day("2026-11-27", "rendben", "rendben", 0.8), day("2026-11-28", "laza", "laza", 0.3),
        day("2026-11-29", "laza", "laza", 0.2),
    ]

    private static func proposal(_ id: String, _ kind: String, day: String, status: String = "open",
                                 steps: [KapacitasStep] = []) -> KapacitasProposal {
        KapacitasProposal(id: id, kind: kind, day: day, status: status, title: "például: \(kind)", move: "",
                          effectLines: [], why: ["A csütörtök négy megbeszéléssel indul"], effects: [], steps: steps)
    }

    private static let packed = KapacitasWeek(monday: "2026-11-23", days: days, proposals: [
        proposal("p1", "MOVE_SESSION_DAY", day: "2026-11-26",
                 steps: [KapacitasStep(kind: "MOVE_SESSION_DAY",
                                       payload: KapacitasStepPayload(fromDate: "2026-11-26", toDate: "2026-11-28"))]),
        proposal("p2", "SHIFT_BEDTIME", day: "2026-11-26",
                 steps: [KapacitasStep(kind: "SHIFT_BEDTIME", payload: KapacitasStepPayload(night: "2026-11-25")),
                         KapacitasStep(kind: "SHIFT_SESSION_TIME", payload: KapacitasStepPayload(date: "2026-11-26"))]),
        proposal("p3", "CALENDAR_TODO", day: "2026-11-27",
                 steps: [KapacitasStep(kind: "CALENDAR_TODO", payload: KapacitasStepPayload(date: "2026-11-27"))]),
        proposal("p4", "MOVE_MEAL_ENERGY", day: "2026-11-26"),
        proposal("p0", "SKIP_SESSION", day: "2026-11-25", status: "declined"),
    ])

    @Test func openProposalsGiveOneImprovesCard() throws {
        let cards = kapacitasWallCandidates(week: Self.packed, now: Self.at(24, 9), timeZone: Self.zone)
        #expect(cards.count == 1, "one source, one card — never a second card surface")
        let c = try #require(cards.first)
        #expect(c.id == "kapacitas-het" && c.role == .improves && c.kind == .teendo && c.rank == 0.85)
        #expect(c.area == WallSources.kapacitas)
        #expect(c.text == "A csütörtök *túl sok* lenne. Négy dolgot tennék át a héten.",
                "the top proposal's day verdict, then the open proposals counted in words (the declined one not)")
        #expect(c.sub == "Edzés szombatra, később fekvés szerdán, egy esemény korábbra pénteken és nagyobb ebéd csütörtökön.")
        #expect(c.primary == "Megnézem" && c.secondary == nil)
        #expect(c.expiresAt == nil && !c.notifiable, "a week card never rings")
        #expect(c.why == "A csütörtök négy megbeszéléssel indul", "miért? is the server's own why line")

        // the proposal the outbox is still sending is not counted again
        let less = kapacitasWallCandidates(week: Self.packed, now: Self.at(24, 9), excluding: ["p4"], timeZone: Self.zone)
        #expect(less.first?.text.hasSuffix("Három dolgot tennék át a héten.") == true)
        // the top proposal's day is today: „A mai nap"
        let thu = kapacitasWallCandidates(week: Self.packed, now: Self.at(26, 7), timeZone: Self.zone)
        #expect(thu.first?.text.hasPrefix("A mai nap *túl sok* lenne.") == true)
    }

    @Test func todayProposalBeforeSessionExpires() throws {
        // Thursday 15:00, the session at 17:30: under three hours away
        let start = Self.at(26, 17, 30)
        let cards = kapacitasWallCandidates(week: Self.packed, now: Self.at(26, 15), todaySessionStart: start,
                                            timeZone: Self.zone)
        #expect(cards.count == 1, "the urgent card replaces the week card, never both")
        let c = try #require(cards.first)
        #expect(c.role == .expires && c.expiresAt == start && c.notifiable)
        #expect(c.id == "kapacitas-ma-p1")
        #expect(c.text.hasPrefix("A mai nap *túl sok* lenne."))
        #expect(c.sub == "például: MOVE_SESSION_DAY", "the today proposal's own title")
        // inside the wall's own two-a-day cap: no notification policy of its own
        #expect(wallNotifications(cards, now: Self.at(26, 15), alreadyRang: ["a", "b"]).isEmpty)

        // three hours or more away: the plain week card
        let early = kapacitasWallCandidates(week: Self.packed, now: Self.at(26, 14), todaySessionStart: start,
                                            timeZone: Self.zone)
        #expect(early.first?.role == .improves && early.first?.id == "kapacitas-het")
        // the session already started: nothing urgent left, the week card
        let late = kapacitasWallCandidates(week: Self.packed, now: Self.at(26, 18), todaySessionStart: start,
                                           timeZone: Self.zone)
        #expect(late.first?.role == .improves)
    }

    @Test func noCardWithoutProposals() {
        #expect(kapacitasWallCandidates(week: nil, now: Self.at(24, 9), timeZone: Self.zone).isEmpty)
        let calm = KapacitasWeek(monday: "2026-11-23", days: Self.days, proposals: [
            Self.proposal("x", "MOVE_SESSION_DAY", day: "2026-11-26", status: "accepted"),
            Self.proposal("y", "SKIP_SESSION", day: "2026-11-25", status: "declined"),
        ])
        #expect(kapacitasWallCandidates(week: calm, now: Self.at(24, 9), timeZone: Self.zone).isEmpty,
                "only open proposals make a card")
        #expect(kapacitasWallCandidates(week: Self.packed, now: Self.at(24, 9), excluding: ["p1", "p2", "p3", "p4"],
                                        timeZone: Self.zone).isEmpty)
        // last week's read is not this week's card
        #expect(kapacitasWallCandidates(week: Self.packed, now: Self.at(30, 9), timeZone: Self.zone).isEmpty)
    }
}
