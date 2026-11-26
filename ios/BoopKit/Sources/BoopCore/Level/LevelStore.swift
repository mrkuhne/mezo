import Foundation
import Observation

/// Where one section of the page stands.
public enum LevelLoadState: Equatable, Sendable {
    case idle, loading, loaded
    case failed(PlanFetchError)
}

/// What a Levél action came to — the screens turn it into a line or a button state.
public enum LevelOutcome: Equatable, Sendable {
    case done
    /// A tap on a card whose previous answer is still on its way; nothing was sent.
    case ignored
    /// The manual run was asked for too soon (`MAIL_RUN_COOLDOWN`, HTTP 429): show "kicsit várj", not an error.
    case cooldown
    case failed(PlanFetchError)
}

/// What the Google sign-in came to after the browser step.
public enum LevelGoogleOutcome: Equatable, Sendable {
    case connected
    /// Google (or the server's exchange) refused: "A Google nem engedte a belépést".
    case refused
    /// The server has no Google client id (409 `MAIL_GOOGLE_NOT_CONFIGURED`).
    case notConfigured
    case offline
    case failed(PlanFetchError)
}

/// The Levél area's data (mezo-r36n9.39): the mailbox, one day's post and the sender rules, each loaded on its own so
/// a rules fault never takes the post with it.
///
/// **Offline is an answer, not an error** (the Edzés / Pénz rule): the digest goes to the server first and the whole
/// answer is written to the per-user `ServerCache` under today's Budapest day; with no network the page shows the
/// last cached copy and `isStale` says so. A refusal or a server fault is reported as itself, never dressed as an old
/// answer. **The app password is never stored**: it is a parameter of `connect` and goes straight to the client; no
/// property, cache blob or log line ever holds it.
@MainActor @Observable
public final class LevelStore {
    public private(set) var digest: LevelDigest?
    public private(set) var mailbox: LevelMailbox?
    public private(set) var rules: LevelRules?
    public private(set) var digestState: LevelLoadState = .idle
    public private(set) var mailboxState: LevelLoadState = .idle
    public private(set) var rulesState: LevelLoadState = .idle
    /// The digest on screen came from the cache because the net was missing.
    public private(set) var isStale = false
    /// The mailbox on screen came from the cache because the net was missing.
    public private(set) var mailboxIsStale = false
    /// The cached digest's age, while it is stale.
    public private(set) var digestAge: TimeInterval?
    /// His verdicts on cards this session, applied the moment he taps (reverted if the server refuses).
    public private(set) var verdicts: [String: LevelVerdict] = [:]

    @ObservationIgnored private var feedbackInFlight: Set<String> = []

    static let digestEndpoint = "level/digest"
    static let mailboxEndpoint = "level/mailbox"
    static let mailboxKey = "current"
    /// A cached post older than this is not shown (it is also keyed by day, so it is read for today and yesterday).
    public static let maxAge: TimeInterval = 3 * 86_400

    @ObservationIgnored public let client: LevelClient?
    @ObservationIgnored let cache: ServerCache?
    @ObservationIgnored let clock: @MainActor () -> Date

    public init(client: LevelClient?, cache: ServerCache?, clock: @escaping @MainActor () -> Date = { Date() }) {
        self.client = client; self.cache = cache; self.clock = clock
    }

    // MARK: - Reading

    /// Reads the mailbox and today's post (in parallel).
    public func refresh() async {
        guard let client else {
            if digest == nil { digestState = .failed(.unauthorized); mailboxState = .failed(.unauthorized) }
            return
        }
        digestState = .loading
        if mailbox == nil { mailboxState = .loading }
        let day = levelDay(clock())
        async let m = Self.attempt { try await client.mailbox() }
        async let d = Self.attempt { try await client.digest(day: day) }
        let (rm, rd) = await (m, d)
        await applyMailbox(rm)
        await applyDigest(rd, day: day)
    }

    /// The sender rules (the settings screen asks when it opens).
    public func loadRules() async {
        guard let client else { rulesState = .failed(.unauthorized); return }
        rulesState = .loading
        switch await Self.attempt({ try await client.rules() }) {
        case .success(let r): rules = r; rulesState = .loaded
        case .failure(let e): rulesState = .failed(e)
        }
    }

    nonisolated static func attempt<T: Sendable>(_ op: @Sendable () async throws -> T) async -> Result<T, PlanFetchError> {
        do { return .success(try await op()) } catch { return .failure((error as? PlanFetchError) ?? .server) }
    }

    private func applyMailbox(_ r: Result<LevelMailbox, PlanFetchError>) async {
        switch r {
        case .success(let m):
            mailbox = m; mailboxState = .loaded; mailboxIsStale = false
            try? await cache?.put(m, endpoint: Self.mailboxEndpoint, date: Self.mailboxKey)
        case .failure(.offline):
            if mailbox == nil,
               let hit = await cache?.get(LevelMailbox.self, endpoint: Self.mailboxEndpoint, date: Self.mailboxKey, maxAge: .infinity) {
                mailbox = hit.value
            }
            mailboxState = mailbox == nil ? .failed(.offline) : .loaded
            mailboxIsStale = mailbox != nil
        case .failure(let e):
            mailboxState = .failed(e)
        }
    }

