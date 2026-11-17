import Foundation

// The in-workout model: what he is on, what he has done, and what happens when he taps „Kész".
//
// **The shape is the Lágy player's, which the owner asked us to take over almost as it is**
// (`IRANY.md` §11b, owner 2026-11-05, and the prototype's `jatszo()`): three states, and the
// one rule that makes it feel right —
//
//   > The three questions (Pumpa · érzed? / Ízületi fájdalom / Akarunk még?) are asked **once
//   > per exercise, after its last set** — never between sets. Between sets there is only the
//   > rest, and the rest shows **the verdict of the set just done**.
//
// Everything here is keyed by **exercise id, never by position in an array**. That is not
// taste: the web twin (`workoutState.ts`) assumed linear order in two places, and reordering
// or skipping an exercise silently logged a set against the wrong one.

/// How a set turned out, against the plan and against his own best.
public enum SetVerdict: String, Codable, Sendable {
    /// Better than anything he has done on this exercise.
    case record
    /// More than today's target asked for.
    case above
    case onTarget
    case below

    public var hungarian: String {
        switch self {
        case .record: "Rekord"
        case .above: "A terv fölött"
        case .onTarget: "Pontosan a terv"
        case .below: "A terv alatt"
        }
    }
}

/// One performed set, before it has a server id.
public struct SessionSet: Codable, Sendable, Equatable, Identifiable {
    public let id: UUID
    public var kind: SetKind
    public var kg: Double?
    public var reps: Int
    /// Reps left in the tank. The player offers 0…3+, so 3 means "three or more".
    public var rir: Int?
    public var at: Date
    public var verdict: SetVerdict

    public init(id: UUID = UUID(), kind: SetKind = .working, kg: Double?, reps: Int, rir: Int? = nil,
                at: Date = Date(), verdict: SetVerdict = .onTarget) {
        self.id = id; self.kind = kind; self.kg = kg; self.reps = reps; self.rir = rir
        self.at = at; self.verdict = verdict
    }
}

/// The three questions, asked once per exercise after its last set.
public struct ExerciseFeedback: Codable, Sendable, Equatable {
    /// 0 Semmi · 1 Enyhe · 2 Jó · 3 Brutális.
    public var pump: Int
    /// 0 Nincs · 1 Enyhe · 2 Erős.
    public var jointPain: Int
    /// 0 Kevés volt · 1 Pont jó · 2 Sok volt.
    public var workload: Int
    public init(pump: Int = 2, jointPain: Int = 0, workload: Int = 1) {
        self.pump = pump; self.jointPain = jointPain; self.workload = workload
    }
}

/// What the player shows next.
public enum WorkoutStep: Equatable, Sendable {
    /// Lift: the set screen.
    case set
    /// Rest, with the verdict of the set just done.
    case rest(seconds: TimeInterval)
    /// This exercise is finished: the three questions.
    case debrief(exercise: UUID)
    /// Everything is done.
    case finish
}

/// One exercise inside the session.
public struct SessionExercise: Codable, Sendable, Equatable, Identifiable {
    public let id: UUID
    public var name: String
    public var muscle: String
    /// What the plan asked for, warmups first.
    public var planned: [PrescribedSet]
    /// What has actually been done.
    public var logged: [SessionSet]
    /// Sets added (+) or dropped (−) in the gym, relative to the plan.
    public var adjustment: Int
    public var skipped: Bool
    /// The owner's durable note, **shown while lifting** — the Lágy rule: not behind a button.
    public var note: String?
    public var feedback: ExerciseFeedback?
    /// His best ever on this exercise, for the record verdict.
    public var bestKg: Double?
    public var bestReps: Int?

    /// How many sets this exercise has today, after what he added or dropped in the gym.
    public var setCount: Int { max(logged.count, planned.count + adjustment) }

    /// The plan for one set, falling back to the last planned set when he added one in the gym.
    public func plan(at index: Int) -> PrescribedSet? {
        if planned.indices.contains(index) { return planned[index] }
        return planned.last
    }

    public var isDone: Bool { skipped || logged.count >= setCount }

