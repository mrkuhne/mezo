import Foundation

// Swift mirrors of the server's training models (Boop B5 "Edzés"). Plain value types: the UI never touches the
// generated `Components.Schemas`. Two rules hold throughout, and the room's honesty depends on them:
//
//   1. **An absent server value stays `nil`, never 0.** A missing anchor weight is "we do not know yet", and a
//      0 kg target would be a lie the player would print in large type.
//   2. **Wire enums read leniently** — a value the server adds later degrades to a known case instead of failing
//      the whole decode, so one new exercise type never empties the room.
//
// They are `Codable` because `ServerCache` stores them verbatim as the last-known-good read.

/// A set's place in the exercise: the warmups that come first, then the working sets that count as volume.
public enum SetKind: String, Codable, Equatable, Sendable {
    case warmup, working
    public init(wire: String?) { self = SetKind(rawValue: (wire ?? "").lowercased()) ?? .working }
}

public enum ExerciseType: String, Codable, Equatable, Sendable {
    case compound, isolation, plyo
    public init(wire: String?) { self = ExerciseType(rawValue: (wire ?? "").lowercased()) ?? .compound }
}

/// One target the engine prescribes for one set. Every number is optional on purpose: on a first session the
/// server knows the rep range but no weight at all.
public struct PrescribedSet: Codable, Equatable, Sendable {
    public var kind: SetKind
    public var targetKg: Double?
    public var targetReps: Int?
    public var targetRIR: Int?
    /// The rest after this set, in seconds — only a block with a training style prescribes one (T1).
    public var restSec: Int?
    /// The intensity technique on this set (T2) — only ever the last working set; `nil` = straight set.
    public var technique: SetTechnique?
    /// Seconds at the top of every rep for a `top_pause` set; absent in older caches.
    public var topHoldSec: Int?
    /// What comes after the main part of a technique set, in order. Empty on a straight set.
    public var legs: [PrescribedLeg]

    public init(kind: SetKind, targetKg: Double? = nil, targetReps: Int? = nil, targetRIR: Int? = nil,
                restSec: Int? = nil, technique: SetTechnique? = nil, topHoldSec: Int? = nil,
                legs: [PrescribedLeg] = []) {
        self.kind = kind; self.targetKg = targetKg; self.targetReps = targetReps; self.targetRIR = targetRIR
        self.restSec = restSec; self.technique = technique == SetTechnique.none ? nil : technique
        self.topHoldSec = topHoldSec; self.legs = legs
    }

    /// A technique set the player walks through step by step: a technique **and** something after the main part.
    public var isTechnique: Bool { technique != nil && !legs.isEmpty }

    enum CodingKeys: String, CodingKey { case kind, targetKg, targetReps, targetRIR, restSec, technique, topHoldSec, legs }

    // Written by hand so a cached plan from before T2 (no `legs` key) still reads.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = try c.decode(SetKind.self, forKey: .kind)
        targetKg = try c.decodeIfPresent(Double.self, forKey: .targetKg)
        targetReps = try c.decodeIfPresent(Int.self, forKey: .targetReps)
        targetRIR = try c.decodeIfPresent(Int.self, forKey: .targetRIR)
        restSec = try c.decodeIfPresent(Int.self, forKey: .restSec)
        technique = try c.decodeIfPresent(SetTechnique.self, forKey: .technique)
        topHoldSec = try c.decodeIfPresent(Int.self, forKey: .topHoldSec)
        legs = try c.decodeIfPresent([PrescribedLeg].self, forKey: .legs) ?? []
    }
}

/// What one step after a technique set's main part is: the lighter weight of a drop, a myo mini-set, or the half
/// reps of the challenge.
public enum LegKind: String, Codable, Equatable, Sendable {
    case drop, mini, partials
    public init(wire: String?) { self = LegKind(rawValue: (wire ?? "").lowercased()) ?? .drop }
}

