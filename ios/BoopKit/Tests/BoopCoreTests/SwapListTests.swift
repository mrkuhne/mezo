import Foundation
import Testing
@testable import BoopCore

private func row(_ name: String, _ muscle: String, gear: [String]? = nil) -> CatalogExercise {
    CatalogExercise(id: UUID(), slug: name, name: name, muscle: muscle, type: .compound, stim: 0.8,
                    fatigue: 0.5, gear: gear)
}

/// The swap sheet's pure parts (mezo-r36n9.66, spec §6.2).
struct SwapListTests {
    @Test func aSwitchedOffKindOrAMissingMachineMakesTheGymLackIt() {
        let bench = row("Barbell Bench Press", "chest-mid", gear: ["barbell", "bench"])
        let press = row("Machine Chest Press", "chest-mid", gear: ["machine"])
        let pushUp = row("Push-Up", "chest-mid", gear: [])
        let custom = row("Saját", "chest-mid", gear: nil)
        let gym = GymProfile(offKinds: ["barbell"], missing: [press.id])
        #expect(gym.lacks(bench))
        #expect(gym.lacks(press))
        #expect(!gym.lacks(pushUp))
        #expect(!gym.lacks(custom))
    }

    @Test func anEditAndItsUndoLeaveTheProfileAsItWas() {
        let id = UUID()
        let start = GymProfile(offKinds: ["cable"], missing: [])
        for edit in [MissingEdit.kind(.barbell), .exercise(id)] {
            #expect(start.applying(edit) != start)
            #expect(start.applying(edit).reverting(edit) == start)
        }
        // „Which one is missing?" is a question, not an edit.
        #expect(start.applying(.ask([.dumbbell, .bench])) == start)
    }

    @Test func untappingTheChipUndoesEveryEditThatBlocksTheExercise() {
        let curl = row("Incline DB Curl", "biceps-long", gear: ["dumbbell", "bench"])
        let gym = GymProfile(offKinds: ["bench", "cable"], missing: [curl.id])
        let edits = gym.edits(blocking: curl)
        #expect(edits.contains(.exercise(curl.id)))
        #expect(edits.contains(.kind(.bench)))
        #expect(edits.count == 2)
        #expect(!edits.reduce(gym) { $0.reverting($1) }.lacks(curl))
    }

    @Test func theFullListLeavesOutTodayByNameAndPutsTheSameMuscleFirst() {
        let catalog = [row("Lat Pulldown", "back-wide"), row("Barbell Row", "back-mid"),
                       row("Chin-Up", "back-wide"), row("Weighted Pull-Up", "back-wide"),
                       row("Face Pull", "shoulder-rear")]
        let list = swapList(catalog: catalog, muscle: "back-wide", today: ["weighted pull-up", "Barbell Row"], query: "")
        #expect(list.map(\.name) == ["Lat Pulldown", "Chin-Up", "Face Pull"])
    }

    @Test func theSearchIgnoresCaseAndAccents() {
        let catalog = [row("Fekvenyomás", "chest-mid"), row("Tárogatás", "chest-mid"), row("Evezés", "back-mid")]
        #expect(swapList(catalog: catalog, muscle: "chest-mid", today: [], query: "NYOMAS").map(\.name) == ["Fekvenyomás"])
        #expect(swapList(catalog: catalog, muscle: "chest-mid", today: [], query: "xyz").isEmpty)
    }

    @Test func theOutgoingRowIsFoundByName() {
        let catalog = [row("Barbell Row", "back-mid")]
        #expect(catalogRow(named: "barbell row", in: catalog)?.name == "Barbell Row")
        #expect(catalogRow(named: "Saját evezés", in: catalog) == nil)
        #expect(catalogRow(named: nil, in: catalog) == nil)
    }
}
