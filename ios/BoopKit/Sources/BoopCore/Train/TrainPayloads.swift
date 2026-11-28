import Foundation

// What a queued training write carries (B5). Every one of them belongs to a workout, and that workout may not
// exist on the server yet — the set he logs in a basement with no signal is queued before the start has landed.
//
// So a queued write never names a server id. It names **`workoutRef`**: the id of the outbox item that started
// the workout, which is also its order group. `TrainClient` resolves that into the server's own workout id at
// send time (the start always goes first in the group, and the server's start is idempotent per template day),
// and no queued payload is ever rewritten.

public enum TrainPayloadCodec {
    public static func encode<T: Encodable>(_ value: T) -> Data {
        let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601
        return (try? e.encode(value)) ?? Data()
    }

    static func decode<T: Decodable>(_ type: T.Type, from data: Data) -> T? {
        let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601
        return try? d.decode(type, from: data)
    }
}

/// Starting (or resuming) the template day's workout. The server is idempotent on the template day: a retry
/// returns the open instance instead of creating a second one.
public struct WorkoutStartPayload: Codable, Equatable, Sendable {
    public var templateSessionId: UUID
    public init(templateSessionId: UUID) { self.templateSessionId = templateSessionId }
}

/// One performed set. `targetWeightKg`/`targetReps` travel with it so the server can score what was asked against
/// what was done even when the plan has since moved on.
public struct WorkoutSetPayload: Codable, Equatable, Sendable {
    public var workoutRef: UUID
    public var exerciseId: UUID
    public var setIndex: Int
    public var weightKg: Double
    public var reps: Int
    public var rir: Int?
    public var side: String?
    public var note: String?
    public var kind: SetKind
    public var targetWeightKg: Double?
    public var targetReps: Int?
    /// The technique's wire value and the steps after the main part (T2). Optional, so a set queued by an older
    /// build still decodes.
    public var technique: String?
    public var legs: [WorkoutLegPayload]?
    public init(workoutRef: UUID, exerciseId: UUID, setIndex: Int, weightKg: Double, reps: Int, rir: Int? = nil,
                side: String? = nil, note: String? = nil, kind: SetKind = .working,
                targetWeightKg: Double? = nil, targetReps: Int? = nil, technique: String? = nil,
                legs: [WorkoutLegPayload]? = nil) {
        self.workoutRef = workoutRef; self.exerciseId = exerciseId; self.setIndex = setIndex
        self.weightKg = weightKg; self.reps = reps; self.rir = rir; self.side = side; self.note = note
        self.kind = kind; self.targetWeightKg = targetWeightKg; self.targetReps = targetReps
        self.technique = technique; self.legs = legs
    }
}

/// One step after a technique set's main part, as it travels in the queue.
public struct WorkoutLegPayload: Codable, Equatable, Sendable {
    public var kind: String
    public var weightKg: Double?
    public var reps: Int?
    public var restSec: Int?
    public init(kind: String, weightKg: Double? = nil, reps: Int? = nil, restSec: Int? = nil) {
        self.kind = kind; self.weightKg = weightKg; self.reps = reps; self.restSec = restSec
    }
    public init(_ leg: LoggedLeg) {
        self.init(kind: leg.kind.rawValue, weightKg: leg.weightKg, reps: leg.reps, restSec: leg.restSec)
    }
}

/// Correcting a set he already logged. The phone rarely knows the server's id for it — the set may still have been
/// in the queue when he corrected it — so it names the set by **exercise and position**, and `TrainClient` resolves
/// the server's id at send time. `setId` is used as-is when given (a set read back from the server).
public struct WorkoutSetEditPayload: Codable, Equatable, Sendable {
    public var workoutRef: UUID
    public var setId: UUID?
    public var exerciseId: UUID?
    public var setIndex: Int?
    public var weightKg: Double
    public var reps: Int
    public var rir: Int?
    public var side: String?
    public var note: String?
    /// `nil` = leave the set's steps as they are on the server.
    public var legs: [WorkoutLegPayload]?
    public init(workoutRef: UUID, setId: UUID? = nil, exerciseId: UUID? = nil, setIndex: Int? = nil,
                weightKg: Double, reps: Int, rir: Int? = nil,
                side: String? = nil, note: String? = nil, legs: [WorkoutLegPayload]? = nil) {
        self.workoutRef = workoutRef; self.setId = setId; self.exerciseId = exerciseId; self.setIndex = setIndex
        self.weightKg = weightKg; self.reps = reps
        self.rir = rir; self.side = side; self.note = note; self.legs = legs
    }
}