    public init(id: UUID, name: String, muscle: String, planned: [PrescribedSet], logged: [SessionSet] = [],
                adjustment: Int = 0, skipped: Bool = false, note: String? = nil,
                feedback: ExerciseFeedback? = nil, bestKg: Double? = nil, bestReps: Int? = nil) {
        self.id = id; self.name = name; self.muscle = muscle; self.planned = planned; self.logged = logged
        self.adjustment = adjustment; self.skipped = skipped; self.note = note; self.feedback = feedback
        self.bestKg = bestKg; self.bestReps = bestReps
    }
}

/// The workout in progress. `Codable` throughout, because the player must survive the phone
/// locking, the app being killed and a relaunch — a session he cannot get back is worse than
/// one he never started.
public struct WorkoutSession: Codable, Sendable, Equatable {
    /// The order he does them in; reordering edits **this**, never the exercises themselves.
    public private(set) var order: [UUID]
    public private(set) var exercises: [UUID: SessionExercise]
    public private(set) var currentExerciseId: UUID?
    /// Which set of the current exercise he is on.
    public private(set) var currentSetIndex: Int
    public let startedAt: Date
    /// Set while resting; the player counts down to it and it survives a relaunch.
    public private(set) var restEndsAt: Date?
    /// The local id the outbox groups this workout's writes by.
    public let ref: UUID
    /// Rest between sets. The engine does not prescribe one, so it is a constant of the player.
    public static let restSeconds: TimeInterval = 90

    public init(_ today: TodayWorkout, ref: UUID = UUID(), startedAt: Date = Date()) {
        var map: [UUID: SessionExercise] = [:]
        var order: [UUID] = []
        for e in today.exercises {
            order.append(e.id)
            map[e.id] = SessionExercise(id: e.id, name: e.name, muscle: e.muscle, planned: e.sets,
                                        note: e.note,
                                        bestKg: e.lastWeek?.weightKg, bestReps: e.lastWeek?.reps)
        }
        // A workout already open on the server: its logged sets come back into the session, so
        // reopening the player continues rather than starting again.
        for set in today.open?.sets ?? [] where map[set.exerciseId] != nil {
            map[set.exerciseId]?.logged.append(
                SessionSet(id: set.id, kind: set.kind, kg: set.weightKg, reps: set.reps ?? 0,
                           rir: set.rir, at: set.doneAt ?? startedAt))
        }
        self.order = order
        self.exercises = map
        self.ref = ref
        self.startedAt = startedAt
        self.currentExerciseId = order.first { map[$0]?.isDone == false }
        self.currentSetIndex = currentExerciseId.flatMap { map[$0]?.logged.count } ?? 0
    }

    // MARK: - Where we are

    public var current: SessionExercise? { currentExerciseId.flatMap { exercises[$0] } }

    /// Every exercise in his order, skipped ones included (the strip draws them greyed).
    public var all: [SessionExercise] { order.compactMap { exercises[$0] } }

    public var loggedSets: [SessionSet] { all.flatMap(\.logged) }

    /// The most recent set anywhere in the session, with the exercise it belongs to.
    ///
    /// The rest screen needs **this**, not the current exercise's last set. The last set of an exercise sends
    /// him to the three questions, and answering them moves the session on to the *next* exercise while the
    /// rest keeps running — so at that moment the current exercise has no logged set at all, and a rest screen
    /// that asked it for one rendered nothing: a black screen he could not get out of.
    public var lastLogged: (exercise: SessionExercise, set: SessionSet)? {
        all.compactMap { e in e.logged.last.map { (exercise: e, set: $0) } }
            .max { $0.set.at < $1.set.at }
    }

    /// Sets done and sets planned across the whole session — the „14 / 16" of the top bar.
    public var progress: (done: Int, total: Int) {
        let live = all.filter { !$0.skipped }
        return (live.reduce(0) { $0 + $1.logged.count }, live.reduce(0) { $0 + $1.setCount })
    }

    public var isComplete: Bool { all.allSatisfy(\.isDone) }

    /// What the player shows right now, after a relaunch as much as after a tap.
    public var step: WorkoutStep {
        guard let current else { return .finish }
        if current.isDone && current.feedback == nil { return .debrief(exercise: current.id) }
        if let restEndsAt, restEndsAt > Date() { return .rest(seconds: restEndsAt.timeIntervalSinceNow) }
        return .set
    }

