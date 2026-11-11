import Foundation
import Testing
@testable import BoopCore

struct ProposalsTests {
    func fixture(time: String = "18:00", planned: String = "18:00", conflict: Bool = true) -> BriefFixture {
        var f = BriefFixture()
        f.session = #"{"title":"Felsőtest edzés","time":"\#(time)","plannedTime":"\#(planned)","minutes":75,"exercises":[]}"#
        if conflict { f.conflict = #"{"text":"Ügyfélhívás 17:30-tól, utána fáradt leszel.","suggestedTime":"18:30"}"# }
        f.formaScore = "72"; f.alvasScore = "80"; f.alvasDisplay = #"7ó 12p"#
        f.bedtimeTarget = #""22:45""#
        f.nextMealTip = #""Ebédre legalább 45 g fehérje.""#
        f.busyRuns = [4...7, 20...23]
        return f
    }
    func make(_ f: BriefFixture, now: Date = at(10), dismissed: Set<String> = []) throws -> [Proposal] {
        Proposals.from(try f.brief(), now: now, dismissed: dismissed, calendar: budapest)
    }

    @Test func conflictMakesMoveProposal() throws {
        let p = try #require(try make(fixture()).first)
        #expect(p.id == "move-session")
        #expect(p.kind == .moveSession(to: "18:30"))
        #expect(p.text == "Told 18:30-ra az edzést")
        #expect(p.sub == "Ügyfélhívás 17:30-tól, utána fáradt leszel.")
        #expect(p.acceptedLine == "Az edzés 18:30-ra került")
        #expect(p.facts == [ProposalFact(value: "2", unit: "esemény", label: "a naptáradban ma"),
                            ProposalFact(value: "72", unit: "", label: "a mai Formád"),
                            ProposalFact(value: "7ó 12p", unit: "", label: "alvás az éjjel")])
    }

    @Test func noConflictNoProposal() throws { #expect(try make(fixture(conflict: false)).isEmpty) }

    @Test func movedSessionNoProposal() throws {
        #expect(try make(fixture(time: "18:30", planned: "18:00")).isEmpty)
    }

    @Test func afterSessionTimeNoProposal() throws {
        #expect(try make(fixture(), now: at(18, 5)).isEmpty)
        #expect(try make(fixture(), now: at(17, 55)).count == 1)
    }

    @Test func dismissedTodayHidesIt() throws {
        let key = Proposals.dismissKey(date: "2026-11-10", id: "move-session")
        #expect(key == "2026-11-10|move-session")
        #expect(try make(fixture(), dismissed: [key]).isEmpty)
    }

    @Test func dismissedYesterdayDoesNotHideToday() throws {
        let key = Proposals.dismissKey(date: "2026-11-09", id: "move-session")
        #expect(try make(fixture(), dismissed: [key]).count == 1)
    }

    @Test func expertsOnlyFromBriefFields() throws {
        let p = try #require(try make(fixture()).first)
        #expect(p.experts.map(\.field) == [.alvas, .mozgas, .etkezes])
        #expect(p.experts.first { $0.field == .mozgas }?.text == "Ügyfélhívás 17:30-tól, utána fáradt leszel.")
        #expect(p.experts.first { $0.field == .alvas }?.text == "t")
        var f = fixture(); f.nextMealTip = "null"; f.bedtimeTarget = "null"
        let q = try #require(try make(f).first)
        #expect(q.experts.map(\.field) == [.mozgas])
        #expect(!(p.experts + q.experts).contains { $0.field == .szkeptikus || $0.field == .kozerzet })
        #expect(ExpertField.allCases.map(\.label) == ["Alvás", "Mozgás", "Étkezés", "Közérzet", "Szkeptikus"])
    }

    @Test func factsSkipMissingData() throws {
        var f = fixture(); f.alvasScore = "null"
        #expect(try #require(try make(f).first).facts.map(\.label) == ["a naptáradban ma", "a mai Formád"])
        var g = fixture(); g.alvasDisplay = "–"
        #expect(try #require(try make(g).first).facts.count == 2)
    }
}
