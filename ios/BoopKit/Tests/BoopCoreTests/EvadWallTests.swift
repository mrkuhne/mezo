import Foundation
import Testing
@testable import BoopCore

@Suite("Évad — the wall source")
struct EvadWallTests {
    private static var cal: Calendar {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }

    private static func at(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 9) -> Date {
        cal.date(from: DateComponents(year: y, month: m, day: d, hour: h))!
    }

    /// The fixture season ends 2026-12-27; `insights` swaps in the overview's insight list (invented copy, "például").
    private static func overview(insights: String = "[]") -> EvadOverview {
        let json = EvadFixtures.overviewJSON().replacingOccurrences(of: #""insights":[]"#, with: #""insights":\#(insights)"#)
        return try! JSONDecoder().decode(EvadOverview.self, from: Data(json.utf8))
    }

    private static let learned = #"""
    [{"key":"learned_expenditure","title":"Kevesebbet égetsz, mint gondoltuk","body":"A terv napi 2650 kcal-lal számolt, de inkább 2580 körül égetsz."},
     {"key":"guard","title":"Erre figyelek","body":"A heti munka a minimum közelében van."}]
    """#

    @Test func noCandidatesWithoutSeason() {
        #expect(evadCandidates(nil, now: Self.at(2026, 12, 24), calendar: Self.cal).isEmpty)
        // a season mid-way with nothing learned and its end far away says nothing either
        #expect(evadCandidates(Self.overview(), now: Self.at(2026, 11, 20), calendar: Self.cal).isEmpty)
    }

    @Test func seasonEndIsHappened() throws {
        let c = try #require(evadCandidates(Self.overview(), now: Self.at(2026, 12, 22), calendar: Self.cal).first)
        #expect(c.role == .happened && c.kind == .tortent && c.area == WallSources.evad)
        #expect(c.text.contains("5 nap múlva"), "the end is five calendar days away")
        #expect(c.why.contains("dec. 27."), "the wall's own miért? names the last day from the overview")
        #expect(c.happenedAt == Self.cal.startOfDay(for: Self.at(2026, 12, 22)),
                "it happened today, so a meal logged later today still wins the slot")
        #expect(!c.notifiable, "no new notification policy: only .expires may ring")
        #expect(evadWallOpens(c.id) == nil, "it opens the Évad page itself")
        // the last day says „ma"; a week before still counts, eight days before does not
        #expect(evadCandidates(Self.overview(), now: Self.at(2026, 12, 27, 20), calendar: Self.cal).first?.text.contains("Ma") == true)
        #expect(evadCandidates(Self.overview(), now: Self.at(2026, 12, 20), calendar: Self.cal).count == 1)
        #expect(evadCandidates(Self.overview(), now: Self.at(2026, 12, 19), calendar: Self.cal).isEmpty)
        #expect(evadCandidates(Self.overview(), now: Self.at(2026, 12, 28), calendar: Self.cal).isEmpty, "an ended season is not news")
    }

    @Test func learnedInsightIsImproves() throws {
        let all = evadCandidates(Self.overview(insights: Self.learned), now: Self.at(2026, 11, 20), calendar: Self.cal)
        #expect(all.count == 1, "only the learned expenditure is a proposal; the guard line stays on the Évad tab")
        let c = try #require(all.first)
        #expect(c.role == .improves && c.kind == .teendo && c.area == WallSources.evad)
        #expect(c.primary == "Átnézem")
        #expect(c.rank > 0.7 && c.rank < 0.9, "above the food tip, below a session within two hours")
        #expect(c.text.contains("Kevesebbet égetsz, mint gondoltuk"))
        #expect(c.why == "A terv napi 2650 kcal-lal számolt, de inkább 2580 körül égetsz.", "the why is the overview's own body")
        #expect(c.expiresAt == nil && !c.notifiable)
        #expect(evadWallOpens(c.id) == "modositas", "Átnézem opens Évad → Módosítás")
        #expect(!c.why.isEmpty)
        // both at once near the end of the season: one per role
        let both = evadCandidates(Self.overview(insights: Self.learned), now: Self.at(2026, 12, 24), calendar: Self.cal)
        #expect(Set(both.map(\.role)) == [.improves, .happened])
    }

    @Test func learnedCardIdChangesOnlyWeekly() throws {
        let id = { (d: Date) in evadCandidates(Self.overview(insights: Self.learned), now: d, calendar: Self.cal).first { $0.role == .improves }?.id }
        // 2026-11-16 is a Monday (ISO week 47); Sunday 11-22 is still week 47, Monday 11-23 is week 48
        let mon = try #require(id(Self.at(2026, 11, 16)))
        #expect(id(Self.at(2026, 11, 18)) == mon && id(Self.at(2026, 11, 22, 21)) == mon, "the same card all week, so a dismissal holds")
        #expect(id(Self.at(2026, 11, 23)) != mon, "a new week may say it again")
        #expect(mon.contains("2026-W47") && mon.contains("s1"))
        #expect(evadWallOpens(mon) == "modositas")
    }

    @Test func seasonEndWhyHasNoRepeatedEndLine() throws {
        let c = try #require(evadCandidates(Self.overview(), now: Self.at(2026, 12, 22), calendar: Self.cal).first)
        #expect(c.why == "Az évad utolsó napja: dec. 27.")
    }

    // MARK: - S4: experiments

    private static func experiments(_ json: String) -> EvadExperiments {
        try! JSONDecoder().decode(EvadExperiments.self, from: Data(json.utf8))
    }

    @Test func proposalIsImproves() throws {
        let x = Self.experiments(EvadExperimentFixtures.listJSON)
        let all = evadCandidates(Self.overview(), experiments: x, now: Self.at(2026, 11, 20), calendar: Self.cal)
        let c = try #require(all.first { $0.role == .improves })
        #expect(c.kind == .teendo && c.area == WallSources.evad)
        #expect(c.primary == "Indulhat", "one tap starts it")
        #expect(c.text.contains("Esti magnézium") && c.text.contains("kísérletet"))
        #expect(c.sub == "Hétfő óta szedsz esti magnéziumot.", "the sub is the server's reason")
        #expect(c.why.contains("Hétfő óta") && c.why.contains("vetem össze az előző két héttel"),
                "the why says why and what is compared")
        #expect(c.rank < 0.7, "below the food tip")
        #expect(!c.notifiable)
        #expect(evadWallProposalID(c.id) == "p1")
        #expect(evadWallOpens(c.id) == "hatas")
        // no season → no card, even with a proposal
        #expect(evadCandidates(nil, experiments: x, now: Self.at(2026, 11, 20), calendar: Self.cal).isEmpty)
    }

    @Test func resultIsHappened() throws {
        let x = Self.experiments(EvadExperimentFixtures.listJSON) // "d1" finished 2026-11-19
        let c = try #require(evadCandidates(Self.overview(), experiments: x, now: Self.at(2026, 11, 20), calendar: Self.cal)
            .first { $0.role == .happened })
        #expect(c.kind == .tortent && c.text.contains("Kész a kísérlet") && c.text.contains("Reggeli séta"))
        #expect(c.sub.hasPrefix("14 nap · "))
        #expect(c.happenedAt == Self.cal.date(from: DateComponents(year: 2026, month: 11, day: 19)))
        #expect(!c.notifiable && evadWallProposalID(c.id) == nil)
        #expect(evadWallOpens(c.id) == "kiserlet:d1", "a tap opens Évad → Hatás → that result")
        // within three days (the day it finished and the next two); later it is not news
        #expect(evadCandidates(Self.overview(), experiments: x, now: Self.at(2026, 11, 21), calendar: Self.cal)
            .contains { $0.role == .happened })
        #expect(!evadCandidates(Self.overview(), experiments: x, now: Self.at(2026, 11, 22), calendar: Self.cal)
            .contains { $0.role == .happened })
        // the older result ("d2", finished in October) never shows
        #expect(evadCandidates(Self.overview(), experiments: x, now: Self.at(2026, 11, 20), calendar: Self.cal)
            .filter { $0.role == .happened }.count == 1)
    }
}
