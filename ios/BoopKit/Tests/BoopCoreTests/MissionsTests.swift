import Foundation
import Testing
@testable import BoopCore

/// „Mit vállalsz ma?" — the briefing's missions. The rule they exist to keep is the owner's own: **no invented
/// number ever reaches the app.** A mission is a step the engine actually took, and letting one go takes the
/// exercise back to last week's real numbers, never to a lighter weight nobody computed.
struct MissionsTests {
    let press = UUID(uuidString: "e1e2e3e4-0001-4a2b-9c3d-111122223333")!
    let row = UUID(uuidString: "e1e2e3e4-0002-4a2b-9c3d-111122223333")!

    func exercise(_ id: UUID, _ name: String, lever: ProgressionLever?, deltaKg: Double? = nil,
                  deltaReps: Int? = nil, target: Double = 80, targetReps: Int = 8,
                  last: (Double, Int)? = (77.5, 8)) -> PlannedExercise {
        PlannedExercise(
            id: id, name: name, muscle: "back", type: .compound,
            sets: [PrescribedSet(kind: .working, targetKg: target, targetReps: targetReps, targetRIR: 2),
                   PrescribedSet(kind: .working, targetKg: target, targetReps: targetReps, targetRIR: 2)],
            warmupCount: 0, workingCount: 2, repMin: 6, repMax: 10, targetRIR: 2, anchorKg: target,
            progression: lever.map {
                Progression(lever: $0, deltaKg: deltaKg, deltaReps: deltaReps, targetKg: target,
                            targetReps: targetReps, rationale: "Múlt hét könnyen ment → lépünk.")
            },
            lastWeek: last.map { LastWeekSet(weightKg: $0.0, reps: $0.1, rir: 2) })
    }

    func record(_ name: String, bestKg: Double, bestReps: Int) -> ExerciseRecord {
        ExerciseRecord(name: name, muscle: "back", type: .compound,
                       bestSet: RecordSet(weightKg: bestKg, reps: bestReps, date: "2026-11-10"),
                       totalVolume: 1000, totalSets: 40, totalReps: 320, sessionCount: 10)
    }

    @Test func aWeightStepIsAMission() {
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .weight, deltaKg: 2.5)])
        let missions = trainMissions(day)
        #expect(missions.count == 1)
        #expect(missions.first?.kind == .overload)
        #expect(missions.first?.targetKg == 80)
        #expect(missions.first?.why == "Múlt hét könnyen ment → lépünk.")
    }

    @Test func aRepStepIsAMission() {
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .rep, deltaReps: 1)])
        #expect(trainMissions(day).first?.kind == .reps)
    }

    @Test func aDeloadIsNeverAMission() {
        // The engine deliberately took load off. Dressing that as a challenge is the one lie this room
        // cannot afford.
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .deload, deltaKg: -5)])
        #expect(trainMissions(day).isEmpty)
    }

    @Test func aHoldIsNotAMissionAndNorIsAnExerciseWithNoProgressionAtAll() {
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .hold),
                                           exercise(row, "Evezés", lever: nil)])
        #expect(trainMissions(day).isEmpty)
    }

    @Test func aTargetThatBeatsHisOwnBestIsARecordAttempt() {
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .weight, deltaKg: 2.5, target: 80)])
        let missions = trainMissions(day, records: [record("Fekvenyomás", bestKg: 77.5, bestReps: 8)])
        #expect(missions.first?.kind == .record)
    }

    @Test func withNoRecordsLoadedNothingIsCalledARecordAttempt() {
        // Only his own history can say „ez rekord". With no history, the mission is what the lever says.
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .weight, deltaKg: 2.5)])
        #expect(trainMissions(day).first?.kind == .overload)
    }

    @Test func aTargetUnderHisBestStaysAPlainOverload() {
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .weight, deltaKg: 2.5, target: 80)])
        let missions = trainMissions(day, records: [record("Fekvenyomás", bestKg: 95, bestReps: 8)])
        #expect(missions.first?.kind == .overload)
    }

    // MARK: - Letting one go

    @Test func aReleasedMissionGoesBackToLastWeeksOwnNumbers() {
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .weight, deltaKg: 2.5,
                                                    target: 80, targetReps: 8, last: (77.5, 9))])
        let eased = day.withReleasedMissions([press])
        let working = eased.exercises[0].sets.filter { $0.kind == .working }
        #expect(working.allSatisfy { $0.targetKg == 77.5 && $0.targetReps == 9 })
        // And it is no longer offered as a mission.
        #expect(trainMissions(eased).isEmpty)
    }

    @Test func aReleasedMissionWithNoLastWeekKeepsThePlan() {
        // There is nothing truthful to fall back to, and inventing a lighter weight is exactly what must
        // not happen here.
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .weight, deltaKg: 2.5,
                                                    target: 80, last: nil)])
        let eased = day.withReleasedMissions([press])
        #expect(eased.exercises[0].sets.first?.targetKg == 80)
    }

    @Test func releasingOneLeavesTheOthersAlone() {
        let day = TodayWorkout(exercises: [exercise(press, "Fekvenyomás", lever: .weight, deltaKg: 2.5),
                                           exercise(row, "Evezés", lever: .weight, deltaKg: 2.5)])
        let eased = day.withReleasedMissions([press])
        #expect(trainMissions(eased).map(\.exerciseId) == [row])
    }
}
