import Foundation

/// What a queued write is; Task 7's sender maps each kind to its API operation.
public enum OutboxKind: String, Codable, CaseIterable, Sendable {
    case checkIn, checkInNote, goal, goalRemove, journal, voice, dayClose, chatQuestion
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

    public init(id: UUID = UUID(), kind: OutboxKind, date: String, capturedAt: Date, payload: Data,
                attempts: Int = 0, nextAttempt: Date? = nil, failure: String? = nil) {
        self.id = id; self.kind = kind; self.date = date; self.capturedAt = capturedAt; self.payload = payload
        self.attempts = attempts; self.nextAttempt = nextAttempt; self.failure = failure
    }
}

/// The sender's verdict: `sent` (with the response body, if any), `retryLater` (no network, 5xx, 409, 429 — the same
/// item goes again after a backoff) or `failed` (a 4xx the server will never accept; kept, never dropped).
public enum OutboxSendResult: Equatable, Sendable {
    case sent(Data?)
    case retryLater
    case failed(String)
}

public protocol OutboxSender: Sendable {
    func send(_ item: OutboxItem) async -> OutboxSendResult
}

/// The offline-first write queue (spec §7.1): persisted in order as JSON in its directory, survives relaunch, flushed
/// head-first. A retry waits 30 s × 2ⁿ⁻¹ (capped at 30 min) and holds the items behind it, so dependent writes keep
/// their order; a failed item steps aside and waits for `retry`. An item dated more than 7 days before today (device
/// calendar) is marked failed without sending — the server would refuse it — with its values kept.
public actor Outbox {
    public static let maxAgeDays = 7

    private let file: URL
    private let sender: OutboxSender
    private let clock: @Sendable () -> Date
    private let calendar: Calendar
    private let onSent: (@Sendable (OutboxItem, Data?) async -> Void)?
    private var items: [OutboxItem]
    private var flushing = false
    private var flushAgain = false

    /// `onSent` hears every delivered item (e.g. to clear the ledger's pending flag).
    public init(directory: URL, sender: OutboxSender, clock: @escaping @Sendable () -> Date = { Date() },
                calendar: Calendar = .current, onSent: (@Sendable (OutboxItem, Data?) async -> Void)? = nil) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        file = directory.appendingPathComponent("queue.json")
        // Item dates are Gregorian on the wire, judged in the device's zone.
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        self.sender = sender; self.clock = clock; self.calendar = greg; self.onSent = onSent
        items = (try? Data(contentsOf: file)).flatMap { try? JSONDecoder().decode([OutboxItem].self, from: $0) } ?? []
    }

    /// Application Support/boop-outbox.
    public static func defaultDirectory() -> URL {
        URL.applicationSupportDirectory.appendingPathComponent("boop-outbox", isDirectory: true)
    }

    /// Items still to be sent, in order.
    public var pending: [OutboxItem] { items.filter { $0.failure == nil } }
    /// Items waiting for the owner's "Újra".
    public var failed: [OutboxItem] { items.filter { $0.failure != nil } }

    /// Appends the item; an item with the same id is replaced in place (its newer values go out, in its old position).
    public func enqueue(_ item: OutboxItem) async {
        if let i = items.firstIndex(where: { $0.id == item.id }) { items[i] = item } else { items.append(item) }
        persist()
    }

    /// "Újra": the failed item gets a fresh start and the queue is flushed.
    public func retry(_ id: UUID) async {
        guard let i = items.firstIndex(where: { $0.id == id && $0.failure != nil }) else { return }
        items[i].failure = nil; items[i].attempts = 0; items[i].nextAttempt = nil
        persist()
        await flush()
    }

    /// Sends what is due, head first. A flush asked for while one runs makes the running one go round again.
    public func flush() async {
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

    private func drain() async {
        var index = 0
        while index < items.count {
            let item = items[index]
            if item.failure != nil { index += 1; continue }
            let now = clock()
            if isTooOld(item.date, now: now) {
                items[index].failure = "Több mint \(Self.maxAgeDays) napos, a szerver már nem fogadja el."
                persist(); index += 1; continue
            }
            if let next = item.nextAttempt, next > now { return }

            let result = await sender.send(item)
            // The queue may have changed while the request was out (an enqueue, a replacement).
            guard let i = items.firstIndex(where: { $0.id == item.id }) else { index = 0; continue }
            switch result {
            case .sent(let body):
                // A newer version enqueued meanwhile stays and goes next.
                if items[i] == item { items.remove(at: i) }
                persist()
                await onSent?(item, body)
                index = items.firstIndex(where: { $0.id == item.id }) ?? i
            case .retryLater:
                items[i].attempts += 1
                items[i].nextAttempt = clock().addingTimeInterval(Self.backoff(attempts: items[i].attempts))
                persist()
                return
            case .failed(let reason):
                items[i].failure = reason
                persist()
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

    private func persist() {
        guard let data = try? JSONEncoder().encode(items) else { return }
        try? data.write(to: file, options: .atomic)
    }
}
