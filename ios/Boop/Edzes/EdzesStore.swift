import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The training client, handed down the view tree

private struct TrainClientKey: EnvironmentKey { static let defaultValue: TrainClient? = nil }
private struct ServerCacheKey: EnvironmentKey { static let defaultValue: ServerCache? = nil }

extension EnvironmentValues {
    /// The signed-in user's training client (nil before sign-in, and in tests that have no server).
    var trainClient: TrainClient? {
        get { self[TrainClientKey.self] }
        set { self[TrainClientKey.self] = newValue }
    }

    /// The user's last-known-good read cache (nil before sign-in).
    var serverCache: ServerCache? {
        get { self[ServerCacheKey.self] }
        set { self[ServerCacheKey.self] = newValue }
    }
}

/// What the Edzés room reads (B5). Today's resolved session is the only read the Ma tab needs; the other three
/// tabs arrive with their own stages.
///
/// **Offline is a first-class answer, not an error state.** Every read goes to the server first and is written to
/// `ServerCache` on success; when the server cannot be reached, the room shows the **last known good** answer
/// with **how old it is**, and when there is no cache either it says so. Nothing here ever substitutes a zero for
/// a number it does not have.
@MainActor @Observable
final class EdzesStore {
    /// Today's session as the server resolved it, with the instant that answer came from.
    private(set) var today: Cached<TodayWorkout>?
    private(set) var problem: TrainFetchError?
    private(set) var loading = false
    /// The running block: its weeks, where he is in them, and each muscle's volume. Loaded on
    /// its own so a block the server cannot produce never blanks today's session, and the
    /// other way round.
    private(set) var block: Cached<BlockPlan>?
    private(set) var blockProblem: TrainFetchError?
    private(set) var blockLoaded = false

    /// A cached day stays usable all day — the plan for today does not change under him — but it always says its
    /// age. Older than this and it is not today's plan any more.
    static let maxAge: TimeInterval = 36 * 3600
    /// The block moves once a week, so a cached one stays usable far longer than a day's plan.
    static let blockMaxAge: TimeInterval = 8 * 86_400
    private static let endpoint = "train/today"
    private static let blockEndpoint = "train/block"

    private let client: TrainClient?
    private let cache: ServerCache?
    private let clock: @MainActor () -> Date

    init(client: TrainClient?, cache: ServerCache?, clock: @escaping @MainActor () -> Date = { Date() }) {
        self.client = client; self.cache = cache; self.clock = clock
    }

    /// `yyyy-MM-dd` of the day this store is about, in the device's own calendar.
    private var day: String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .autoupdatingCurrent
        let c = cal.dateComponents([.year, .month, .day], from: clock())
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Load today's session. Already-loaded days are not re-fetched unless `force` is set, so moving between the
    /// room's tabs costs nothing.
    func load(force: Bool = false) async {
        guard let client else {
            // No client at all (not signed in, or a test): nothing to say, and nothing invented.
            if today == nil { problem = .unauthorized }
            return
        }
        guard force || (today == nil && problem == nil) else { return }
        loading = true
        defer { loading = false }
        let date = day
        do {
            let fresh = try await client.todayWorkout()
            today = Cached(value: fresh, fetchedAt: clock(), age: 0)
            problem = nil
            try? await cache?.put(fresh, endpoint: Self.endpoint, date: date)
        } catch {
            let failure = (error as? TrainFetchError) ?? .server
            // Only the network sends us to the cache. A refusal or a server fault is not "here is an old answer":
            // it is a problem the room reports.
            if failure == .offline, let hit = await cache?.get(TodayWorkout.self, endpoint: Self.endpoint,
                                                               date: date, maxAge: Self.maxAge) {
                today = hit
                problem = nil
            } else {
                problem = failure
            }
        }
    }

