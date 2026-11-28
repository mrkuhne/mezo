import Foundation
import Observation

/// The Test tab's data (`mezo-r36n9.205`): this week's muscle heat, six weeks of shoulder and this week's rest gaps.
/// **Cache first** like the other Sport stores; each read keeps its cached copy when it fails. Read-only.
@MainActor @Observable
public final class SportBodyStore {
    public private(set) var body: SportBodyWeek?
    public private(set) var shoulder: SportShoulder?
    public private(set) var gaps: SportGaps?
    public private(set) var problem: PlanFetchError?
    public private(set) var offline = false
    public private(set) var loading = false

    static let bodyEndpoint = "sport/body"
    static let shoulderEndpoint = "sport/shoulder"
    static let gapsEndpoint = "sport/gaps"
    static let key = "-"

    @ObservationIgnored let client: SportClient?
    @ObservationIgnored private let cache: ServerCache?
    @ObservationIgnored private var primed = false
    @ObservationIgnored private var fresh = false

    public init(client: SportClient?, cache: ServerCache?) {
        self.client = client; self.cache = cache
    }

    /// Nothing to show yet and nothing cached.
    public var isEmpty: Bool { body == nil && shoulder == nil && gaps == nil }

    public func load(force: Bool = false) async {
        guard let client else { if isEmpty { problem = .unauthorized }; return }
        await primeFromCache()
        guard force || !fresh || offline || problem != nil, !loading else { return }
        loading = true
        defer { loading = false }
        async let b = Self.attempt { () async throws(PlanFetchError) -> SportBodyWeek in try await client.body() }
        async let s = Self.attempt { () async throws(PlanFetchError) -> SportShoulder in try await client.shoulder(weeks: 6) }
        async let g = Self.attempt { () async throws(PlanFetchError) -> SportGaps in try await client.gaps() }
        let (rb, rs, rg) = await (b, s, g)
        var failure: PlanFetchError?
        switch rb {
        case .success(let v): body = v; try? await cache?.put(v, endpoint: Self.bodyEndpoint, date: Self.key)
        case .failure(let f): failure = f
        }
        switch rs {
        case .success(let v): shoulder = v; try? await cache?.put(v, endpoint: Self.shoulderEndpoint, date: Self.key)
        case .failure(let f): failure = failure ?? f
        }
        switch rg {
        case .success(let v): gaps = v; try? await cache?.put(v, endpoint: Self.gapsEndpoint, date: Self.key)
        case .failure(let f): failure = failure ?? f
        }
        fresh = failure == nil
        offline = failure == .offline && !isEmpty
        problem = isEmpty ? failure : (failure == nil || failure == .offline ? nil : failure)
    }

    private static func attempt<T: Sendable>(_ op: @Sendable () async throws(PlanFetchError) -> T) async -> Result<T, PlanFetchError> {
        do throws(PlanFetchError) { return .success(try await op()) } catch { return .failure(error) }
    }

    private func primeFromCache() async {
        guard !primed else { return }
        primed = true
        let age = SportStore.maxAge
        if body == nil, let hit = await cache?.get(SportBodyWeek.self, endpoint: Self.bodyEndpoint, date: Self.key, maxAge: age) {
            body = hit.value
        }
        if shoulder == nil, let hit = await cache?.get(SportShoulder.self, endpoint: Self.shoulderEndpoint, date: Self.key, maxAge: age) {
            shoulder = hit.value
        }
        if gaps == nil, let hit = await cache?.get(SportGaps.self, endpoint: Self.gapsEndpoint, date: Self.key, maxAge: age) {
            gaps = hit.value
        }
    }

    #if DEBUG
    public func debugShow(body: SportBodyWeek?, shoulder: SportShoulder?, gaps: SportGaps?, problem: PlanFetchError? = nil,
                          offline: Bool = false) {
        self.body = body; self.shoulder = shoulder; self.gaps = gaps; self.problem = problem; self.offline = offline
        primed = true; fresh = true
    }
    #endif
}
