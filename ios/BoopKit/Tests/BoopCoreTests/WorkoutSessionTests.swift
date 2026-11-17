import Foundation
import Testing
@testable import BoopCore

/// The in-workout model. Its one shape rule comes from the owner's own player design
/// (`IRANY.md` §11b): **the three questions are asked once per exercise, after its last set —
/// never between sets.** Between sets there is only the rest, and the rest shows the verdict
/// of the set just done. Most of what follows is that sentence, made checkable.
struct WorkoutSessionTests {
    let press = UUID(uuidString: "d1d2d3d4-0001-4a2b-9c3d-111122223333")!
    let row = UUID(uuidString: "d1d2d3d4-0002-4a2b-9c3d-111122223333")!

    func exercise(_ id: UUID, _ name: String, muscle: String = "chest", warmups: Int = 1, working: Int = 2,
                  kg: Double? = 80, reps: Int = 8, best: (Double, Int)? = nil) -> PlannedExercise {
        let sets = (0..<warmups).map { _ in PrescribedSet(kind: .warmup, targetKg: kg.map { $0 * 0.6 }, targetReps: 8) }
            + (0..<working).map { _ in PrescribedSet(kind: .working, targetKg: kg, targetReps: reps, targetRIR: 2) }
        return PlannedExercise(id: id, name: name, muscle: muscle, type: .compound, sets: sets,
                               warmupCount: warmups, workingCount: working, repMin: 6, repMax: 10,
                               targetRIR: 2, anchorKg: kg,
                               lastWeek: best.map { LastWeekSet(weightKg: $0.0, reps: $0.1, rir: 2) })
    }

    func session(_ exercises: [PlannedExercise], open: WorkoutInstance? = nil) -> WorkoutSession {
        WorkoutSession(TodayWorkout(title: "Pull Day", exercises: exercises, open: open))
    }

    // MARK: - The shape of a set

    @Test func itStartsOnTheFirstSetOfTheFirstExercise() {
        let s = session([exercise(press, "Fekvenyomás"), exercise(row, "Evezés")])
        #expect(s.currentExerciseId == press)
        #expect(s.currentSetIndex == 0)
        #expect(s.step == .set)
        #expect(s.progress == (done: 0, total: 6))
    }

    @Test func aSetThatIsNotTheLastGoesToRest() {
        var s = session([exercise(press, "Fekvenyomás", warmups: 1, working: 2)])
        let step = s.log(kg: 50, reps: 8, rir: 3)
        guard case .rest(let seconds) = step else { Issue.record("expected a rest, got \(step)"); return }
        #expect(seconds == WorkoutSession.restSeconds)
        #expect(s.currentSetIndex == 1)
        #expect(s.progress.done == 1)
    }