    private func applyDigest(_ r: Result<LevelDigest, PlanFetchError>, day: String) async {
        switch r {
        case .success(let d):
            digest = d; digestState = .loaded; isStale = false; digestAge = nil
            try? await cache?.put(d, endpoint: Self.digestEndpoint, date: day)
        case .failure(.offline):
            if digest != nil {
                // What is in memory is newer than any cached day: keep it, only say it is old.
                digestState = .loaded; isStale = true
            } else if let hit = await lastCachedDigest() {
                digest = hit.value; digestState = .loaded; isStale = true; digestAge = hit.age
            } else {
                digestState = .failed(.offline)
            }
        case .failure(let e):
            digestState = .failed(e)
        }
    }

    /// Today's cached post, else yesterday's, else the day before's — whichever the cache still has.
    private func lastCachedDigest() async -> Cached<LevelDigest>? {
        guard let cache else { return nil }
        let now = clock()
        for back in 0..<3 {
            guard let date = levelCalendar.date(byAdding: .day, value: -back, to: now) else { continue }
            if let hit = await cache.get(LevelDigest.self, endpoint: Self.digestEndpoint, date: levelDay(date), maxAge: Self.maxAge) {
                return hit
            }
        }
        return nil
    }

    // MARK: - Actions

    /// Connects the mailbox. The password is passed straight through and forgotten.
    public func connect(address: String, appPassword: String) async -> LevelOutcome {
        guard let client else { return .failed(.unauthorized) }
        switch await Self.attempt({ try await client.connect(address: address, appPassword: appPassword) }) {
        case .success(let m):
            mailbox = m; mailboxState = .loaded; mailboxIsStale = false
            try? await cache?.put(m, endpoint: Self.mailboxEndpoint, date: Self.mailboxKey)
            return .done
        case .failure(let e):
            return .failed(e)
        }
    }

    /// Connects through Google. The code and verifier are parameters that go straight to the server — no token, code or
    /// verifier is ever kept on the phone.
    public func connectGoogle(code: String, codeVerifier: String, redirectUri: String) async -> LevelGoogleOutcome {
        guard let client else { return .failed(.unauthorized) }
        switch await Self.attempt({ try await client.connectGoogle(code: code, codeVerifier: codeVerifier, redirectUri: redirectUri) }) {
        case .success(let m):
            // The answer carries the client id too, but keep the one we already knew if the answer lacks it.
            var m = m
            if m.googleClientId == nil { m.googleClientId = mailbox?.googleClientId }
            mailbox = m; mailboxState = .loaded; mailboxIsStale = false
            try? await cache?.put(m, endpoint: Self.mailboxEndpoint, date: Self.mailboxKey)
            return .connected
        case .failure(.offline): return .offline
        case .failure(.rejected("MAIL_AUTH_FAILED")), .failure(.conflict("MAIL_AUTH_FAILED")): return .refused
        case .failure(.conflict("MAIL_GOOGLE_NOT_CONFIGURED")), .failure(.rejected("MAIL_GOOGLE_NOT_CONFIGURED")): return .notConfigured
        case .failure(let e): return .failed(e)
        }
    }

    public func disconnect() async -> LevelOutcome {
        guard let client else { return .failed(.unauthorized) }
        switch await Self.attempt({ try await client.disconnect() }) {
        case .success(let m):
            mailbox = m; mailboxState = .loaded; mailboxIsStale = false
            try? await cache?.put(m, endpoint: Self.mailboxEndpoint, date: Self.mailboxKey)
            return .done
        case .failure(let e):
            return .failed(e)
        }
    }

    /// Asks for a run now. Too soon (429, `MAIL_RUN_COOLDOWN`) is `.cooldown`, not a fault.
    public func runNow() async -> LevelOutcome {
        guard let client else { return .failed(.unauthorized) }
        let result: Result<Void, PlanFetchError> = await Self.attempt { try await client.run() }
        switch result {
        case .success: return .done
        case .failure(.conflict("MAIL_RUN_COOLDOWN")), .failure(.rejected("MAIL_RUN_COOLDOWN")): return .cooldown
        case .failure(let e): return .failed(e)
        }
    }

    /// "Érdekel" / "nem érdekel" on a card: shown at once, taken back if the server says no.
    public func feedback(item: String, verdict: LevelVerdict) async -> LevelOutcome {
        guard let client else { return .failed(.unauthorized) }
        guard feedbackInFlight.insert(item).inserted else { return .ignored }
        defer { feedbackInFlight.remove(item) }
        let previous = verdicts[item]
        verdicts[item] = verdict
        let result: Result<Void, PlanFetchError> = await Self.attempt { try await client.feedback(item: item, verdict: verdict) }
        switch result {
        case .success: return .done
        case .failure(let e):
            verdicts[item] = previous
            return .failed(e)
        }
    }

    public func saveRules(_ request: LevelRulesRequest) async -> LevelOutcome {
        guard let client else { return .failed(.unauthorized) }
        switch await Self.attempt({ try await client.saveRules(request) }) {
        case .success(let r): rules = r; rulesState = .loaded; return .done
        case .failure(let e): return .failed(e)
        }
    }
}
