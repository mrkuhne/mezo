import Foundation
import Testing
@testable import BoopCore

// The block day editor's structural and per-row edits on the draft (mezo-r36n9.116). Every test carries a time limit:
// the BoopKit suite once hung on a runaway recursion.

@Suite("BlockDraft — the day editor's edits")
struct BlockDraftEditTests {
    static let curl = CatalogExercise(id: UUID(uuidString: PlanFixtures.catCurl)!, slug: "preacher-curl", name: "Preacher Curl",
                                      muscle: "biceps", type: .isolation, stim: 0.7, fatigue: 0.3)
    static let fly = CatalogExercise(id: UUID(uuidString: "c0000000-0000-4000-8000-0000000000f1")!, slug: "cable-fly",
                                     name: "Cable Fly", muscle: "chest-mid", type: .isolation, stim: 0.6, fatigue: 0.2)
    static let style = Prescription(workingSets: 2, repMin: 12, repMax: 15, targetRIR: 1, restSec: 90)

    @Test(.timeLimit(.minutes(1))) func addWithAPrescription() {
        let original = PlanFixtures.draft
        var d = original
        d.add(day: 0, catalog: Self.fly, prescription: Self.style)
        let row = d.days[0].exercises[3]
        #expect(row.isNew && row.id.hasPrefix("new-"))
        #expect(row.name == "Cable Fly" && row.muscle == "chest" && row.isolation)
        #expect(row.catalogId == PlanFixtures.catFly.lowercased())
        #expect(row.sets == 2 && row.repMin == 12 && row.repMax == 15 && row.targetRIR == 1 && row.restSec == 90)
        #expect(row.overrides.isEmpty && row.technique == .none && !row.challenge)
        #expect(d.changes(since: original).days == [0])
    }

    @Test(.timeLimit(.minutes(1))) func addWithoutAPrescriptionTakesTheDefault() {
        var d = PlanFixtures.draft
        d.add(day: 1, catalog: Self.curl, prescription: nil)
        let row = d.days[1].exercises[2]
        #expect(row.sets == 3 && row.repMin == 8 && row.repMax == 12 && row.targetRIR == 2 && row.restSec == nil)
        #expect(row.overrides.isEmpty)
        #expect(row.stable && row.lengthened, "technique attributes come from the block's catalog")
        #expect(PlanFixtures.draft.days[0].exercises.allSatisfy { !$0.isNew })
    }

    @Test(.timeLimit(.minutes(1))) func removeThenInsertRestoresTheOriginal() throws {
        let original = PlanFixtures.draft
        var d = original
        let removed = d.remove(day: 0, at: 1)
        let row = try #require(removed)
        #expect(row.name == "Preacher Curl" && d.days[0].exercises.count == 2)
        #expect(d.changes(since: original).days == [0])
        d.insert(day: 0, row, at: 1)
        #expect(d == original)
        #expect(d.changes(since: original).isEmpty)
    }

    @Test(.timeLimit(.minutes(1))) func aMoveIsAChange() {
        let original = PlanFixtures.draft
        var d = original
        d.move(day: 0, from: IndexSet(integer: 2), to: 0)
        #expect(d.days[0].exercises.map(\.name) == ["Plank", "Chest Supported Row", "Preacher Curl"])
        #expect(d.changes(since: original).days == [0])
    }

    @Test(.timeLimit(.minutes(1))) func aSameCountSwapIsAChange() {
        let original = PlanFixtures.draft
        var d = original
        d.replace(day: 1, at: 0, with: Self.fly, prescription: nil)
        #expect(d.days[1].exercises.count == original.days[1].exercises.count)
        #expect(d.days[1].exercises[0].name == "Cable Fly")
        #expect(d.changes(since: original).days == [1])
    }

