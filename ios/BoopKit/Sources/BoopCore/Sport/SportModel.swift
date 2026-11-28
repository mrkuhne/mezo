import Foundation
import Observation

/// The Sport area's data (`mezo-r36n9.203`): **cache first** — the last week on the phone shows at once, the fresh read
/// replaces it behind; with no net the cached week stays with its age; a fault is shown only when there is nothing to
/// show. A log is queued on the phone (`OutboxKind.sportSession`) and shown as done at once (`noteLogged`); a skip and
/// its undo go straight to the server and the week is read again.
@MainActor @Observable
public final class SportStore {
    /// The week as the server last said it.
    public private(set) var overview: SportOverview?
    /// How old the week on screen is when it came from the cache; nil for a fresh read.
    public private(set) var age: TimeInterval?
    public private(set) var offline = false
    public private(set) var problem: PlanFetchError?
    public private(set) var loading = false
    /// Logs queued on the phone that the server's week does not show yet.
    public private(set) var pending: [SportSessionPayload] = []
    /// The effort of the last log — the sheet's default (spec §5.6).
    public private(set) var lastRpe: Int = 6

    public static let maxAge: TimeInterval = 14 * 86_400
    static let endpoint = "sport/overview"
    static let rpeEndpoint = "sport/last-rpe"
    static let key = "-"

    /// The Hét tab's weekly rhythm, events and six-week load (`mezo-r36n9.204`); a write there re-reads the week.
    public let schedule: SportScheduleStore
    /// The Napló tab's sessions (`mezo-r36n9.205`); a correction or delete re-reads the week, the load and the body.
    public let journal: SportJournalStore
    /// The Test tab's muscle heat, shoulder and rest gaps (`mezo-r36n9.205`).
    public let bodyWeek: SportBodyStore

    @ObservationIgnored let client: SportClient?
    @ObservationIgnored private let cache: ServerCache?
    @ObservationIgnored private var reloadAgain = false
    @ObservationIgnored private var primed = false

    public init(client: SportClient?, cache: ServerCache?) {
        self.client = client; self.cache = cache
        schedule = SportScheduleStore(client: client, cache: cache)
        journal = SportJournalStore(client: client, cache: cache)
        bodyWeek = SportBodyStore(client: client, cache: cache)
        schedule.changed = { [weak self] in await self?.load(force: true) }
        schedule.today = { [weak self] in self?.overview?.today }
        journal.today = { [weak self] in self?.overview?.today ?? sportPhoneToday() }
        journal.changed = { [weak self] in
            guard let self else { return }
            await load(force: true); await schedule.load(force: true); await bodyWeek.load(force: true)
        }
    }

    // MARK: - What the room and the ring read

    /// The week with what the phone knows on top: a queued log turns today's sport DONE at once.
    public var week: SportOverview? {
        guard var o = overview else { return nil }
        guard let log = pending.last(where: { $0.date == o.today }) else { return o }
        if o.tonight?.moment == "DONE" { return o }
        let load = Int((log.rpe * Double(log.durationMinutes)).rounded())
        let session = SportLoggedSession(id: "pending", sport: log.sport, durationMin: log.durationMinutes, rpe: log.rpe,
                                         load: load, kcal: log.kcalOverride, setsPlayed: log.setsPlayed,
                                         shoulderStrain: log.shoulderStrain)
        var t = o.tonight ?? SportTonight(sport: log.sport, time: log.time, durationMin: log.durationMinutes, moment: "DONE")
        let wasCounted = t.moment == "SKIPPED"
        t.moment = "DONE"; t.session = session; t.skip = nil; t.startsInMinutes = nil
        o.tonight = t
        if let i = o.days.firstIndex(where: { $0.date == o.today }) {
            if let j = o.days[i].sport.firstIndex(where: { $0.state != "DONE" }) {
                o.days[i].sport[j].state = "DONE"; o.days[i].sport[j].load = load; o.days[i].sport[j].skipId = nil
            } else {
                o.days[i].sport.append(SportLaneItem(layer: "SPORT", sport: log.sport, time: log.time, durationMin: log.durationMinutes,
                                                     state: "DONE", load: load))
            }
        }
        if var c = o.weekCount { c.done += 1; if wasCounted { c.planned = max(c.planned, c.done) }; o.weekCount = c }
        return o
    }

