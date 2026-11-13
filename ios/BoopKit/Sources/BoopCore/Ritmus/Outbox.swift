import Foundation
import OSLog

/// What a queued write is; Task 7's sender maps each kind to its API operation.
public enum OutboxKind: String, Codable, CaseIterable, Sendable {
    case checkIn, checkInNote, goal, goalRemove, journal, voice, dayClose, chatQuestion
    /// A meal captured without the net (B4): the sender computes the draft, it never saves anything.
    case mealDraft
}

/// One pending write. `id` is the client ref the server keys idempotency on, so a resend never duplicates.
public struct OutboxItem: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public var kind: OutboxKind
    /// The local day (`yyyy-MM-dd`) the write belongs to.
    public var date: String
    /// The phone's instant of capture — the record's moment on the server, not the send time.
    public var capturedAt: Date
    /// The encoded request body (the sender knows its shape per kind).
    public var payload: Data
    public var attempts: Int
    /// Not sent before this instant (backoff); nil = as soon as possible.
    public var nextAttempt: Date?
    /// Set when the item will not be sent without the owner's "Újra"; its values stay.
    public var failure: String?
    /// The failure is the attempt cap (the server kept answering "later"), not a refusal: the net coming back gives
    /// it a fresh start (`Outbox.networkReturned`). Absent in queues written before (decodes as nil = a refusal).
    public var exhausted: Bool?

    public init(id: UUID = UUID(), kind: OutboxKind, date: String, capturedAt: Date, payload: Data,
                attempts: Int = 0, nextAttempt: Date? = nil, failure: String? = nil, exhausted: Bool? = nil) {
        self.id = id; self.kind = kind; self.date = date; self.capturedAt = capturedAt; self.payload = payload
        self.attempts = attempts; self.nextAttempt = nextAttempt; self.failure = failure; self.exhausted = exhausted
    }
}

/// The sender's verdict: `sent` (with the response body, if any), `offline` (no network — not an attempt: the drain
/// stops and everything waits for the next trigger), `retryLater` (5xx, most 409s, 429, a 401 — the same item goes again
/// after a backoff, counted against the attempt cap) or `failed` (a 4xx the server will never accept, or the 409 of
/// the focus cap; kept, never dropped).
public enum OutboxSendResult: Equatable, Sendable {
    case sent(Data?)
    case offline
    case retryLater
    case failed(String)
}

public protocol OutboxSender: Sendable {
    func send(_ item: OutboxItem) async -> OutboxSendResult
}

