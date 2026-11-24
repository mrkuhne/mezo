import Foundation
import Observation

/// One body sample from Apple Health (the Feelfit scale writes fat % and lean mass there).
public struct SulyBodySample: Codable, Equatable, Sendable {
    public let date: Date
    public let value: Double
    public let source: String
    public init(date: Date, value: Double, source: String) { self.date = date; self.value = value; self.source = source }
}

/// Everything the Súly room shows, as one read: the season (nil = no active season), the smoothed trend, the weigh-ins
/// and the last 90 days of body samples. Cached as one, so an offline room is one coherent old picture.
public struct SulySnapshot: Codable, Equatable, Sendable {
    public let season: EvadOverview?
    public let trend: SulyTrend?
    public let logs: [SulyLog]
    public let fatPct: [SulyBodySample]
    public let leanKg: [SulyBodySample]
    /// From the biometric profile; nil without one (the BMI then stays „–").
    public let heightCm: Double?
    public let fetchedAt: Date
    public init(season: EvadOverview?, trend: SulyTrend?, logs: [SulyLog], fatPct: [SulyBodySample],
                leanKg: [SulyBodySample], heightCm: Double? = nil, fetchedAt: Date) {
        self.season = season; self.trend = trend; self.logs = logs; self.fatPct = fatPct; self.leanKg = leanKg
        self.heightCm = heightCm; self.fetchedAt = fetchedAt
    }
}

/// The Súly area's data (`mezo-r36n9.158`), the Pénz / Évad way: read from the server first, written to the per-user
/// `ServerCache`; with no net the last known picture **with its age**; a refusal or a fault reported as itself.
/// The season's absence (404) is an answer, not a failure: the trend and the weigh-ins still show, the head says
/// „Nincs évad". The four reads run as unstructured tasks — never `async let` (boop-ios.md §9).
@MainActor @Observable
public final class SulyStore {
    public private(set) var snapshot: SulySnapshot?
    /// How old the snapshot on screen is when it came from the cache; nil for a fresh read.
    public private(set) var age: TimeInterval?
    public private(set) var offline = false
    public private(set) var problem: PlanFetchError?
    public private(set) var loading = false

    public static let maxAge: TimeInterval = 14 * 86_400
    /// How far back the body samples are read.
    public static let bodyDays = 90
    static let endpoint = "suly/snapshot"
    static let key = "-"

    @ObservationIgnored let evad: EvadClient?
    @ObservationIgnored let client: SulyClient?
    @ObservationIgnored let health: HealthReader?
    @ObservationIgnored private let cache: ServerCache?
    @ObservationIgnored private let clock: @Sendable () -> Date
    @ObservationIgnored private var reloadAgain = false

    public init(evad: EvadClient?, client: SulyClient?, health: HealthReader?, cache: ServerCache?,
                clock: @escaping @Sendable () -> Date = { Date() }) {
        self.evad = evad; self.client = client; self.health = health; self.cache = cache; self.clock = clock
    }

    // MARK: - What the room and the ring read

    public var course: SulyCourse { SulyCourse(trajectory: snapshot?.season?.head.trajectory) }

    /// The orb's number: the trend's four-week rate against the season's planned rate (maintain: the band). nil
    /// without a season, without a trend, or while the trend has no data behind it.
    public var score: Int? {
        guard let s = snapshot, let season = s.season, let trend = s.trend, trend.dataSufficiency != "none" else { return nil }
        let w = season.weight
        return sulyPaceScore(actualKgPerWeek: trend.last4wRateKgPerWeek, plannedKgPerWeek: w.kgPerWeek, course: course,
                             trendKg: trend.latestTrendKg ?? w.trendKg, bandLowKg: w.band?.lowKg ?? season.pillars.weight.band?.lowKg,
                             bandHighKg: w.band?.highKg ?? season.pillars.weight.band?.highKg)
    }

    public var head: SulyHead {
        let season = snapshot?.season
        return sulyHead(status: season?.head.status, course: course,
                        trendKg: snapshot?.trend?.latestTrendKg ?? season?.weight.trendKg,
                        targetKg: season?.weight.targetKg, targetDate: season?.pillars.weight.targetDate,
                        actualKgPerWeek: snapshot?.trend?.last4wRateKgPerWeek, plannedKgPerWeek: season?.weight.kgPerWeek,
                        hasSeason: season != nil)
    }

    /// The trend weight on the profile's height, one decimal; nil without either.
    public var bmi: Double? {
        sulyBmi(kg: snapshot?.trend?.latestTrendKg ?? snapshot?.season?.weight.trendKg, heightCm: snapshot?.heightCm)
    }