    public var ring: (display: String, level: Double?) { sportRing(week?.weekCount) }

    /// "5 órás adat" while a cached week is on screen.
    public var ageText: String? { offline ? penzAgeText(age) : nil }

    // MARK: - Reading

    /// Reads the week. Without `force` it reads once — and again while the last attempt found no net or a fault.
    public func load(force: Bool = false) async {
        guard let client else {
            if overview == nil { problem = .unauthorized }
            return
        }
        await primeFromCache()
        let retryable = problem == nil || problem == .offline || problem == .server
        guard force || age != nil || (overview == nil && retryable) || offline else { return }
        if loading {
            if force { reloadAgain = true }
            return
        }
        loading = true
        do throws(PlanFetchError) {
            let fresh = try await client.overview()
            overview = fresh; age = nil; offline = false; problem = nil
            // The server has caught up with a queued log once today's sport is DONE (or the day is over).
            pending.removeAll { $0.date < fresh.today || ($0.date == fresh.today && fresh.tonight?.moment == "DONE") }
            if let rpe = fresh.tonight?.session?.rpe { remember(rpe: Int(rpe.rounded())) }
            try? await cache?.put(fresh, endpoint: Self.endpoint, date: Self.key)
        } catch {
            if overview == nil {
                problem = error
            } else if error == .offline {
                offline = true
            }
            // A fault with a week on screen keeps it; the age stays honest.
        }
        loading = false
        if reloadAgain {
            reloadAgain = false
            await load(force: true)
        }
    }

    /// The cached week (and the last effort) before the first read, so the room opens at once.
    private func primeFromCache() async {
        guard !primed else { return }
        primed = true
        if let hit = await cache?.get(Int.self, endpoint: Self.rpeEndpoint, date: Self.key, maxAge: 365 * 86_400) {
            lastRpe = hit.value
        }
        guard overview == nil, let hit = await cache?.get(SportOverview.self, endpoint: Self.endpoint, date: Self.key, maxAge: Self.maxAge)
        else { return }
        overview = hit.value; age = hit.age
    }

    // MARK: - Writing

    /// A log was queued on the phone (the outbox sends it): today's sport shows as done at once.
    public func noteLogged(_ payload: SportSessionPayload) {
        pending.append(payload)
        remember(rpe: Int(payload.rpe.rounded()))
    }

    private func remember(rpe: Int) {
        guard (1...10).contains(rpe) else { return }
        lastRpe = rpe
        let cache = self.cache
        Task { try? await cache?.put(rpe, endpoint: Self.rpeEndpoint, date: Self.key) }
    }

    /// Skips today's sport, then reads the week again.
    public func skip(_ reason: SportSkipReason) async throws(PlanFetchError) {
        guard let client, let o = week, let t = o.tonight else { throw .server }
        let r = try await client.skip(date: o.today, time: t.time, reason: reason)
        // Shown at once; the read below brings the server's own picture.
        if var shown = overview, var tonight = shown.tonight {
            tonight.moment = "SKIPPED"
            tonight.skip = SportSkipInfo(id: r.id, reason: r.reasonCategory, freePass: r.freePass, serious: r.serious)
            shown.tonight = tonight
            overview = shown
        }
        await load(force: true)
    }

    /// Takes today's skip back, then reads the week again.
    public func undoSkip() async throws(PlanFetchError) {
        guard let client, let id = overview?.tonight?.skip?.id else { throw .server }
        try await client.undoSkip(id: id)
        if var shown = overview, var tonight = shown.tonight {
            tonight.moment = "BEFORE"; tonight.skip = nil
            shown.tonight = tonight
            overview = shown
        }
        await load(force: true)
    }

    #if DEBUG
    /// Simulator review: a fixed week without any network.
    public func debugShow(_ o: SportOverview?, problem: PlanFetchError? = nil, offline: Bool = false, age: TimeInterval? = nil) {
        overview = o; self.problem = problem; self.offline = offline; self.age = age; primed = true
    }
    #endif
}
