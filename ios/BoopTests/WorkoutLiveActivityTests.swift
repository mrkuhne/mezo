import Foundation
import Testing
import BoopCore
@testable import Boop

/// The workout card on the Lock Screen (`mezo-r36n9.172`, step 2): what it shows, and what its buttons do.
@MainActor
struct WorkoutLiveActivityTests {
    let now = Date(timeIntervalSince1970: 1_795_089_600)

    func session(sets: Int = 3, kg: Double? = 80, technique: Bool = false) -> WorkoutSession {
        var planned = (0..<sets).map { _ in PrescribedSet(kind: .working, targetKg: kg, targetReps: 8, targetRIR: 2) }
        if technique {
            planned[0] = PrescribedSet(kind: .working, targetKg: kg, targetReps: 8, targetRIR: 2, technique: .drop,
                                       legs: [PrescribedLeg(kind: .drop, reps: 8)])
        }
        let e = PlannedExercise(id: UUID(), name: "Fekvenyomás", muscle: "chest", type: .compound, sets: planned,
                                warmupCount: 0, workingCount: sets, repMin: 6, repMax: 10, targetRIR: 2, anchorKg: kg)
        return WorkoutSession(TodayWorkout(exercises: [e]), startedAt: now)
    }

    @Test func setPhaseCarriesTheTarget() throws {
        let st = try #require(WorkoutActivityState.state(session(), now: now))
        #expect(st.phase == .set)
        #expect(st.exercise == "Fekvenyomás")
        #expect(st.setIndex == 1 && st.setCount == 3)
        #expect(st.done == 0 && st.total == 3)
        #expect(st.targetKg == 80 && st.targetReps == 8)
        #expect(st.restEndsAt == nil)
        #expect(st.canLogHere)
    }

    @Test func restPhaseCarriesTheRestEndAndTheNextSet() throws {
        var s = session()
        s.log(kg: 80, reps: 8, rir: 2, now: now)
        let st = try #require(WorkoutActivityState.state(s, now: now.addingTimeInterval(5)))
        #expect(st.phase == .rest)
        #expect(st.restEndsAt == s.restEndsAt)
        #expect(st.restTotal == s.restTotal)
        #expect(st.setIndex == 2)
        #expect(st.done == 1)
    }

    @Test func aRestThatRanOutIsTheNextSet() throws {
        var s = session()
        s.log(kg: 80, reps: 8, rir: 2, now: now)
        let st = try #require(WorkoutActivityState.state(s, now: now.addingTimeInterval(3600)))
        #expect(st.phase == .set)
    }

    @Test func theLastSetOfTheExerciseAsksTheQuestionsInTheApp() throws {
        var s = session(sets: 1)
        s.log(kg: 80, reps: 8, rir: 2, now: now)
        let st = try #require(WorkoutActivityState.state(s, now: now))
        #expect(st.phase == .debrief)
        #expect(st.targetKg == nil)
    }

    @Test func aPlannedTechniqueSetIsNotLoggedFromTheCard() throws {
        let st = try #require(WorkoutActivityState.state(session(technique: true), now: now))
        #expect(st.phase == .set)
        #expect(!st.canLogHere)
        var s = session(technique: true)
        #expect(WorkoutLiveActions.apply(.logSet, to: &s, now: now).isEmpty)
        #expect(s.loggedSets.isEmpty)
    }

    @Test func aFinishedSessionShowsNothing() {
        var s = session(sets: 1)
        s.log(kg: 80, reps: 8, rir: 2, now: now)
        s.finishExercise(ExerciseFeedback(), now: now)
        #expect(WorkoutActivityState.state(s, now: now) == nil)
    }

    // MARK: the buttons

    @Test func doneLogsThePrefilledSetAndQueuesTheRoomsWrite() throws {
        var s = session()
        let items = WorkoutLiveActions.apply(.logSet, to: &s, now: now)
        #expect(s.loggedSets.count == 1)
        #expect(s.loggedSets.first?.kg == 80 && s.loggedSets.first?.reps == 8)
        #expect(items.count == 1)
        let item = try #require(items.first)
        let e = try #require(s.current)
        // the same write as the player's own „Kész" queues
        let room = try #require(WorkoutLiveActions.setItem(session: s, exerciseId: e.id, set: s.loggedSets[0],
                                                           date: HeadlessContext.day(of: now, calendar: .current)))
        #expect(item.kind == .workoutSet)
        // same JSON (key order is the encoder's own)
        let a = try JSONSerialization.jsonObject(with: item.payload) as? NSDictionary
        let b = try JSONSerialization.jsonObject(with: room.payload) as? NSDictionary
        #expect(a != nil && a == b)
        #expect(item.groupRef == s.ref)
        // the rest started: the card moves on to it
        #expect(WorkoutActivityState.state(s, now: now)?.phase == .rest)
    }

    @Test func doneDuringARestDoesNothing() {
        var s = session()
        s.log(kg: 80, reps: 8, rir: 2, now: now)
        #expect(WorkoutLiveActions.apply(.logSet, to: &s, now: now.addingTimeInterval(1)).isEmpty)
        #expect(s.loggedSets.count == 1)
    }

    @Test func plusFifteenAddsToTheRunningRestOnly() throws {
        var s = session()
        s.log(kg: 80, reps: 8, rir: 2, now: now)
        let ends = try #require(s.restEndsAt)
        _ = WorkoutLiveActions.apply(.addRest, to: &s, now: now.addingTimeInterval(1))
        #expect(s.restEndsAt == ends.addingTimeInterval(15))
        // after the rest ran out, a late tap does not start a new one
        var late = session()
        late.log(kg: 80, reps: 8, rir: 2, now: now)
        let lateEnds = late.restEndsAt
        _ = WorkoutLiveActions.apply(.addRest, to: &late, now: now.addingTimeInterval(3600))
        #expect(late.restEndsAt == lateEnds)
    }

    @Test func onEndsTheRest() {
        var s = session()
        s.log(kg: 80, reps: 8, rir: 2, now: now)
        _ = WorkoutLiveActions.apply(.skipRest, to: &s, now: now.addingTimeInterval(1))
        #expect(s.restEndsAt == nil)
        #expect(WorkoutActivityState.state(s, now: now.addingTimeInterval(1))?.phase == .set)
    }

    @Test func aKilledAppLogsFromTheWorkoutFile() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("wla-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let file = EdzesStore.sessionFile(in: dir)
        try JSONEncoder().encode(session()).write(to: file)
        let outbox = Outbox(directory: dir.appendingPathComponent("outbox"), sender: NeverSends())
        await WorkoutLiveActions.runOnFile(.logSet, file: file, outbox: outbox, now: now)
        let saved = try JSONDecoder().decode(WorkoutSession.self, from: Data(contentsOf: file))
        #expect(saved.loggedSets.count == 1)
        #expect(await outbox.pending.map(\.kind) == [.workoutSet])
    }
}

private struct NeverSends: OutboxSender {
    func send(_ item: OutboxItem) async -> OutboxSendResult { .offline }
}