    @Test func theLastSetOfAnExerciseGoesToTheDebriefNotToARest() {
        // The rule the owner asked for by name: the questions come once, after the last set,
        // and a rest never stands between the set and them.
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 2), exercise(row, "Evezés")])
        _ = s.log(kg: 80, reps: 8, rir: 2)
        let step = s.log(kg: 80, reps: 8, rir: 1)
        #expect(step == .debrief(exercise: press))
        #expect(s.step == .debrief(exercise: press))
    }

    @Test func theDebriefIsAskedOncePerExercise() {
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 1), exercise(row, "Evezés")])
        _ = s.log(kg: 80, reps: 8, rir: 2)
        _ = s.finishExercise(ExerciseFeedback(pump: 3, jointPain: 0, workload: 1))
        #expect(s.exercises[press]?.feedback?.pump == 3)
        #expect(s.currentExerciseId == row)
        // And it is not asked again for the same exercise.
        #expect(s.step != .debrief(exercise: press))
    }

    @Test func theRestRunsBehindTheDebriefUntilTheLastExercise() {
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 1), exercise(row, "Evezés")])
        _ = s.log(kg: 80, reps: 8, rir: 2)
        // There is a next exercise, so the clock is already running while he answers.
        let next = s.finishExercise(ExerciseFeedback())
        guard case .rest = next else { Issue.record("expected the rest to be running, got \(next)"); return }
    }

    @Test func theLastExercisesDebriefFinishesTheWorkout() {
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 1)])
        _ = s.log(kg: 80, reps: 8, rir: 2)
        #expect(s.finishExercise(ExerciseFeedback()) == .finish)
        #expect(s.isComplete)
        #expect(s.step == .finish)
    }

    // MARK: - The verdict on the rest screen

    @Test func beatingHisOwnBestIsARecord() {
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 2, kg: 80, reps: 8, best: (77.5, 8))])
        _ = s.log(kg: 80, reps: 8, rir: 1)
        #expect(s.exercises[press]?.logged.first?.verdict == .record)
    }

    @Test func theOtherThreeVerdictsReadAgainstTodaysTarget() {
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 3, kg: 80, reps: 8, best: (200, 20))])
        _ = s.log(kg: 80, reps: 9, rir: 0)
        _ = s.log(kg: 80, reps: 8, rir: 2)
        _ = s.log(kg: 80, reps: 6, rir: 3)
        let verdicts = s.exercises[press]?.logged.map(\.verdict)
        #expect(verdicts == [.above, .onTarget, .below])
    }

    @Test func withNoTargetNothingIsJudged() {
        // The engine prescribed no reps: the app does not invent a target to measure him by.
        let bare = PlannedExercise(id: press, name: "Fekvenyomás", muscle: "chest", type: .compound,
                                   sets: [PrescribedSet(kind: .working)], warmupCount: 0, workingCount: 1,
                                   repMin: 6, repMax: 10, targetRIR: 2)
        var s = session([bare])
        _ = s.log(kg: nil, reps: 5, rir: nil)
        #expect(s.exercises[press]?.logged.first?.verdict == .onTarget)
    }

    // MARK: - What he can do in the gym

    @Test func addingAndDroppingSetsNeverGoesBelowWhatHeHasDone() {
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 2)])
        s.addSet(to: press)
        #expect(s.exercises[press]?.setCount == 3)
        s.dropSet(from: press)
        s.dropSet(from: press)
        #expect(s.exercises[press]?.setCount == 1)
        _ = s.log(kg: 80, reps: 8, rir: 2)
        // One set logged and one set planned: dropping again would erase a set he did.
        s.dropSet(from: press)
        #expect(s.exercises[press]?.setCount == 1)
    }

    @Test func aMistypedSetCanBeCorrected() {
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 2, kg: 80, reps: 8)])
        _ = s.log(kg: 8, reps: 8, rir: 2)         // 8 kg instead of 80
        let setId = try! #require(s.exercises[press]?.logged.first?.id)
        s.edit(setId: setId, kg: 80, reps: 8, rir: 2)
        #expect(s.exercises[press]?.logged.first?.kg == 80)
        #expect(s.exercises[press]?.logged.first?.verdict == .onTarget)
    }

    @Test func skippingTheCurrentExerciseMovesOnAndKeepsItInTheList() {
        var s = session([exercise(press, "Fekvenyomás"), exercise(row, "Evezés")])
        let step = s.skip(press)
        #expect(s.currentExerciseId == row)
        #expect(s.exercises[press]?.skipped == true)   // greyed, not deleted
        #expect(s.all.count == 2)
        #expect(step == .set)
        // And a skipped exercise is out of the count: 14 / 16 must not include what he dropped.
        #expect(s.progress.total == 3)
    }

    @Test func skippingTheLastRemainingExerciseFinishes() {
        var s = session([exercise(press, "Fekvenyomás")])
        #expect(s.skip(press) == .finish)
        #expect(s.isComplete)
    }

    @Test func doingItLaterMovesItToTheEnd() {
        let third = UUID()
        var s = session([exercise(press, "Fekvenyomás"), exercise(row, "Evezés"), exercise(third, "Fejemelés")])
        s.postpone(press)
        #expect(s.all.map(\.id) == [row, third, press])
        #expect(s.currentExerciseId == row)
    }

    @Test func swappingKeepsThePlaceThePlanAndWhatWasLogged() {
        let replacement = UUID()
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 3), exercise(row, "Evezés")])
        _ = s.log(kg: 80, reps: 8, rir: 2)
        s.swap(press, forId: replacement, name: "Tolódzkodás", muscle: "chest")

        #expect(s.all.map(\.id) == [replacement, row])      // same place in the order
        #expect(s.exercises[replacement]?.setCount == 3)    // same set plan
        #expect(s.exercises[replacement]?.logged.count == 1) // he did that set, whatever it is called now
        #expect(s.currentExerciseId == replacement)
    }

    // MARK: - Surviving the phone

    @Test func itRestoresMidSession() {
        // The player must come back after a lock, a crash or a relaunch: a session he cannot
        // get back is worse than one he never started.
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 3), exercise(row, "Evezés")])
        _ = s.log(kg: 80, reps: 8, rir: 2)
        _ = s.log(kg: 80, reps: 7, rir: 1)

        let data = try! JSONEncoder().encode(s)
        let back = try! JSONDecoder().decode(WorkoutSession.self, from: data)

        #expect(back == s)
        #expect(back.currentExerciseId == press)
        #expect(back.currentSetIndex == 2)
        #expect(back.progress == s.progress)
    }

    @Test func aWorkoutAlreadyOpenOnTheServerContinues() {
        // He started on the phone, the app was killed, the server has two sets: reopening the
        // player continues from there rather than starting the day again.
        let logged = [
            LoggedSet(id: UUID(), exerciseId: press, setIndex: 0, kind: .working, weightKg: 80, reps: 8, rir: 2),
            LoggedSet(id: UUID(), exerciseId: press, setIndex: 1, kind: .working, weightKg: 80, reps: 7, rir: 1),
        ]
        let open = WorkoutInstance(id: UUID(), date: "2026-11-17", status: .active, sets: logged)
        let s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 3), exercise(row, "Evezés")], open: open)

        #expect(s.currentExerciseId == press)
        #expect(s.currentSetIndex == 2)
        #expect(s.progress.done == 2)
    }

    @Test func theRestSurvivesARelaunchAsAnInstant() {
        // Stored as the moment it ends, not as "60 seconds left" — otherwise the timer would
        // restart at full every time the player comes back.
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 2)])
        _ = s.log(kg: 80, reps: 8, rir: 2)
        let data = try! JSONEncoder().encode(s)
        let back = try! JSONDecoder().decode(WorkoutSession.self, from: data)
        guard case .rest(let seconds) = back.step else { Issue.record("expected a rest"); return }
        #expect(seconds <= WorkoutSession.restSeconds && seconds > WorkoutSession.restSeconds - 5)
    }

    @Test func plusThirtySecondsAndSkippingTheRest() {
        var s = session([exercise(press, "Fekvenyomás", warmups: 0, working: 2)])
        _ = s.log(kg: 80, reps: 8, rir: 2)
        s.addRest(30)
        guard case .rest(let longer) = s.step else { Issue.record("expected a rest"); return }
        #expect(longer > WorkoutSession.restSeconds)
        s.skipRest()
        #expect(s.step == .set)
    }
}