/// One prescribed step after the main part (T2 `PrescribedLeg`). Every number is optional: the server may know
/// the drop percent but not a real weight to snap it to.
public struct PrescribedLeg: Codable, Equatable, Sendable {
    public var kind: LegKind
    public var weightKg: Double?
    public var reps: Int?
    /// Myo: the mini-sets stop when one falls below this.
    public var minReps: Int?
    public var toFailure: Bool
    public var restBeforeSec: Int
    /// A drop's load as a percent off the main part's weight.
    public var dropPercent: Int?
    public init(kind: LegKind, weightKg: Double? = nil, reps: Int? = nil, minReps: Int? = nil,
                toFailure: Bool = false, restBeforeSec: Int = 0, dropPercent: Int? = nil) {
        self.kind = kind; self.weightKg = weightKg; self.reps = reps; self.minReps = minReps
        self.toFailure = toFailure; self.restBeforeSec = restBeforeSec; self.dropPercent = dropPercent
    }
}

/// One performed step after the main part, as it is logged (T2 `SetLeg`).
public struct LoggedLeg: Codable, Equatable, Sendable {
    public var kind: LegKind
    public var weightKg: Double?
    public var reps: Int?
    public var restSec: Int?
    public init(kind: LegKind, weightKg: Double? = nil, reps: Int? = nil, restSec: Int? = nil) {
        self.kind = kind; self.weightKg = weightKg; self.reps = reps; self.restSec = restSec
    }
}

/// What the same exercise did last week — the one comparison the player shows under the current set.
public struct LastWeekSet: Codable, Equatable, Sendable {
    public var weightKg: Double, reps: Int, rir: Int
    public init(weightKg: Double, reps: Int, rir: Int) { self.weightKg = weightKg; self.reps = reps; self.rir = rir }
}

/// Which lever the engine moved. `deload` is a deliberate back-off and **must never be shown as progress**
/// (the server's own `OverloadSummary` keeps load reductions apart from increases for the same reason).
public enum ProgressionLever: String, Codable, Equatable, Sendable {
    case weight, rep, hold, deload
    public init(wire: String?) { self = ProgressionLever(rawValue: (wire ?? "").lowercased()) ?? .hold }
}

/// The engine's recommendation for one exercise, with the sentence it wrote for it. `rationale` is the server's
/// own Hungarian text — the room never writes its own version of it.
public struct Progression: Codable, Equatable, Sendable {
    public var lever: ProgressionLever
    public var deltaKg: Double?
    public var deltaReps: Int?
    public var targetKg: Double?
    public var targetReps: Int?
    public var rationale: String
    public init(lever: ProgressionLever, deltaKg: Double? = nil, deltaReps: Int? = nil,
                targetKg: Double? = nil, targetReps: Int? = nil, rationale: String) {
        self.lever = lever; self.deltaKg = deltaKg; self.deltaReps = deltaReps
        self.targetKg = targetKg; self.targetReps = targetReps; self.rationale = rationale
    }
}

