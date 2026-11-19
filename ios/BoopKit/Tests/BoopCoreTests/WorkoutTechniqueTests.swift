import Foundation
import Testing
@testable import BoopCore

/// The technique set and the challenge in the player (mezo-r36n9.84, spec 2026-11-17 §6.4/§6.6/§6.10): the main part
/// first, then the steps the server prescribed, then **one** write carrying the set and its steps.
struct WorkoutTechniqueTests {
    let pulldown = UUID(uuidString: "e1e2e3e4-0001-4a2b-9c3d-111122223333")!
    let curl = UUID(uuidString: "e1e2e3e4-0002-4a2b-9c3d-111122223333")!
    let row = UUID(uuidString: "e1e2e3e4-0003-4a2b-9c3d-111122223333")!

    func straight(_ kg: Double = 60, reps: Int = 10) -> PrescribedSet {
        PrescribedSet(kind: .working, targetKg: kg, targetReps: reps, targetRIR: 2, restSec: 120)
    }

    func exercise(_ id: UUID, _ name: String, last: PrescribedSet, technique: SetTechnique? = nil,
                  challenge: Bool = false, best: Int? = nil) -> PlannedExercise {
        PlannedExercise(id: id, name: name, muscle: "back", type: .compound, sets: [straight(), last],
                        warmupCount: 0, workingCount: 2, repMin: 8, repMax: 12, targetRIR: 2,
                        technique: technique, challenge: challenge, challengeBest: best)
    }

    var restDrop: PrescribedSet {
        PrescribedSet(kind: .working, targetKg: 60, targetReps: 10, targetRIR: 0, restSec: 120, technique: .restDrop,
                      legs: [PrescribedLeg(kind: .drop, weightKg: 42.5, reps: 10, toFailure: false,
                                           restBeforeSec: 30, dropPercent: 30)])
    }

    var myo: PrescribedSet {
        let mini = PrescribedLeg(kind: .mini, weightKg: 30, reps: 4, minReps: 3, toFailure: false, restBeforeSec: 20)
        return PrescribedSet(kind: .working, targetKg: 30, targetReps: 15, targetRIR: 1, technique: .myo,
                             legs: [mini, mini, mini, mini])
    }

    var partials: PrescribedSet {
        PrescribedSet(kind: .working, targetKg: 30, targetReps: 11, targetRIR: 1, technique: .partials,
                      legs: [PrescribedLeg(kind: .partials, toFailure: true, restBeforeSec: 0)])
    }

    func session(_ exercises: [PlannedExercise]) -> WorkoutSession {
        WorkoutSession(TodayWorkout(title: "Hát", exercises: exercises))
    }

    // MARK: - The rest drop, the owner's own variant

    @Test func theTechniqueSetIsNotLoggedWhenItsMainPartIsDone() {
        var s = session([exercise(pulldown, "Lat Pulldown", last: restDrop, technique: .restDrop),
                         exercise(row, "Evezés", last: straight())])
        let t0 = Date()
        _ = s.log(kg: 60, reps: 10, rir: 2, now: t0)
        s.skipRest()
        let step = s.log(kg: 60, reps: 9, rir: 0, now: t0)

        guard case .techniqueRest(let seconds) = step else { Issue.record("expected the 30 s rest, got \(step)"); return }
        #expect(seconds == 30)
        #expect(s.exercises[pulldown]?.logged.count == 1)   // the technique set waits for its steps
        #expect(s.technique?.main.reps == 9)
        #expect(s.technique?.main.technique == .restDrop)
    }

