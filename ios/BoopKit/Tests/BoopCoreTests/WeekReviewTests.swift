import Foundation
import Testing
@testable import BoopCore

@Suite("WeekReview — the weekly deck")
struct WeekReviewTests {
    @Test func groupsByMuscleInBodyOrderAndKeepsTheQuietOnes() {
        let r = WeekReview(PlanFixtures.proposal)
        #expect(r.isOpen && r.mode == .manual && r.week == 3)
        #expect(r.reviewMuscles == ["back", "biceps"])
        #expect(r.quietMuscles.map(\.muscle) == ["chest"])
        #expect(r.lines("back").map(\.id) == ["L1", "L2"])
        #expect(r.lines[0].dayName == "Hétfő" && r.lines[1].dayName == "Csütörtök")
        #expect(r.setsBefore == 13)
    }

    @Test func toleratesUnknownKindsAndReasons() {
        let r = WeekReview(PlanFixtures.proposal)
        let odd = r.lines.first { $0.id == "L4" }!
        #expect(odd.kind == .other(from: 1, to: 2))
        #expect(odd.reasons == ["sportnap"], "the unknown code gets no pill, the known T3 one does")
    }

    @Test func everyKnownReasonHasAPill() {
        let codes = ["all_sets_done", "felt_easy", "deficit_pace", "room_in_band", "soreness_cleared", "top_of_rep_range",
                     "reserve_left", "next_plate", "grind", "too_much", "sets_missed", "tier_maintain", "deload", "no_slot",
                     "above_band", "joint_pain", "soreness", "at_ceiling", "deload_restore", "stalled", "tier_change",
                     "technique_week", "emphasis", "deficit_allowance", "ai_suggested", "challenge", "sport_day"]
        for c in codes { #expect(reasonText(c) != nil, "missing pill for \(c)") }
        for c in codes { #expect(!(reasonText(c) ?? "").lowercased().contains("mezo")) }
    }

    @Test func decisionsAndSummaryNumbers() {
        var r = WeekReview(PlanFixtures.proposal)
        r.decide("L1", .accepted)
        r.decide("L3", .kept)
        #expect(r.acceptedCount == 1 && r.keptCount == 1 && r.openCount == 2)
        #expect(r.addedSets == 1)
        #expect(r.acceptedOn(day: 0) == 1 && r.acceptedOn(day: 1) == 0)
        r.decideAll("back", .kept)
        #expect(r.decision("L1") == .accepted, "onlyOpen leaves the decided line alone")
        #expect(r.decision("L2") == .kept)
        #expect(r.isSettled("back") && !r.isSettled("biceps"))
        r.decide("L1", nil)
        #expect(r.decision("L1") == nil)
    }

    @Test func finalRequestSendsChoicesAndKeepsTheRest() {
        var r = WeekReview(PlanFixtures.proposal)
        r.decide("L1", .accepted)
        r.decide("L2", .kept)
        let req = r.finalRequest()
        #expect(req.decisions == [WireLineDecision(lineId: "L1", decision: "accepted"), WireLineDecision(lineId: "L2", decision: "kept")])
        #expect(req.keepRest == true && req.acceptRest == nil)
        r.acceptAllOpen()
        #expect(r.finalRequest().keepRest == nil, "nothing open: no rest flag")
    }

    @Test func aServerDecisionIsFinal() {
        let p = try! JSONDecoder().decode([WireProposal].self, from: Data(PlanFixtures.proposalJSON(decidedB: true).utf8))[0]
        var r = WeekReview(p)
        r.decide("L2", .kept)
        #expect(r.decision("L2") == .accepted)
        #expect(!(r.finalRequest().decisions ?? []).contains { $0.lineId == "L2" })
    }

    @Test func aClosedProposalTakesNoDecisions() {
        let p = try! JSONDecoder().decode([WireProposal].self, from: Data(PlanFixtures.proposalJSON(status: "auto_applied").utf8))[0]
        var r = WeekReview(p)
        r.decide("L1", .accepted)
        #expect(r.decision("L1") == nil && !r.isOpen && r.wasAppliedAutomatically)
    }

    @Test func kgFormatting() {
        #expect(formatKg(62.5) == "62,5 kg")
        #expect(formatKg(30) == "30 kg")
    }
}
