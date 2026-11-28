import Foundation
import Observation

/// The Napló tab's data (`mezo-r36n9.205`): the last twelve weeks of logged sessions. **Cache first** like
/// `SportStore`: the last copy shows at once, the fresh read replaces it behind; with no net the copy stays with its
/// age. A correction or a delete needs the net and throws on failure (the sheet stays open); on success the list and
/// the cache change at once and `changed` re-reads the week (its count), the load and the body.
@MainActor @Observable
public final class SportJournalStore {
    public private(set) var sessions: [SportSessionRecord]?
    public private(set) var problem: PlanFetchError?
    public private(set) var offline = false
    public private(set) var loading = false
    public private(set) var age: TimeInterval?

    /// How far back the tab reads.
    public static let days = 84
    static let endpoint = "sport/journal"
    static let key = "-"

    @ObservationIgnored let client: SportClient?
    @ObservationIgnored private let cache: ServerCache?
    @ObservationIgnored private var primed = false
    @ObservationIgnored private var fresh = false
    /// Called after every successful write.
    @ObservationIgnored public var changed: (@MainActor () async -> Void)?
    /// Today (`yyyy-MM-dd`), the read's upper bound.
    @ObservationIgnored public var today: @MainActor () -> String = { sportPhoneToday() }

    public init(client: SportClient?, cache: ServerCache?) {
        self.client = client; self.cache = cache
    }

    // MARK: - Reading

    public func load(force: Bool = false) async {
        guard let client else { if sessions == nil { problem = .unauthorized }; return }
        await primeFromCache()
        guard force || !fresh || offline || problem != nil, !loading else { return }
        loading = true
        defer { loading = false }
        let to = today()
        do throws(PlanFetchError) {
            let list = try await client.sessions(from: sportAddDays(to, -(Self.days - 1)), to: to)
            sessions = sportJournalSorted(list); age = nil; offline = false; problem = nil; fresh = true
            try? await cache?.put(list, endpoint: Self.endpoint, date: Self.key)
        } catch {
            if sessions == nil { problem = error } else if error == .offline { offline = true }
        }
    }

    private func primeFromCache() async {
        guard !primed else { return }
        primed = true
        guard sessions == nil,
              let hit = await cache?.get([SportSessionRecord].self, endpoint: Self.endpoint, date: Self.key, maxAge: SportStore.maxAge)
        else { return }
        sessions = sportJournalSorted(hit.value); age = hit.age
    }

    // MARK: - Writing

    /// Corrects `record` on the server; the list shows the server's copy.
    public func update(_ record: SportSessionRecord, _ edit: SportSessionEdit) async throws(PlanFetchError) {
        guard let client else { throw .unauthorized }
        let saved = try await client.updateSession(id: record.id, edit)
        var list = sessions ?? []
        if let i = list.firstIndex(where: { $0.id == record.id }) { list[i] = saved } else { list.append(saved) }
        await applied(list)
    }

    /// Deletes `record` on the server; it leaves the list at once.
    public func delete(_ record: SportSessionRecord) async throws(PlanFetchError) {
        guard let client else { throw .unauthorized }
        try await client.deleteSession(id: record.id)
        await applied((sessions ?? []).filter { $0.id != record.id })
    }

    private func applied(_ list: [SportSessionRecord]) async {
        sessions = sportJournalSorted(list)
        offline = false
        try? await cache?.put(list, endpoint: Self.endpoint, date: Self.key)
        await changed?()
    }

    #if DEBUG
    public func debugShow(_ list: [SportSessionRecord]?, problem: PlanFetchError? = nil, offline: Bool = false) {
        sessions = list.map(sportJournalSorted); self.problem = problem; self.offline = offline; primed = true; fresh = true
    }
    #endif
}

/// Newest first: date, then start time.
public func sportJournalSorted(_ list: [SportSessionRecord]) -> [SportSessionRecord] {
    list.sorted { ($0.date, $0.time ?? "") > ($1.date, $1.time ?? "") }
}

/// Today on the phone, `yyyy-MM-dd`.
public func sportPhoneToday() -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: Date())
}