/// One exercise of today's plan, with its sets already resolved: the engine's per-set targets when it has them,
/// otherwise the plain warmup/working counts with **no weights at all**.
public struct PlannedExercise: Codable, Equatable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    public var muscle: String
    public var type: ExerciseType
    /// The resolved sets — **working and technique sets only**. The server still prescribes warm-ups, but the app
    /// never shows them (owner, 2026-11-25: „az nem számít és csak összezavar"), so they are dropped right here,
    /// on the way in from the wire and from the cache alike, and nothing downstream ever meets one.
    public var sets: [PrescribedSet]
    /// The server's warm-up count, kept only so a write (a swap) hands it back unchanged — never shown.
    public var warmupCount: Int
    public var workingCount: Int
    public var repMin: Int
    public var repMax: Int
    public var targetRIR: Int
    /// The weight the plan is anchored to; `nil` on a first session — never 0.
    public var anchorKg: Double?
    public var rationale: String?
    public var progression: Progression?
    public var lastWeek: LastWeekSet?
    /// The owner's own durable note on this exercise.
    public var note: String?
    public var warning: String?
    public var videoURL: String?
    public var imageStartURL: String?
    public var imageEndURL: String?
    /// Set when this row was swapped in during the open workout, and what it replaced / was replaced by.
    public var replacesName: String?
    public var replacedByName: String?
    /// Whether a „Mezociklusra is" change may target this row at all.
    public var planSlot: Bool
    /// The technique on the exercise's last working set (T2/T3); `nil` = straight sets.
    public var technique: SetTechnique?
    /// Today's challenge exercise: half reps after the last full set (T3).
    public var challenge: Bool
    /// The half-rep count to beat at the challenge set's weight; `nil` when there is none yet.
    public var challengeBest: Int?

    public init(id: UUID, name: String, muscle: String, type: ExerciseType, sets: [PrescribedSet],
                warmupCount: Int, workingCount: Int, repMin: Int, repMax: Int, targetRIR: Int,
                anchorKg: Double? = nil, rationale: String? = nil, progression: Progression? = nil,
                lastWeek: LastWeekSet? = nil, note: String? = nil, warning: String? = nil,
                videoURL: String? = nil, imageStartURL: String? = nil, imageEndURL: String? = nil,
                replacesName: String? = nil, replacedByName: String? = nil, planSlot: Bool = true,
                technique: SetTechnique? = nil, challenge: Bool = false, challengeBest: Int? = nil) {
        self.id = id; self.name = name; self.muscle = muscle; self.type = type
        self.sets = sets.filter { $0.kind != .warmup }
        self.warmupCount = warmupCount; self.workingCount = workingCount
        self.repMin = repMin; self.repMax = repMax; self.targetRIR = targetRIR
        self.anchorKg = anchorKg; self.rationale = rationale; self.progression = progression
        self.lastWeek = lastWeek; self.note = note; self.warning = warning
        self.videoURL = videoURL; self.imageStartURL = imageStartURL; self.imageEndURL = imageEndURL
        self.replacesName = replacesName; self.replacedByName = replacedByName; self.planSlot = planSlot
        self.technique = technique == SetTechnique.none ? nil : technique
        self.challenge = challenge; self.challengeBest = challengeBest
    }

    enum CodingKeys: String, CodingKey {
        case id, name, muscle, type, sets, warmupCount, workingCount, repMin, repMax, targetRIR, anchorKg, rationale
        case progression, lastWeek, note, warning, videoURL, imageStartURL, imageEndURL, replacesName, replacedByName
        case planSlot, technique, challenge, challengeBest
    }

    // Written by hand so a plan cached before T2 (no `challenge` key) still reads.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try c.decode(UUID.self, forKey: .id), name: try c.decode(String.self, forKey: .name),
            muscle: try c.decode(String.self, forKey: .muscle), type: try c.decode(ExerciseType.self, forKey: .type),
            sets: try c.decode([PrescribedSet].self, forKey: .sets),
            warmupCount: try c.decode(Int.self, forKey: .warmupCount),
            workingCount: try c.decode(Int.self, forKey: .workingCount),
            repMin: try c.decode(Int.self, forKey: .repMin), repMax: try c.decode(Int.self, forKey: .repMax),
            targetRIR: try c.decode(Int.self, forKey: .targetRIR),
            anchorKg: try c.decodeIfPresent(Double.self, forKey: .anchorKg),
            rationale: try c.decodeIfPresent(String.self, forKey: .rationale),
            progression: try c.decodeIfPresent(Progression.self, forKey: .progression),
            lastWeek: try c.decodeIfPresent(LastWeekSet.self, forKey: .lastWeek),
            note: try c.decodeIfPresent(String.self, forKey: .note),
            warning: try c.decodeIfPresent(String.self, forKey: .warning),
            videoURL: try c.decodeIfPresent(String.self, forKey: .videoURL),
            imageStartURL: try c.decodeIfPresent(String.self, forKey: .imageStartURL),
            imageEndURL: try c.decodeIfPresent(String.self, forKey: .imageEndURL),
            replacesName: try c.decodeIfPresent(String.self, forKey: .replacesName),
            replacedByName: try c.decodeIfPresent(String.self, forKey: .replacedByName),
            planSlot: try c.decodeIfPresent(Bool.self, forKey: .planSlot) ?? true,
            technique: try c.decodeIfPresent(SetTechnique.self, forKey: .technique),
            challenge: try c.decodeIfPresent(Bool.self, forKey: .challenge) ?? false,
            challengeBest: try c.decodeIfPresent(Int.self, forKey: .challengeBest))
    }
}