    /// The running block. Same rule as the day: the server first, the cache only when there is
    /// no network, and the age always said.
    func loadBlock(force: Bool = false) async {
        guard let client else { blockLoaded = true; return }
        guard force || !blockLoaded else { return }
        blockLoaded = true
        let key = "current"
        do {
            let fresh = try await client.blockPlan()
            if let fresh {
                block = Cached(value: fresh, fetchedAt: clock(), age: 0)
                try? await cache?.put(fresh, endpoint: Self.blockEndpoint, date: key)
            } else {
                // No running block at all. That is an answer, and the tab says it in words —
                // it is not a failure and it must not show a stale block instead.
                block = nil
            }
            blockProblem = nil
        } catch {
            let failure = (error as? TrainFetchError) ?? .server
            if failure == .offline, let hit = await cache?.get(BlockPlan.self, endpoint: Self.blockEndpoint,
                                                               date: key, maxAge: Self.blockMaxAge) {
                block = hit
                blockProblem = nil
            } else {
                blockProblem = failure
            }
        }
    }

    var blockAgeText: String? { Self.ageText(block?.age) }

    /// How old what the room shows is, in his words — nil when it came from the server just now.
    var ageText: String? { Self.ageText(today?.age) }

    /// „2 napos terv" / „5 órás terv"; nothing under a quarter of an hour, because a fresh read is not news.
    static func ageText(_ age: TimeInterval?) -> String? {
        guard let age, age >= 900 else { return nil }
        let hours = Int(age / 3600)
        if hours < 24 { return "\(max(1, hours)) órás terv" }
        return "\(hours / 24) napos terv"
    }
}

// MARK: - What today's session asks of the body

/// Today's load per muscle, for the body map: **relative to the hardest-worked muscle today**,
/// because one session has no meaning against a weekly landmark — a single day cannot be "over
/// MRV". The hardest-worked muscle is fully lit and the rest are read against it.
///
/// Only the working sets count. Warmups are not load, and counting them would make a long
/// warm-up look like volume.
func edzesBodyHeat(_ workout: TodayWorkout?) -> [NKBodyHeat] {
    guard let workout else { return [] }
    var sets: [String: Int] = [:]
    for e in workout.exercises {
        let working = e.sets.filter { $0.kind == .working }.count
        sets[e.muscle, default: 0] += working > 0 ? working : e.workingCount
    }
    guard let top = sets.values.max(), top > 0 else { return [] }
    return sets.map { NKBodyHeat(muscle: $0.key, level: Double($0.value) / Double(top)) }
        .sorted { $0.muscle < $1.muscle }
}

/// Today's session in three numbers: how many exercises, how many working sets, and roughly how
/// long. Each is `nil` when the plan does not say — the room prints a dash, never a 0.
struct EdzesSummary: Equatable {
    var exercises: Int?
    var workingSets: Int?
    var minutes: Int?
}

func edzesSummary(_ workout: TodayWorkout?, brief: Brief?) -> EdzesSummary {
    var out = EdzesSummary()
    if let workout, !workout.exercises.isEmpty {
        out.exercises = workout.exercises.count
        let sets = workout.exercises.reduce(0) { sum, e in
            let working = e.sets.filter { $0.kind == .working }.count
            return sum + (working > 0 ? working : e.workingCount)
        }
        out.workingSets = sets > 0 ? sets : nil
    } else if let e = brief?.day.session?.exercises, !e.isEmpty {
        out.exercises = e.count
        let sets = e.reduce(0) { $0 + $1.sets }
        out.workingSets = sets > 0 ? sets : nil
    }
    out.minutes = brief?.day.session?.minutes ?? workout?.durationEst
    return out
}

/// The block's weeks for the timeline: the phase curve as height, and where he is now.
func edzesTimeline(_ block: BlockPlan?) -> [NKBlockWeek] {
    guard let block, block.weeks > 0 else { return [] }
    return (1...block.weeks).map { week in
        let phase = block.phaseCurve.indices.contains(week - 1) ? block.phaseCurve[week - 1] : .mav
        let state: NKBlockWeek.State = week < block.currentWeek ? .past
            : (week == block.currentWeek ? .current : .future)
        return NKBlockWeek(week: week, load: phaseLoad(phase), phase: phase.hungarian,
                           state: state, isDeload: phase == .deload)
    }
}

/// How hard a phase asks you to work, as a height. A deload is drawn low **and** hollow, so it
/// reads as the planned easy week rather than as a week that went wrong.
private func phaseLoad(_ phase: BlockPhase) -> Double {
    switch phase {
    case .mev: 0.45
    case .mav: 0.72
    case .mrv: 1.0
    case .deload: 0.3
    }
}
