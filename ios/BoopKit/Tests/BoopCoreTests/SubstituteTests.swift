import Foundation
import Testing
@testable import BoopCore

private let workoutId = UUID(uuidString: "a1b2c3d4-0001-4a2b-9c3d-111122223333")!
private let outId = UUID(uuidString: "a1b2c3d4-0002-4a2b-9c3d-111122223333")!
private let machinePress = "a1b2c3d4-0010-4a2b-9c3d-111122223333"
private let dbBench = "a1b2c3d4-0011-4a2b-9c3d-111122223333"
private let dip = "a1b2c3d4-0012-4a2b-9c3d-111122223333"
private let hack = "a1b2c3d4-0013-4a2b-9c3d-111122223333"

private func item(_ id: String, _ name: String, gear: String?) -> String {
    #"{"id":"\#(id)","slug":"s-\#(id.suffix(2))","name":"\#(name)","muscle":"chest-mid","type":"compound","stim":0.8,"fatigue":0.5,"editable":false,"mediaEditable":false,"authoredByMe":false\#(gear.map { #","gear":\#($0)"# } ?? "")}"#
}

private func substitutesJSON() -> String {
    #"""
    {"suggestions":[
      {"exercise":\#(item(machinePress, "Machine Chest Press", gear: #"["machine"]"#)),
       "reasonText":"Ugyanazt a munkát végzi a tervben, stabil, könnyű benne terhelni.",
       "signals":["same-role","guided"],"lastTopSet":{"weightKg":55,"reps":11}},
      {"exercise":\#(item(dbBench, "DB Bench Press", gear: #"["dumbbell","bench"]"#)),
       "reasonText":"Ugyanazt a munkát végzi a tervben.","signals":["same-role"],"lastTopSet":null}],
     "labels":[{"catalogId":"\#(dip)","label":"HURT_BEFORE"},{"catalogId":"\#(hack)","label":"NO_EQUIPMENT"}]}
    """#
}

private func exercise(_ name: String, gear: [String]?) -> CatalogExercise {
    CatalogExercise(id: UUID(), slug: name, name: name, muscle: "chest-mid", type: .compound, stim: 0.8,
                    fatigue: 0.5, gear: gear)
}

@MainActor
struct SubstituteTests {
    let stub = StubTransport()
    let tokens = MemoryTokenStore()

    func train() throws -> TrainClient {
        try tokens.write("t0")
        let tz = TimeZone(identifier: "Europe/Budapest")!
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        return TrainClient(client: makeClient(tokens: tokens, transport: stub, timeZone: tz), calendar: cal)
    }

    @Test func substitutesDecodeReasonSignalsTopSetAndLabels() async throws {
        stub.on("getExerciseSubstitutes", .json(200, substitutesJSON()))
        let r = try await train().substitutes(workoutId: workoutId, exerciseId: outId)

        #expect(r.suggestions.count == 2)
        #expect(r.suggestions[0].exercise.name == "Machine Chest Press")
        #expect(r.suggestions[0].exercise.gear == ["machine"])
        #expect(r.suggestions[0].reason == "Ugyanazt a munkát végzi a tervben, stabil, könnyű benne terhelni.")
        #expect(r.suggestions[0].signals == ["same-role", "guided"])
        #expect(r.suggestions[0].lastTopSet?.kg == 55)
        #expect(r.suggestions[0].lastTopSet?.reps == 11)
        #expect(r.suggestions[1].lastTopSet == nil)
        #expect(r.labels[UUID(uuidString: dip)!] == .hurtBefore)
        #expect(r.labels[UUID(uuidString: hack)!] == .noEquipment)
        #expect(stub.sent.first?.path.hasSuffix("/exercises/\(outId.uuidString.lowercased())/substitutes") == true)
    }

    @Test func substitutes503Throws() async throws {
        stub.on("getExerciseSubstitutes", .status(503))
        await #expect(throws: TrainFetchError.self) {
            _ = try await train().substitutes(workoutId: workoutId, exerciseId: outId)
        }
    }

    @Test func gymProfileReadsBothLists() async throws {
        stub.on("getGymProfile", .json(200, #"{"offKinds":["cable"],"missingExerciseIds":["\#(hack)"]}"#))
        let p = try await train().gymProfile()
        #expect(p.offKinds == ["cable"])
        #expect(p.missing == [UUID(uuidString: hack)!])
    }

    @Test func saveGymProfileSendsBothArrays() async throws {
        stub.on("putGymProfile", .json(200, #"{"offKinds":["smith"],"missingExerciseIds":["\#(hack)"]}"#))
        let saved = try await train().saveGymProfile(GymProfile(offKinds: ["smith"], missing: [UUID(uuidString: hack)!]))
        let body = try #require(stub.sent.first?.body)
        #expect(body.contains("offKinds") && body.contains("smith"))
        #expect(body.contains("missingExerciseIds") && body.contains(hack))
        #expect(saved.offKinds == ["smith"])
    }

    @Test func discomfortMarkAndClearAreOnlineCalls() async throws {
        stub.on("markExerciseDiscomfort", .status(204))
        stub.on("clearExerciseDiscomfort", .status(204))
        stub.on("markExerciseDiscomfort", .status(409))
        let t = try train()
        try await t.markDiscomfort(workoutId: workoutId, exerciseId: outId)
        try await t.clearDiscomfort(workoutId: workoutId, exerciseId: outId)
        #expect(stub.ops == ["markExerciseDiscomfort", "clearExerciseDiscomfort"])
        await #expect(throws: TrainFetchError.self) { try await t.markDiscomfort(workoutId: workoutId, exerciseId: outId) }
    }

    @Test func missingEditForAMachineIsThatExercise() {
        let hackSquat = exercise("Hack Squat", gear: ["machine"])
        #expect(missingEdit(for: hackSquat) == .exercise(hackSquat.id))
        let smith = exercise("Smith Squat", gear: ["smith", "bench"])
        #expect(missingEdit(for: smith) == .exercise(smith.id))
    }

    @Test func missingEditForOnePortableKindIsThatKind() {
        #expect(missingEdit(for: exercise("Cable Fly", gear: ["cable"])) == .kind(.cable))
        #expect(missingEdit(for: exercise("Dip", gear: ["pullup-bar", "bodyweight"])) == .kind(.pullupBar))
    }

    @Test func missingEditForSeveralKindsAsksWithBenchLast() {
        #expect(missingEdit(for: exercise("Barbell Bench Press", gear: ["bench", "barbell"])) == .ask([.barbell, .bench]))
    }

    @Test func missingEditIsNilWithoutAttributesOrKit() {
        #expect(missingEdit(for: exercise("Saját", gear: nil)) == nil)
        #expect(missingEdit(for: exercise("Push-Up", gear: ["bodyweight"])) == nil)
        #expect(missingEdit(for: exercise("Üres", gear: [])) == nil)
    }

    @Test func nineKindsHaveHungarianLabels() {
        #expect(EquipmentKind.allCases.count == 9)
        #expect(EquipmentKind.barbell.label == "Rúd és tárcsák")
        #expect(EquipmentKind.pullupBar.label == "Húzódzkodó és tolódzkodó állvány")
        #expect(EquipmentKind.specialty.label == "Különleges eszközök")
    }
}