/// A set that has actually been performed. `weightKg`/`reps` are optional because a skipped set has neither.
public struct LoggedSet: Codable, Equatable, Sendable, Identifiable {
    public var id: UUID
    public var exerciseId: UUID
    public var setIndex: Int
    public var kind: SetKind
    public var weightKg: Double?
    public var reps: Int?
    public var rir: Int?
    public var side: String?
    public var note: String?
    public var skipped: Bool
    public var doneAt: Date?
    /// The technique it was done with, and the steps after its main part (T2).
    public var technique: SetTechnique?
    public var legs: [LoggedLeg]?
    public init(id: UUID, exerciseId: UUID, setIndex: Int, kind: SetKind = .working, weightKg: Double? = nil,
                reps: Int? = nil, rir: Int? = nil, side: String? = nil, note: String? = nil,
                skipped: Bool = false, doneAt: Date? = nil, technique: SetTechnique? = nil,
                legs: [LoggedLeg]? = nil) {
        self.id = id; self.exerciseId = exerciseId; self.setIndex = setIndex; self.kind = kind
        self.weightKg = weightKg; self.reps = reps; self.rir = rir; self.side = side
        self.note = note; self.skipped = skipped; self.doneAt = doneAt
        self.technique = technique == SetTechnique.none ? nil : technique; self.legs = legs
    }
}

public enum WorkoutStatus: String, Codable, Equatable, Sendable {
    case planned, active, completed, skipped
    public init(wire: String?) { self = WorkoutStatus(rawValue: (wire ?? "").lowercased()) ?? .planned }
}

/// A workout instance: the one that is open right now, or the one already finished today.
public struct WorkoutInstance: Codable, Equatable, Sendable, Identifiable {
    public var id: UUID
    public var templateSessionId: UUID?
    /// `yyyy-MM-dd` in the device's own calendar, as the server wrote it.
    public var date: String
    public var status: WorkoutStatus
    public var sets: [LoggedSet]
    public var startedAt: Date?
    /// Absent on an auto-closed session even though it counts as completed — that pair means "the timing here is
    /// not trustworthy", and the room says so rather than printing a made-up duration.
    public var finishedAt: Date?
    public var activeSeconds: Int?
    /// The session's kcal — only on a finished workout, and only when the server knows one.
    public var energy: WorkoutEnergy?
    public init(id: UUID, templateSessionId: UUID? = nil, date: String, status: WorkoutStatus,
                sets: [LoggedSet] = [], startedAt: Date? = nil, finishedAt: Date? = nil, activeSeconds: Int? = nil,
                energy: WorkoutEnergy? = nil) {
        self.id = id; self.templateSessionId = templateSessionId; self.date = date; self.status = status
        self.sets = sets; self.startedAt = startedAt; self.finishedAt = finishedAt; self.activeSeconds = activeSeconds
        self.energy = energy
    }
}

/// What a finished workout burned (owner, 2026-11-25: „becslés, utána óra"): the server's estimate from the work
/// time right away, the watch's own figure once a matching workout from the watch has synced.
public struct WorkoutEnergy: Codable, Equatable, Sendable {
    public enum Source: String, Codable, Equatable, Sendable { case estimate, watch }
    public var kcal: Int
    public var source: Source
    public init(kcal: Int, source: Source) { self.kcal = kcal; self.source = source }
}

/// How many exercises move by each lever today. Load **reductions** are counted apart and are not overload.
public struct OverloadSummary: Codable, Equatable, Sendable {
    public var weightUp: Int, weightDown: Int, repUp: Int, hold: Int
    public init(weightUp: Int, weightDown: Int, repUp: Int, hold: Int) {
        self.weightUp = weightUp; self.weightDown = weightDown; self.repUp = repUp; self.hold = hold
    }
}

