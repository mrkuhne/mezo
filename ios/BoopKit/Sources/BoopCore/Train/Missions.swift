import Foundation

// MARK: - „Mit vállalsz ma?" — the day's missions

// The owner asked for the Lágy briefing's mission carousel by name (2026-11-17). It is **not** gamification —
// Boop does not hand out points, and the decision to hide the web app's quests stands. A mission here is one
// thing: **a step the progression engine actually took this session**, named and put in front of him so he can
// take it on or let it go before he picks the bar up.
//
// That is why there is no confidence percentage and no made-up difficulty: the Lágy prototype drew a „72% biztos"
// bar, and the server computes nothing of the sort. What is real is the lever the engine moved, the number it is
// asking for, its own sentence about why, and — when his records are loaded — whether today's target would beat
// anything he has ever done on that exercise.
//
// Letting a mission go is not a refusal to train: the exercise stays, with **last week's numbers** as the target
// (`withReleasedMissions`). A released mission never silently becomes a lighter invented weight.

public enum TrainMissionKind: String, Codable, Sendable {
    /// The engine raised the weight.
    case overload
    /// The engine asked for more reps at the same weight.
    case reps
    /// Today's target would beat his own best on this exercise.
    case record

    public var hungarian: String {
        switch self {
        case .overload: "Túlterhelés"
        case .reps: "Több ismétlés"
        case .record: "Rekordkísérlet"
        }
    }

    /// Gold is the record's alone, everywhere in the room.
    public var glyph: String {
        switch self {
        case .overload: "chart-deep"
        case .reps: "repeat-deep"
        case .record: "medal-sun"
        }
    }
}

/// One mission of the day, built from one exercise's progression. Every field comes from the server.
public struct TrainMission: Identifiable, Equatable, Sendable {
    public var exerciseId: UUID
    public var kind: TrainMissionKind
    public var exerciseName: String
    public var muscle: String
    public var targetKg: Double?
    public var targetReps: Int?
    /// What it was last week — the mission's „mihez képest", and what a released mission falls back to.
    public var fromKg: Double?
    public var fromReps: Int?
    /// The engine's own Hungarian sentence. The app never writes its own version of it.
    public var why: String
    public var photo: String?
    public var id: UUID { exerciseId }

    public init(exerciseId: UUID, kind: TrainMissionKind, exerciseName: String, muscle: String,
                targetKg: Double? = nil, targetReps: Int? = nil, fromKg: Double? = nil, fromReps: Int? = nil,
                why: String, photo: String? = nil) {
        self.exerciseId = exerciseId; self.kind = kind; self.exerciseName = exerciseName; self.muscle = muscle
        self.targetKg = targetKg; self.targetReps = targetReps; self.fromKg = fromKg; self.fromReps = fromReps
        self.why = why; self.photo = photo
    }
}

/// The day's missions, in the plan's own order.
///
/// A **deload is never a mission** — the engine deliberately took load off, and dressing that as a challenge
/// would be the one lie this room cannot afford. A `hold` is not one either: nothing is being asked of him
/// beyond repeating the week.
public func trainMissions(_ workout: TodayWorkout?, records: [ExerciseRecord] = []) -> [TrainMission] {
    guard let workout else { return [] }
    let bestByName = Dictionary(records.map { ($0.name.lowercased(), $0) }, uniquingKeysWith: { a, _ in a })
    return workout.exercises.compactMap { e -> TrainMission? in
        guard let p = e.progression else { return nil }
        let working = e.sets.first { $0.kind == .working }
        let targetKg = p.targetKg ?? working?.targetKg
        let targetReps = p.targetReps ?? working?.targetReps
        var kind: TrainMissionKind
        switch p.lever {
        case .weight where (p.deltaKg ?? 0) > 0: kind = .overload
        case .rep where (p.deltaReps ?? 0) > 0: kind = .reps
        default: return nil
        }
        // A record attempt outranks the lever it was reached by: it is the rarer thing, and the one he will
        // remember. Only his own history can say so, so with no records loaded this never fires.
        if let best = bestByName[e.name.lowercased()]?.bestSet, let targetKg, let bestKg = best.weightKg,
           targetKg > bestKg || (targetKg == bestKg && (targetReps ?? 0) > best.reps) {
            kind = .record
        }
        return TrainMission(exerciseId: e.id, kind: kind, exerciseName: e.name, muscle: e.muscle,
                            targetKg: targetKg, targetReps: targetReps,
                            fromKg: e.lastWeek?.weightKg, fromReps: e.lastWeek?.reps,
                            why: p.rationale, photo: e.imageStartURL)
    }
}

public extension TodayWorkout {
    /// The same day with the released missions taken back to **last week's own numbers**. An exercise whose last
    /// week is unknown keeps the plan: there is nothing truthful to fall back to, and inventing a lighter weight
    /// is exactly what this room must not do.
    func withReleasedMissions(_ released: Set<UUID>) -> TodayWorkout {
        guard !released.isEmpty else { return self }
        var copy = self
        copy.exercises = exercises.map { e in
            guard released.contains(e.id), let last = e.lastWeek else { return e }
            var out = e
            out.sets = e.sets.map { s in
                guard s.kind == .working else { return s }
                var t = s
                t.targetKg = last.weightKg
                t.targetReps = last.reps
                return t
            }
            out.progression = nil
            return out
        }
        return copy
    }
}
