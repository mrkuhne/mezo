import Foundation
import Observation

/// The Évad page's data (Boop B6, `mezo-r36n9.16`).
///
/// **Offline is an answer, not an error** (the Pénz / Edzés rule): the overview is read from the server first and
/// written to the per-user `ServerCache`; with no network the page shows the last known overview **with its age** and
/// every change (Módosítás, Új évad, Szabályok) says it needs the net. A 404 is "no season yet" — the empty state — and
/// never a failure. A refusal or a server fault is reported as itself, never dressed as an old answer.
@MainActor @Observable
public final class EvadStore {
    /// The overview on screen (fresh or cached).
    public private(set) var overview: EvadOverview?
    /// How old the overview on screen is when it came from the cache; nil for a fresh read.
    public private(set) var overviewAge: TimeInterval?
    /// He has no active season (the server said 404): the page shows the empty state.
    public private(set) var empty = false
    /// The overview on screen came from the cache because the net was missing.
    public private(set) var offline = false
    /// Why the last read gave no answer (nil while an answer — fresh, cached or "no season" — is on screen).
    public private(set) var problem: PlanFetchError?
    public private(set) var loading = false
    /// This week so far, Monday → yesterday (the Évad orb and the Most tab); nil on Monday or before the first read.
    public private(set) var week: EvadAdherenceResponse?
    /// How old `week` is when it came from the cache; nil for a fresh read.
    public private(set) var weekAge: TimeInterval?
    @ObservationIgnored private var weekFrom: String?
    /// The Monday of the week on screen: a failed read of another week drops it rather than passing it off as this one.
    @ObservationIgnored private var weekMonday: String?

    /// A cached overview older than this is not shown: a month-old season week is not this week.
    public static let maxAge: TimeInterval = 14 * 86_400
    static let endpoint = "evad/overview"
    static let weekEndpoint = "evad/adherence-week"
    static let key = "-"

    @ObservationIgnored public let client: EvadClient?
    @ObservationIgnored private let cache: ServerCache?

    /// The Menü and Lista tabs' data (S3), on the same client and cache.
    @ObservationIgnored public let menu: EvadMenuStore
    /// The Hatás tab's experiments (S4), on the same client and cache; the Ma wall reads its proposal and results.
    @ObservationIgnored public let experiments: EvadExperimentStore

    public init(client: EvadClient?, cache: ServerCache?) {
        self.client = client; self.cache = cache
        self.menu = EvadMenuStore(client: client, cache: cache)
        self.experiments = EvadExperimentStore(client: client, cache: cache)
        self.menu.onMenuChanged = { [weak self] in await self?.load(force: true) }
    }

    /// "3 órás adat" while a cached overview is on screen.
    public var ageText: String? { offline ? penzAgeText(overviewAge) : nil }

    // MARK: - Reading

    /// Reads the overview. Without `force` it reads once — and again while the last attempt found no net or a
    /// server fault.
    public func load(force: Bool = false) async {
        guard let client else {
            if overview == nil { problem = .unauthorized }
            return
        }
        let retryable = problem == nil || problem == .offline || problem == .server
        guard force || (overview == nil && !empty && retryable) || offline else { return }
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do throws(PlanFetchError) {
            let fresh = try await client.overview()
            overview = fresh; overviewAge = nil; empty = false; offline = false; problem = nil
            try? await cache?.put(fresh, endpoint: Self.endpoint, date: Self.key)
        } catch .notFound {
            overview = nil; overviewAge = nil; empty = true; offline = false; problem = nil
        } catch .offline {
            if let hit = await cache?.get(EvadOverview.self, endpoint: Self.endpoint, date: Self.key, maxAge: Self.maxAge) {
                overview = hit.value; overviewAge = hit.age; offline = true; problem = nil; empty = false
            } else if overview == nil {
                problem = .offline
            } else {
                offline = true
            }
        } catch {
            if overview == nil { problem = error }
        }
    }

    /// The Évad orb's number: this week's adherence, nil without a season or with nothing judged yet.
    public var weekScore: Int? { empty ? nil : week.flatMap { evadWeekScore($0.summary) } }

    /// Reads this week so far (Monday → yesterday). Monday: nothing is lived yet, so no call and no week. Without
    /// `force` it reads once per week; offline it serves the cached week of the same Monday.
    public func loadWeek(now: Date = Date(), calendar: Calendar = .current, force: Bool = false) async {
        guard let range = evadMostRange(now: now, calendar: calendar) else {
            week = nil; weekAge = nil; weekFrom = nil; weekMonday = nil
            return
        }
        guard let client else { return }
        guard force || weekFrom != range.to || weekAge != nil else { return }
        do throws(PlanFetchError) {
            let fresh = try await client.adherence(from: range.from, to: range.to)
            week = fresh; weekAge = nil; weekFrom = range.to; weekMonday = range.from
            try? await cache?.put(fresh, endpoint: Self.weekEndpoint, date: range.from)
        } catch .offline {
            if let hit = await cache?.get(EvadAdherenceResponse.self, endpoint: Self.weekEndpoint, date: range.from,
                                          maxAge: Self.maxAge) {
                week = hit.value; weekAge = hit.age; weekFrom = range.to; weekMonday = range.from
            } else {
                dropWeek(unless: range.from)
            }
        } catch {
            // a refusal or fault keeps what is on screen — but only while it is the same week
            dropWeek(unless: range.from)
        }
    }

    private func dropWeek(unless monday: String) {
        guard weekMonday != monday else { return }
        week = nil; weekAge = nil; weekFrom = nil; weekMonday = nil
    }

    // MARK: - Módosítás

    /// What a change to the active season would do. Saves nothing.
    public func preview(_ d: EvadDraft) async throws(PlanFetchError) -> EvadPreview {
        guard let client, let id = overview?.season.id else { throw .notFound }
        return try await client.preview(id: id, d)
    }

    /// Accepts a previewed change, then re-reads the overview. A stale preview is `.conflict("SEASON_PREVIEW_STALE")`.
    public func apply(_ d: EvadDraft, fingerprint: String) async throws(PlanFetchError) {
        guard let client, let id = overview?.season.id else { throw .notFound }
        _ = try await client.apply(id: id, d, fingerprint: fingerprint)
        await load(force: true)
    }

    // MARK: - Szabályok

    public func putRules(_ r: EvadRules) async throws(PlanFetchError) {
        guard let client, let id = overview?.season.id else { throw .notFound }
        _ = try await client.putRules(id: id, r)
        await load(force: true)
    }

    // MARK: - Új évad

    public func firstDraft() async throws(PlanFetchError) -> EvadDraft {
        guard let client else { throw .unauthorized }
        return try await client.firstDraft()
    }

    /// The new-season summary before anything is saved.
    public func previewDraft(_ d: EvadDraft) async throws(PlanFetchError) -> EvadPreview {
        guard let client else { throw .unauthorized }
        return try await client.previewDraft(d)
    }

    /// The season "Indulhat az évad" created but could not activate yet, with the draft it was made from: a retry of the
    /// same draft activates this one, never a second.
    @ObservationIgnored private var planned: (id: String, draft: EvadDraft)?

    /// "Indulhat az évad": create the planned season (once), activate it, re-read the page.
    public func start(_ d: EvadDraft) async throws(PlanFetchError) {
        guard let client else { throw .unauthorized }
        let id: String
        if let planned, planned.draft == d { id = planned.id } else {
            id = try await client.create(d).id
            planned = (id, d)
        }
        _ = try await client.activate(id: id)
        planned = nil
        await load(force: true)
    }
}