/// Kímélő mód: today's session is deliberately lightened — the Nth session of a comeback ramp, or a protected day
/// he chose to train anyway with the lightening kept.
public struct ComebackState: Codable, Equatable, Sendable {
    public enum Mode: String, Codable, Equatable, Sendable {
        case ramp = "RAMP", released = "RELEASED"
        public init(wire: String?) { self = Mode(rawValue: (wire ?? "").uppercased()) ?? .ramp }
    }
    public var index: Int, total: Int
    public var mode: Mode
    public init(index: Int, total: Int, mode: Mode) { self.index = index; self.total = total; self.mode = mode }
}

/// Everything the Ma tab needs about today. All of `templateSessionId`, `title` and `exercises` are absent on a
/// rest day or with no running block — that is a real state the room shows, not an error.
public struct TodayWorkout: Codable, Equatable, Sendable {
    public var templateSessionId: UUID?
    /// „Hét"…„Vas" — the template day's own label.
    public var dayLabel: String?
    /// The day type, e.g. „Pull Day".
    public var title: String?
    public var durationEst: Int?
    public var exercises: [PlannedExercise]
    public var open: WorkoutInstance?
    public var completed: WorkoutInstance?
    /// Dates of this Mon–Sun week that have a finished gym workout.
    public var weekDoneDates: [String]
    public var overload: OverloadSummary?
    public var comeback: ComebackState?

    public init(templateSessionId: UUID? = nil, dayLabel: String? = nil, title: String? = nil,
                durationEst: Int? = nil, exercises: [PlannedExercise] = [], open: WorkoutInstance? = nil,
                completed: WorkoutInstance? = nil, weekDoneDates: [String] = [],
                overload: OverloadSummary? = nil, comeback: ComebackState? = nil) {
        self.templateSessionId = templateSessionId; self.dayLabel = dayLabel; self.title = title
        self.durationEst = durationEst; self.exercises = exercises; self.open = open
        self.completed = completed; self.weekDoneDates = weekDoneDates
        self.overload = overload; self.comeback = comeback
    }

    /// True when there is nothing planned for today at all (rest day, or no running block).
    public var isRestDay: Bool { templateSessionId == nil && exercises.isEmpty }
}

// MARK: - The block (Blokk tab)

/// A week's place on the volume curve. `Deload` is a planned light week, and the room always shows its reason.
public enum BlockPhase: String, Codable, Equatable, Sendable {
    case mev = "MEV", mav = "MAV", mrv = "MRV", deload = "Deload"
    public init(wire: String?) {
        switch (wire ?? "").lowercased() {
        case "mev": self = .mev
        case "mav": self = .mav
        case "mrv": self = .mrv
        default: self = .deload
        }
    }
    /// What the week asks of him, in his own language.
    public var hungarian: String {
        switch self {
        case .mev: "Alap"
        case .mav: "Építés"
        case .mrv: "Csúcs"
        case .deload: "Pihenőhét"
        }
    }
}

public struct MuscleVolumeWeek: Codable, Equatable, Sendable {
    public var week: Int
    public var phase: BlockPhase
    public var planned: Int
    /// `nil` for a week that has not happened yet — a future week is not zero sets.
    public var actual: Int?
    public var isCurrent: Bool
    public init(week: Int, phase: BlockPhase, planned: Int, actual: Int? = nil, isCurrent: Bool) {
        self.week = week; self.phase = phase; self.planned = planned; self.actual = actual; self.isCurrent = isCurrent
    }
}

/// One muscle's weekly volume against its own landmarks. `mev`/`mav` come from the block's volume profile and are
/// what the bar's ticks sit on; `mrv` is the bar's end.
public struct MuscleVolume: Codable, Equatable, Sendable, Identifiable {
    public var muscle: String
    /// The colour-family key the server groups muscles by (coral/sky/lav/rose/sage/amber).
    public var region: String
    public var mev: Int?
    public var mav: Int?
    public var mrv: Int
    /// This week's planned sets for the muscle.
    public var current: Int?
    public var weeks: [MuscleVolumeWeek]
    public var id: String { muscle }
    public init(muscle: String, region: String, mev: Int? = nil, mav: Int? = nil, mrv: Int,
                current: Int? = nil, weeks: [MuscleVolumeWeek] = []) {
        self.muscle = muscle; self.region = region; self.mev = mev; self.mav = mav
        self.mrv = mrv; self.current = current; self.weeks = weeks
    }
}

