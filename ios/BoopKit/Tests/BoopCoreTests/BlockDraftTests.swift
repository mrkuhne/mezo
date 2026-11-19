import Foundation
import Testing
@testable import BoopCore

@Suite("BlockDraft — the builder's editable block")
struct BlockDraftTests {
    @Test func buildsFromTheBlockAndCatalog() {
        let d = PlanFixtures.draft
        #expect(d.days.count == 2)
        #expect(d.days[0].name == "Hétfő")
        #expect(d.days[1].name == "Csütörtök")
        let row = d.days[0].exercises[0]
        #expect(row.muscle == "back")
        #expect(row.stable && !row.lengthened)
        #expect(d.days[0].exercises[1].isolation && d.days[0].exercises[1].lengthened)
        #expect(!d.days[1].exercises[0].stable)
        #expect(d.days[1].exercises[1].technique == .restDrop)
        #expect(d.tier("back") == .emphasize && d.tier("biceps") == .grow && d.tier("chest") == .maintain)
        #expect(d.reviewMode == .auto && !d.techniquesEnabled && d.style == nil)
    }

    @Test func stepsClampOneToEight() {
        var d = PlanFixtures.draft
        for _ in 0..<10 { d.step(day: 0, exercise: 0, by: 1) }
        #expect(d.days[0].exercises[0].sets == 8)
        for _ in 0..<10 { d.step(day: 0, exercise: 0, by: -1) }
        #expect(d.days[0].exercises[0].sets == 1)
        d.step(day: 9, exercise: 9, by: 1) // out of range: no crash, no change
    }

    @Test func tierCyclesGrowEmphasizeMaintain() {
        var d = PlanFixtures.draft
        d.cycleTier("biceps"); #expect(d.tier("biceps") == .emphasize)
        d.cycleTier("biceps"); #expect(d.tier("biceps") == .maintain)
        d.cycleTier("biceps"); #expect(d.tier("biceps") == .grow)
        #expect(d.prioritiesWire["biceps"] == nil)
    }

    @Test func techniqueCycleRespectsStabilityAndTheSwitch() {
        var d = PlanFixtures.draft
        d.cycleTechnique(day: 0, exercise: 0)
        #expect(d.days[0].exercises[0].technique == .none, "techniques off: no change")
        d.techniquesEnabled = true
        let seen = (0..<4).map { _ -> SetTechnique in d.cycleTechnique(day: 0, exercise: 0); return d.days[0].exercises[0].technique }
        #expect(seen == [.restDrop, .drop, .myo, .none], "no half reps on a non-lengthened exercise")
        d.cycleTechnique(day: 1, exercise: 0)
        #expect(d.days[1].exercises[0].technique == .none, "free weight: never a technique")
        #expect(d.days[0].exercises[2].allowedTechniques == [.none], "core is not judged")
        #expect(d.days[0].exercises[1].allowedTechniques.contains(.partials))
    }

    @Test func oneChallengeADayAndItReplacesTheTechnique() {
        var d = PlanFixtures.draft
        d.techniquesEnabled = true
        d.toggleChallenge(day: 0, exercise: 0)
        #expect(!d.days[0].exercises[0].challenge, "not lengthened: cannot take the challenge")
        d.cycleTechnique(day: 0, exercise: 1)
        d.toggleChallenge(day: 0, exercise: 1)
        #expect(d.days[0].exercises[1].challenge && d.days[0].exercises[1].technique == .none)
        d.toggleChallenge(day: 0, exercise: 1)
        #expect(!d.days[0].exercises[1].challenge)
        #expect(d.techniqueCount(1) == 1)
    }

    @Test func proposalEditsApplyByIndex() {
        var d = PlanFixtures.draft
        d.apply([WireEdit(dayIndex: 0, exerciseIndex: 0, delta: 1), WireEdit(dayIndex: 1, exerciseIndex: 1, delta: -2),
                 WireEdit(dayIndex: 5, exerciseIndex: 0, delta: 3)])
        #expect(d.days[0].exercises[0].sets == 5)
        #expect(d.days[1].exercises[1].sets == 1)
    }

    @Test func changesFindExactlyWhatMoved() {
        let original = PlanFixtures.draft
        var d = original
        #expect(d.changes(since: original).isEmpty)
        d.step(day: 1, exercise: 1, by: 1)
        d.cycleTier("chest")
        d.style = .heavy
        let c = d.changes(since: original)
        #expect(c.days == [1] && c.tiers && c.style && c.settings && !c.techniquesEnabled && !c.sportGroups)
    }

