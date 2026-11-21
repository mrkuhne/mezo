import Foundation
import Observation

/// The Hatás tab's data (Boop B6 Évad S4, `mezo-r36n9.16`), owned by `EvadStore` like the menu store.
///
/// **Offline is an answer** (the Évad rule): the last list is cached per user with its age and shown when the net is
/// missing; every change (Indulhat, Ma megvolt, Leállítom, Megtartom, Új kísérlet) says it needs the net. A refusal or a
/// server fault is reported as itself. Every change is sent, then the list is re-read, so what is on screen is always
/// the server's (the running experiment's day count, the proposal detector's answer).
@MainActor @Observable
public final class EvadExperimentStore {
    public private(set) var data: EvadExperiments?
    /// The list on screen came from the cache (and how old it is).
    public private(set) var offline = false
    public private(set) var age: TimeInterval?
    /// Why the last read gave no answer (nil while an answer is on screen).
    public private(set) var problem: PlanFetchError?
    public private(set) var loading = false
    /// A change is on its way: the buttons wait.
    public private(set) var busy = false
    /// A change that did not go through, in his words.
    public var actionProblem: String?

    static let endpoint = "evad/experiments"
    static let key = "-"
    public static let maxAge: TimeInterval = 14 * 86_400

    @ObservationIgnored let client: EvadClient?
    @ObservationIgnored let cache: ServerCache?
    @ObservationIgnored let clock: @MainActor () -> Date
    @ObservationIgnored let calendar: Calendar

    public init(client: EvadClient?, cache: ServerCache?, clock: @escaping @MainActor () -> Date = { Date() },
                calendar: Calendar = .current) {
        self.client = client; self.cache = cache; self.clock = clock; self.calendar = calendar
    }

    public var ageText: String? { offline ? penzAgeText(age) : nil }
    public var today: String { evadToday(clock(), calendar: calendar) }

    /// The experiment with that id, wherever it is on screen.
    public func experiment(_ id: String) -> EvadExperiment? {
        guard let d = data else { return nil }
        return ([d.proposal, d.running].compactMap { $0 } + d.past).first { $0.id == id }
    }

    // MARK: - Reading

    public func load(force: Bool = false) async {
        guard let client else {
            if data == nil { problem = .unauthorized }
            return
        }
        guard force || data == nil || offline else { return }
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do throws(PlanFetchError) {
            let fresh = try await client.experiments()
            data = fresh; offline = false; age = nil; problem = nil
            try? await cache?.put(fresh, endpoint: Self.endpoint, date: Self.key)
        } catch .offline {
            if let hit = await cache?.get(EvadExperiments.self, endpoint: Self.endpoint, date: Self.key, maxAge: Self.maxAge) {
                data = hit.value; age = hit.age; offline = true; problem = nil
            } else if data == nil {
                problem = .offline
            } else {
                offline = true
            }
        } catch {
            if data == nil { problem = error }
        }
    }

    // MARK: - Changes (each only on his tap)

    /// „Indulhat" — on the Hatás tab's highlight or the Ma wall's card.
    public func start(_ id: String) async {
        guard let client else { return }
        await run { _ = try await client.startExperiment(id: id) }
    }

    /// „Most nem" on a proposal, „Leállítom" on a running one.
    public func dismiss(_ id: String) async {
        guard let client else { return }
        await run { _ = try await client.dismissExperiment(id: id) }
    }

    /// „Megtartom szokásnak".
    public func keep(_ id: String) async {
        guard let client else { return }
        await run { _ = try await client.keepExperiment(id: id) }
    }

    /// „Ma megvolt" — ticks today on the running experiment, or unticks it.
    public func toggleToday() async {
        guard let client, let r = data?.running else { return }
        let day = today
        let done = !r.markedDays.contains(day)
        await run { _ = try await client.markExperimentDay(id: r.id, date: day, done: done) }
    }

    /// „Indítom" / „Újra kipróbálom". True when it started.
    @discardableResult
    public func create(_ c: EvadExperimentCreate) async -> Bool {
        guard let client else { return false }
        return await run { _ = try await client.createExperiment(c) }
    }

    // MARK: -

    @discardableResult
    private func run(_ body: () async throws -> Void) async -> Bool {
        guard !busy else { return false }
        busy = true; actionProblem = nil
        defer { busy = false }
        do {
            try await body()
        } catch {
            let e = (error as? PlanFetchError) ?? .server
            actionProblem = e == .offline ? "Ehhez internet kell. Próbáld újra, ha lesz net." : evadErrorText(e)
            return false
        }
        await load(force: true)
        return true
    }
}
