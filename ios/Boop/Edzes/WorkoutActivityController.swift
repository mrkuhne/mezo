import ActivityKit
import BoopCore
import Foundation
import os

/// What the Lock Screen card shows for a session (`mezo-r36n9.172`, step 2) — nil when there is nothing to show (the
/// workout is over).
enum WorkoutActivityState {
    static func state(_ s: WorkoutSession, now: Date) -> WorkoutActivityAttributes.ContentState? {
        guard let cur = s.current else { return nil }
        let progress = s.progress
        let index = min(cur.logged.count, max(0, cur.setCount - 1)) + 1
        let p = WorkoutSession.prefill(for: cur)
        // A planned technique set needs the player for its steps: the card shows it, but „Kész" stays in the app.
        let next = cur.logged.count
        let plain = !(cur.planned.indices.contains(next) && (cur.plan(at: next)?.isTechnique ?? false))
        func make(_ phase: WorkoutActivityAttributes.ContentState.Phase, rest: Date?, total: TimeInterval?,
                  target: Bool = true) -> WorkoutActivityAttributes.ContentState {
            .init(phase: phase, exercise: cur.name, setIndex: index, setCount: cur.setCount,
                  done: progress.done, total: progress.total,
                  targetKg: target ? p.kg : nil, targetReps: target ? p.reps : nil,
                  restEndsAt: rest, restTotal: rest == nil ? nil : total, canLogHere: plain)
        }
        if let run = s.technique, run.exerciseId == cur.id, run.next != nil {
            let ends = run.restEndsAt.flatMap { $0 > now ? $0 : nil }
            return make(.technique, rest: ends, total: run.restTotal, target: false)
        }
        if cur.isDone && cur.feedback == nil { return make(.debrief, rest: nil, total: nil, target: false) }
        if let ends = s.restEndsAt, ends > now { return make(.rest, rest: ends, total: s.restTotal) }
        return make(.set, rest: nil, total: nil)
    }
}

/// Keeps the one workout card in step with the session. The seam the intents and the store talk to.
@MainActor
protocol WorkoutActivitySyncing: AnyObject {
    func sessionChanged(_ s: WorkoutSession?, dayName: String?) async
    func endAll() async
}

/// The real card, over ActivityKit. One card per workout (`ref`); a card of another workout is ended. Every change
/// goes through one chain, so an end never overtakes the update before it.
@MainActor
final class WorkoutActivityController: WorkoutActivitySyncing {
    static let shared = WorkoutActivityController()
    nonisolated private static let log = Logger(subsystem: "hu.mezo.boop", category: "WorkoutActivity")
    private var tail: Task<Void, Never>?

    func sessionChanged(_ s: WorkoutSession?, dayName: String?) async {
        await chain { await Self.apply(s, dayName: dayName) }
    }

    func endAll() async { await chain { await Self.apply(nil, dayName: nil) } }

    #if DEBUG
    /// Simulator review: `-previewLiveActivity set|rest|stale|technique|debrief` puts a sample workout card (invented
    /// numbers) on the Lock Screen; its buttons act on no session.
    static func debugPreview() async {
        guard let kind = UserDefaults.standard.string(forKey: "previewLiveActivity") else { return }
        typealias S = WorkoutActivityAttributes.ContentState
        let now = Date()
        let phase: S.Phase = switch kind { case "set": .set; case "technique": .technique; case "debrief": .debrief; default: .rest }
        let resting = kind == "rest" || kind == "stale"
        let ends = kind == "stale" ? now.addingTimeInterval(-5) : now.addingTimeInterval(82)
        let state = S(phase: phase, exercise: "Fekvenyomás", setIndex: 3, setCount: 4, done: 7, total: 16,
                      targetKg: 80, targetReps: 8, restEndsAt: resting ? ends : nil, restTotal: resting ? 90 : nil,
                      canLogHere: true)
        for a in Activity<WorkoutActivityAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
        do {
            _ = try Activity.request(attributes: WorkoutActivityAttributes(ref: "preview", dayName: "Push nap"),
                                     content: ActivityContent(state: state, staleDate: resting ? ends : nil), pushType: nil)
            print("LIVEPREVIEW started, enabled=\(ActivityAuthorizationInfo().areActivitiesEnabled)")
        } catch {
            print("LIVEPREVIEW failed: \(error)")
        }
    }
    #endif

    private func chain(_ work: @escaping @MainActor () async -> Void) async {
        let previous = tail
        let next = Task { @MainActor in
            await previous?.value
            await work()
        }
        tail = next
        await next.value
    }