    // MARK: - Doing the work

    /// Log the current set and say what happens next. The **last set of an exercise goes to the
    /// debrief, not to a rest** — the questions are asked once, about the whole exercise.
    @discardableResult
    public mutating func log(kg: Double?, reps: Int, rir: Int?, now: Date = Date()) -> WorkoutStep {
        guard let id = currentExerciseId, var exercise = exercises[id] else { return .finish }
        let index = exercise.logged.count
        let plan = exercise.plan(at: index)
        let set = SessionSet(kind: plan?.kind ?? .working, kg: kg, reps: reps, rir: rir, at: now,
                             verdict: Self.verdict(kg: kg, reps: reps, plan: plan, exercise: exercise))
        exercise.logged.append(set)
        exercises[id] = exercise

        if exercise.isDone {
            // The three questions come now, once, for the whole exercise. The rest runs behind
            // them when there is still something after this exercise.
            restEndsAt = nextUnfinished(after: id) == nil ? nil : now.addingTimeInterval(Self.restSeconds)
            return .debrief(exercise: id)
        }
        currentSetIndex = exercise.logged.count
        restEndsAt = now.addingTimeInterval(Self.restSeconds)
        return .rest(seconds: Self.restSeconds)
    }

    /// Answer the three questions and move to the next exercise.
    @discardableResult
    public mutating func finishExercise(_ feedback: ExerciseFeedback, now: Date = Date()) -> WorkoutStep {
        guard let id = currentExerciseId else { return .finish }
        exercises[id]?.feedback = feedback
        return moveOn(from: id, now: now)
    }

    /// Skip what is in front of him, with the reason recorded elsewhere. A skipped exercise
    /// stays in the list — greyed, not deleted: he did decide something about it.
    @discardableResult
    public mutating func skip(_ id: UUID, now: Date = Date()) -> WorkoutStep {
        exercises[id]?.skipped = true
        guard id == currentExerciseId else { return step }
        return moveOn(from: id, now: now)
    }

    /// „+" and „−" in the gym. Never below what he has already logged: a set he did is a fact.
    public mutating func addSet(to id: UUID) {
        exercises[id]?.adjustment += 1
    }

    public mutating func dropSet(from id: UUID) {
        guard let e = exercises[id], e.setCount - 1 >= max(1, e.logged.count) else { return }
        exercises[id]?.adjustment -= 1
    }

    /// Correct a set he already logged — a mistyped weight is the commonest thing in a gym.
    public mutating func edit(setId: UUID, kg: Double?, reps: Int, rir: Int?) {
        for (id, exercise) in exercises {
            guard let index = exercise.logged.firstIndex(where: { $0.id == setId }) else { continue }
            var updated = exercise
            updated.logged[index].kg = kg
            updated.logged[index].reps = reps
            updated.logged[index].rir = rir
            updated.logged[index].verdict = Self.verdict(kg: kg, reps: reps,
                                                         plan: exercise.plan(at: index), exercise: exercise)
            exercises[id] = updated
            return
        }
    }

    public mutating func setNote(_ note: String?, for id: UUID) { exercises[id]?.note = note }

    /// Do it later: the exercise moves to the end of the order, keeping everything logged.
    public mutating func postpone(_ id: UUID, now: Date = Date()) {
        guard order.count > 1, let at = order.firstIndex(of: id) else { return }
        order.remove(at: at)
        order.append(id)
        if currentExerciseId == id { _ = moveOn(from: id, now: now) }
    }

    /// Swap an exercise for another, keeping its place and its set plan. What is already
    /// logged stays with the row — he did those sets, whatever the row is called now.
    public mutating func swap(_ id: UUID, forId newId: UUID, name: String, muscle: String) {
        guard var exercise = exercises[id] else { return }
        let replacement = SessionExercise(id: newId, name: name, muscle: muscle, planned: exercise.planned,
                                          logged: exercise.logged, adjustment: exercise.adjustment,
                                          skipped: exercise.skipped, note: nil, feedback: exercise.feedback)
        exercises.removeValue(forKey: id)
        exercises[newId] = replacement
        if let at = order.firstIndex(of: id) { order[at] = newId }
        if currentExerciseId == id { currentExerciseId = newId }
        exercise.note = nil
    }

