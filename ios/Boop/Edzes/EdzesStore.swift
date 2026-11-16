import SwiftUI
import BoopCore

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

    /// A cached day stays usable all day — the plan for today does not change under him — but it always says its
    /// age. Older than this and it is not today's plan any more.
    static let maxAge: TimeInterval = 36 * 3600
    private static let endpoint = "train/today"

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
