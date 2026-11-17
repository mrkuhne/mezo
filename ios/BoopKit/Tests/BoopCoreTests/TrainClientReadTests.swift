import Foundation
import Testing
@testable import BoopCore

private let sessionId = "a1b2c3d4-0001-4a2b-9c3d-111122223333"
private let pressId = "a1b2c3d4-0002-4a2b-9c3d-111122223333"

/// Today's day with the hypertrophy engine on: the first exercise carries two warmups, three working sets and the
/// engine's own HU rationale.
private func todayJSON() -> String {
    #"""
    {"templateSessionId":"\#(sessionId)","dayLabel":"Hét","title":"Pull Day","durationEst":62,
     "exercises":[
       {"id":"\#(pressId)","name":"Fekvenyomás","muscle":"chest","warmupSets":2,"workingSets":3,
        "repMin":6,"repMax":10,"targetRIR":2,"type":"compound","anchorWeightKg":77.5,"planSlot":true,
        "prescribedSets":[
          {"kind":"warmup","targetWeightKg":40,"targetReps":8},
          {"kind":"warmup","targetWeightKg":60,"targetReps":5},
          {"kind":"working","targetWeightKg":80,"targetReps":8,"targetRIR":2},
          {"kind":"working","targetWeightKg":80,"targetReps":8,"targetRIR":2},
          {"kind":"working","targetWeightKg":80,"targetReps":7,"targetRIR":1}],
        "lastWeek":{"weightKg":77.5,"reps":8,"rir":3},
        "progression":{"lever":"weight","deltaKg":2.5,"targetWeightKg":80,"targetReps":8,
                       "rationale":"Múlt hét 8 × 77.5 kg (RIR 3) → +2.5 kg"},
        "rationale":"Múlt hét 8 × 77.5 kg (RIR 3) → +2.5 kg"}],
     "weekDoneDates":["2026-11-16"]}
    """#
}

/// The same day on a first session: no anchor weight and no per-set targets at all. Nothing may invent a 0 kg here.
private func todayWithoutWeightsJSON() -> String {
    #"""
    {"templateSessionId":"\#(sessionId)","dayLabel":"Hét","title":"Pull Day",
     "exercises":[
       {"id":"\#(pressId)","name":"Fekvenyomás","muscle":"chest","warmupSets":1,"workingSets":3,
        "repMin":6,"repMax":10,"targetRIR":2,"type":"compound","planSlot":true}],
     "weekDoneDates":[]}
    """#
}

@MainActor
struct TrainClientReadTests {
    let stub = StubTransport()
    let tokens = MemoryTokenStore()

    func train() throws -> TrainClient {
        try tokens.write("t0")
        let tz = TimeZone(identifier: "Europe/Budapest")!
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        return TrainClient(client: makeClient(tokens: tokens, transport: stub, timeZone: tz), calendar: cal)
    }

    func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        return cal.date(from: DateComponents(year: y, month: m, day: d, hour: 12))!
    }

    @Test func todayWorkoutMapsPrescribedSetsAndRationale() async throws {
        stub.on("getTodayWorkout", .json(200, todayJSON()))
        let today = try await train().todayWorkout()

        let first = try #require(today.exercises.first)
        #expect(first.sets.filter { $0.kind == .warmup }.count == 2)
        #expect(first.sets.filter { $0.kind == .working }.count == 3)
        #expect(first.rationale == "Múlt hét 8 × 77.5 kg (RIR 3) → +2.5 kg")
        #expect(first.sets.first?.targetKg == 40)
        #expect(today.title == "Pull Day")
        #expect(today.weekDoneDates == ["2026-11-16"])
    }

    @Test func todayWorkoutKeepsNilApartFromZero() async throws {
        stub.on("getTodayWorkout", .json(200, todayWithoutWeightsJSON()))
        let today = try await train().todayWorkout()

        let first = try #require(today.exercises.first)
        // The counts are still known, so the player can show four rows — but not one of them claims a weight.
        #expect(first.sets.count == 4)
        #expect(first.sets[0].targetKg == nil)
        #expect(first.sets.allSatisfy { $0.targetKg == nil })
        #expect(first.anchorKg == nil)
        #expect(first.rationale == nil)
    }

    @Test func historyRangeIsPassedThrough() async throws {
        stub.on("listWorkouts", .json(200, "[]"))
        _ = try await train().history(from: day(2026, 10, 19), to: day(2026, 11, 16))

        let sent = try #require(stub.sent.first)
        #expect(sent.path.contains("from=2026-10-19"))
        #expect(sent.path.contains("to=2026-11-16"))
    }
}
