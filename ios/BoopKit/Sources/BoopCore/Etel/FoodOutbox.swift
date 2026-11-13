import Foundation
import OSLog

/// Computes a meal draft — `FoodClient` in the app, a fake in tests. It can only draft: nothing here saves a meal.
public protocol MealDrafting: Sendable {
    func draft(date: Date, text: String?, photo: Data?, barcode: String?) async throws -> MealDraft
}

extension FoodClient: MealDrafting {}

/// Puts a photo on a saved meal — `FoodClient` in the app, a fake in tests.
public protocol PhotoAttaching: Sendable {
    func attachPhoto(_ data: Data, mealId: UUID) async throws
}

extension FoodClient: PhotoAttaching {}

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
        // Already computed (a crash between the ready write and the queue removal): never buy a second draft or
        // overwrite a card the owner may be reviewing.
        if FileManager.default.fileExists(atPath: FoodOutbox.readyURL(item.id, in: directory).path) { return .sent(nil) }
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
    /// A saved meal whose photo has not gone up yet.
    struct PhotoFile: Codable { var mealId: UUID; var capturedAt: Date; var photoRef: UUID; var text: String? }
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
    static func photoMarkerURL(_ id: UUID, in dir: URL) -> URL { dir.appendingPathComponent("photo-\(id.uuidString).json") }

    // MARK: Photos

    /// Shrinks the picture to a long edge of 1600 px, stores it as JPEG beside the queue and returns its id.
    /// `rescale: false` for bytes already shrunk (no second lossy pass).
    public func storePhoto(_ data: Data, rescale: Bool = true) throws -> UUID {
        guard let jpeg = rescale ? MealPhoto.jpeg(from: data) : data else { throw FoodOutboxError.unreadablePhoto }
        let ref = UUID()
        try RitmusFiles.write(jpeg, to: Self.photoURL(ref, in: directory))
        return ref
    }

    /// The stored photo's bytes; nil when there is none (any more).
    public func photoData(_ ref: UUID) -> Data? { try? Data(contentsOf: Self.photoURL(ref, in: directory)) }

    /// Removes a stored photo (a capture that could not be kept as a whole).
    public func deletePhoto(_ ref: UUID) { try? FileManager.default.removeItem(at: Self.photoURL(ref, in: directory)) }

    // MARK: Queue

    /// Queues a capture at the instant the owner made it. The returned id is the outbox item's id.
    @discardableResult
    public func enqueueMeal(draft: MealCapture, photoRef: UUID?, capturedAt: Date) async throws -> UUID {
        var capture = draft
        capture.photoRef = photoRef
        let c = calendar.dateComponents([.year, .month, .day], from: capturedAt)
        let day = String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
        let item = OutboxItem(kind: .mealDraft, date: day, capturedAt: capturedAt, payload: try JSONEncoder().encode(capture))
        try await outbox.enqueue(item, rollbackOnFailure: true)
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
        for (id, p) in photoFiles() {
            cards[id] = PendingDraft(id: id, capturedAt: p.capturedAt, date: dayString(p.capturedAt), text: p.text, barcode: nil,
                                     photoRef: p.photoRef, state: .photoWaiting(mealId: p.mealId))
        }
        return cards.values.sorted { ($0.capturedAt, $0.id.uuidString) < ($1.capturedAt, $1.id.uuidString) }
    }

    private func dayString(_ d: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    private func photoFiles() -> [(UUID, MealDraftSender.PhotoFile)] {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files.compactMap { url in
            guard url.lastPathComponent.hasPrefix("photo-"), url.pathExtension == "json",
                  let id = UUID(uuidString: String(url.deletingPathExtension().lastPathComponent.dropFirst("photo-".count))),
                  let data = try? Data(contentsOf: url),
                  let p = try? JSONDecoder().decode(MealDraftSender.PhotoFile.self, from: data) else { return nil }
            return (id, p)
        }
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
        if ref == nil { ref = photoFiles().first { $0.0 == id }?.1.photoRef }
        if let ref { deletePhoto(ref) }
        await outbox.remove(id)
        try? FileManager.default.removeItem(at: Self.readyURL(id, in: directory))
        try? FileManager.default.removeItem(at: Self.photoMarkerURL(id, in: directory))
    }

    // MARK: Parking a draft the owner is looking at

    /// Writes an online draft (or a reviewed card) down as a ready card BEFORE the owner's save is tried, so a swipe
    /// that closes the sheet, a failed save or the app being killed cannot lose it. The same id parks again with the
    /// edited lines. The photo is referenced by id (`storePhoto`), never inlined.
    @discardableResult
    public func park(_ draft: MealDraft, id: UUID?, capturedAt: Date, text: String?, photoRef: UUID?) throws -> UUID {
        let id = id ?? UUID()
        var d = draft; d.photo = nil
        let file = MealDraftSender.ReadyFile(draft: d, capturedAt: capturedAt, photoRef: photoRef, text: text)
        try RitmusFiles.write(try JSONEncoder().encode(file), to: Self.readyURL(id, in: directory))
        return id
    }

    /// The meal is saved. When its photo is on the server everything goes; when it is not (the upload is best-effort
    /// inside `FoodClient.save`), the photo file — possibly the only copy — stays, as a card the owner can retry.
    public func finishSave(_ id: UUID, meal: Meal) async {
        var ref: UUID?
        var text: String?
        if let item = await outbox.queued(id), let c = try? JSONDecoder().decode(MealCapture.self, from: item.payload) { ref = c.photoRef; text = c.text }
        if let r = readyFiles().first(where: { $0.0 == id })?.1 { ref = ref ?? r.photoRef; text = text ?? r.text ?? r.draft.title }
        guard let ref, !meal.hasPhoto, photoData(ref) != nil else { return await discard(id) }
        let marker = MealDraftSender.PhotoFile(mealId: meal.id, capturedAt: meal.loggedAt, photoRef: ref, text: text)
        guard (try? RitmusFiles.write(try JSONEncoder().encode(marker), to: Self.photoMarkerURL(id, in: directory))) != nil else { return }
        await outbox.remove(id)
        try? FileManager.default.removeItem(at: Self.readyURL(id, in: directory))
    }

    /// *Újra* on a photo that did not go up: true when it did (the card and the file are then gone).
    public func retryPhoto(_ id: UUID, attacher: any PhotoAttaching) async -> Bool {
        guard let p = photoFiles().first(where: { $0.0 == id })?.1, let data = photoData(p.photoRef) else { return false }
        do { try await attacher.attachPhoto(data, mealId: p.mealId) } catch { return false }
        await discard(id)
        return true
    }

    // MARK: Housekeeping

    /// Removes photo files nothing refers to (a capture that never made it into the queue). A file younger than
    /// `grace` is left alone: it may be between `storePhoto` and `enqueueMeal` right now.
    public func sweepOrphans(grace: TimeInterval = 3600) async {
        var used = Set<UUID>()
        for item in await outbox.queue where item.kind == .mealDraft {
            if let r = (try? JSONDecoder().decode(MealCapture.self, from: item.payload))?.photoRef { used.insert(r) }
        }
        for (_, r) in readyFiles() { if let ref = r.photoRef { used.insert(ref) } }
        for (_, p) in photoFiles() { used.insert(p.photoRef) }
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
        for url in files where url.lastPathComponent.hasPrefix("meal-") && url.pathExtension == "jpg" {
            guard let ref = UUID(uuidString: String(url.deletingPathExtension().lastPathComponent.dropFirst("meal-".count))),
                  !used.contains(ref),
                  let modified = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate,
                  Date().timeIntervalSince(modified) > grace else { continue }
            try? FileManager.default.removeItem(at: url)
        }
    }
}