/// One template day of the running block.
public struct BlockDay: Codable, Equatable, Sendable, Identifiable {
    public var id: UUID?
    /// „Hét"…„Vas".
    public var day: String
    public var type: String
    public var muscle: String
    public var exerciseCount: Int
    public var note: String?
    public var isCurrent: Bool
    public init(id: UUID? = nil, day: String, type: String, muscle: String, exerciseCount: Int,
                note: String? = nil, isCurrent: Bool = false) {
        self.id = id; self.day = day; self.type = type; self.muscle = muscle
        self.exerciseCount = exerciseCount; self.note = note; self.isCurrent = isCurrent
    }
}

/// The running training block: its weeks, where he is in them, and what each muscle gets.
public struct BlockPlan: Codable, Equatable, Sendable, Identifiable {
    public var id: UUID
    public var title: String
    public var shortTitle: String
    public var status: String
    public var startDate: String
    public var endDate: String
    public var weeks: Int
    public var currentWeek: Int
    public var split: String
    public var style: String
    public var goal: String?
    public var phaseCurve: [BlockPhase]
    /// Muscle key → the priority he set for it.
    public var musclePriorities: [String: String]
    public var muscles: [MuscleVolume]
    public var days: [BlockDay]
    public var hasReport: Bool

    public init(id: UUID, title: String, shortTitle: String, status: String, startDate: String, endDate: String,
                weeks: Int, currentWeek: Int, split: String, style: String, goal: String? = nil,
                phaseCurve: [BlockPhase] = [], musclePriorities: [String: String] = [:],
                muscles: [MuscleVolume] = [], days: [BlockDay] = [], hasReport: Bool = false) {
        self.id = id; self.title = title; self.shortTitle = shortTitle; self.status = status
        self.startDate = startDate; self.endDate = endDate; self.weeks = weeks; self.currentWeek = currentWeek
        self.split = split; self.style = style; self.goal = goal; self.phaseCurve = phaseCurve
        self.musclePriorities = musclePriorities; self.muscles = muscles; self.days = days; self.hasReport = hasReport
    }

    /// The phase of the week he is in, when the curve reaches that far.
    public var currentPhase: BlockPhase? {
        let i = currentWeek - 1
        return phaseCurve.indices.contains(i) ? phaseCurve[i] : nil
    }
}

// MARK: - Gyakorlatok and Előzmények

/// One row of the exercise catalog.
public struct CatalogExercise: Codable, Equatable, Sendable, Identifiable {
    public var id: UUID
    public var slug: String
    public var name: String
    public var muscle: String
    public var type: ExerciseType
    /// How much the movement stimulates (0…1) and how much it costs (0…1), as the server scores it.
    public var stim: Double
    public var fatigue: Double
    public var videoURL: String?
    public var imageStartURL: String?
    public var imageEndURL: String?
    public var editable: Bool
    public var mediaEditable: Bool
    public var authoredByMe: Bool
    public var authorName: String?
    /// The kit the movement needs (`barbell`, `machine`, …); nil on a user-authored row, which is never filtered
    /// by kit. (`gear`, not `equipment`: the server's `equipment` is the single primary kind.)
    public var gear: [String]?
    public init(id: UUID, slug: String, name: String, muscle: String, type: ExerciseType, stim: Double,
                fatigue: Double, videoURL: String? = nil, imageStartURL: String? = nil, imageEndURL: String? = nil,
                editable: Bool = false, mediaEditable: Bool = false, authoredByMe: Bool = false,
                authorName: String? = nil, gear: [String]? = nil) {
        self.id = id; self.slug = slug; self.name = name; self.muscle = muscle; self.type = type
        self.stim = stim; self.fatigue = fatigue; self.videoURL = videoURL
        self.imageStartURL = imageStartURL; self.imageEndURL = imageEndURL
        self.editable = editable; self.mediaEditable = mediaEditable
        self.authoredByMe = authoredByMe; self.authorName = authorName; self.gear = gear
    }
}

