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
        // both at once near the end of the season: one per role
        let both = evadCandidates(Self.overview(insights: Self.learned), now: Self.at(2026, 12, 24), calendar: Self.cal)
        #expect(Set(both.map(\.role)) == [.improves, .happened])
    }
}
