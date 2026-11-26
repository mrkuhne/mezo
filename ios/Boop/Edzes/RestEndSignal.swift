import BoopCore
import BoopDesign
import Foundation

/// What rings when the rest between sets ends and the workout is not on screen (spec D5).
enum RestEndMode: String, Codable, Sendable {
    /// A notification: a short sound, only a buzz on a muted phone. The default.
    case vibrate
    /// An AlarmKit alarm: full screen, rings on silent.
    case alarm

    /// Per user, in `UserDefaults` (not in the reminders file).
    static func key(for userKey: String) -> String { "boop.restEnd.\(userKey)" }
    static func load(userKey: String, defaults: UserDefaults = .standard) -> RestEndMode {
        defaults.string(forKey: key(for: userKey)).flatMap(RestEndMode.init(rawValue:)) ?? .vibrate
    }
    static func save(_ mode: RestEndMode, userKey: String, defaults: UserDefaults = .standard) {
        defaults.set(mode.rawValue, forKey: key(for: userKey))
    }
}

/// Keeps one "rest is over" signal armed for the running workout: re-armed on every session change (a rest started,
/// +15 s, skipped), cancelled when the rest is gone or past, the workout ends, or he signs out.
/// Everything goes through one task chain so a cancel never overtakes the add before it.
@MainActor
final class RestEndSignal {
    nonisolated static let notificationId = "boop.rest"
    static let title = "Lejárt a pihenő"

    private let alarms: AlarmScheduling
    private let center: ReminderCenter
    private let mode: () -> RestEndMode
    private let clock: () -> Date
    private var target: Target?
    private var foreground = true
    private var inFlight: Task<Void, Never>?

    struct Target: Equatable { let fireAt: Date; let body: String }

    init(alarms: AlarmScheduling, center: ReminderCenter, mode: @escaping () -> RestEndMode,
         clock: @escaping () -> Date = { Date() }) {
        self.alarms = alarms; self.center = center; self.mode = mode; self.clock = clock
    }

    /// When the running rest ends and what comes after it — nil when no rest is running (or it is already past).
    nonisolated static func target(for s: WorkoutSession?, now: Date) -> Target? {
        guard let s else { return nil }
        // Inside a technique set the short step rest is the one that is running.
        let techRest = s.technique?.restEndsAt.map { (ends: $0, exercise: s.technique.map { $0.exerciseId }) }
        let ends: Date
        var exerciseId: UUID?
        if let techRest, techRest.ends > now { ends = techRest.ends; exerciseId = techRest.exercise }
        else if let rest = s.restEndsAt, rest > now { ends = rest }
        else { return nil }
        let exercise = exerciseId.flatMap { s.exercises[$0] }
            ?? (s.current.map { $0.isDone ? (s.all.first { !$0.isDone } ?? $0) : $0 })
        let body = exercise.map { "\($0.name) · \(min($0.logged.count, max(0, $0.setCount - 1)) + 1). sorozat" } ?? "Mehet a következő sorozat"
        return Target(fireAt: ends, body: body)
    }

    func sessionChanged(_ s: WorkoutSession?, now: Date) async {
        target = Self.target(for: s, now: now)
        await run { await $0.apply() }
    }

    /// Alarm mode: silent while the app is open (the player shows the countdown), armed once it goes to the background.
    func foregroundChanged(_ inForeground: Bool) async {
        foreground = inForeground
        await run { await $0.apply() }
    }

    /// The setting changed: whatever was armed for the old mode is replaced.
    func modeChanged() async { await run { await $0.apply() } }

    func signedOut() async {
        target = nil
        await run { await $0.apply() }
    }

    private func run(_ work: @escaping @MainActor (RestEndSignal) async -> Void) async {
        let previous = inFlight
        let task = Task { @MainActor [self] in
            await previous?.value
            await work(self)
        }
        inFlight = task
        await task.value
    }

    private func apply() async {
        center.cancel(id: Self.notificationId)
        guard let t = target, t.fireAt > clock() else { await alarms.cancelRest(); return }
        switch mode() {
        case .vibrate:
            await alarms.cancelRest()
            try? await center.scheduleAt(id: Self.notificationId, fireAt: t.fireAt, title: Self.title, body: t.body)
        case .alarm:
            if foreground { await alarms.cancelRest(); return }
            do { try await alarms.scheduleRest(at: t.fireAt, title: Self.title, tint: Hue.mozgas.glow) }
            catch {
                // The system refused: a quiet notification beats silence.
                try? await center.scheduleAt(id: Self.notificationId, fireAt: t.fireAt, title: Self.title, body: t.body)
            }
        }
    }
}
