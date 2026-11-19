import Foundation
import Testing
@testable import BoopCore

private let templateDay = UUID(uuidString: "d5b2c3d4-0001-4a2b-9c3d-111122223333")!
private let pressId = "d5b2c3d4-0002-4a2b-9c3d-111122223333"
private let serverWorkout = "d5b2c3d4-0012-4a2b-9c3d-111122223333"
private let serverSet = "d5b2c3d4-0020-4a2b-9c3d-111122223333"

private func instanceJSON() -> String {
    #"{"id":"\#(serverWorkout)","templateSessionId":"\#(templateDay.uuidString.lowercased())","date":"2026-11-19","status":"active","sets":[]}"#
}

private func setJSON(index: Int) -> String {
    #"{"id":"\#(serverSet)","exerciseId":"\#(pressId)","setIndex":\#(index),"weightKg":80,"reps":8}"#
}

private func detailJSON() -> String {
    #"""
    {"id":"\#(serverWorkout)","templateSessionId":"\#(templateDay.uuidString.lowercased())","date":"2026-11-19",
     "status":"active","title":"Push","dayLabel":"Hét",
     "exercises":[{"exerciseId":"\#(pressId)","name":"Fekvenyomás","muscle":"chest","type":"compound",
       "warmupSets":0,"workingSets":2,"repMin":6,"repMax":10,"targetRIR":2,"skipped":false,
       "sets":[{"id":"d5b2c3d4-0019-4a2b-9c3d-111122223333","exerciseId":"\#(pressId)","setIndex":0},
               {"id":"\#(serverSet)","exerciseId":"\#(pressId)","setIndex":1}]}]}
    """#
}

/// A set he corrects in the gym reaches the server (mezo-r36n9.96). Before, the correction lived on the phone only.
@MainActor
struct TrainSetEditTests {
    let stub = StubTransport()

    func train() -> TrainClient {
        TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), calendar: budapest)
    }

    func start(_ client: TrainClient) async -> OutboxItem {
        stub.on("startWorkout", .json(201, instanceJSON()))
        let item = OutboxItem.workoutStart(WorkoutStartPayload(templateSessionId: templateDay),
                                           date: "2026-11-19", capturedAt: Date())
        _ = await client.send(item)
        return item
    }

    func edit(_ ref: UUID, index: Int, kg: Double) -> OutboxItem {
        let p = WorkoutSetEditPayload(workoutRef: ref, exerciseId: UUID(uuidString: pressId)!, setIndex: index,
                                      weightKg: kg, reps: 8, rir: 1)
        return .workoutWrite(.workoutSetEdit, payload: TrainPayloadCodec.encode(p), workoutRef: ref,
                             date: "2026-11-19", capturedAt: Date())
    }

    @Test func aCorrectionAddressesTheIdTheServerGaveTheSet() async throws {
        let client = train()
        let s = await start(client)
        stub.on("logWorkoutSet", .json(201, setJSON(index: 1)))
        let set = WorkoutSetPayload(workoutRef: s.id, exerciseId: UUID(uuidString: pressId)!, setIndex: 1,
                                    weightKg: 80, reps: 8, rir: 2)
        _ = await client.send(.workoutWrite(.workoutSet, payload: TrainPayloadCodec.encode(set), workoutRef: s.id,
                                            date: "2026-11-19", capturedAt: Date()))
        stub.on("updateWorkoutSet", .json(200, setJSON(index: 1)))

        let result = await client.send(edit(s.id, index: 1, kg: 82.5))

        guard case .sent = result else { Issue.record("expected sent, got \(result)"); return }
        let put = try #require(stub.sent.last { $0.op == "updateWorkoutSet" })
        #expect(put.path.hasSuffix("/sets/\(serverSet)"))
        #expect(put.body?.contains("82.5") == true)
        #expect(!stub.ops.contains("getWorkoutDetail"))   // remembered from the log answer, no extra read
    }

    @Test func afterARelaunchTheSetIsFoundOnTheWorkout() async throws {
        // A new run: the set was sent before the app was killed, so this run never saw its id.
        let client = train()
        let s = await start(client)
        stub.on("getWorkoutDetail", .json(200, detailJSON()))
        stub.on("updateWorkoutSet", .json(200, setJSON(index: 1)))

        let result = await client.send(edit(s.id, index: 1, kg: 82.5))

        guard case .sent = result else { Issue.record("expected sent, got \(result)"); return }
        let put = try #require(stub.sent.last { $0.op == "updateWorkoutSet" })
        #expect(put.path.hasSuffix("/sets/\(serverSet)"))
    }

    @Test func aSetTheServerDoesNotHaveFailsVisibly() async throws {
        let client = train()
        let s = await start(client)
        stub.on("getWorkoutDetail", .json(200, detailJSON()))

        let result = await client.send(edit(s.id, index: 5, kg: 82.5))

        #expect(result == .failed("TRAIN_SET_NOT_FOUND"))
        #expect(!stub.ops.contains("updateWorkoutSet"))
    }

    @Test func aCorrectionQueuedByTheOldBuildStillReads() throws {
        let old = #"{"workoutRef":"\#(UUID())","setId":"\#(serverSet)","weightKg":80,"reps":8}"#
        let p = try #require(TrainPayloadCodec.decode(WorkoutSetEditPayload.self, from: Data(old.utf8)))
        #expect(p.setId?.uuidString.lowercased() == serverSet)
        #expect(p.exerciseId == nil)
    }
}
