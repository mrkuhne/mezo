import Foundation
import Testing
@testable import BoopCore

private let sessionId = "c1b2c3d4-0001-4a2b-9c3d-111122223333"
private let curlId = "c1b2c3d4-0002-4a2b-9c3d-111122223333"
private let templateDay = UUID(uuidString: sessionId)!
private let serverWorkout = "c1b2c3d4-0012-4a2b-9c3d-111122223333"

/// Today's day as T2/T3 send it: a rest drop on the last working set, the challenge flag and the number to beat.
private func todayJSON() -> String {
    #"""
    {"templateSessionId":"\#(sessionId)","title":"Hát",
     "exercises":[
       {"id":"\#(curlId)","name":"Preacher Curl","muscle":"biceps","warmupSets":0,"workingSets":2,
        "repMin":10,"repMax":15,"targetRIR":2,"type":"isolation","planSlot":true,
        "technique":"rest_drop","techniqueSource":"planner","challenge":true,"challengeBest":7,
        "prescribedSets":[
          {"kind":"working","targetWeightKg":30,"targetReps":11,"targetRIR":2,"restSec":90},
          {"kind":"working","targetWeightKg":30,"targetReps":11,"targetRIR":0,"restSec":90,"technique":"rest_drop",
           "legs":[{"kind":"drop","weightKg":20,"reps":11,"toFailure":false,"restBeforeSec":30,"dropPercent":30}]}]}],
     "weekDoneDates":[]}
    """#
}

private func instanceJSON() -> String {
    #"""
    {"id":"\#(serverWorkout)","templateSessionId":"\#(sessionId)","date":"2026-11-19","status":"active",
     "sets":[{"id":"c1b2c3d4-0020-4a2b-9c3d-111122223333","exerciseId":"\#(curlId)","setIndex":1,"weightKg":30,
              "reps":10,"rir":0,"kind":"working","technique":"rest_drop",
              "legs":[{"legIndex":0,"kind":"drop","weightKg":20,"reps":10,"restSec":30}]}]}
    """#
}

@MainActor
struct TrainTechniqueWireTests {
    let stub = StubTransport()

    func train() -> TrainClient {
        TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), calendar: budapest)
    }

    func body(op: String) throws -> [String: Any] {
        let text = try #require(stub.sent.last { $0.op == op }?.body)
        return try #require(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
    }

    @Test func todayCarriesTheTechniqueItsStepsAndTheChallenge() async throws {
        stub.on("getTodayWorkout", .json(200, todayJSON()))
        let e = try #require(try await train().todayWorkout().exercises.first)

        #expect(e.technique == .restDrop)
        #expect(e.challenge)
        #expect(e.challengeBest == 7)
        #expect(e.sets[0].restSec == 90)
        #expect(e.sets[0].isTechnique == false)
        let last = e.sets[1]
        #expect(last.technique == .restDrop)
        #expect(last.legs == [PrescribedLeg(kind: .drop, weightKg: 20, reps: 11, toFailure: false,
                                            restBeforeSec: 30, dropPercent: 30)])
    }

    @Test func aLoggedTechniqueSetComesBackWithItsSteps() async throws {
        stub.on("startWorkout", .json(201, instanceJSON()))
        let instance = try await train().startWorkout(templateSessionId: templateDay, ref: UUID())
        let set = try #require(instance.sets.first)
        #expect(set.technique == .restDrop)
        #expect(set.legs == [LoggedLeg(kind: .drop, weightKg: 20, reps: 10, restSec: 30)])
    }

    @Test func theSetGoesOutWithItsTechniqueAndSteps() async throws {
        stub.on("startWorkout", .json(201, instanceJSON()))
        stub.on("logWorkoutSet", .json(201, #"{"id":"c1b2c3d4-0021-4a2b-9c3d-111122223333","exerciseId":"\#(curlId)","setIndex":1}"#))
        let client = train()
        let start = OutboxItem.workoutStart(WorkoutStartPayload(templateSessionId: templateDay),
                                            date: "2026-11-19", capturedAt: Date())
        _ = await client.send(start)
        let payload = WorkoutSetPayload(workoutRef: start.id, exerciseId: UUID(uuidString: curlId)!, setIndex: 1,
                                        weightKg: 30, reps: 10, rir: 0, technique: "rest_drop",
                                        legs: [WorkoutLegPayload(kind: "drop", weightKg: 20, reps: 10, restSec: 30)])
        let result = await client.send(.workoutWrite(.workoutSet, payload: TrainPayloadCodec.encode(payload),
                                                     workoutRef: start.id, date: "2026-11-19", capturedAt: Date()))
        guard case .sent = result else { Issue.record("expected sent, got \(result)"); return }

        let b = try body(op: "logWorkoutSet")
        #expect(b["technique"] as? String == "rest_drop")
        let legs = try #require(b["legs"] as? [[String: Any]])
        #expect(legs.count == 1)
        #expect(legs[0]["kind"] as? String == "drop")
        #expect(legs[0]["reps"] as? Int == 10)
    }

    @Test func aStraightSetSendsNoTechniqueAtAll() async throws {
        stub.on("startWorkout", .json(201, instanceJSON()))
        stub.on("logWorkoutSet", .json(201, #"{"id":"c1b2c3d4-0021-4a2b-9c3d-111122223333","exerciseId":"\#(curlId)","setIndex":0}"#))
        let client = train()
        let start = OutboxItem.workoutStart(WorkoutStartPayload(templateSessionId: templateDay),
                                            date: "2026-11-19", capturedAt: Date())
        _ = await client.send(start)
        let payload = WorkoutSetPayload(workoutRef: start.id, exerciseId: UUID(uuidString: curlId)!, setIndex: 0,
                                        weightKg: 30, reps: 11, rir: 2)
        _ = await client.send(.workoutWrite(.workoutSet, payload: TrainPayloadCodec.encode(payload),
                                            workoutRef: start.id, date: "2026-11-19", capturedAt: Date()))
        let b = try body(op: "logWorkoutSet")
        #expect(b["technique"] == nil)
        #expect(b["legs"] == nil)
    }

    @Test func aCorrectionLeavesTheStepsAlone() async throws {
        stub.on("startWorkout", .json(201, instanceJSON()))
        stub.on("updateWorkoutSet", .json(200, #"{"id":"c1b2c3d4-0020-4a2b-9c3d-111122223333","exerciseId":"\#(curlId)","setIndex":1}"#))
        let client = train()
        let start = OutboxItem.workoutStart(WorkoutStartPayload(templateSessionId: templateDay),
                                            date: "2026-11-19", capturedAt: Date())
        _ = await client.send(start)
        let edit = WorkoutSetEditPayload(workoutRef: start.id, setId: UUID(uuidString: "c1b2c3d4-0020-4a2b-9c3d-111122223333")!,
                                         weightKg: 32.5, reps: 10, rir: 0)
        _ = await client.send(.workoutWrite(.workoutSetEdit, payload: TrainPayloadCodec.encode(edit),
                                            workoutRef: start.id, date: "2026-11-19", capturedAt: Date()))
        #expect(try body(op: "updateWorkoutSet")["legs"] == nil)
    }
}
