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

    // L6 (`mezo-r36n9.104`): Pénzem and the digest load and fail on their own, next to the snapshot — a news source
    // being down never takes the week's remaining with it.
    /// Pénzem (fresh or cached).
    public private(set) var portfolio: Cached<PenzPortfolio>?
    public private(set) var portfolioProblem: PlanFetchError?
    public private(set) var portfolioOffline = false
    /// Today's digest (fresh, or today's cache — never yesterday's).
    public private(set) var digest: Cached<PenzDigest>?
    public private(set) var digestProblem: PlanFetchError?
    public private(set) var digestOffline = false
    /// The weekly long-horizon review (`mezo-r36n9.120`, fresh or cached). It loads and fails on its own: a failure
    /// keeps the last one, and never touches Pénzem.
    public private(set) var weekly: Cached<PenzWeeklyReview>?
    public private(set) var weeklyProblem: PlanFetchError?
    public private(set) var weeklyOffline = false

    // L7 (`mezo-r36n9.105`): Gyakorlás, the proposals, the catalog and the strategy — each read on its own, when its
    // screen asks (`PenzStore+Practice.swift`), so a practice or proposal fault never takes the week with it.
    /// The Gyakorlás overview (fresh or cached).
    public internal(set) var practice: Cached<PenzPracticeOverview>?
    public internal(set) var practiceProblem: PlanFetchError?
    public internal(set) var practiceOffline = false
    /// The full journal (read when its page opens).
    public internal(set) var journal: [PenzPaperTrade]?
    public internal(set) var journalProblem: PlanFetchError?
    /// Every proposal, newest first (fresh or cached).
    public internal(set) var proposals: Cached<[PenzProposal]>?
    public internal(set) var proposalsProblem: PlanFetchError?
    public internal(set) var proposalsOffline = false
    /// His curated product list (fresh or cached).
    public internal(set) var catalog: Cached<[PenzProduct]>?
    public internal(set) var catalogProblem: PlanFetchError?
    public internal(set) var catalogOffline = false
    /// The monthly strategy figure (online only: it is asked for while he looks).
    public internal(set) var strategy: PenzStrategy?
    public internal(set) var strategyProblem: PlanFetchError?

    /// A cached answer older than this is not shown at all — a month-old remainder is not this week's.
    public static let maxAge: TimeInterval = 14 * 86_400
    static let endpoint = "penz/snapshot"
    static let key = "current"
    static let portfolioEndpoint = "penz/portfolio"
    static let digestEndpoint = "penz/digest"
    static let weeklyEndpoint = "penz/weekly"
    static let practiceEndpoint = "penz/practice"
    static let proposalsEndpoint = "penz/proposals"
    static let catalogEndpoint = "penz/catalog"

    @ObservationIgnored public let client: PenzClient?
    @ObservationIgnored let cache: ServerCache?
    @ObservationIgnored let clock: @MainActor () -> Date

    @ObservationIgnored private let sleep: @Sendable (Duration) async throws -> Void

    public init(client: PenzClient?, cache: ServerCache?, clock: @escaping @MainActor () -> Date = { Date() },
                sleep: @escaping @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) }) {
        self.client = client; self.cache = cache; self.clock = clock; self.sleep = sleep
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
        // Ten independent reads at once, as unstructured tasks — not `async let`: ten async lets awaited as two
        // tuples abort the Swift 6.2 / iOS 26.3 concurrency runtime (`swift_task_dealloc` fatal error in
        // `asyncLet_finish_after_task_completion`) both in the simulator and natively (`mezo-r36n9.153`).
        let a = Task { await Self.attempt { try await client.allowance() } }
        let t = Task { await Self.attempt { try await client.transactions(month: month) } }
        let c = Task { await Self.attempt { try await client.categories() } }
        let acc = Task { await Self.attempt { try await client.accounts() } }
        let o = Task { await Self.attempt { try await client.openMonths() } }
        let g = Task { await Self.attempt { try await client.goals() } }
        let s = Task { await Self.attempt { try await client.settings() } }
        let pf = Task { await Self.attempt { try await client.portfolio() } }
        let dg = Task { await Self.attempt { try await client.digest() } }
        let wk = Task { await Self.attempt { try await client.weeklyReview() } }
        let (ra, rt, rc, racc, ro, rg, rs) = await (a.value, t.value, c.value, acc.value, o.value, g.value, s.value)
        let (rpf, rdg, rwk) = await (pf.value, dg.value, wk.value)
        await applyPortfolio(rpf)
        await applyDigest(rdg)
        await applyWeekly(rwk)

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

    // MARK: - Pénzem and the digest (L6)

    /// What one independent read leaves on screen: the fresh answer (cached), or — with no net — the cache with its
    /// age, or the problem. A server fault keeps what was already on screen and says so.
    func settle<T: Codable & Sendable>(_ result: Result<T, PlanFetchError>, current: Cached<T>?, endpoint: String,
                                               key: String) async -> (Cached<T>?, PlanFetchError?, Bool) {
        switch result {
        case .success(let value):
            try? await cache?.put(value, endpoint: endpoint, date: key)
            return (Cached(value: value, fetchedAt: clock(), age: 0), nil, false)
        case .failure(.offline):
            if let hit = await cache?.get(T.self, endpoint: endpoint, date: key, maxAge: Self.maxAge) { return (hit, nil, true) }
            return (current, current == nil ? .offline : nil, current != nil)
        case .failure(let e):
            return (current, e, false)
        }
    }

    private func applyPortfolio(_ r: Result<PenzPortfolio, PlanFetchError>) async {
        (portfolio, portfolioProblem, portfolioOffline) = await settle(r, current: portfolio, endpoint: Self.portfolioEndpoint,
                                                                      key: Self.key)
    }

    private func applyDigest(_ r: Result<PenzDigest, PlanFetchError>) async {
        // Keyed by the day: yesterday's stories are not this morning's.
        let current = digest.flatMap { $0.value.date == today || $0.value.date.isEmpty ? $0 : nil }
        (digest, digestProblem, digestOffline) = await settle(r, current: current, endpoint: Self.digestEndpoint, key: today)
    }

    private func applyWeekly(_ r: Result<PenzWeeklyReview, PlanFetchError>) async {
        // The latest review, one key: last week's reading stays true until the next one is built.
        (weekly, weeklyProblem, weeklyOffline) = await settle(r, current: weekly, endpoint: Self.weeklyEndpoint, key: Self.key)
    }

    /// Re-reads the weekly review alone.
    public func reloadWeekly() async {
        guard let client else { return }
        await applyWeekly(await Self.attempt { try await client.weeklyReview() })
    }

    // MARK: - Asking for a fresh digest

    /// Where an asked-for rebuild stands (the digest block says it in one calm line).
    public enum DigestRefresh: Equatable, Sendable {
        case idle
        /// Asked; the server is reading the news — re-read after ~45 s and ~120 s.
        case working
        /// The server refused: it was rebuilt a few minutes ago.
        case limited
    }
    public private(set) var digestRefresh: DigestRefresh = .idle
    /// His first holding just landed: one rebuild round is owed even if one already ran today.
    public private(set) var digestRefreshWanted = false
    /// The day a round already ran this session — so it never loops.
    @ObservationIgnored private var refreshedFor: String?
    @ObservationIgnored private var round = 0
    /// The two re-reads after the ask: ~45 s, then ~120 s after it.
    public static let digestRefreshWaits: [Duration] = [.seconds(45), .seconds(75)]

    /// Should a round run now: the first holding just landed, or — once a day — today's digest is pending or quiet
    /// while he has holdings.
    public var shouldRefreshDigest: Bool {
        guard client != nil else { return false }
        if digestRefreshWanted { return true }
        guard refreshedFor != today, let d = digest?.value, portfolio?.value.isEmpty == false else { return false }
        return d.status == "pending" || d.status == "quiet"
    }

    /// One round: ask for a rebuild, then re-read the digest twice and stop. A 429 keeps what is on screen and says
    /// so; any other failure stays quiet (the digest block already shows its own state). Cancelling the task (he left
    /// the page) ends the round.
    public func refreshDigestRound() async {
        guard let client, shouldRefreshDigest else { return }
        refreshedFor = today
        digestRefreshWanted = false
        round += 1
        let mine = round
        defer { if round == mine, digestRefresh == .working { digestRefresh = .idle } }
        do { try await client.refreshDigest() } catch {
            if error == .conflict("PENZ_DIGEST_REFRESH_LIMITED") { digestRefresh = .limited }
            return
        }
        digestRefresh = .working
        for wait in Self.digestRefreshWaits {
            do { try await sleep(wait) } catch { return }
            guard !Task.isCancelled, round == mine else { return }
            await reloadDigest()
        }
    }

    /// Re-reads Pénzem alone (after a buy, a sell or an event).
    public func reloadPortfolio() async {
        guard let client else { return }
        await applyPortfolio(await Self.attempt { try await client.portfolio() })
    }

    /// Re-reads the digest alone (the block's "Újra").
    public func reloadDigest() async {
        guard let client else { return }
        await applyDigest(await Self.attempt { try await client.digest() })
    }

    /// The record sheet: a new holding first (idempotent on its `clientRef`, so a retry after a failed buy never makes
    /// a second one), then the buy or sell. The error sentence, or nil on success — Pénzem is read again either way
    /// once something was written.
    public func recordInvestment(newHolding: PenzHoldingRequest?, holdingId: String?,
                                 transaction: PenzInvestTxnRequest) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        var id = holdingId
        if let newHolding {
            do { id = try await client.createHolding(newHolding).id } catch { return penzErrorText(error) }
        }
        guard let id else { return "Válaszd ki, melyik befektetésről van szó." }
        var request = transaction
        request.holdingId = id
        let hadNone = portfolio?.value.isEmpty ?? true
        do { _ = try await client.createInvestTransaction(request) } catch {
            if newHolding != nil { await reloadPortfolio() }
            return penzErrorText(error)
        }
        // paid from / into a money account (mezo-r36n9.119): the allowance and Költés moved too, so everything is read
        // again (the full read includes Pénzem); otherwise Pénzem alone, as in L6
        if request.accountId != nil { await load(force: true) } else { await reloadPortfolio() }
        // his first holding: the digest has something to look for now
        if hadNone, portfolio?.value.isEmpty == false { digestRefreshWanted = true }
        return nil
    }

    /// The bank-SMS debits a buy may adopt (`mezo-r36n9.119`); empty when there is none, no net or the read fails —
    /// the offer is a convenience, never a blocker.
    public func smsCandidates(accountId: String, amountMinor: Int64, date: String) async -> [PenzTransaction] {
        guard let client else { return [] }
        return (try? await client.smsCandidates(accountId: accountId, amountMinor: amountMinor, date: date)) ?? []
    }

    public func addEvent(_ request: PenzHoldingEventRequest) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.createHoldingEvent(request) } catch { return penzErrorText(error) }
        await reloadPortfolio()
        return nil
    }

    /// "3 órás adat" for Pénzem when it is drawn from an older read.
    public var portfolioAgeText: String? { penzAgeText(portfolio.map { clock().timeIntervalSince($0.fetchedAt) }) }
    public var digestAgeText: String? { penzAgeText(digest.map { clock().timeIntervalSince($0.fetchedAt) }) }

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