    // Off the main actor: ActivityKit's `Activity` is not Sendable, so it must not cross from it.
    nonisolated private static func apply(_ s: WorkoutSession?, dayName: String?) async {
        let running = Activity<WorkoutActivityAttributes>.activities
        guard let s, let state = WorkoutActivityState.state(s, now: Date()) else {
            for a in running { await a.end(nil, dismissalPolicy: .immediate) }
            return
        }
        let ref = s.ref.uuidString
        for a in running where a.attributes.ref != ref { await a.end(nil, dismissalPolicy: .immediate) }
        // Stale when the rest runs out with nobody touching the phone: the card then says „Lejárt a pihenő".
        let content = ActivityContent(state: state, staleDate: state.restEndsAt)
        if let a = running.first(where: { $0.attributes.ref == ref }) {
            await a.update(content)
        } else if ActivityAuthorizationInfo().areActivitiesEnabled {
            do {
                _ = try Activity.request(attributes: WorkoutActivityAttributes(ref: ref, dayName: dayName ?? ""),
                                         content: content, pushType: nil)
            } catch {
                log.error("workout card not started: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}

/// No card at all (unit tests).
@MainActor
final class NoWorkoutActivity: WorkoutActivitySyncing {
    func sessionChanged(_ s: WorkoutSession?, dayName: String?) async {}
    func endAll() async {}
}

/// What the card's buttons do. The room's store when one is alive (it saves, re-arms the rest end and updates the
/// card); else the workout file of the last signed-in user — a killed app is launched in the background to run the
/// intent, with no `RootView`.
@MainActor
enum WorkoutLiveActions {
    /// The Edzés room's store, while it exists.
    static weak var liveStore: EdzesStore?
    /// Unit tests never start a real card (their host is the app itself). Neither does a `-previewLiveActivity` run: its
    /// sample card would be ended at once by the preview account's start-up (no workout file → `endAll`).
    static var activities: WorkoutActivitySyncing = {
        if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil { return NoWorkoutActivity() }
        #if DEBUG
        if UserDefaults.standard.string(forKey: "previewLiveActivity") != nil { return NoWorkoutActivity() }
        #endif
        return WorkoutActivityController.shared
    }()
    /// Seconds a „+15 mp" adds.
    static let addSeconds: TimeInterval = 15

    static func run(_ action: WorkoutLiveAction, now: Date = Date()) async {
        if let store = liveStore, var s = store.session {
            let items = apply(action, to: &s, now: now)
            store.update(s)
            await enqueue(items, outbox: BackgroundSyncHost.ritmus?.outbox ?? HeadlessContext.outbox())
            return
        }
        guard let userId = BackgroundSyncHost.lastUserId else { return }
        let file = EdzesStore.sessionFile(in: RitmusEnvironment.directories(for: userId).outbox)
        await runOnFile(action, file: file, outbox: BackgroundSyncHost.ritmus?.outbox ?? HeadlessContext.outbox(), now: now)
    }

    /// The killed-app path: the session file is read, changed and written back; the set goes to the per-user queue.
    static func runOnFile(_ action: WorkoutLiveAction, file: URL, outbox: Outbox?, now: Date) async {
        guard let data = try? Data(contentsOf: file), var s = try? JSONDecoder().decode(WorkoutSession.self, from: data) else {
            await activities.endAll()          // no workout on the phone: a card left over is ended
            return
        }
        let items = apply(action, to: &s, now: now)
        if let out = try? JSONEncoder().encode(s) {
            try? out.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
        await enqueue(items, outbox: outbox)
        await ReminderHub.restEnd?.sessionChanged(s, now: now)
        await activities.sessionChanged(s, dayName: nil)
    }

    /// The change itself, and the writes it makes. A button that no longer fits the session (the rest already over,
    /// the set already logged in the app) does nothing.
    static func apply(_ action: WorkoutLiveAction, to s: inout WorkoutSession, now: Date,
                      calendar: Calendar = .current) -> [OutboxItem] {
        switch action {
        case .addRest:
            if let ends = s.restEndsAt, ends > now { s.addRest(addSeconds, now: now) }
            return []
        case .skipRest:
            if let run = s.technique, run.restEndsAt != nil { s.skipTechniqueRest() } else { s.skipRest() }
            return []
        case .logSet:
            guard let state = WorkoutActivityState.state(s, now: now), state.phase == .set, state.canLogHere,
                  let e = s.current else { return [] }
            let p = WorkoutSession.prefill(for: e)
            let before = Set(s.loggedSets.map(\.id))
            s.log(kg: p.kg, reps: p.reps, rir: p.rir, now: now)
            let day = HeadlessContext.day(of: now, calendar: calendar)
            return s.all.flatMap { ex in
                ex.logged.filter { !before.contains($0.id) }.compactMap { setItem(session: s, exerciseId: ex.id, set: $0, date: day) }
            }
        }
    }

    /// The queued write of one logged set — the same item the player's „Kész" makes (`EdzesRoom.enqueueSet`).
    static func setItem(session: WorkoutSession, exerciseId: UUID, set: SessionSet, date: String) -> OutboxItem? {
        guard let exercise = session.exercises[exerciseId] else { return nil }
        // The set's own place in the exercise, found by id: a technique set is appended only when its last step
        // is done, and a skip or a switch can be what finishes it.
        let index = exercise.logged.firstIndex { $0.id == set.id } ?? max(0, exercise.logged.count - 1)
        let plan = exercise.plan(at: index)
        let payload = WorkoutSetPayload(
            workoutRef: session.ref, exerciseId: exerciseId,
            setIndex: index,
            weightKg: set.kg ?? 0, reps: set.reps, rir: set.rir, kind: set.kind,
            targetWeightKg: plan?.targetKg, targetReps: plan?.targetReps,
            technique: set.technique?.rawValue, legs: set.legs?.map(WorkoutLegPayload.init))
        return .workoutWrite(.workoutSet, payload: TrainPayloadCodec.encode(payload),
                             workoutRef: session.ref, date: date, capturedAt: set.at)
    }

    private static func enqueue(_ items: [OutboxItem], outbox: Outbox?) async {
        for item in items { try? await outbox?.enqueue(item) }
    }
}
