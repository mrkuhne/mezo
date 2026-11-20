import Foundation
import Observation

/// Everything the Pénz area reads, as one cacheable answer.
public struct PenzSnapshot: Codable, Equatable, Sendable {
    public var allowance: PenzAllowance
    /// The current month's transactions, newest first.
    public var transactions: [PenzTransaction]
    public var categories: [PenzCategory]
    public var accounts: [PenzAccount]
    /// Past months with no close yet, oldest first.
    public var openMonths: [PenzMonthClose]
    /// nil = the goals could not be read (the block says so; it never shows an empty list as if there were none).
    public var goals: [PenzGoal]?
    public var settings: PenzSettings?

    public init(allowance: PenzAllowance, transactions: [PenzTransaction] = [], categories: [PenzCategory] = [],
                accounts: [PenzAccount] = [], openMonths: [PenzMonthClose] = [], goals: [PenzGoal]? = [],
                settings: PenzSettings? = nil) {
        self.allowance = allowance; self.transactions = transactions; self.categories = categories
        self.accounts = accounts; self.openMonths = openMonths; self.goals = goals; self.settings = settings
    }
}

/// The Pénz area's data (L5, `mezo-r36n9.103`), shared by the area page, the Terv card and the cash capture.
///
/// **Offline is an answer, not an error** (the Edzés rule): every read goes to the server first and the whole answer
/// is written to the per-user `ServerCache`; with no network the page shows the last known answer **with its age**,
/// and with no cache either it says so. A refusal or a server fault is reported as itself, never dressed as an old
/// answer. Cash typed on the phone and still in the outbox is laid over the server's figures (`pending`), so the
/// week's remaining drops the moment he records it.
@MainActor @Observable
public final class PenzStore {
    public private(set) var snapshot: Cached<PenzSnapshot>?
    /// Why the last read gave no answer (nil while an answer — fresh or cached — is on screen).
    public private(set) var problem: PlanFetchError?
    public private(set) var loading = false
    /// The answer on screen came from the cache because the net was missing.
    public private(set) var offline = false
    /// The month's transactions could not be read with the rest (the lists say so; the figures still stand).
    public private(set) var transactionsFailed = false
    /// Cash expenses still in the outbox (refused ones flagged).
    public private(set) var pending: [PenzPendingExpense] = []

    /// A cached answer older than this is not shown at all — a month-old remainder is not this week's.
    public static let maxAge: TimeInterval = 14 * 86_400
    static let endpoint = "penz/snapshot"
    static let key = "current"

    @ObservationIgnored public let client: PenzClient?
    @ObservationIgnored private let cache: ServerCache?
    @ObservationIgnored private let clock: @MainActor () -> Date

    public init(client: PenzClient?, cache: ServerCache?, clock: @escaping @MainActor () -> Date = { Date() }) {
        self.client = client; self.cache = cache; self.clock = clock
    }

    // MARK: - Reading

    nonisolated static func attempt<T: Sendable>(_ op: @Sendable () async throws -> T) async -> Result<T, PlanFetchError> {
        do { return .success(try await op()) } catch { return .failure((error as? PlanFetchError) ?? .server) }
    }

    /// A forced reload asked for while a read was in flight: it runs right after, so a capture, a review or a
    /// close racing a reload is never lost.
    @ObservationIgnored private var reloadAgain = false

    /// Reads everything (in parallel). Without `force` it reads once — and again while the last attempt found no
    /// net or a server fault (a first read on a plane must not stick for ever).
    public func load(force: Bool = false) async {
        guard let client else {
            if snapshot == nil { problem = .unauthorized }
            return
        }
        let retryable = problem == nil || problem == .offline || problem == .server
        guard force || (snapshot == nil && retryable) else { return }
        if loading {
            if force { reloadAgain = true }
            return
        }
        loading = true
        await read(client)
        loading = false
        if reloadAgain {
            reloadAgain = false
            await load(force: true)
        }
    }

    private func read(_ client: PenzClient) async {
        let month = penzMonth(clock())
        async let a = Self.attempt { try await client.allowance() }
        async let t = Self.attempt { try await client.transactions(month: month) }
        async let c = Self.attempt { try await client.categories() }
        async let acc = Self.attempt { try await client.accounts() }
        async let o = Self.attempt { try await client.openMonths() }
        async let g = Self.attempt { try await client.goals() }
        async let s = Self.attempt { try await client.settings() }
        let (ra, rt, rc, racc, ro, rg, rs) = await (a, t, c, acc, o, g, s)

        let previous: PenzSnapshot?
        if let snapshot { previous = snapshot.value } else {
            previous = await cache?.get(PenzSnapshot.self, endpoint: Self.endpoint, date: Self.key, maxAge: Self.maxAge)?.value
        }
        switch ra {
        case .failure(.offline):
            if let hit = await cache?.get(PenzSnapshot.self, endpoint: Self.endpoint, date: Self.key, maxAge: Self.maxAge) {
                snapshot = hit; problem = nil; offline = true
            } else {
                problem = .offline
            }
        case .failure(let e):
            problem = e
        case .success(let allowance):
            let fresh = PenzSnapshot(
                allowance: allowance,
                // A failed read keeps the last rows only when they are this month's: November's rows are not
                // January's.
                transactions: (try? rt.get()) ?? (previous?.allowance.month.month == month ? previous?.transactions : nil) ?? [],
                categories: (try? rc.get()) ?? previous?.categories ?? [],
                accounts: (try? racc.get()) ?? previous?.accounts ?? [],
                openMonths: (try? ro.get()) ?? previous?.openMonths ?? [],
                goals: try? rg.get(),
                settings: (try? rs.get()) ?? previous?.settings)
            transactionsFailed = (try? rt.get()) == nil
            snapshot = Cached(value: fresh, fetchedAt: clock(), age: 0)
            problem = nil; offline = false
            try? await cache?.put(fresh, endpoint: Self.endpoint, date: Self.key)
        }
    }

