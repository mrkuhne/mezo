import Foundation
import OSLog

/// Computes a meal draft — `FoodClient` in the app, a fake in tests. It can only draft: nothing here saves a meal.
public protocol MealDrafting: Sendable {
    func draft(date: Date, text: String?, photo: Data?, barcode: String?) async throws -> MealDraft
}

extension FoodClient: MealDrafting {}

/// What `OutboxKind.mealDraft` does when the network is there: reads the photo from beside the queue, asks the model for a
/// draft at the capture's own instant, and parks the result as `ready-<id>.json` for the owner's confirmation. It never
/// saves. The file is written before `.sent` is answered, so a draft the queue forgot is never a draft the owner lost.
public struct MealDraftSender: OutboxSender {
    private let drafter: any MealDrafting
    private let directory: URL
    private static let log = Logger(subsystem: "io.mrkuhne.boop", category: "food-outbox")

    public init(drafter: any MealDrafting, directory: URL) { self.drafter = drafter; self.directory = directory }

    public func send(_ item: OutboxItem) async -> OutboxSendResult {
        guard let capture = try? JSONDecoder().decode(MealCapture.self, from: item.payload) else {
            return .failed("A rögzítés nem olvasható.")
        }
        var photo: Data?
        if let ref = capture.photoRef {
            guard let bytes = try? Data(contentsOf: FoodOutbox.photoURL(ref, in: directory)) else {
                return .failed("A fotó már nincs a telefonon.")
            }
            photo = bytes
        }
        do {
            var draft = try await drafter.draft(date: item.capturedAt, text: capture.text, photo: photo, barcode: capture.barcode)
            draft.photo = nil
            let file = ReadyFile(draft: draft, capturedAt: item.capturedAt, photoRef: capture.photoRef, text: capture.text)
            try RitmusFiles.write(try JSONEncoder().encode(file), to: FoodOutbox.readyURL(item.id, in: directory))
            return .sent(nil)
        } catch let e as FoodFetchError {
            switch e {
            case .offline: return .offline
            case .unauthorized, .unavailable, .server: return .retryLater
            case .rejected, .notFound: return .failed("A szerver nem fogadta el a rögzítést.")
            }
        } catch {
            // The draft could not be written down: not the item's fault, try again.
            Self.log.error("ready draft not stored: \(error.localizedDescription, privacy: .public)")
            return .retryLater
        }
    }

    struct ReadyFile: Codable { var draft: MealDraft; var capturedAt: Date; var photoRef: UUID?; var text: String? }
}

/// The meal capture's offline side (B4, decision 9): the phone keeps the photo and the words in B3's `Outbox` (kind
/// `mealDraft`), Boop computes the draft when the network returns, and the result waits as a confirmation card — a
/// meal is saved only by the owner's tap (`FoodClient.save`), never by this queue.
///
/// Photos live beside the queue as `meal-<id>.jpg` and are referenced by id; ready drafts as `ready-<id>.json`.
public struct FoodOutbox: Sendable {
    private let outbox: Outbox
    private let directory: URL
    private let calendar: Calendar

    /// `directory` is the outbox's own directory (the sender looks for the photos there).
    public init(outbox: Outbox, directory: URL, calendar: Calendar = .current) {
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        self.outbox = outbox; self.directory = directory; self.calendar = greg
    }

    static func photoURL(_ ref: UUID, in dir: URL) -> URL { dir.appendingPathComponent("meal-\(ref.uuidString).jpg") }
    static func readyURL(_ id: UUID, in dir: URL) -> URL { dir.appendingPathComponent("ready-\(id.uuidString).json") }

    // MARK: Photos

    /// Shrinks the picture to a long edge of 1600 px, stores it as JPEG beside the queue and returns its id.
    public func storePhoto(_ data: Data) throws -> UUID {
        guard let jpeg = MealPhoto.jpeg(from: data) else { throw FoodOutboxError.unreadablePhoto }
        let ref = UUID()
        try RitmusFiles.write(jpeg, to: Self.photoURL(ref, in: directory))
        return ref
    }

    /// The stored photo's bytes; nil when there is none (any more).
    public func photoData(_ ref: UUID) -> Data? { try? Data(contentsOf: Self.photoURL(ref, in: directory)) }

    // MARK: Queue

    /// Queues a capture at the instant the owner made it. The returned id is the outbox item's id.
    @discardableResult
    public func enqueueMeal(draft: MealCapture, photoRef: UUID?, capturedAt: Date) async throws -> UUID {
        var capture = draft
        capture.photoRef = photoRef
        let c = calendar.dateComponents([.year, .month, .day], from: capturedAt)
        let day = String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
        let item = OutboxItem(kind: .mealDraft, date: day, capturedAt: capturedAt, payload: try JSONEncoder().encode(capture))
        try await outbox.enqueue(item)
        return item.id
    }

    public func flush() async { await outbox.flush(ignoringBackoff: true) }

    /// Every capture still in the owner's hands, oldest first: waiting, failed with its values, or ready for a tap.
    public func pendingDrafts() async -> [PendingDraft] {
        var cards: [UUID: PendingDraft] = [:]
        for item in await outbox.queue where item.kind == .mealDraft {
            guard let capture = try? JSONDecoder().decode(MealCapture.self, from: item.payload) else { continue }
            cards[item.id] = PendingDraft(id: item.id, capturedAt: item.capturedAt, date: item.date, text: capture.text,
                                          barcode: capture.barcode, photoRef: capture.photoRef,
                                          state: item.failure.map { .failed($0) } ?? .waiting)
        }
        for (id, ready) in readyFiles() {
            cards[id] = PendingDraft(id: id, capturedAt: ready.capturedAt, date: ready.draft.date, text: ready.text,
                                     barcode: ready.draft.barcode, photoRef: ready.photoRef, state: .ready(ready.draft))
        }
        return cards.values.sorted { ($0.capturedAt, $0.id.uuidString) < ($1.capturedAt, $1.id.uuidString) }
    }

    private func readyFiles() -> [(UUID, MealDraftSender.ReadyFile)] {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files.compactMap { url in
            guard url.lastPathComponent.hasPrefix("ready-"), url.pathExtension == "json",
                  let id = UUID(uuidString: String(url.deletingPathExtension().lastPathComponent.dropFirst("ready-".count))),
                  let data = try? Data(contentsOf: url),
                  let ready = try? JSONDecoder().decode(MealDraftSender.ReadyFile.self, from: data) else { return nil }
            return (id, ready)
        }
    }

    /// *Újra* on a failed capture.
    public func retry(_ id: UUID) async { await outbox.retry(id) }

    /// The owner's decision (saved it, or sent it away): the card, its queue item and its photo all go.
    public func discard(_ id: UUID) async {
        var ref: UUID?
        if let item = await outbox.queued(id) { ref = (try? JSONDecoder().decode(MealCapture.self, from: item.payload))?.photoRef }
        if ref == nil { ref = readyFiles().first { $0.0 == id }?.1.photoRef }
        if let ref { try? FileManager.default.removeItem(at: Self.photoURL(ref, in: directory)) }
        await outbox.remove(id)
        try? FileManager.default.removeItem(at: Self.readyURL(id, in: directory))
    }
}
