import Foundation
import Observation

/// The Hét tab's data beyond the week (`mezo-r36n9.204`): the weekly rhythm, the upcoming one-off events and the
/// six-week load. **Cache first**, like `SportStore`: the last copy shows at once, the fresh read replaces it behind.
/// Writes need the net and throw on failure (the sheet stays open with what he entered); after a write the week is read
/// again through `changed` (the owning `SportStore` re-reads its overview).
@MainActor @Observable
public final class SportScheduleStore {
    public private(set) var slots: [SportSlot]?
    public private(set) var events: [SportEvent]?
    public private(set) var weeksLoad: SportLoad?
    public private(set) var problem: PlanFetchError?
    public private(set) var offline = false
    public private(set) var loading = false
    /// The slot just deleted, so the list can offer to bring it back.
    public private(set) var removed: SportSlot?

    static let slotsEndpoint = "sport/schedule"
    static let eventsEndpoint = "sport/events"
    static let loadEndpoint = "sport/load"
    static let key = "-"

    @ObservationIgnored let client: SportClient?
    @ObservationIgnored private let cache: ServerCache?
    @ObservationIgnored private var primed = false
    /// A full fresh read has landed this session (the cache alone still asks the server once).
    @ObservationIgnored private var fresh = false
    /// Called after every successful write.
    @ObservationIgnored public var changed: (@MainActor () async -> Void)?
    /// Today (`yyyy-MM-dd`) for the events' lower bound; nil = the server's default.
    @ObservationIgnored public var today: @MainActor () -> String? = { nil }

    public init(client: SportClient?, cache: ServerCache?) {
        self.client = client; self.cache = cache
    }

    // MARK: - Reading

    /// Reads the three; each keeps its cached copy when its read fails.
    public func load(force: Bool = false) async {
        guard let client else { problem = .unauthorized; return }
        await primeFromCache()
        guard force || !fresh || offline || problem != nil, !loading else { return }
        loading = true
        defer { loading = false }
        let from = today()
        async let s = Self.attempt { () async throws(PlanFetchError) -> [SportSlot] in try await client.schedule() }
        async let e = Self.attempt { () async throws(PlanFetchError) -> [SportEvent] in try await client.events(from: from) }
        async let l = Self.attempt { () async throws(PlanFetchError) -> SportLoad in try await client.load(weeks: 6) }
        let (rs, re, rl) = await (s, e, l)
        var failure: PlanFetchError?
        switch rs {
        case .success(let v): slots = sportScheduleSorted(v); try? await cache?.put(v, endpoint: Self.slotsEndpoint, date: Self.key)
        case .failure(let f): failure = f
        }
        switch re {
        case .success(let v): events = v; try? await cache?.put(v, endpoint: Self.eventsEndpoint, date: Self.key)
        case .failure(let f): failure = failure ?? f
        }
        switch rl {
        case .success(let v): weeksLoad = v; try? await cache?.put(v, endpoint: Self.loadEndpoint, date: Self.key)
        case .failure(let f): failure = failure ?? f
        }
        fresh = failure == nil
        offline = failure == .offline
        problem = failure == nil || failure == .offline ? nil : failure
        if failure == .offline && slots == nil { problem = .offline }
    }

    private static func attempt<T: Sendable>(_ op: @Sendable () async throws(PlanFetchError) -> T) async -> Result<T, PlanFetchError> {
        do throws(PlanFetchError) { return .success(try await op()) } catch { return .failure(error) }
    }

    private func primeFromCache() async {
        guard !primed else { return }
        primed = true
        let age = SportStore.maxAge
        if slots == nil, let hit = await cache?.get([SportSlot].self, endpoint: Self.slotsEndpoint, date: Self.key, maxAge: age) {
            slots = sportScheduleSorted(hit.value)
        }
        if events == nil, let hit = await cache?.get([SportEvent].self, endpoint: Self.eventsEndpoint, date: Self.key, maxAge: age) {
            events = hit.value
        }
        if weeksLoad == nil, let hit = await cache?.get(SportLoad.self, endpoint: Self.loadEndpoint, date: Self.key, maxAge: age) {
            weeksLoad = hit.value
        }
    }

    // MARK: - Writing

    /// Saves one slot (new or edited): the server gets the whole rhythm with every other slot unchanged.
    public func save(_ slot: SportSlot) async throws(PlanFetchError) {
        guard let client else { throw .unauthorized }
        let saved = try await client.replaceSchedule(sportScheduleSaving(slots ?? [], slot))
        await applied(saved)
    }

    /// Deletes one slot; it can be brought back with `restore()` until the next change.
    public func delete(_ slot: SportSlot) async throws(PlanFetchError) {
        guard let client else { throw .unauthorized }
        let saved = try await client.replaceSchedule(sportScheduleRemoving(slots ?? [], id: slot.id))
        await applied(saved)
        removed = slot
    }

    /// Brings the last deleted slot back.
    public func restore() async throws(PlanFetchError) {
        guard let slot = removed else { return }
        var back = slot
        back.id = nil
        try await save(back)
    }

    public func addEvent(_ draft: SportEventDraft) async throws(PlanFetchError) {
        guard let client else { throw .unauthorized }
        let e = try await client.createEvent(draft)
        var list = events ?? []
        list.append(e)
        events = list.sorted { ($0.date, $0.time) < ($1.date, $1.time) }
        try? await cache?.put(events ?? [], endpoint: Self.eventsEndpoint, date: Self.key)
        await changed?()
    }

    public func deleteEvent(_ e: SportEvent) async throws(PlanFetchError) {
        guard let client else { throw .unauthorized }
        try await client.deleteEvent(id: e.id)
        events?.removeAll { $0.id == e.id }
        try? await cache?.put(events ?? [], endpoint: Self.eventsEndpoint, date: Self.key)
        await changed?()
    }

    private func applied(_ saved: [SportSlot]) async {
        slots = sportScheduleSorted(saved)
        removed = nil
        offline = false
        try? await cache?.put(saved, endpoint: Self.slotsEndpoint, date: Self.key)
        await changed?()
    }

    #if DEBUG
    public func debugShow(slots: [SportSlot]?, events: [SportEvent]?, load: SportLoad?, offline: Bool = false) {
        self.slots = slots; self.events = events; self.weeksLoad = load; self.offline = offline; primed = true
    }
    #endif
}