    /// The outbox as it stands: its cash expenses become `pending` (a failed one is marked refused).
    public func setPending(_ queue: [OutboxItem]) {
        pending = queue.compactMap { item in
            guard item.kind == .penzExpense, let p = RitmusPayload.decodePenzExpense(item.payload) else { return nil }
            return PenzPendingExpense(id: item.id, payload: p, refused: item.failure != nil)
        }
    }

    // MARK: - What the screens read

    public var value: PenzSnapshot? { snapshot?.value }
    public var transactions: [PenzTransaction] { value?.transactions ?? [] }
    public var categories: [PenzCategory] { value?.categories ?? [] }
    public var accounts: [PenzAccount] { value?.accounts ?? [] }
    public var openMonths: [PenzMonthClose] { value?.openMonths ?? [] }
    /// The cash the server does not have yet.
    public var unsent: [PenzPendingExpense] { penzUnsent(pending, transactions: transactions) }
    /// The allowance with the unsent cash counted.
    public var allowance: PenzAllowance? { value.map { penzPendingAdjusted($0.allowance, unsent: unsent) } }
    /// "3 órás adat" when what is shown is older than a fresh read.
    public var ageText: String? { penzAgeText(snapshot.map { clock().timeIntervalSince($0.fetchedAt) }) }
    /// Today on the device's clock (the money timezone is the phone's for one owner) — never a cached allowance's
    /// date, which may be days old.
    public var today: String { penzDay(clock()) }
    public var reviewRows: [PenzTransaction] { penzNeedsReview(transactions) }
    public var verdict: PenzVerdict { penzVerdict(reviewCount: reviewRows.count, openMonths: openMonths) }
    /// Today's rows: the unsent cash dated today first, then the server's. A row waiting for review is left to the
    /// aggregate "N üzenet ellenőrzésre vár" row, so it is never shown twice.
    public var todayItems: [PenzItem] {
        let day = today
        return penzItems(transactions.filter { $0.date == day && !$0.needsReview },
                         pending: pending.filter { $0.payload.date == day && (unsent.contains($0) || $0.refused) },
                         categories: categories, accounts: accounts)
    }
    /// No account at all: nothing can be recorded yet, and no figure means anything.
    public var isEmpty: Bool { value != nil && accounts.isEmpty && transactions.isEmpty }
    public var cashAccount: PenzAccount? { penzCashAccount(accounts) }

    // MARK: - Writes (online; the answer re-reads the page)

    /// The review sheet's "Rendben". The error sentence, or nil on success.
    public func confirm(_ t: PenzTransaction, categoryId: String?) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.confirm(t, categoryId: categoryId) } catch { return penzErrorText(error) }
        await load(force: true)
        return nil
    }

    public func saveSettings(savingsTargetHufMinor: Int64, practiceMonthlyHufMinor: Int64) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        // The other fields come from a fresh read, never from a cached snapshot (a stale timezone or month override
        // would be written back over the server's); without one, only the two edited lines go.
        let request: PenzSettingsRequest
        if let fresh = try? await client.settings() {
            request = PenzSettingsRequest(from: fresh, savingsTargetHufMinor: savingsTargetHufMinor,
                                          practiceMonthlyHufMinor: practiceMonthlyHufMinor)
        } else {
            request = PenzSettingsRequest(savingsTargetHufMinor: savingsTargetHufMinor, practiceMonthlyHufMinor: practiceMonthlyHufMinor)
        }
        do { _ = try await client.saveSettings(request) } catch { return penzErrorText(error) }
        await load(force: true)
        return nil
    }

    public func closeMonth(_ month: String, leftoverAction: String) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.closeMonth(month, leftoverAction: leftoverAction) } catch { return penzErrorText(error) }
        await load(force: true)
        return nil
    }

    /// The cash sheet's „Készpénz számla létrehozása" when he has no forint account at all (production starts empty).
    public func createCashAccount() async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.createAccount(.cash) } catch { return penzErrorText(error) }
        await load(force: true)
        return nil
    }

    public func addGoal(_ request: PenzGoalRequest) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.createGoal(request) } catch { return penzErrorText(error) }
        await load(force: true)
        return nil
    }
}
