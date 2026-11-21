import Foundation
import Observation

/// The season's load-vs-recovery data for the Évad page (B7 K2, `mezo-r36n9.17`).
///
/// **Offline is an answer** (the Évad / Pénz rule): a fresh read is written to the per-user `ServerCache`; with no
/// net the block shows the last known read **with its age**. A 404 (no active season) or any other failure with
/// nothing cached leaves the block out — it is an extra, never an error the page has to explain.
@MainActor @Observable
public final class KapacitasStore {
    public private(set) var season: KapacitasSeasonLoad?
    /// How old the season on screen is when it came from the cache; nil for a fresh read.
    public private(set) var age: TimeInterval?
    public private(set) var offline = false
    public private(set) var loading = false

    /// A cached read older than this is not shown.
    public static let maxAge: TimeInterval = 14 * 86_400
    static let endpoint = "kapacitas/season"
    static let key = "-"

    @ObservationIgnored public let client: KapacitasClient?
    @ObservationIgnored private let cache: ServerCache?

    public init(client: KapacitasClient?, cache: ServerCache?) { self.client = client; self.cache = cache }

    /// "3 órás adat" while a cached read is on screen.
    public var ageText: String? { offline ? penzAgeText(age) : nil }

    public func load(force: Bool = false) async {
        guard let client, !loading, force || season == nil || offline else { return }
        loading = true
        defer { loading = false }
        do throws(PlanFetchError) {
            let fresh = try await client.season()
            season = fresh; age = nil; offline = false
            try? await cache?.put(fresh, endpoint: Self.endpoint, date: Self.key)
        } catch .notFound {
            season = nil; age = nil; offline = false
        } catch .offline {
            if let hit = await cache?.get(KapacitasSeasonLoad.self, endpoint: Self.endpoint, date: Self.key, maxAge: Self.maxAge) {
                season = hit.value; age = hit.age; offline = true
            }
        } catch {
            // a refusal or a server fault: keep what is on screen, show nothing new
        }
    }
}