/// Round 4's two additions to the session: doing another exercise now, and the swap the **server** performs.
struct WorkoutSessionOrderTests {
    let a = UUID(uuidString: "f1f2f3f4-0001-4a2b-9c3d-111122223333")!
    let b = UUID(uuidString: "f1f2f3f4-0002-4a2b-9c3d-111122223333")!
    let c = UUID(uuidString: "f1f2f3f4-0003-4a2b-9c3d-111122223333")!

    func exercise(_ id: UUID, _ name: String) -> PlannedExercise {
        PlannedExercise(id: id, name: name, muscle: "back", type: .compound,
                        sets: [PrescribedSet(kind: .working, targetKg: 80, targetReps: 8),
                               PrescribedSet(kind: .working, targetKg: 80, targetReps: 8)],
                        warmupCount: 0, workingCount: 2, repMin: 6, repMax: 10, targetRIR: 2)
    }

    func session() -> WorkoutSession {
        WorkoutSession(TodayWorkout(title: "Pull", exercises: [exercise(a, "A"), exercise(b, "B"), exercise(c, "C")]))
    }

    @Test func switchingToAnotherExerciseLeavesThePlansOrderAlone() {
        // The machine is taken: he does C now. The list does not get rearranged — when C is done the session
        // goes back to the first unfinished one after it, as it always would.
        var s = session()
        _ = s.log(kg: 80, reps: 8, rir: 2)        // one set on A
        #expect(s.switchTo(c) == .set)
        #expect(s.currentExerciseId == c)
        #expect(s.all.map(\.id) == [a, b, c])
        #expect(s.exercises[a]?.logged.count == 1)   // what he did on A stays on A
        #expect(s.currentSetIndex == 0)
    }

    @Test func switchingClearsTheRestBecauseWalkingToAnotherMachineIsTheRest() {
        var s = session()
        _ = s.log(kg: 80, reps: 8, rir: 2)
        guard case .rest = s.step else { Issue.record("expected a rest"); return }
        _ = s.switchTo(c)
        #expect(s.step == .set)
    }

