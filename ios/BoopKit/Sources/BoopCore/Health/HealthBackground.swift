import Foundation
import OSLog

/// The Health types whose changes wake the app in the background (B1, mezo-r36n9.11).
public enum HealthObservedKind: CaseIterable, Sendable {
    case sleep, workouts, bodyMass, hrv, restingHeartRate, steps, respiratoryRate, oxygenSaturation,
         wristTemperature, vo2max, mindful, stateOfMind

    /// Sleep, workouts and body mass ask for `.immediate` delivery (HealthKit grants it for them); the rest
    /// (steps are capped at hourly by HealthKit anyway) are hourly — a night's HRV etc. arrive in bursts.
    public var immediate: Bool {
        switch self {
        case .sleep, .workouts, .bodyMass: true
        default: false
        }
    }
}

/// Where wake-ups come from. The real one is `HKObserverQuery` + `enableBackgroundDelivery`; tests fake it.
public protocol HealthObserverSource: Sendable {
    /// Starts observing `kinds`. `onWake` is called for every change notification with the HealthKit
    /// completion handler, which MUST be called exactly once (3 missed completions stop delivery).
    func start(kinds: [HealthObservedKind], onWake: @escaping @Sendable (_ complete: @escaping @Sendable () -> Void) -> Void)
}

/// Background delivery coordinator: one coalesced incremental sync per burst of wake-ups.
///
/// - Several wakes arriving together (or during a run) share one run; a wake that lands *during* a run
///   triggers exactly one follow-up run, because the run may have read before the new data arrived.
/// - Every pending HealthKit completion handler is called on every path: success, failure, signed out
///   (the sync closure returns false at once), a locked phone (protected data unavailable → no sync is
///   attempted, anchors untouched), and the time budget running out.
/// - **Budget**: a background wake gets ~30 s. A sleep rewrite or deletion makes `HealthSync` rebuild the
///   60-day night window (and a first run is a 60-day backfill), which can exceed that; `HealthSync` has no
///   way to bound a run, so we stop *waiting* after `budget` and call the completions (the run keeps going
///   while the process lives; anchors only move after acknowledged batches, so an interrupted run re-sends).
public actor HealthBackground {
    private let source: any HealthObserverSource
    private let protectedDataAvailable: @Sendable () async -> Bool
    private let budget: Duration
    private var sync: (@Sendable () async -> Bool)?
    private var registered = false
    private var pending: [@Sendable () -> Void] = []
    private var running = false
    private var rerun = false
    private let log = Logger(subsystem: "io.mrkuhne.boop", category: "health-background")

    public init(source: any HealthObserverSource,
                protectedDataAvailable: @escaping @Sendable () async -> Bool = { true },
                budget: Duration = .seconds(25)) {
        self.source = source; self.protectedDataAvailable = protectedDataAvailable; self.budget = budget
    }

    /// Registers the observers once; a second call only swaps the sync closure (never doubles observers).
    /// `sync` is the signed-in user's `HealthSync.syncIncremental`, or false when nobody is signed in.
    public func registerObservers(sync: @escaping @Sendable () async -> Bool) {
        self.sync = sync
        guard !registered else { return }
        registered = true
        source.start(kinds: HealthObservedKind.allCases) { [weak self] complete in
            guard let self else { complete(); return }
            Task { await self.wake(complete) }
        }
    }

    func wake(_ complete: @escaping @Sendable () -> Void) async {
        pending.append(complete)
        if running { rerun = true; return }
        running = true
        repeat {
            rerun = false
            let batch = pending
            pending = []
            _ = await runOnce()
            batch.forEach { $0() }
            // wakes that arrived during the run stay in `pending` and get the follow-up run
        } while rerun
        running = false
        let leftover = pending; pending = []
        leftover.forEach { $0() }
    }

    private func runOnce() async -> Bool {
        guard let sync else { return false }
        guard await protectedDataAvailable() else {
            log.info("locked phone: skipping the sync, anchors stay")
            return false
        }
        return await withBudget(sync)
    }

    private func withBudget(_ work: @escaping @Sendable () async -> Bool) async -> Bool {
        let budget = self.budget
        return await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            let once = Once(cont)
            Task { once.resume(await work()) }
            Task { try? await Task.sleep(for: budget); once.resume(false) }
        }
    }
}

private final class Once: @unchecked Sendable {
    private let lock = NSLock()
    private var cont: CheckedContinuation<Bool, Never>?
    init(_ cont: CheckedContinuation<Bool, Never>) { self.cont = cont }
    func resume(_ value: Bool) {
        let c = lock.withLock { let c = cont; cont = nil; return c }
        c?.resume(returning: value)
    }
}

#if canImport(HealthKit) && os(iOS)
import HealthKit
import UIKit

/// `HKObserverQuery` per observed type + `enableBackgroundDelivery`.
public final class HealthKitObserverSource: HealthObserverSource, @unchecked Sendable {
    private let store = HKHealthStore()
    private let lock = NSLock()
    private var queries: [HKObserverQuery] = []
    public init() {}

    public func start(kinds: [HealthObservedKind], onWake: @escaping @Sendable (@escaping @Sendable () -> Void) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        for kind in kinds {
            guard let type = Self.type(for: kind) else { continue }
            let q = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, error in
                // On a query error there is nothing to sync; still hand the completion back.
                if error != nil { completion(); return }
                onWake { completion() }
            }
            store.execute(q)
            lock.withLock { queries.append(q) }
            store.enableBackgroundDelivery(for: type, frequency: kind.immediate ? .immediate : .hourly) { _, _ in }
        }
    }

    static func type(for kind: HealthObservedKind) -> HKSampleType? {
        switch kind {
        case .sleep: HKCategoryType(.sleepAnalysis)
        case .workouts: HKObjectType.workoutType()
        case .bodyMass: HKQuantityType(.bodyMass)
        case .hrv: HKQuantityType(.heartRateVariabilitySDNN)
        case .restingHeartRate: HKQuantityType(.restingHeartRate)
        case .steps: HKQuantityType(.stepCount)
        case .respiratoryRate: HKQuantityType(.respiratoryRate)
        case .oxygenSaturation: HKQuantityType(.oxygenSaturation)
        case .wristTemperature: HKQuantityType(.appleSleepingWristTemperature)
        case .vo2max: HKQuantityType(.vo2Max)
        case .mindful: HKCategoryType(.mindfulSession)
        case .stateOfMind: HKObjectType.stateOfMindType()
        }
    }
}

extension HealthBackground {
    /// The app's instance: real observers; a locked phone (protected data unavailable) skips the run.
    public static let shared = HealthBackground(
        source: HealthKitObserverSource(),
        protectedDataAvailable: { await MainActor.run { UIApplication.shared.isProtectedDataAvailable } })
}
#endif