public struct WorkoutSkipExercisePayload: Codable, Equatable, Sendable {
    public var workoutRef: UUID
    public var exerciseId: UUID
    public init(workoutRef: UUID, exerciseId: UUID) { self.workoutRef = workoutRef; self.exerciseId = exerciseId }
}

/// The debrief: how each exercise felt. The engine's next week is computed from these, so they are a write, not
/// a nicety, and they queue like everything else.
public struct WorkoutFeedbackPayload: Codable, Equatable, Sendable {
    public struct Item: Codable, Equatable, Sendable {
        public var exerciseId: UUID
        public var pump: Int, jointPain: Int, workload: Int
        public init(exerciseId: UUID, pump: Int, jointPain: Int, workload: Int) {
            self.exerciseId = exerciseId; self.pump = pump; self.jointPain = jointPain; self.workload = workload
        }
    }
    public var workoutRef: UUID
    public var items: [Item]
    public init(workoutRef: UUID, items: [Item]) { self.workoutRef = workoutRef; self.items = items }
}

/// A note. With `exerciseId` it is that exercise's own durable note (it outlives the workout); without one it is
/// this workout's note.
public struct WorkoutNotePayload: Codable, Equatable, Sendable {
    public var workoutRef: UUID
    public var exerciseId: UUID?
    public var note: String?
    public init(workoutRef: UUID, exerciseId: UUID? = nil, note: String?) {
        self.workoutRef = workoutRef; self.exerciseId = exerciseId; self.note = note
    }
}

/// Finishing the session — the explicit finish is what makes the day count as done.
public struct WorkoutFinishPayload: Codable, Equatable, Sendable {
    public var workoutRef: UUID
    public var note: String?
    public init(workoutRef: UUID, note: String? = nil) { self.workoutRef = workoutRef; self.note = note }
}

/// A sport session he logs by hand (volleyball and the rest). It belongs to no workout, so it has no `workoutRef`.
public struct SportSessionPayload: Codable, Equatable, Sendable {
    public var sport: String
    public var date: String
    public var time: String?
    public var durationMinutes: Int
    public var setsPlayed: Int?
    public var rounds: Int?
    public var rpe: Double
    public var shoulderStrain: Int?
    public var notes: String?
    /// The watch's own kcal (the Sport log's pre-fill, `mezo-r36n9.203`); nil = the server estimates. Optional, so a
    /// payload queued by an older build still decodes.
    public var kcalOverride: Int?
    public init(sport: String, date: String, time: String? = nil, durationMinutes: Int, setsPlayed: Int? = nil,
                rounds: Int? = nil, rpe: Double, shoulderStrain: Int? = nil, notes: String? = nil, kcalOverride: Int? = nil) {
        self.sport = sport; self.date = date; self.time = time; self.durationMinutes = durationMinutes
        self.setsPlayed = setsPlayed; self.rounds = rounds; self.rpe = rpe
        self.shoulderStrain = shoulderStrain; self.notes = notes; self.kcalOverride = kcalOverride
    }
}

// MARK: - Building the queued items

public extension OutboxItem {
    /// The start of a workout: its own id is the group every later write of that session names.
    static func workoutStart(_ payload: WorkoutStartPayload, date: String, capturedAt: Date,
                             id: UUID = UUID()) -> OutboxItem {
        OutboxItem(id: id, kind: .workoutStart, date: date, capturedAt: capturedAt,
                   payload: TrainPayloadCodec.encode(payload), groupRef: id)
    }

    /// Any later write of a workout: it waits behind the start and behind the writes queued before it.
    static func workoutWrite(_ kind: OutboxKind, payload: Data, workoutRef: UUID, date: String,
                             capturedAt: Date, id: UUID = UUID()) -> OutboxItem {
        OutboxItem(id: id, kind: kind, date: date, capturedAt: capturedAt, payload: payload, groupRef: workoutRef)
    }
}