    @Test func aFinishedOrSkippedExerciseCannotBeJumpedTo() {
        var s = session()
        s.skip(b)
        _ = s.switchTo(b)
        #expect(s.currentExerciseId == a)
    }

    @Test func theServersSwapKeepsThePlaceAndTheSetsButTakesTheNewPlan() {
        let replacement = UUID()
        var s = session()
        _ = s.log(kg: 80, reps: 8, rir: 2)
        let fresh = PlannedExercise(id: replacement, name: "Lat Pulldown", muscle: "back-wide", type: .compound,
                                    sets: [PrescribedSet(kind: .working, targetKg: 60, targetReps: 12),
                                           PrescribedSet(kind: .working, targetKg: 60, targetReps: 12),
                                           PrescribedSet(kind: .working, targetKg: 60, targetReps: 12)],
                                    warmupCount: 0, workingCount: 3, repMin: 10, repMax: 14, targetRIR: 2,
                                    lastWeek: LastWeekSet(weightKg: 57.5, reps: 12, rir: 2))
        s.swap(a, for: fresh)

        #expect(s.all.map(\.id) == [replacement, b, c])
        #expect(s.currentExerciseId == replacement)
        #expect(s.exercises[replacement]?.logged.count == 1)       // he did that set, whatever it is called now
        #expect(s.exercises[replacement]?.setCount == 3)           // the replacement's own set plan
        #expect(s.exercises[replacement]?.plan(at: 0)?.targetKg == 60)
        #expect(s.exercises[replacement]?.bestKg == 57.5)
        #expect(s.exercises[a] == nil)
    }
}

/// The rest screen's own question: **which set was just done?** Getting this wrong left the player with
/// nothing on screen after the three questions — a black screen he could not get out of.
struct WorkoutSessionLastLoggedTests {
    let a = UUID(uuidString: "a9a9a9a9-0001-4a2b-9c3d-111122223333")!
    let b = UUID(uuidString: "a9a9a9a9-0002-4a2b-9c3d-111122223333")!

    func exercise(_ id: UUID, _ name: String, sets: Int) -> PlannedExercise {
        PlannedExercise(id: id, name: name, muscle: "back", type: .compound,
                        sets: (0..<sets).map { _ in PrescribedSet(kind: .working, targetKg: 80, targetReps: 8) },
                        warmupCount: 0, workingCount: sets, repMin: 6, repMax: 10, targetRIR: 2)
    }

    @Test func nothingLoggedYetMeansNoLastSet() {
        let s = WorkoutSession(TodayWorkout(exercises: [exercise(a, "A", sets: 2)]))
        #expect(s.lastLogged == nil)
    }

    @Test func afterTheQuestionsTheRestStillKnowsTheSetItIsAbout() {
        // A has one set; logging it goes to the debrief, and answering moves to B — while the rest runs on.
        // At that moment the CURRENT exercise has no logged set, so the rest screen must read the session's
        // last set, not the current exercise's.
        var s = WorkoutSession(TodayWorkout(exercises: [exercise(a, "A", sets: 1), exercise(b, "B", sets: 2)]))
        _ = s.log(kg: 80, reps: 9, rir: 1)
        #expect(s.step == .debrief(exercise: a))
        let next = s.finishExercise(ExerciseFeedback())
        guard case .rest = next else { Issue.record("expected the rest to be running, got \(next)"); return }

        #expect(s.currentExerciseId == b)
        #expect(s.exercises[b]?.logged.isEmpty == true)     // the current exercise has nothing yet
        let done = try! #require(s.lastLogged)
        #expect(done.exercise.id == a)
        #expect(done.set.reps == 9)
    }

    @Test func theLastSetIsTheLatestOneAnywhereNotTheLastInTheOrder() {
        var s = WorkoutSession(TodayWorkout(exercises: [exercise(a, "A", sets: 2), exercise(b, "B", sets: 2)]))
        _ = s.log(kg: 80, reps: 8, rir: 2)          // A, set 1
        s.skipRest()
        _ = s.switchTo(b)
        _ = s.log(kg: 60, reps: 12, rir: 1)         // B, set 1 — later in time, earlier in nothing
        #expect(s.lastLogged?.exercise.id == b)
        #expect(s.lastLogged?.set.reps == 12)
    }
}