    @Test(.timeLimit(.minutes(1))) func replaceKeepsHisValuesTheKeyAndTheTechnique() {
        var d = PlanFixtures.draft
        d.techniquesEnabled = true
        d.setRepRange(day: 1, at: 1, min: 5, max: 7)          // Cable Row: his range, rest_drop on it
        let key = d.days[1].exercises[1].id
        d.replace(day: 1, at: 1, with: Self.curl, prescription: Self.style)
        let row = d.days[1].exercises[1]
        #expect(row.id == key, "the local key stays")
        #expect(row.name == "Preacher Curl" && row.catalogId == PlanFixtures.catCurl)
        #expect(row.repMin == 5 && row.repMax == 7 && row.overrides.contains("repRange"), "his range stays")
        #expect(row.technique == .restDrop, "the technique stays")
        #expect(row.sets == 2 && row.targetRIR == 1, "everything he did not set comes from the prescription")
    }

    @Test(.timeLimit(.minutes(1))) func fieldEditsMarkTheServersKeysAndResetClearsThemAll() {
        let original = PlanFixtures.draft
        var d = original
        d.setRepRange(day: 0, at: 1, min: 8, max: 12)
        #expect(d.days[0].exercises[1].overrides == ["repRange"])
        d.setReserve(day: 0, at: 1, 1)
        #expect(d.days[0].exercises[1].overrides == ["repRange", "targetRir"])
        d.setAnchor(day: 0, at: 1, 22.5)
        d.setWarmups(day: 0, at: 1, 2)
        #expect(d.days[0].exercises[1].overrides == ["repRange", "targetRir"], "weight and warm-ups are never style-stamped")
        #expect(d.days[0].exercises[1].anchorWeightKg == 22.5 && d.days[0].exercises[1].warmups == 2)
        #expect(d.changes(since: original).days == [0])
        d.resetToStyle(day: 0, at: 1)
        d.resetToStyle(day: 0, at: 0)
        #expect(d.days[0].exercises[1].overrides.isEmpty)
        #expect(d.days[0].exercises[0].overrides.isEmpty, "the loaded restSec key goes too")
    }

    @Test(.timeLimit(.minutes(1))) func boundsClamp() {
        var d = PlanFixtures.draft
        d.setRepRange(day: 0, at: 0, min: 0, max: 40)
        #expect(d.days[0].exercises[0].repMin == 1 && d.days[0].exercises[0].repMax == 30)
        d.setRepRange(day: 0, at: 0, min: 12, max: 8)
        #expect(d.days[0].exercises[0].repMin <= d.days[0].exercises[0].repMax)
        d.setReserve(day: 0, at: 0, 9); #expect(d.days[0].exercises[0].targetRIR == 4)
        d.setReserve(day: 0, at: 0, -1); #expect(d.days[0].exercises[0].targetRIR == 0)
        d.setWarmups(day: 0, at: 0, 7); #expect(d.days[0].exercises[0].warmups == 4)
        d.setWarmups(day: 0, at: 0, -2); #expect(d.days[0].exercises[0].warmups == 0)
        d.setAnchor(day: 0, at: 0, 22.3); #expect(d.days[0].exercises[0].anchorWeightKg == 22.5)
        d.setAnchor(day: 0, at: 0, -5); #expect(d.days[0].exercises[0].anchorWeightKg == 0)
        d.setAnchor(day: 0, at: 0, nil); #expect(d.days[0].exercises[0].anchorWeightKg == nil)
        d.setReserve(day: 9, at: 9, 1)   // out of range: no crash
        let none1 = d.remove(day: 9, at: 0), none2 = d.remove(day: 0, at: 9)
        #expect(none1 == nil && none2 == nil)
    }

    @Test(.timeLimit(.minutes(1))) func dayInputCarriesNoIdButTheOverrides() throws {
        var d = PlanFixtures.draft
        d.setRepRange(day: 0, at: 1, min: 6, max: 8)
        d.setWarmups(day: 0, at: 1, 1)
        d.add(day: 0, catalog: Self.fly, prescription: Self.style)
        let input = d.dayInput(d.days[0], forSave: true)
        #expect(input.exercises[1].overrides == ["repRange"])
        #expect(input.exercises[1].repMin == 6 && input.exercises[1].repMax == 8 && input.exercises[1].warmupSets == 1)
        #expect(input.exercises[2].overrides == nil, "an untouched row carries its style by omission")
        let added = input.exercises[3]
        #expect(added.catalogId == PlanFixtures.catFly.lowercased() && added.name == "Cable Fly" && added.muscle == "chest-mid")
        #expect(added.workingSets == 2 && added.restSec == 90 && added.overrides == [])
        let json = String(decoding: try PlanJSON.encoder.encode(input), as: UTF8.self)
        #expect(!json.contains("\"id\""), "the server matches rows by catalogue id or name")
    }