    /// "5 órás adat" while a cached snapshot is on screen.
    public var ageText: String? { offline ? penzAgeText(age) : nil }

    // MARK: - Reading

    nonisolated static func attempt<T: Sendable>(_ op: @Sendable () async throws -> T) async -> Result<T, PlanFetchError> {
        do { return .success(try await op()) } catch { return .failure((error as? PlanFetchError) ?? .server) }
    }

    /// Reads everything. Without `force` it reads once — and again while the last attempt found no net or a fault.
    public func load(force: Bool = false) async {
        guard let client, let evad else {
            if snapshot == nil { problem = .unauthorized }
            return
        }
        let retryable = problem == nil || problem == .offline || problem == .server
        guard force || (snapshot == nil && retryable) || offline else { return }
        if loading {
            if force { reloadAgain = true }
            return
        }
        loading = true
        await read(evad: evad, client: client)
        loading = false
        if reloadAgain {
            reloadAgain = false
            await load(force: true)
        }
    }

    private func read(evad: EvadClient, client: SulyClient) async {
        let now = clock()
        let since = now.addingTimeInterval(-Double(Self.bodyDays) * 86_400)
        let health = self.health
        let season = Task { await Self.attempt { try await evad.overview() } }
        let trend = Task { await Self.attempt { try await client.trend() } }
        let logs = Task { await Self.attempt { try await client.logs() } }
        let fat = Task { await Self.attempt { try await health?.readSamples(.bodyFatPct, from: since, to: now) ?? [] } }
        let lean = Task { await Self.attempt { try await health?.readSamples(.leanBodyMass, from: since, to: now) ?? [] } }
        let profile = Task { await Self.attempt { try await client.profile() } }
        let (rs, rt, rl, rf, rln) = await (season.value, trend.value, logs.value, fat.value, lean.value)
        // The height is a nicety for the BMI: a failed profile read costs the number, never the room.
        let heightCm: Double? = { if case .success(let p) = $0 { p.heightCm } else { nil } }(await profile.value)

        // The season: an answer (fresh or "none"), or a failure to weigh with the others.
        let seasonValue: EvadOverview??
        switch rs {
        case .success(let o): seasonValue = .some(o)
        case .failure(.notFound): seasonValue = .some(nil)
        case .failure: seasonValue = nil
        }
        var failures: [PlanFetchError] = []
        if case .failure(let e) = rt { failures.append(e) }
        if case .failure(let e) = rl { failures.append(e) }
        if seasonValue == nil { failures.append(Self.failure(rs)) }
        if let seasonValue, case .success(let t) = rt, case .success(let l) = rl {
            let fresh = SulySnapshot(season: seasonValue, trend: t, logs: l,
                                     fatPct: Self.body(rf, percent: true), leanKg: Self.body(rln, percent: false),
                                     heightCm: heightCm, fetchedAt: now)
            snapshot = fresh; age = nil; offline = false; problem = nil
            try? await cache?.put(fresh, endpoint: Self.endpoint, date: Self.key)
            return
        }
        // Not a full fresh picture: the cache, else the problem.
        let worst = failures.contains(.offline) ? PlanFetchError.offline : (failures.first ?? .server)
        if worst == .offline, let hit = await cache?.get(SulySnapshot.self, endpoint: Self.endpoint, date: Self.key, maxAge: Self.maxAge) {
            snapshot = hit.value; age = hit.age; offline = true; problem = nil
        } else if snapshot == nil {
            problem = worst
        } else if worst == .offline {
            // The picture on screen is the last one; its age (if it came from the cache) stays what it was.
            offline = true
        }
        // A fault with a picture on screen changes nothing: an old answer is never dressed as a fresh one (the Évad rule).
    }

    private static func failure<T>(_ r: Result<T, PlanFetchError>) -> PlanFetchError {
        if case .failure(let e) = r { e } else { .server }
    }

    /// Health's samples as the room's rows, oldest first; body fat comes as a fraction and is kept as percent.
    private static func body(_ r: Result<[HealthSampleValue], PlanFetchError>, percent: Bool) -> [SulyBodySample] {
        guard case .success(let samples) = r else { return [] }
        return samples.sorted { $0.start < $1.start }.map {
            SulyBodySample(date: $0.start, value: percent ? (percentFromFraction($0.value) * 10).rounded() / 10 : ($0.value * 10).rounded() / 10,
                           source: $0.sourceName)
        }
    }
}
