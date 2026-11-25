import Foundation
import Observation

/// The season's load-vs-recovery data for the Évad page (B7 K2, `mezo-r36n9.17`), and the Átrendezés weeks (K3).
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
    /// Where an accept made without the net waits (`OutboxKind.dayAdjustment`); nil = no queue (an offline accept
    /// then only says so).
    @ObservationIgnored private let outbox: Outbox?

    public init(client: KapacitasClient?, cache: ServerCache?, outbox: Outbox? = nil) {
        self.client = client; self.cache = cache; self.outbox = outbox
    }

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

    // MARK: - The Átrendezés week (K3)

    /// The weeks read so far, by Monday (`yyyy-MM-dd`).
    public private(set) var weeks: [String: KapacitasWeek] = [:]
    /// How old a week on screen is when it came from the cache (absent for a fresh read).
    public private(set) var weekAges: [String: TimeInterval] = [:]
    /// Why a week could not be shown at all (nothing cached either).
    public private(set) var weekProblem: [String: PlanFetchError] = [:]
    public private(set) var weekLoading: Set<String> = []
    /// Proposals accepted without the net, waiting in the outbox.
    public private(set) var queuedAccepts: Set<String> = []
    /// Proposals whose decision is on its way to the server right now.
    public private(set) var deciding: Set<String> = []
    /// The page's one quiet line (a stale card refreshed, a day already started, no net).
    public var notice: String?

    /// The phone's idempotency key per proposal: a second tap, or the offline replay, sends the same one.
    @ObservationIgnored private var clientRefs: [String: String] = [:]

    static let weekEndpoint = "kapacitas/week"

    public static let staleNotice = "Közben változott a heted, frissítettem a javaslatokat."
    static let dayStartedNotice = "Ez a nap már elkezdődött, rajta már nem változtatok."
    static let offlineNotice = "Most nincs net, nem tudtam elküldeni. Próbáld újra később."
    static let failedNotice = "Nem sikerült elküldeni. Próbáld újra."

    /// "3 órás adat" while a cached week is on screen.
    public func weekAgeText(_ monday: String) -> String? { penzAgeText(weekAges[monday]) }

    /// Open proposals of the week (nil = the week is not read).
    public func openCount(monday: String) -> Int? {
        weeks[monday].map { w in w.proposals.filter { $0.status == "open" && !queuedAccepts.contains($0.id) }.count }
    }

    /// Reads the week; with no net (or a fault) the last cached read is shown with its age.
    public func loadWeek(monday: String) async {
        guard let client, !weekLoading.contains(monday) else { return }
        weekLoading.insert(monday)
        defer { weekLoading.remove(monday) }
        do throws(PlanFetchError) {
            await put(try await client.week(monday: monday), monday: monday)
        } catch {
            if weeks[monday] == nil || weekAges[monday] != nil,
               let hit = await cache?.get(KapacitasWeek.self, endpoint: Self.weekEndpoint, date: monday, maxAge: Self.maxAge) {
                weeks[monday] = hit.value; weekAges[monday] = hit.age; weekProblem[monday] = nil
            } else if weeks[monday] == nil {
                weekProblem[monday] = error
            }
        }
        await syncOutbox()
    }

    private func put(_ week: KapacitasWeek, monday: String) async {
        weeks[monday] = week; weekAges[monday] = nil; weekProblem[monday] = nil
        try? await cache?.put(week, endpoint: Self.weekEndpoint, date: monday)
    }

    /// „Jóváhagyom" / „Felírom teendőnek". No net → queued (the same clientRef), a stale card → the week is
    /// refreshed (regenerated when nothing open is left for that day) and one quiet line says so.
    public func accept(_ p: KapacitasProposal, monday: String) async {
        guard let client, !deciding.contains(p.id) else { return }
        let ref = clientRefs[p.id] ?? UUID().uuidString.lowercased()
        clientRefs[p.id] = ref
        deciding.insert(p.id)
        defer { deciding.remove(p.id) }
        do throws(PlanFetchError) {
            try await client.accept(proposalId: p.id, clientRef: ref)
            notice = nil
            await loadWeek(monday: monday)
        } catch {
            switch error {
            case .offline: await queue(p, ref: ref, monday: monday)
            case .conflict("CAPACITY_PROPOSAL_STALE"): await refreshAfterStale(p, monday: monday)
            case .conflict("CAPACITY_DAY_STARTED"), .dayWorkoutRunning:
                notice = Self.dayStartedNotice
                await loadWeek(monday: monday)
            case .conflict, .rejected, .notFound:
                notice = Self.staleNotice
                await loadWeek(monday: monday)
            default: notice = Self.failedNotice
            }
        }
    }

    private func queue(_ p: KapacitasProposal, ref: String, monday: String) async {
        guard let outbox, let id = UUID(uuidString: ref) else { notice = Self.offlineNotice; return }
        let payload = DayAdjustmentPayload(proposalId: p.id, clientRef: ref)
        let data = (try? JSONEncoder().encode(payload)) ?? Data()
        do {
            // the same id replaces the queued item in place: a second tap never queues a second accept
            try await outbox.enqueue(OutboxItem(id: id, kind: .dayAdjustment, date: p.day ?? monday, capturedAt: Date(),
                                                payload: data), rollbackOnFailure: true)
            queuedAccepts.insert(p.id)
            notice = nil
        } catch {
            notice = Self.failedNotice
        }
    }

    private func refreshAfterStale(_ p: KapacitasProposal, monday: String) async {
        notice = Self.staleNotice
        clientRefs[p.id] = nil
        await loadWeek(monday: monday)
        guard let client, let week = weeks[monday], weekAges[monday] == nil else { return }
        let stillOpen = week.proposals.contains { $0.status == "open" && $0.day == p.day }
        guard !stillOpen else { return }
        do throws(PlanFetchError) {
            await put(try await client.regenerate(monday: monday), monday: monday)
        } catch {
            // a past week cannot be regenerated: the refreshed week stays
        }
    }

    /// „Most nem": nothing moves.
    public func decline(_ p: KapacitasProposal, monday: String) async {
        guard let client, !deciding.contains(p.id) else { return }
        deciding.insert(p.id)
        defer { deciding.remove(p.id) }
        do throws(PlanFetchError) {
            try await client.decline(proposalId: p.id)
            notice = nil
        } catch {
            notice = error == .offline ? Self.offlineNotice : Self.staleNotice
        }
        await loadWeek(monday: monday)
    }

    /// „vissza" on an accepted card: the whole bundle is taken back (allowed until its day starts). A queued accept
    /// simply leaves the outbox.
    public func undo(_ p: KapacitasProposal, monday: String) async {
        if queuedAccepts.contains(p.id) {
            if let ref = clientRefs[p.id], let id = UUID(uuidString: ref), await outbox?.inFlight != id {
                await outbox?.remove(id)
                queuedAccepts.remove(p.id)
            }
            return
        }
        guard let client, !deciding.contains(p.id),
              let row = weeks[monday]?.adjustments.first(where: { $0.proposalId == p.id && ["active", "waiting"].contains($0.state) })
        else { return }
        deciding.insert(p.id)
        defer { deciding.remove(p.id) }
        do throws(PlanFetchError) {
            try await client.undo(adjustmentId: row.id)
            notice = nil
        } catch {
            switch error {
            case .offline: notice = Self.offlineNotice; return
            case .conflict("CAPACITY_DAY_STARTED"): notice = "Ez a nap már elkezdődött, nem tudom visszavonni."
            default: break
            }
        }
        await loadWeek(monday: monday)
    }

    /// „Kérek más javaslatot".
    public func regenerate(monday: String) async {
        guard let client, !weekLoading.contains(monday) else { return }
        weekLoading.insert(monday)
        defer { weekLoading.remove(monday) }
        do throws(PlanFetchError) {
            await put(try await client.regenerate(monday: monday), monday: monday)
            notice = nil
        } catch {
            notice = error == .offline ? "Ehhez internet kell." : Self.failedNotice
        }
    }

    /// A queued accept was delivered or refused: the queue and every week on screen are read again.
    public func outboxChanged() async {
        await syncOutbox()
        for monday in weeks.keys { await loadWeek(monday: monday) }
    }

    /// Re-reads the outbox: which accepts still wait, and which the server refused on replay (a stale card, a started
    /// day) — those leave the queue, the week is refreshed and the page says so once.
    public func syncOutbox() async {
        guard let outbox else { return }
        let items = await outbox.queue.filter { $0.kind == .dayAdjustment }
        var waiting = Set<String>()
        var refused: [UUID] = []
        for item in items {
            guard let p = KapacitasOutboxSender.decode(item.payload) else { continue }
            if item.failure == nil {
                waiting.insert(p.proposalId)
                clientRefs[p.proposalId] = p.clientRef
            } else if item.exhausted != true {
                refused.append(item.id)
            } else {
                waiting.insert(p.proposalId)
            }
        }
        queuedAccepts = waiting
        guard !refused.isEmpty else { return }
        for id in refused { await outbox.remove(id) }
        notice = Self.staleNotice
        for monday in weeks.keys { await loadWeek(monday: monday) }
    }
}