    @Test func afterTheRestTheDropIsLiftedAndTheSetGoesOutWithItsLeg() {
        var s = session([exercise(pulldown, "Lat Pulldown", last: restDrop, technique: .restDrop),
                         exercise(row, "Evezés", last: straight())])
        let t0 = Date()
        _ = s.log(kg: 60, reps: 10, rir: 2, now: t0)
        s.skipRest()
        _ = s.log(kg: 60, reps: 9, rir: 0, now: t0)
        s.skipTechniqueRest()
        #expect(s.step == .leg(.drop))

        let step = s.logLeg(kg: 42.5, reps: 9, now: t0)

        #expect(step == .debrief(exercise: pulldown))
        #expect(s.technique == nil)
        let set = try? #require(s.exercises[pulldown]?.logged.last)
        #expect(set?.technique == .restDrop)
        #expect(set?.kg == 60)                 // the parent row is the main part, exactly as a straight set
        #expect(set?.reps == 9)
        #expect(set?.legs == [LoggedLeg(kind: .drop, weightKg: 42.5, reps: 9, restSec: 30)])
    }

    @Test func theDropIsPrefilledFromWhatHeReallyDid() {
        let leg = restDrop.legs[0]
        // He lifted the plan: the server's snapped weight, and „ugyanannyi" = the reps he really did.
        let asPlanned = WorkoutSession.legDefaults(leg, main: SessionSet(kg: 60, reps: 9), plannedKg: 60)
        #expect(asPlanned.kg == 42.5)
        #expect(asPlanned.reps == 9)
        // He changed the weight: 30 % off what he lifted, down to a real 2.5 kg step.
        let changed = WorkoutSession.legDefaults(leg, main: SessionSet(kg: 55, reps: 10), plannedKg: 60)
        #expect(changed.kg == 37.5)
    }

    @Test func stoppingEarlyStillLogsTheSetWithWhatWasDone() {
        var s = session([exercise(pulldown, "Lat Pulldown", last: restDrop, technique: .restDrop)])
        _ = s.log(kg: 60, reps: 10, rir: 2)
        s.skipRest()
        _ = s.log(kg: 60, reps: 9, rir: 0)
        _ = s.endTechnique()

        let set = s.exercises[pulldown]?.logged.last
        #expect(set?.technique == .restDrop)
        #expect(set?.legs == nil)
        #expect(s.exercises[pulldown]?.isDone == true)
    }

    // MARK: - Myo

    @Test func myoMiniSetsStopWhenOneFallsShort() {
        var s = session([exercise(curl, "Preacher Curl", last: myo, technique: .myo)])
        _ = s.log(kg: 30, reps: 12, rir: 2)
        s.skipRest()
        _ = s.log(kg: 30, reps: 15, rir: 1)
        s.skipTechniqueRest()
        #expect(s.step == .leg(.mini))
        _ = s.logLeg(kg: 30, reps: 4)
        s.skipTechniqueRest()
        let step = s.logLeg(kg: 30, reps: 2)          // below the minimum of 3: the set ends here

        #expect(step == .debrief(exercise: curl))
        #expect(s.exercises[curl]?.logged.last?.legs?.map(\.reps) == [4, 2])
    }

    // MARK: - The challenge

    @Test func theChallengeIsAHalfRepCountWithNoWeight() {
        var s = session([exercise(curl, "Preacher Curl", last: partials, challenge: true, best: 7)])
        _ = s.log(kg: 30, reps: 11, rir: 2)
        s.skipRest()
        let step = s.log(kg: 30, reps: 11, rir: 1)
        #expect(step == .partials)                   // no rest: straight after the last full set

        _ = s.logLeg(kg: 30, reps: 9)
        let e = s.exercises[curl]
        #expect(e?.logged.last?.legs == [LoggedLeg(kind: .partials, weightKg: nil, reps: 9, restSec: nil)])
        #expect(e?.partialsToday == 9)
        #expect(e?.isChallenge == true)
        #expect(e?.challengeBest == 7)
    }

    // MARK: - What must not change

    @Test func aSetAddedInTheGymDoesNotRepeatTheTechnique() {
        var s = session([exercise(pulldown, "Lat Pulldown", last: restDrop, technique: .restDrop)])
        s.addSet(to: pulldown)
        _ = s.log(kg: 60, reps: 10, rir: 2); s.skipRest()
        _ = s.log(kg: 60, reps: 9, rir: 0); _ = s.endTechnique(); s.skipRest()
        let step = s.log(kg: 50, reps: 10, rir: 1)
        #expect(step == .debrief(exercise: pulldown))
        #expect(s.exercises[pulldown]?.logged.last?.technique == nil)
    }

