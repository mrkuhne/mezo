import Foundation
import Observation
import BoopAPI
import BoopCore

/// The daily loop's app-wide glue (B3, spec §7.1): the day ledgers the screens read, the outbox that delivers every
/// capture, Boop's lines, the plan cache and the watch snapshot. One per signed-in user, handed down the view tree.
///
/// A capture always goes ledger first (pending) → outbox → flush, so the screens never wait for the network; the outbox
/// clears the ledger's pending flag when an item is delivered.
@MainActor @Observable
final class RitmusEnvironment {
    let ledger: LedgerStore
    @ObservationIgnored let outbox: Outbox
    @ObservationIgnored let calendar: Calendar
    @ObservationIgnored let clock: @Sendable () -> Date
    /// The spoken-sentence recorder; nil until Task 10 brings the real one (the mic is dimmed, typing works).
    @ObservationIgnored var recorder: (any VoiceNoteRecorder)?
    @ObservationIgnored private let lineSource: @Sendable (_ date: String, _ slot: String) async throws -> String
    @ObservationIgnored private let snapshotSource: @Sendable (Date) async -> CheckInSnapshotValue
    @ObservationIgnored private let planSource: (@Sendable (String) async throws -> [String: CheckInPlanLite])?

    /// `line`: Boop's sentence after a check-in (throws `RitmusFetchError`); `snapshot`: the watch at a moment;
    /// `plans`: the day's questions of the day (nil = never fetched, e.g. in tests).
    init(ledgerDirectory: URL, outboxDirectory: URL, sender: OutboxSender,
         line: @escaping @Sendable (String, String) async throws -> String,
         snapshot: @escaping @Sendable (Date) async -> CheckInSnapshotValue,
         plans: (@Sendable (String) async throws -> [String: CheckInPlanLite])?,
         clock: @escaping @Sendable () -> Date = { Date() }, calendar: Calendar = .current) {
        let ledger = LedgerStore(directory: ledgerDirectory)
        self.ledger = ledger
        // Dates on the wire are Gregorian, in the device zone.
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        greg.locale = Locale(identifier: "en_US_POSIX")
        self.calendar = greg
        self.clock = clock
        lineSource = line; snapshotSource = snapshot; planSource = plans
        // A delivery clears the pending flag only when no newer version of the same id (a note sent after an
        // in-flight check-in) is still queued — that one clears it when it arrives.
        let queue = OutboxRef()
        outbox = Outbox(directory: outboxDirectory, sender: sender, clock: clock, calendar: greg) { item, _ in
            if await queue.outbox?.isQueued(item.id) == true { return }
            await ledger.markSent(item.id, date: item.date)
        }
        queue.outbox = outbox
    }

    /// Lets the outbox's delivery listener ask the outbox itself (set once, right after creation).
    private final class OutboxRef: @unchecked Sendable { var outbox: Outbox? }

    /// Each signed-in user keeps their own days and queue: `<base>/boop-ritmus/<userId>/ledger|outbox`.
    static func directories(for userId: UUID, base: URL = .applicationSupportDirectory) -> (ledger: URL, outbox: URL) {
        let root = base.appendingPathComponent("boop-ritmus", isDirectory: true)
            .appendingPathComponent(userId.uuidString, isDirectory: true)
        return (root.appendingPathComponent("ledger", isDirectory: true), root.appendingPathComponent("outbox", isDirectory: true))
    }

    /// The real wiring: the Boop API client, HealthKit for the snapshot, the user's own directories.
    static func live(client: Client, health: HealthReader, userId: UUID) -> RitmusEnvironment {
        let dirs = directories(for: userId)
        let ritmus = RitmusClient(client: client, audioDirectory: dirs.outbox)
        let snapshots = SnapshotBuilder(reader: health)
        return RitmusEnvironment(
            ledgerDirectory: dirs.ledger, outboxDirectory: dirs.outbox, sender: ritmus,
            line: { date, slot in try await ritmus.checkInLine(date, slot: slot) },
            snapshot: { now in await snapshots.snapshot(at: now) },
            plans: { date in try await ritmus.fetchPlans(date) })
    }

    /// The local day of `date` (`yyyy-MM-dd`).
    func day(of date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    var today: String { day(of: clock()) }

    /// Writes the check-in to the day (pending) and queues it. Throws when the phone could not keep it (disk).
    /// `kind` is `.checkInNote` for the follow-up carrying the sentence; it keeps the check-in's id and moment.
    func capture(_ checkIn: LedgerCheckIn, payload: CheckInPayload, kind: OutboxKind = .checkIn, date: String) async throws {
        var local = checkIn
        local.pending = true
        try ledger.saveCheckIn(local, date: date)
        try await outbox.enqueue(OutboxItem(id: checkIn.id, kind: kind, date: date, capturedAt: checkIn.capturedAt,
                                            payload: RitmusPayload.encode(payload)))
    }

    /// Sends what is queued; true when the item went out (false: still waiting for the net, or refused).
    @discardableResult
    func deliver(_ id: UUID) async -> Bool {
        await outbox.flush(ignoringBackoff: true)
        let pending = await outbox.pending.contains { $0.id == id }
        let failed = await outbox.failed.contains { $0.id == id }
        return !pending && !failed
    }

    /// True while the item still waits for the net (not refused).
    func isWaiting(_ id: UUID) async -> Bool { await outbox.pending.contains { $0.id == id } }

    func checkInLine(date: String, slot: String) async throws -> String { try await lineSource(date, slot) }

    func snapshot(at date: Date) async -> CheckInSnapshotValue { await snapshotSource(date) }

    /// Fetches and caches the day's questions of the day; quietly does nothing offline.
    func refreshPlans(_ date: String) async {
        guard let planSource, let plans = try? await planSource(date) else { return }
        ledger.cachePlans(Array(plans.values), date: date)
    }
}