    /// **Do this one now** — the machine he wanted is taken, so he picks another exercise off the list and
    /// carries on (owner, 2026-11-17: *„simán lehessen másik gyakorlatot választani amit csinálsz, ha mondjuk
    /// épp foglalt a gép"*).
    ///
    /// It is deliberately **not** a reorder: the plan's order stands, and when this exercise is finished the
    /// session goes back to the first unfinished one after it, exactly as it would have. A finished or skipped
    /// exercise cannot be jumped to, and neither can one he is already on.
    @discardableResult
    public mutating func switchTo(_ id: UUID, now: Date = Date()) -> WorkoutStep {
        guard let target = exercises[id], !target.isDone, id != currentExerciseId else { return step }
        currentExerciseId = id
        currentSetIndex = target.logged.count
        // The rest belonged to the set he just did on the other exercise; walking to another machine is the
        // rest. Leaving it running would start him on a countdown he has already spent.
        restEndsAt = nil
        return .set
    }

    /// The server performed the swap and sent the replacement row back: it takes the old row's place and its
    /// logged sets (he did those sets, whatever the row is called now) but **its own set plan**, which is the
    /// point of letting the server do it.
    public mutating func swap(_ id: UUID, for exercise: PlannedExercise) {
        guard let old = exercises[id] else { return }
        let replacement = SessionExercise(id: exercise.id, name: exercise.name, muscle: exercise.muscle,
                                          planned: exercise.sets, logged: old.logged,
                                          adjustment: 0, skipped: old.skipped, note: exercise.note,
                                          feedback: old.feedback,
                                          bestKg: exercise.lastWeek?.weightKg, bestReps: exercise.lastWeek?.reps)
        exercises.removeValue(forKey: id)
        exercises[exercise.id] = replacement
        if let at = order.firstIndex(of: id) { order[at] = exercise.id }
        if currentExerciseId == id { currentExerciseId = exercise.id }
    }

    /// Skip the rest and get on with it.
    public mutating func skipRest() { restEndsAt = nil }

    /// „+30 mp".
    public mutating func addRest(_ seconds: TimeInterval = 30, now: Date = Date()) {
        restEndsAt = (restEndsAt ?? now).addingTimeInterval(seconds)
    }

    // MARK: - Private

    private mutating func moveOn(from id: UUID, now: Date) -> WorkoutStep {
        guard let next = nextUnfinished(after: id) else {
            currentExerciseId = nil
            restEndsAt = nil
            return .finish
        }
        currentExerciseId = next
        currentSetIndex = exercises[next]?.logged.count ?? 0
        return restEndsAt.map { .rest(seconds: $0.timeIntervalSince(now)) } ?? .set
    }

    /// The next exercise with work left, in **his** order — which is why the order is a list of
    /// ids and not the dictionary's.
    private func nextUnfinished(after id: UUID) -> UUID? {
        guard let at = order.firstIndex(of: id) else { return order.first { exercises[$0]?.isDone == false } }
        return order[(at + 1)...].first { exercises[$0]?.isDone == false }
            ?? order[..<at].first { exercises[$0]?.isDone == false }
    }

    /// How a set reads on the rest screen. A record beats his own best; otherwise it is read
    /// against what today asked for. With no target at all it is simply „a terv" — the app
    /// does not invent one to judge him by.
    static func verdict(kg: Double?, reps: Int, plan: PrescribedSet?, exercise: SessionExercise) -> SetVerdict {
        if let kg, let bestKg = exercise.bestKg, let bestReps = exercise.bestReps,
           kg > bestKg || (kg == bestKg && reps > bestReps) {
            return .record
        }
        guard let targetReps = plan?.targetReps else { return .onTarget }
        if let kg, let targetKg = plan?.targetKg, kg > targetKg, reps >= targetReps { return .above }
        if reps > targetReps { return .above }
        if reps < targetReps { return .below }
        return .onTarget
    }
}