    @Test func evaluateRequestCarriesTheDraft() throws {
        var d = PlanFixtures.draft
        d.step(day: 0, exercise: 0, by: 1)
        let r = d.evaluateRequest()
        #expect(r.weeks == 6 && r.days.count == 2)
        #expect(r.days[0].day == "Hét" && r.days[0].exercises[0].workingSets == 5)
        #expect(r.musclePriorities == ["back": "emphasize", "chest": "maintain"])
        #expect(r.days[1].exercises[1].technique == "rest_drop")
        #expect(r.days[0].exercises[0].trainingStyle == nil, "the style trio never goes to the evaluator")
        let json = String(decoding: try PlanJSON.encoder.encode(r), as: UTF8.self)
        #expect(!json.contains("\"overrides\""), "absent optionals are omitted")
    }

    @Test func daySaveOfAStyledExerciseOverridesWorkingSets() {
        let block = try! JSONDecoder().decode([WireBlock].self, from: Data(PlanFixtures.blocksJSON(style: "balanced").utf8))[0]
        var d = BlockDraft(block: block, catalog: PlanFixtures.catalog)
        d.step(day: 0, exercise: 0, by: 1)
        let input = d.dayInput(d.days[0], forSave: true).exercises
        #expect(input[0].overrides == ["restSec", "workingSets"])
        #expect(input[0].restSec == 120)
        #expect(input[1].overrides == nil, "unchanged rows carry their style by omission")
    }

    @Test func daySaveSendsTheTechniqueTrio() {
        var d = PlanFixtures.draft
        d.techniquesEnabled = true
        d.cycleTechnique(day: 0, exercise: 0)
        let input = d.dayInput(d.days[0], forSave: true).exercises
        #expect(input[0].technique == "rest_drop" && input[0].techniqueSource == "owner" && input[0].challenge == false)
        #expect(input[1].technique == nil && input[1].techniqueSource == nil && input[1].challenge == nil)
        let thu = d.dayInput(d.days[1], forSave: true).exercises
        #expect(thu[1].technique == nil && thu[1].techniqueSource == nil && thu[1].challenge == nil,
                "an untouched pick is omitted, so the server keeps it and its source")
    }

    @Test func editsCarryOntoAFreshRead() {
        let original = PlanFixtures.draft
        var d = original
        d.step(day: 0, exercise: 1, by: 2)
        d.cycleTier("biceps")
        let carried = d.carryEdits(onto: PlanFixtures.draft, original: original)
        #expect(carried.days[0].exercises[1].sets == 5)
        #expect(carried.tier("biceps") == .emphasize)
    }

    @Test func onlyRealEditsMoveAndADeltaMeetsAServerChange() throws {
        let original = PlanFixtures.draft
        var d = original
        d.step(day: 0, exercise: 1, by: 1)            // curl 3 → 4, his only edit
        // The server re-stamped every row to two sets (a switch to „Két sorozat bukásig").
        var fresh = original
        for i in fresh.days.indices { for e in fresh.days[i].exercises.indices { fresh.days[i].exercises[e].sets = 2 } }
        let carried = d.carryEdits(onto: fresh, original: original)
        #expect(carried.days[0].exercises[1].sets == 3, "his +1 on the server's 2, not his old 4")
        #expect(carried.days[0].exercises[0].sets == 2, "an untouched row keeps the server's value")
        #expect(carried.changes(since: fresh).days == [0])
    }

    @Test func aValueTheServerAlreadyHoldsIsNotAddedTwice() {
        let original = PlanFixtures.draft
        var d = original
        d.step(day: 0, exercise: 1, by: 1)
        let saved = d                                  // the day reached the server, then something else failed
        let carried = d.carryEdits(onto: saved, original: original)
        #expect(carried.days[0].exercises[1].sets == 4)
    }

    @Test func appliedProposalsStayInTheStepperRange() {
        var d = PlanFixtures.draft
        d.apply([WireEdit(dayIndex: 0, exerciseIndex: 0, delta: 9)])
        #expect(d.days[0].exercises[0].sets == 8)
    }

    @Test func coarseMuscleGroupsCatalogKeys() {
        #expect(coarseMuscle("back-wide") == "back")
        #expect(coarseMuscle("lats") == "back")
        #expect(coarseMuscle("chest-upper") == "chest")
        #expect(coarseMuscle("hamstring") == "ham")
        #expect(coarseMuscle("abs") == "core")
    }
}