    @Test(.timeLimit(.minutes(1))) func aReplacedRowResendsItsStyleRestAndTechnique() {
        let block = try! JSONDecoder().decode([WireBlock].self, from: Data(PlanFixtures.blocksJSON(style: "balanced").utf8))[0]
        var d = BlockDraft(block: block, catalog: PlanFixtures.catalog)
        d.replace(day: 0, at: 0, with: Self.curl, prescription: Self.style)
        let input = d.dayInput(d.days[0], forSave: true).exercises[0]
        #expect(input.name == "Preacher Curl" && input.catalogId == PlanFixtures.catCurl)
        #expect(input.restSec == 120 && input.overrides == ["restSec"], "the old row's rest and keys go explicitly")
        #expect(input.technique == nil && input.challenge == false, "the technique trio is explicit on a new identity")
    }

    @Test(.timeLimit(.minutes(1))) func aSwappedRowsKeptPlannerPickIsHis() throws {
        let json = PlanFixtures.blocksJSON().replacingOccurrences(of: #""technique":"rest_drop","techniqueSource":"owner""#,
                                                                   with: #""technique":"rest_drop","techniqueSource":"planner""#)
        let block = try JSONDecoder().decode([WireBlock].self, from: Data(json.utf8))[0]
        var d = BlockDraft(block: block, catalog: PlanFixtures.catalog)
        #expect(d.days[1].exercises[1].pickedByBoop)
        d.replace(day: 1, at: 1, with: Self.curl, prescription: nil)
        let row = d.days[1].exercises[1]
        #expect(row.technique == .restDrop && !row.pickedByBoop, "he chose this exercise")
        let input = d.dayInput(d.days[1], forSave: true).exercises[1]
        #expect(input.technique == "rest_drop" && input.techniqueSource == "owner")
    }

    @Test(.timeLimit(.minutes(1))) func aStepOnAnUnstyledBlockSendsNoOverrides() {
        var d = PlanFixtures.draft
        d.step(day: 0, exercise: 1, by: 1)
        d.apply([WireEdit(dayIndex: 1, exerciseIndex: 0, delta: 1)])
        #expect(d.days[0].exercises[1].overrides.isEmpty && d.days[1].exercises[0].overrides.isEmpty)
        let mon = d.dayInput(d.days[0], forSave: true).exercises
        #expect(mon[1].workingSets == 4 && mon[1].overrides == nil, "as before the day editor")
        #expect(mon[0].overrides == nil, "an untouched row carries its keys by omission")
        #expect(d.dayInput(d.days[1], forSave: true).exercises[0].overrides == nil)
        d.setReserve(day: 0, at: 1, 1)
        #expect(d.dayInput(d.days[0], forSave: true).exercises[1].overrides == ["targetRir"], "field edits mark on any block")
    }

    @Test(.timeLimit(.minutes(1))) func aStepThenAStyleInTheSameSaveKeepsHisCount() {
        var d = PlanFixtures.draft
        d.step(day: 0, exercise: 1, by: 1)
        d.style = .balanced
        #expect(d.dayInput(d.days[0], forSave: true).exercises[1].overrides == ["workingSets"])
    }

    @Test(.timeLimit(.minutes(1))) func aStepThenAClearedStyleSendsNoWorkingSetsKey() throws {
        let block = try JSONDecoder().decode([WireBlock].self, from: Data(PlanFixtures.blocksJSON(style: "balanced").utf8))[0]
        var d = BlockDraft(block: block, catalog: PlanFixtures.catalog)
        d.step(day: 0, exercise: 0, by: 1)
        d.step(day: 0, exercise: 1, by: 1)
        d.style = nil
        let input = d.dayInput(d.days[0], forSave: true).exercises
        #expect(!(input[0].overrides ?? []).contains("workingSets") && !(input[1].overrides ?? []).contains("workingSets"))
        #expect(input[1].overrides == nil, "nothing left to send on a row without keys")
    }

    @Test(.timeLimit(.minutes(1))) func aNewRowsPickIsSavedAsHis() {
        var d = PlanFixtures.draft
        d.techniquesEnabled = true
        d.add(day: 0, catalog: Self.curl, prescription: nil)
        d.setTechnique(day: 0, exercise: 3, .myo)
        let input = d.dayInput(d.days[0], forSave: true).exercises[3]
        #expect(input.technique == "myo" && input.techniqueSource == "owner" && input.challenge == false)
        #expect(!d.days[0].exercises[3].pickedByBoop)
    }

    @Test(.timeLimit(.minutes(1))) func catalogIdCaseDoesNotMakeANewIdentity() throws {
        let json = PlanFixtures.blocksJSON().replacingOccurrences(of: "\"catalogId\":\"\(PlanFixtures.catCurl)\"",
                                                                   with: "\"catalogId\":\"\(PlanFixtures.catCurl.uppercased())\"")
        #expect(json.contains(PlanFixtures.catCurl.uppercased()))
        var d = BlockDraft(block: try JSONDecoder().decode([WireBlock].self, from: Data(json.utf8))[0], catalog: PlanFixtures.catalog)
        d.replace(day: 0, at: 1, with: Self.curl, prescription: nil)   // the same exercise, upper-case id on the wire
        #expect(!d.days[0].exercises[1].identityChanged)
    }

    @Test(.timeLimit(.minutes(1))) func anEmptyDayWithOneAddedRow() throws {
        var d = PlanFixtures.draft
        for _ in 0..<2 { _ = d.remove(day: 1, at: 0) }
        #expect(d.days[1].exercises.isEmpty)
        d.add(day: 1, catalog: Self.curl, prescription: nil)
        let input = d.dayInput(d.days[1], forSave: true)
        #expect(input.exercises.count == 1 && input.exercises[0].name == "Preacher Curl")
    }

    @Test(.timeLimit(.minutes(1))) func carryKeepsANewRowOnAnUnsavedDay() {
        let original = PlanFixtures.draft
        var d = original
        d.add(day: 0, catalog: Self.fly, prescription: nil)
        d.move(day: 0, from: IndexSet(integer: 3), to: 0)
        d.step(day: 1, exercise: 0, by: 1)
        let fresh = PlanFixtures.draft
        let carried = d.carryEdits(onto: fresh, original: original)
        #expect(carried.days[0].exercises.map(\.name) == ["Cable Fly", "Chest Supported Row", "Preacher Curl", "Plank"])
        #expect(carried.days[0].exercises[0].isNew)
        #expect(carried.days[1].exercises[0].sets == 4)
        #expect(carried.changes(since: fresh).days == [0, 1])
    }

    @Test(.timeLimit(.minutes(1))) func aDayTheServerTookIsNotReapplied() {
        let original = PlanFixtures.draft
        var d = original
        d.add(day: 0, catalog: Self.fly, prescription: nil)
        // The save reached the server: it re-minted every row id of the day, the new row now has one too.
        var fresh = d
        fresh.days[0].exercises = fresh.days[0].exercises.enumerated().map { $1.withId("server-\($0)") }
        let carried = d.carryEdits(onto: fresh, original: original)
        #expect(carried.days[0].exercises.count == 4)
        #expect(carried.days[0].exercises.allSatisfy { !$0.isNew })
        #expect(carried.changes(since: fresh).isEmpty)
    }

    @Test(.timeLimit(.minutes(1))) func proposalsStillAddressRequestIndices() {
        var d = PlanFixtures.draft
        d.move(day: 0, from: IndexSet(integer: 1), to: 0)     // curl first now
        d.apply([WireEdit(dayIndex: 0, exerciseIndex: 0, delta: 1)])
        #expect(d.days[0].exercises[0].name == "Preacher Curl" && d.days[0].exercises[0].sets == 4)
    }
}

extension PlanFixtures {
    static let catFly = "c0000000-0000-4000-8000-0000000000f1"
}
