import Foundation
import HTTPTypes
import OpenAPIRuntime
import BoopAPI

/// Boop's training client (B5 „Edzés"): today's session, the running block, the exercise catalog, the records and
/// the history — each a generated operation behind a small value-type API (`TrainModels.swift`).
///
/// Reads only, in this file's first half; the write half (the player's sets, through the outbox) arrives with the
/// outbox kinds. Every call throws `TrainFetchError`, and `offline` is the one the room answers with its cached
/// last-known-good read plus how old it is.
public struct TrainClient: Sendable {
    private let client: Client
    private let cal: Calendar
    /// Workout ids learned in this run (see the `OutboxSender` extension below). A reference type, so every copy
    /// of this struct shares it — the sender and the player must agree on which workout a queued set belongs to.
    private let memo = Memo()

    /// `calendar`: whose days these are. Rewritten as Gregorian in the given zone, because a Buddhist or Japanese
    /// device calendar would otherwise send year 2569 on the wire (the same trap `FoodClient` documents).
    public init(client: Client, calendar: Calendar = .current) {
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        greg.locale = Locale(identifier: "en_US_POSIX")
        self.client = client; self.cal = greg
    }

    /// `yyyy-MM-dd` of a device-local day.
    public func ymd(_ date: Date) -> String {
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    // MARK: - Ma

    /// Today's resolved training day: the open workout's day if one is open, else the named template day, else
    /// today's weekday in the running block. An empty answer is a rest day, not a failure.
    public func todayWorkout(templateSessionId: UUID? = nil) async throws -> TodayWorkout {
        try await call {
            switch try await client.getTodayWorkout(query: .init(templateSessionId: templateSessionId?.wire)) {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    // MARK: - Előzmények

    /// Finished days in the inclusive range, date-ascending as the server orders them.
    public func history(from: Date, to: Date) async throws -> [WorkoutHistoryDay] {
        try await call {
            switch try await client.listWorkouts(query: .init(from: ymd(from), to: ymd(to))) {
            case .ok(let ok): return try ok.body.json.map(Self.map)
            case .badRequest: throw TrainFetchError.rejected
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    // MARK: - Blokk

    /// The running block with its weeks and its per-muscle volume, or `nil` when he has no block running — which
    /// is a real state the Blokk tab shows („nincs futó blokk"), never an error.
    ///
    /// Two reads: the block itself carries the volume landmarks (MEV/MAV/MRV) and the template days, the volume
    /// arc carries each muscle's week-by-week planned and actual sets. They are merged here so the tab never has
    /// to know there were two.
    public func blockPlan() async throws -> BlockPlan? {
        let blocks: [Components.Schemas.MesocycleResponse] = try await call {
            switch try await client.listMesocycles() {
            case .ok(let ok): return try ok.body.json
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
        guard let running = blocks.first(where: { $0.status == .active }) ?? blocks.first(where: { $0.status == .planned })
        else { return nil }

        var plan = Self.map(running)
        if let id = UUID(uuidString: running.id) {
            // A block whose arc the server cannot produce still shows its weeks and days; only the per-week
            // volume bars go missing, and the tab says so rather than drawing empty bars.
            if let arc = try? await volumeArc(blockId: id) { plan.muscles = Self.merge(plan.muscles, arc: arc) }
        }
        return plan
    }

    /// One block's per-muscle volume arc: planned scaffold plus the working sets actually logged.
    public func volumeArc(blockId: UUID) async throws -> [MuscleVolume] {
        try await call {
            switch try await client.getMesocycleVolumeArc(path: .init(id: blockId.wire)) {
            case .ok(let ok): return try ok.body.json.muscles.map(Self.map)
            case .notFound: throw TrainFetchError.notFound
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    // MARK: - Gyakorlatok

    /// Every exercise he can choose from: the master catalog plus his own rows.
    public func catalog() async throws -> [CatalogExercise] {
        try await call {
            switch try await client.getExerciseCatalog() {
            case .ok(let ok): return try ok.body.json.map(Self.map)
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    /// What he has ever done, per exercise. Empty with no logged history — never a row of zeroes.
    public func records() async throws -> [ExerciseRecord] {
        try await call {
            switch try await client.getExerciseRecords() {
            case .ok(let ok): return try ok.body.json.map(Self.map)
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    // MARK: - Csere

    /// Swap one exercise of the **running** workout for another, and get the refreshed day back.
    ///
    /// This one write does not go through the outbox, and that is deliberate. The server creates a new
    /// instance-scoped exercise row and answers with **its** id; every set logged afterwards is addressed by that
    /// id. Queueing the swap would mean queueing writes against an id that does not exist yet and rewriting their
    /// payloads when it arrives — one lost map and a whole exercise's sets land on the wrong row, or nowhere. So
    /// the swap asks for a connection, says so when there is none, and everything else in the player stays
    /// offline-first. (`scope`: `TODAY` touches this session only; `MESO` also rewrites the template day.)
    @discardableResult
    public func changeExercise(workoutId: UUID, replacing: UUID?, with exercise: CatalogExercise,
                               warmupSets: Int, workingSets: Int, repMin: Int, repMax: Int, targetRIR: Int,
                               forWholeBlock: Bool = false) async throws -> (exerciseId: UUID, today: TodayWorkout) {
        try await call {
            let body = Components.Schemas.WorkoutExerciseChangeRequest(
                catalogId: exercise.id.wire, name: exercise.name, muscle: exercise.muscle,
                _type: .init(rawValue: exercise.type.rawValue) ?? .compound,
                warmupSets: warmupSets, workingSets: workingSets, repMin: repMin, repMax: repMax,
                targetRIR: targetRIR, scope: forWholeBlock ? .MESO : .TODAY,
                replacesExerciseId: replacing?.wire)
            switch try await client.changeWorkoutExercise(path: .init(id: workoutId.wire), body: .json(body)) {
            case .ok(let ok):
                let r = try ok.body.json
                guard let id = UUID(uuidString: r.exerciseId) else { throw TrainFetchError.server }
                return (id, Self.map(r.today))
            case .conflict: throw TrainFetchError.conflict(code: nil, workoutId: nil)
            case .notFound: throw TrainFetchError.notFound
            case .badRequest: throw TrainFetchError.rejected
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    /// The server's id for a workout started in this run, when the player needs it for an online call.
    public func knownWorkoutId(for ref: UUID) async -> UUID? { await memo.id(for: ref) }

    // MARK: - Mapping

    static func map(_ r: Components.Schemas.WorkoutTodayResponse) -> TodayWorkout {
        TodayWorkout(
            templateSessionId: r.templateSessionId.flatMap(UUID.init(uuidString:)),
            dayLabel: r.dayLabel, title: r.title, durationEst: r.durationEst,
            exercises: (r.exercises ?? []).compactMap(map),
            open: r.openWorkout.map(map), completed: r.completedWorkout.map { map($0.value1) },
            weekDoneDates: r.weekDoneDates ?? [],
            overload: r.overloadSummary.map { OverloadSummary(weightUp: $0.value1.weightUp, weightDown: $0.value1.weightDown,
                                                              repUp: $0.value1.repUp, hold: $0.value1.hold) },
            comeback: r.comeback.map { ComebackState(index: $0.value1.index, total: $0.value1.total,
                                                     mode: .init(wire: $0.value1.mode.rawValue)) })
    }

    /// An exercise whose id the server did not write as a uuid is dropped rather than carried with a made-up id:
    /// every write the player makes is addressed by that id.
    static func map(_ e: Components.Schemas.TodayExercise) -> PlannedExercise? {
        guard let id = UUID(uuidString: e.id) else { return nil }
        return PlannedExercise(
            id: id, name: e.name, muscle: e.muscle, type: .init(wire: e._type.rawValue),
            sets: sets(of: e), warmupCount: e.warmupSets, workingCount: e.workingSets,
            repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
            anchorKg: e.anchorWeightKg, rationale: e.rationale,
            progression: e.progression.map {
                Progression(lever: .init(wire: $0.value1.lever.rawValue), deltaKg: $0.value1.deltaKg,
                            deltaReps: $0.value1.deltaReps, targetKg: $0.value1.targetWeightKg,
                            targetReps: $0.value1.targetReps, rationale: $0.value1.rationale)
            },
            lastWeek: e.lastWeek.map { LastWeekSet(weightKg: $0.weightKg, reps: $0.reps, rir: $0.rir) },
            note: e.note, warning: e.warning, videoURL: e.videoUrl,
            imageStartURL: e.imageStartUrl, imageEndURL: e.imageEndUrl,
            replacesName: e.replacesName, replacedByName: e.replacedByName, planSlot: e.planSlot ?? true)
    }

    /// The exercise's sets. With the engine on, they are its own per-set targets verbatim. With it off there are
    /// only counts, so the rows are built from `warmupSets`/`workingSets` **with no weight at all** — the anchor
    /// weight is the plan's reference, not a target for a specific set, and printing it as one would be a claim
    /// the server never made.
    static func sets(of e: Components.Schemas.TodayExercise) -> [PrescribedSet] {
        if let given = e.prescribedSets, !given.isEmpty {
            return given.map { PrescribedSet(kind: .init(wire: $0.kind.rawValue), targetKg: $0.targetWeightKg,
                                             targetReps: $0.targetReps, targetRIR: $0.targetRIR) }
        }
        let warmups = (0..<max(0, e.warmupSets)).map { _ in PrescribedSet(kind: .warmup, targetReps: e.repMax) }
        let working = (0..<max(0, e.workingSets)).map { _ in
            PrescribedSet(kind: .working, targetReps: e.repMin, targetRIR: e.targetRIR)
        }
        return warmups + working
    }

    static func map(_ w: Components.Schemas.WorkoutInstanceResponse) -> WorkoutInstance {
        WorkoutInstance(
            id: UUID(uuidString: w.id) ?? UUID(), templateSessionId: UUID(uuidString: w.templateSessionId),
            date: w.date, status: .init(wire: w.status.rawValue),
            sets: w.sets.compactMap(map), startedAt: w.startedAt, finishedAt: w.finishedAt,
            activeSeconds: w.activeSeconds)
    }

    static func map(_ s: Components.Schemas.ExerciseSetResponse) -> LoggedSet? {
        guard let id = UUID(uuidString: s.id), let exerciseId = UUID(uuidString: s.exerciseId) else { return nil }
        return LoggedSet(id: id, exerciseId: exerciseId, setIndex: s.setIndex,
                         kind: .init(wire: s.kind?.rawValue), weightKg: s.weightKg, reps: s.reps, rir: s.rir,
                         side: s.side, note: s.note, skipped: s.skipped ?? false, doneAt: s.doneAt)
    }

    static func map(_ s: Components.Schemas.WorkoutSummaryResponse) -> WorkoutHistoryDay {
        WorkoutHistoryDay(id: UUID(uuidString: s.id) ?? UUID(),
                          templateSessionId: s.templateSessionId.flatMap(UUID.init(uuidString:)),
                          date: s.date, status: .init(wire: s.status.rawValue),
                          origin: .init(wire: s.origin.rawValue), title: s.title)
    }

    static func map(_ m: Components.Schemas.MesocycleResponse) -> BlockPlan {
        let profiles = m.volumePerMuscle?.additionalProperties ?? [:]
        let muscles = profiles
            .map { key, p in MuscleVolume(muscle: key, region: "", mev: p.mev, mav: p.mav, mrv: p.mrv, current: p.current) }
            .sorted { $0.muscle < $1.muscle }
        return BlockPlan(
            id: UUID(uuidString: m.id) ?? UUID(), title: m.title, shortTitle: m.shortTitle,
            status: m.status.rawValue, startDate: m.startDate, endDate: m.endDate,
            weeks: m.weeks, currentWeek: m.currentWeek, split: m.split, style: m.style, goal: m.goal,
            phaseCurve: m.phaseCurve.map { BlockPhase(wire: $0.rawValue) },
            musclePriorities: m.musclePriorities?.additionalProperties ?? [:],
            muscles: muscles,
            days: (m.days ?? []).map {
                BlockDay(id: $0.id.flatMap(UUID.init(uuidString:)), day: $0.day, type: $0._type, muscle: $0.muscle,
                         exerciseCount: $0.exerciseCount, note: $0.note, isCurrent: $0.current ?? false)
            },
            hasReport: m.hasReport)
    }

    static func map(_ a: Components.Schemas.MuscleVolumeArc) -> MuscleVolume {
        MuscleVolume(muscle: a.muscle, region: a.region, mrv: a.mrv,
                     weeks: a.weeks.map { MuscleVolumeWeek(week: $0.week, phase: .init(wire: $0.phase.rawValue),
                                                           planned: $0.planned, actual: $0.actual,
                                                           isCurrent: $0.isCurrent) })
    }

    /// The block's landmarks (MEV/MAV, and this week's planned sets) joined to the arc's weeks, by muscle key. A
    /// muscle the arc knows and the profile does not keeps its own MRV and loses only the two ticks.
    static func merge(_ profiles: [MuscleVolume], arc: [MuscleVolume]) -> [MuscleVolume] {
        let byKey = Dictionary(profiles.map { ($0.muscle, $0) }, uniquingKeysWith: { a, _ in a })
        return arc.map { a in
            var out = a
            if let p = byKey[a.muscle] { out.mev = p.mev; out.mav = p.mav; out.current = p.current }
            return out
        }
    }

    static func map(_ c: Components.Schemas.ExerciseCatalogItem) -> CatalogExercise {
        CatalogExercise(id: UUID(uuidString: c.id) ?? UUID(), slug: c.slug, name: c.name, muscle: c.muscle,
                        type: .init(wire: c._type.rawValue), stim: c.stim, fatigue: c.fatigue,
                        videoURL: c.videoUrl, imageStartURL: c.imageStartUrl, imageEndURL: c.imageEndUrl,
                        editable: c.editable, mediaEditable: c.mediaEditable,
                        authoredByMe: c.authoredByMe, authorName: c.authorName)
    }

    static func map(_ r: Components.Schemas.ExerciseRecordResponse) -> ExerciseRecord {
        ExerciseRecord(
            catalogId: r.catalogId.flatMap(UUID.init(uuidString:)), name: r.name, muscle: r.muscle,
            type: .init(wire: r._type.rawValue),
            bestSet: r.bestSet.map(map), bestE1rm: r.bestE1rm?.value, bestE1rmSet: r.bestE1rm.map { map($0.set) },
            bestSessionVolumeKg: r.bestSessionVolume?.volumeKg, bestSessionVolumeDate: r.bestSessionVolume?.date,
            totalVolume: r.totalVolume, totalSets: r.totalSets, totalReps: r.totalReps,
            sessionCount: r.sessionCount, repRecords: r.repRecords.map(map), recentTopSets: r.recentTopSets.map(map),
            e1rmSeries: (r.e1rmSeries ?? []).map { E1rmPoint(date: $0.date, e1rm: $0.e1rm) })
    }

    static func map(_ s: Components.Schemas.RecordSetRef) -> RecordSet {
        RecordSet(weightKg: s.weightKg, reps: s.reps, date: s.date)
    }

    // MARK: - Failures

    /// One place where a transport or HTTP failure becomes a `TrainFetchError`, so no call site invents its own
    /// mapping. The network cases are what the room answers from its cache.
    private func call<T>(_ work: () async throws -> T) async throws -> T {
        do { return try await work() }
        catch let e as TrainFetchError { throw e }
        catch {
            if let status = (error as? ClientError)?.response?.status.code {
                if status == 401 { throw TrainFetchError.unauthorized }
                if status == 404 { throw TrainFetchError.notFound }
                if status == 400 { throw TrainFetchError.rejected }
            }
            throw isNetworkFailure(error) ? TrainFetchError.offline : TrainFetchError.server
        }
    }
}

// MARK: - The write side (the outbox's training sender)

/// `TrainClient` is also the sender for every training `OutboxKind`. Two things make that safe without any
/// contract change:
///
/// - **The server's start is idempotent on the template day.** `POST /api/train/workouts` returns the *open*
///   instance when one exists, so a replayed start never creates a second workout. That is the natural key the
///   queue relies on — `(templateSessionId, the open instance)` — and it is why no `clientRef` is needed here.
/// - **A queued write names a local `workoutRef`, never a server id**, because the workout may not exist yet when
///   he logs the set. The id is resolved at send time and remembered for the rest of the run; after a relaunch it
///   is re-learned from today's open workout. No queued payload is ever rewritten.
///
/// The two 409s are **refusals with a meaning**, not retries: another workout is open elsewhere, or this day was
/// already finished this week. Retrying cannot change either, so the item fails with the server's own code and the
/// room says what happened in his own words.
extension TrainClient: OutboxSender {
    /// Workout ids learned in this run: local group ref → the server's own workout id.
    actor Memo {
        private var workouts: [UUID: UUID] = [:]
        func id(for ref: UUID) -> UUID? { workouts[ref] }
        func keep(_ id: UUID, for ref: UUID) { workouts[ref] = id }
    }

    public func send(_ item: OutboxItem) async -> OutboxSendResult {
        do {
            switch item.kind {
            case .workoutStart: return try await sendStart(item)
            case .workoutSet: return try await sendSet(item)
            case .workoutSetEdit: return try await sendSetEdit(item)
            case .workoutSkipExercise: return try await sendSkipExercise(item)
            case .workoutFeedback: return try await sendFeedback(item)
            case .workoutNote: return try await sendNote(item)
            case .workoutFinish: return try await sendFinish(item)
            case .sportSession: return try await sendSport(item)
            default: return .failed("not a training write: \(item.kind.rawValue)")
            }
        } catch {
            if let status = (error as? ClientError)?.response?.status.code {
                // A 2xx whose body would not decode still happened: every training write is idempotent or
                // additive-by-id, so reporting it as sent is safer than sending it twice.
                if (200..<300).contains(status) { return .sent(nil) }
                return Self.map(status)
            }
            // No connection is not an attempt — a week in a basement gym must not burn the cap.
            return isNoConnection(error) ? .offline : .retryLater
        }
    }

    /// Status → verdict, the same mapping `RitmusClient` uses: the item is fine, the moment may not be.
    static func map(_ status: Int) -> OutboxSendResult {
        switch status {
        case 401, 409, 429, 500...599: .retryLater
        default: .failed("HTTP \(status)")
        }
    }

    private func malformed(_ what: String) -> OutboxSendResult { .failed("unreadable \(what) payload") }

    // MARK: Start

    private func sendStart(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = TrainPayloadCodec.decode(WorkoutStartPayload.self, from: item.payload)
        else { return malformed("workout start") }
        let ref = item.groupRef ?? item.id
        switch try await client.startWorkout(body: .json(.init(templateSessionId: p.templateSessionId.wire))) {
        case .created(let created):
            let instance = Self.map(try created.body.json)
            await memo.keep(instance.id, for: ref)
            return .sent(TrainPayloadCodec.encode(instance))
        case .conflict(let conflict):
            // Reported, not retried: he has to decide (finish the other session, or review this day).
            let code = (try? conflict.body.json).flatMap { $0.first?.code } ?? "TRAIN_WORKOUT_CONFLICT"
            return .failed(code)
        case .notFound: return .failed("TRAIN_TEMPLATE_DAY_NOT_FOUND")
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    /// An online start, for the player with a live connection: the same call, with the id remembered under `ref`
    /// so anything queued later in the same session addresses it.
    public func startWorkout(templateSessionId: UUID, ref: UUID) async throws -> WorkoutInstance {
        try await call {
            switch try await client.startWorkout(body: .json(.init(templateSessionId: templateSessionId.wire))) {
            case .created(let created):
                let instance = Self.map(try created.body.json)
                await memo.keep(instance.id, for: ref)
                return instance
            case .conflict(let conflict):
                let code = (try? conflict.body.json).flatMap { $0.first?.code }
                throw TrainFetchError.conflict(code: code, workoutId: nil)
            case .notFound: throw TrainFetchError.notFound
            case .badRequest: throw TrainFetchError.rejected
            case .unauthorized: throw TrainFetchError.unauthorized
            case .undocumented: throw TrainFetchError.server
            }
        }
    }

    /// The server's workout id for a queued write's `workoutRef`: what this run learned, else today's open
    /// workout (the case after a relaunch), else the finished one — a note or a finish may arrive after the
    /// session was closed. `nil` means the start has not landed yet, so the write waits.
    private func workoutId(for ref: UUID) async -> UUID? {
        if let known = await memo.id(for: ref) { return known }
        guard let today = try? await todayWorkout() else { return nil }
        guard let id = today.open?.id ?? today.completed?.id else { return nil }
        await memo.keep(id, for: ref)
        return id
    }

    // MARK: The writes behind a start

    private func sendSet(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = TrainPayloadCodec.decode(WorkoutSetPayload.self, from: item.payload)
        else { return malformed("workout set") }
        guard let workout = await workoutId(for: p.workoutRef) else { return .retryLater }
        let body = Components.Schemas.SetLogRequest(
            exerciseId: p.exerciseId.wire, setIndex: p.setIndex, weightKg: p.weightKg, reps: p.reps, rir: p.rir,
            side: p.side, note: p.note, kind: p.kind.rawValue,
            targetWeightKg: p.targetWeightKg, targetReps: p.targetReps)
        switch try await client.logWorkoutSet(path: .init(id: workout.wire), body: .json(body)) {
        case .created: return .sent(nil)
        case .conflict: return .retryLater
        case .notFound: return .failed("TRAIN_WORKOUT_NOT_FOUND")
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    private func sendSetEdit(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = TrainPayloadCodec.decode(WorkoutSetEditPayload.self, from: item.payload)
        else { return malformed("set correction") }
        guard let workout = await workoutId(for: p.workoutRef) else { return .retryLater }
        let body = Components.Schemas.SetUpdateRequest(weightKg: p.weightKg, reps: p.reps, rir: p.rir,
                                                       side: p.side, note: p.note)
        switch try await client.updateWorkoutSet(path: .init(id: workout.wire, setId: p.setId.wire),
                                                 body: .json(body)) {
        case .ok: return .sent(nil)
        case .conflict: return .retryLater
        case .notFound: return .failed("TRAIN_SET_NOT_FOUND")
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    private func sendSkipExercise(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = TrainPayloadCodec.decode(WorkoutSkipExercisePayload.self, from: item.payload)
        else { return malformed("exercise skip") }
        guard let workout = await workoutId(for: p.workoutRef) else { return .retryLater }
        switch try await client.skipWorkoutExercise(path: .init(id: workout.wire),
                                                    body: .json(.init(exerciseId: p.exerciseId.wire))) {
        case .noContent: return .sent(nil)
        case .conflict: return .retryLater
        case .notFound: return .failed("TRAIN_WORKOUT_NOT_FOUND")
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    private func sendFeedback(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = TrainPayloadCodec.decode(WorkoutFeedbackPayload.self, from: item.payload)
        else { return malformed("workout feedback") }
        guard let workout = await workoutId(for: p.workoutRef) else { return .retryLater }
        // In the app the answers are 0-based; the contract is 1-based (pump 1-4, jointPain 1-3, workload 1-3).
        // Mapped here, at the wire only, so items queued before the fix are corrected too (mezo-r36n9.67).
        let body = p.items.map {
            Components.Schemas.WorkoutFeedbackInput(exerciseId: $0.exerciseId.wire, pump: $0.pump + 1,
                                                    jointPain: $0.jointPain + 1, workload: $0.workload + 1)
        }
        switch try await client.saveWorkoutFeedback(path: .init(id: workout.wire), body: .json(body)) {
        case .noContent: return .sent(nil)
        case .notFound: return .failed("TRAIN_WORKOUT_NOT_FOUND")
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    private func sendNote(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = TrainPayloadCodec.decode(WorkoutNotePayload.self, from: item.payload)
        else { return malformed("note") }
        // An exercise note is the exercise's own, and outlives the workout: it needs no workout id at all.
        if let exerciseId = p.exerciseId {
            switch try await client.saveExerciseNote(path: .init(exerciseId: exerciseId.wire),
                                                     body: .json(.init(note: p.note))) {
            case .noContent: return .sent(nil)
            case .notFound: return .failed("TRAIN_EXERCISE_NOT_FOUND")
            case .badRequest: return Self.map(400)
            case .unauthorized: return Self.map(401)
            case .undocumented(let code, _): return Self.map(code)
            }
        }
        guard let workout = await workoutId(for: p.workoutRef) else { return .retryLater }
        switch try await client.saveWorkoutNote(path: .init(id: workout.wire), body: .json(.init(note: p.note))) {
        case .noContent: return .sent(nil)
        case .notFound: return .failed("TRAIN_WORKOUT_NOT_FOUND")
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    private func sendFinish(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = TrainPayloadCodec.decode(WorkoutFinishPayload.self, from: item.payload)
        else { return malformed("workout finish") }
        guard let workout = await workoutId(for: p.workoutRef) else { return .retryLater }
        switch try await client.finishWorkout(path: .init(id: workout.wire), body: .json(.init(note: p.note))) {
        case .ok(let ok): return .sent(TrainPayloadCodec.encode(Self.map(try ok.body.json)))
        case .notFound: return .failed("TRAIN_WORKOUT_NOT_FOUND")
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    private func sendSport(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = TrainPayloadCodec.decode(SportSessionPayload.self, from: item.payload)
        else { return malformed("sport session") }
        let body = Components.Schemas.SportSessionCreateRequest(
            sport: p.sport, date: p.date, time: p.time, duration: p.durationMinutes, setsPlayed: p.setsPlayed,
            rounds: p.rounds, rpe: p.rpe, shoulderStrain: p.shoulderStrain, notes: p.notes)
        switch try await client.logSportSession(body: .json(body)) {
        case .created: return .sent(nil)
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }
}

/// True when the failure means there is no connection at all (so it is not an attempt), rather than a request that
/// reached the net and went wrong.
func isNoConnection(_ error: Error) -> Bool {
    let codes: Set<URLError.Code> = [.notConnectedToInternet, .networkConnectionLost, .cannotFindHost,
                                     .cannotConnectToHost, .dnsLookupFailed, .dataNotAllowed,
                                     .internationalRoamingOff]
    if let e = error as? URLError { return codes.contains(e.code) }
    if let c = error as? ClientError, let e = c.underlyingError as? URLError { return codes.contains(e.code) }
    return false
}