    @Test func skippingMidTechniqueOnTheLastSetFinishesTheExerciseAndAsksTheQuestions() {
        var s = session([exercise(pulldown, "Lat Pulldown", last: restDrop, technique: .restDrop),
                         exercise(row, "Evezés", last: straight())])
        _ = s.log(kg: 60, reps: 10, rir: 2); s.skipRest()
        _ = s.log(kg: 60, reps: 9, rir: 0)
        let step = s.skip(pulldown)
        #expect(step == .debrief(exercise: pulldown))
        #expect(s.exercises[pulldown]?.logged.count == 2)
        #expect(s.exercises[pulldown]?.skipped == false)   // every set exists: it is done, not skipped
        #expect(s.technique == nil)
        #expect(s.currentExerciseId == pulldown)
    }

    @Test func switchingMachinesMidTechniqueAsksTheQuestionsFirst() {
        var s = session([exercise(pulldown, "Lat Pulldown", last: restDrop, technique: .restDrop),
                         exercise(row, "Evezés", last: straight())])
        _ = s.log(kg: 60, reps: 10, rir: 2); s.skipRest()
        _ = s.log(kg: 60, reps: 9, rir: 0)
        let step = s.switchTo(row)
        #expect(step == .debrief(exercise: pulldown))
        #expect(s.currentExerciseId == pulldown)
        #expect(s.step == .debrief(exercise: pulldown))
    }

    @Test func postponingMidTechniqueAsksTheQuestionsFirst() {
        var s = session([exercise(pulldown, "Lat Pulldown", last: restDrop, technique: .restDrop),
                         exercise(row, "Evezés", last: straight())])
        _ = s.log(kg: 60, reps: 10, rir: 2); s.skipRest()
        _ = s.log(kg: 60, reps: 9, rir: 0)
        let step = s.postpone(pulldown)
        #expect(step == .debrief(exercise: pulldown))
        #expect(s.all.first?.id == pulldown)                 // the order did not move
    }

    @Test func aStoredPickWithoutTodaysPrescriptionIsNotLive() {
        // Techniques switched off for the block: the server still echoes the stored pick, but today's sets carry
        // no technique — nothing to show, nothing to play.
        let plain = exercise(curl, "Preacher Curl", last: straight(30, reps: 11), technique: .restDrop,
                             challenge: true, best: 7)
        let s = session([plain])
        #expect(s.exercises[curl]?.liveTechnique == nil)
        #expect(s.exercises[curl]?.liveChallenge == false)
        let live = session([exercise(curl, "Preacher Curl", last: partials, challenge: true, best: 7)])
        #expect(live.exercises[curl]?.liveChallenge == true)
    }

    @Test func theRestIsThePlansOwnOnAStyledBlock() {
        var s = session([exercise(row, "Evezés", last: straight())])
        let step = s.log(kg: 60, reps: 10, rir: 2)
        #expect(step == .rest(seconds: 120))
        #expect(s.restTotal == 120)
    }

    @Test func aSessionSavedMidTechniqueComesBack() throws {
        var s = session([exercise(pulldown, "Lat Pulldown", last: restDrop, technique: .restDrop)])
        _ = s.log(kg: 60, reps: 10, rir: 2); s.skipRest()
        _ = s.log(kg: 60, reps: 9, rir: 0)
        let data = try JSONEncoder().encode(s)
        let back = try JSONDecoder().decode(WorkoutSession.self, from: data)
        #expect(back.technique == s.technique)
    }

    @Test func aPlanCachedBeforeTechniquesStillReads() throws {
        let old = #"{"kind":"working","targetKg":60,"targetReps":10,"targetRIR":2}"#
        let set = try JSONDecoder().decode(PrescribedSet.self, from: Data(old.utf8))
        #expect(set.legs.isEmpty)
        #expect(set.technique == nil)
    }
}