/// The offline-first write queue (spec §7.1): persisted in order as JSON in its directory (file protection until first
/// unlock, so a background flush on a locked phone can still write), survives relaunch, flushed in order.
///
/// - A `retryLater` waits 30 s × 2ⁿ⁻¹ (capped at 30 min); after `maxAttempts` the item is marked failed with its
///   values (`exhausted`), so it gets an "Újra" row instead of retrying forever — and the net coming back
///   (`networkReturned`) starts it afresh. An `offline` answer is never an attempt: a day without network burns nothing.
/// - An item waiting on backoff holds back only the later items that depend on its order: for the same date, the
///   check-in → note / journal → voice → day-close chain, the goal set/remove pair, and chat questions among
///   themselves. Everything else (other dates, other check-in slots, unrelated kinds) keeps flowing.
/// - A failed item steps aside and waits for `retry`. An item dated more than 7 days before today (device zone) is
///   marked failed without sending — the server would refuse it — with its values kept.
/// - An unreadable queue file is moved aside (`queue.corrupt-<ts>.json`), and an undecodable element is kept aside
///   (`queue.unreadable-<ts>.json`) — never overwritten.
public actor Outbox {
    public static let maxAgeDays = 7
    public static let maxAttempts = 8

    private let directory: URL
    private let file: URL
    private let sender: OutboxSender
    private let clock: @Sendable () -> Date
    private let calendar: Calendar
    private let onSent: (@Sendable (OutboxItem, Data?) async -> Void)?
    private var items: [OutboxItem]
    private var flushing = false
    private var flushAgain = false
    private var failureObserver: (@Sendable ([OutboxItem]) async -> Void)?
    private var heardFailures: [UUID]?
    private static let log = Logger(subsystem: "io.mrkuhne.boop", category: "outbox")

    /// `onSent` hears every delivered item (e.g. to clear the ledger's pending flag).
    public init(directory: URL, sender: OutboxSender, clock: @escaping @Sendable () -> Date = { Date() },
                calendar: Calendar = .current, onSent: (@Sendable (OutboxItem, Data?) async -> Void)? = nil) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        self.directory = directory
        file = directory.appendingPathComponent("queue.json")
        // Item dates are Gregorian on the wire, judged in the device's zone.
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        self.sender = sender; self.clock = clock; self.calendar = greg; self.onSent = onSent
        items = Self.load(file, in: directory, stamp: clock())
    }

    /// Application Support/boop-outbox.
    public static func defaultDirectory() -> URL {
        URL.applicationSupportDirectory.appendingPathComponent("boop-outbox", isDirectory: true)
    }

    /// Items still to be sent, in order.
    public var pending: [OutboxItem] { items.filter { $0.failure == nil } }
    /// Items waiting for the owner's "Újra".
    public var failed: [OutboxItem] { items.filter { $0.failure != nil } }

    /// True while an item with this id is still in the queue (pending or failed). Asked from `onSent`, it tells a
    /// listener that a newer version of the delivered item was enqueued meanwhile and is still on its way.
    public func isQueued(_ id: UUID) -> Bool { items.contains { $0.id == id } }

    /// The item whose request is out right now (nil between sends): a capture must not move it mid-send.
    public private(set) var inFlight: UUID?

    /// Every queued item (pending and failed), in order.
    public var queue: [OutboxItem] { items }

    /// The queued item with this id (pending or failed).
    public func queued(_ id: UUID) -> OutboxItem? { items.first { $0.id == id } }

    /// Appends the item; an item with the same id is replaced in place (its newer values go out, in its old position).
    /// Throws when the queue cannot be written to disk — the item is still queued for this run, but would not survive
    /// a relaunch, so the capture flow can say so.
    /// `rollbackOnFailure`: a capture that could not be written down is taken back out of memory too, so the caller's
    /// "could not keep it" is true (a meal capture must not live on in RAM and surface later).
    public func enqueue(_ item: OutboxItem, rollbackOnFailure: Bool = false) async throws {
        let before = items
        if let i = items.firstIndex(where: { $0.id == item.id }) { items[i] = item } else { items.append(item) }
        do { try persist() } catch {
            if rollbackOnFailure { items = before }
            await publishFailures(); throw error
        }
        await publishFailures()
    }

    /// Takes an item back out of the queue (a capture the phone could not keep as a whole is undone).
    public func remove(_ id: UUID) async {
        items.removeAll { $0.id == id }
        save()
        await publishFailures()
    }

    /// "Újra": the failed item gets a fresh start and the queue is flushed.
    public func retry(_ id: UUID) async {
        guard let i = items.firstIndex(where: { $0.id == id && $0.failure != nil }) else { return }
        items[i].failure = nil; items[i].exhausted = nil; items[i].attempts = 0; items[i].nextAttempt = nil
        save()
        await publishFailures()
        await flush()
    }

    /// The network is back: what ran out of tries while it was flaky starts afresh (a refusal keeps waiting for the
    /// owner's "Újra"), and everything queued goes out now.
    public func networkReturned() async {
        for i in items.indices where items[i].exhausted == true {
            items[i].failure = nil; items[i].exhausted = nil; items[i].attempts = 0; items[i].nextAttempt = nil
        }
        save()
        await publishFailures()
        await flush(ignoringBackoff: true)
    }

    /// `handler` hears the failed items now and whenever that list changes (the UI's "nem sikerült elküldeni" rows).
    public func observeFailures(_ handler: @escaping @Sendable ([OutboxItem]) async -> Void) async {
        failureObserver = handler
        heardFailures = nil
        await publishFailures()
    }

    private func publishFailures() async {
        guard let failureObserver else { return }
        let now = failed
        guard now.map(\.id) != heardFailures else { return }
        heardFailures = now.map(\.id)
        await failureObserver(now)
    }

    /// Sends what is due. `ignoringBackoff` (reconnect, foreground) makes every pending item due now. A flush asked
    /// for while one runs makes the running one go round again.
    public func flush(ignoringBackoff: Bool = false) async {
        if ignoringBackoff {
            for i in items.indices where items[i].failure == nil { items[i].nextAttempt = nil }
            save()
        }
        if flushing { flushAgain = true; return }
        flushing = true; defer { flushing = false }
        repeat {
            flushAgain = false
            await drain()
        } while flushAgain
    }

    /// 30 s × 2^(attempts − 1), at most 30 min.
    static func backoff(attempts: Int) -> TimeInterval {
        min(30 * pow(2, Double(min(max(attempts - 1, 0), 10))), 30 * 60)
    }

    /// The order group an item belongs to on its date; a waiting item holds later items of its group.
    /// A check-in starts the chain but does not wait on it (another slot's check-in is independent).
    private static func group(of item: OutboxItem) -> (key: String, waits: Bool) {
        switch item.kind {
        case .checkIn: ("chain|\(item.date)", false)
        case .checkInNote, .journal, .voice, .dayClose: ("chain|\(item.date)", true)
        case .goal, .goalRemove: ("goal|\(item.date)", true)
        case .chatQuestion: ("chat|\(item.date)", true)
        // Every captured meal stands alone: one waiting never holds another back.
        case .mealDraft: ("meal|\(item.id.uuidString)", false)
        }
    }

    private func drain() async {
        var held = Set<String>()
        var index = 0
        while index < items.count {
            let item = items[index]
            if item.failure != nil { index += 1; continue }
            let group = Self.group(of: item)
            if group.waits, held.contains(group.key) { index += 1; continue }
            let now = clock()
            if isTooOld(item.date, now: now) {
                items[index].failure = "Több mint \(Self.maxAgeDays) napos, a szerver már nem fogadja el."
                save(); await publishFailures(); index += 1; continue
            }
            if let next = item.nextAttempt, next > now { held.insert(group.key); index += 1; continue }

            inFlight = item.id
            let result = await sender.send(item)
            inFlight = nil
            // The queue may have changed while the request was out (an enqueue, a replacement).
            guard let i = items.firstIndex(where: { $0.id == item.id }) else { continue }
            switch result {
            case .sent(let body):
                // A newer version enqueued meanwhile stays and goes next.
                if items[i] == item { items.remove(at: i) }
                save()
                await onSent?(item, body)
                index = items.firstIndex(where: { $0.id == item.id }) ?? i
            case .offline:
                // No network: not the item's fault and not an attempt. Nothing else can go either — stop here; the
                // next trigger (the net coming back, the foreground, a capture) sends it all.
                return
            case .retryLater:
                // A newer version enqueued while this one was out was never tried: it starts fresh, due now.
                guard items[i] == item else { index = i + 1; continue }
                items[i].attempts += 1
                if items[i].attempts >= Self.maxAttempts {
                    items[i].failure = "\(Self.maxAttempts) próbálkozás után sem sikerült elküldeni."
                    items[i].exhausted = true
                } else {
                    items[i].nextAttempt = clock().addingTimeInterval(Self.backoff(attempts: items[i].attempts))
                    held.insert(group.key)
                }
                save()
                await publishFailures()
                index = i + 1
            case .failed(let reason):
                // A newer version enqueued meanwhile was not the one refused: it gets its own try.
                guard items[i] == item else { index = i + 1; continue }
                items[i].failure = reason
                save()
                await publishFailures()
                index = i + 1
            }
        }
    }

    private func isTooOld(_ date: String, now: Date) -> Bool {
        let parts = date.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
              let day = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])),
              let age = calendar.dateComponents([.day], from: calendar.startOfDay(for: day),
                                                to: calendar.startOfDay(for: now)).day
        else { return false }
        return age > Self.maxAgeDays
    }

    private func persist() throws {
        do {
            try RitmusFiles.write(try JSONEncoder().encode(items), to: file)
        } catch {
            Self.log.error("outbox write failed: \(error.localizedDescription, privacy: .public)")
            throw error
        }
    }

    /// Persist where nobody can react (flush, retry): the failure is logged and the queue stays in memory.
    private func save() { try? persist() }

    /// Reads the queue element by element: an undecodable element is set aside, an unreadable file moved aside.
    private static func load(_ file: URL, in directory: URL, stamp: Date) -> [OutboxItem] {
        guard let data = try? Data(contentsOf: file) else { return [] }
        guard let elements = try? JSONSerialization.jsonObject(with: data) as? [Any] else {
            log.error("outbox queue unreadable, moved aside")
            RitmusFiles.moveAside(file, as: "queue.corrupt", stamp: stamp)
            return []
        }
        let decoder = JSONDecoder()
        var items: [OutboxItem] = []
        var unreadable: [Any] = []
        for element in elements {
            if let raw = try? JSONSerialization.data(withJSONObject: element),
               let item = try? decoder.decode(OutboxItem.self, from: raw) {
                items.append(item)
            } else {
                unreadable.append(element)
            }
        }
        if !unreadable.isEmpty, let raw = try? JSONSerialization.data(withJSONObject: unreadable) {
            log.error("outbox: \(unreadable.count) unreadable item(s) set aside")
            try? RitmusFiles.write(raw, to: directory.appendingPathComponent(RitmusFiles.asideName("queue.unreadable", stamp: stamp)))
        }
        return items
    }
}

/// File helpers shared by the outbox and the ledger store.
enum RitmusFiles {
    /// Atomic, readable after the first unlock (background flushes on a locked phone).
    static func write(_ data: Data, to url: URL) throws {
        #if os(iOS)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: url, options: .atomic)
        #endif
    }

    static func asideName(_ base: String, stamp: Date) -> String {
        "\(base)-\(Int(stamp.timeIntervalSince1970))-\(UUID().uuidString.prefix(8)).json"
    }

    /// Keeps an unreadable file's bytes under a new name instead of letting the next write overwrite them.
    static func moveAside(_ url: URL, as base: String, stamp: Date) {
        let target = url.deletingLastPathComponent().appendingPathComponent(asideName(base, stamp: stamp))
        try? FileManager.default.moveItem(at: url, to: target)
    }
}