/// A set that holds a record, with the day it happened on.
public struct RecordSet: Codable, Equatable, Sendable {
    public var weightKg: Double?
    public var reps: Int
    public var date: String
    public init(weightKg: Double? = nil, reps: Int, date: String) {
        self.weightKg = weightKg; self.reps = reps; self.date = date
    }
}

/// One point of the strength curve. A session with no eligible set carries **no point at all** — a gap, not a zero.
public struct E1rmPoint: Codable, Equatable, Sendable {
    public var date: String
    public var e1rm: Double
    public init(date: String, e1rm: Double) { self.date = date; self.e1rm = e1rm }
}

/// What he has ever done on one exercise.
public struct ExerciseRecord: Codable, Equatable, Sendable, Identifiable {
    public var catalogId: UUID?
    public var name: String
    public var muscle: String
    public var type: ExerciseType
    public var bestSet: RecordSet?
    public var bestE1rm: Double?
    public var bestE1rmSet: RecordSet?
    public var bestSessionVolumeKg: Double?
    public var bestSessionVolumeDate: String?
    public var totalVolume: Double
    public var totalSets: Int
    public var totalReps: Int
    public var sessionCount: Int
    public var repRecords: [RecordSet]
    public var recentTopSets: [RecordSet]
    public var e1rmSeries: [E1rmPoint]
    public var id: String { catalogId?.uuidString ?? name }

    public init(catalogId: UUID? = nil, name: String, muscle: String, type: ExerciseType,
                bestSet: RecordSet? = nil, bestE1rm: Double? = nil, bestE1rmSet: RecordSet? = nil,
                bestSessionVolumeKg: Double? = nil, bestSessionVolumeDate: String? = nil,
                totalVolume: Double, totalSets: Int, totalReps: Int, sessionCount: Int,
                repRecords: [RecordSet] = [], recentTopSets: [RecordSet] = [], e1rmSeries: [E1rmPoint] = []) {
        self.catalogId = catalogId; self.name = name; self.muscle = muscle; self.type = type
        self.bestSet = bestSet; self.bestE1rm = bestE1rm; self.bestE1rmSet = bestE1rmSet
        self.bestSessionVolumeKg = bestSessionVolumeKg; self.bestSessionVolumeDate = bestSessionVolumeDate
        self.totalVolume = totalVolume; self.totalSets = totalSets; self.totalReps = totalReps
        self.sessionCount = sessionCount; self.repRecords = repRecords
        self.recentTopSets = recentTopSets; self.e1rmSeries = e1rmSeries
    }
}

public enum WorkoutOrigin: String, Codable, Equatable, Sendable {
    case meso, custom
    public init(wire: String?) { self = WorkoutOrigin(rawValue: (wire ?? "").lowercased()) ?? .meso }
}

/// One finished day in Előzmények.
public struct WorkoutHistoryDay: Codable, Equatable, Sendable, Identifiable {
    public var id: UUID
    public var templateSessionId: UUID?
    public var date: String
    public var status: WorkoutStatus
    public var origin: WorkoutOrigin
    public var title: String
    public init(id: UUID, templateSessionId: UUID? = nil, date: String, status: WorkoutStatus,
                origin: WorkoutOrigin, title: String) {
        self.id = id; self.templateSessionId = templateSessionId; self.date = date
        self.status = status; self.origin = origin; self.title = title
    }
}

// MARK: - Errors

/// Why a training read or write did not happen. `offline` is the only one the room treats as "show the last
/// known good answer and say how old it is".
public enum TrainFetchError: Error, Equatable, Sendable {
    case offline, unauthorized, notFound
    /// The server refused the request as invalid.
    case rejected
    /// A workout is already open elsewhere, or the day is already done this week — a refusal with a meaning.
    case conflict(code: String?, workoutId: UUID?)
    case server
}
