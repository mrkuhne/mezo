import Foundation
import Observation
import OSLog
import BoopAPI

/// One fact of the "Boop látja · most" strip, exactly as the server built it from the same day block the model sees.
public struct DayChip: Equatable, Sendable, Identifiable {
    public let key: String
    public let label: String
    public let value: String
    public let sub: String?
    public var id: String { key }
    public init(key: String, label: String, value: String, sub: String?) {
        self.key = key; self.label = label; self.value = value; self.sub = sub
    }
}

/// One bubble of today's conversation.
public struct ChatLine: Equatable, Sendable, Identifiable {
    public enum Who: Equatable, Sendable { case owner, boop }
    public enum State: Equatable, Sendable {
        case shown
        /// Out to Boop now, the answer on its way (online; a quiet wait, not the offline line).
        case sending
        /// Waits on the phone for the net (an outbox `chatQuestion`).
        case queued
        /// The server refused it; *Újra* asks again.
        case failed
    }
    public let id: UUID
    public let who: Who
    public let text: String
    public var state: State
    public init(id: UUID, who: Who, text: String, state: State = .shown) {
        self.id = id; self.who = who; self.text = text; self.state = state
    }
}

/// The Boop tab's chat (B3, spec §5.5, §7.6): today's `boop` conversation — found by when it started within the phone's
/// day (or its date title) or created on the first question, its id kept per date on the phone, so a new day starts a new one — the day-context strip and the
/// ready questions, and the non-stream answer.
///
/// Online, a question goes straight out and Boop's answer follows; without the net (or when the send loses the net, or
/// an earlier question of the day still waits) it becomes an outbox `chatQuestion` with the bubble's own id, so it is
/// queued exactly once. When the outbox delivers it, `delivered` keeps the conversation id, hands it to the day's other
/// waiting questions (one conversation per day, never one per question) and fetches the turns.
@MainActor @Observable
public final class ChatStore {
    /// The day shown (`yyyy-MM-dd`, device zone).
    public private(set) var day: String
    public private(set) var chips: [DayChip] = []
    public private(set) var questions: [String] = []
    public private(set) var lines: [ChatLine] = []
    /// A question is out and Boop's answer is on its way.
    public private(set) var answering = false
    /// An ask is being handled: a second one is not taken (the composer keeps its text) until it is done.
    public private(set) var busy = false
    /// A question waits on the phone for the net ("Nincs net · a kérdésed elküldöm, amint lesz").
    public var hasQueued: Bool { lines.contains { $0.state == .queued } }

    @ObservationIgnored private let client: Client
    @ObservationIgnored private let sender: OutboxSender
    @ObservationIgnored private let outbox: Outbox
    @ObservationIgnored private let file: URL
    @ObservationIgnored private let clock: @Sendable () -> Date
    @ObservationIgnored private let calendar: Calendar
    @ObservationIgnored private var conversations: [String: UUID]
    @ObservationIgnored private let log = Logger(subsystem: "io.mrkuhne.boop", category: "chat")

    /// `sender` sends a question directly (the outbox's own sender in the app); `directory` keeps the day → conversation
    /// file (the user's own folder).
    public init(client: Client, sender: OutboxSender, outbox: Outbox, directory: URL,
                clock: @escaping @Sendable () -> Date = { Date() }, calendar: Calendar = .current) {
        self.client = client; self.sender = sender; self.outbox = outbox; self.clock = clock
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        self.calendar = greg
        file = directory.appendingPathComponent("chat-conversations.json")
        conversations = Self.load(file)
        day = Self.dayString(clock(), greg)
    }

    /// Today's conversation on `date`, if one is known.
    public func conversationId(on date: String) -> UUID? { conversations[date] }

    // MARK: - Reading

    /// Starts a new day when the date turned, then fetches the strip, the ready questions and today's turns, and adds the
    /// questions still waiting on the phone. Offline: what is on screen stays.
    public func refresh() async {
        let today = Self.dayString(clock(), calendar)
        if today != day { day = today; lines = []; chips = []; questions = [] }
        await refreshContext()
        if conversations[today] == nil, let found = await findConversation(today) { keep(found, for: today) }
        if let id = conversations[today], let turns = await fetchTurns(id) { merge(turns) }
        await addWaiting()
    }

    /// The server's turns, then what is still on its way from the phone (sending, queued, refused) — a refresh during
    /// an ask never drops the question.
    private func merge(_ turns: [ChatLine], dropping delivered: UUID? = nil) {
        let ids = Set(turns.map(\.id))
        lines = turns + lines.filter { $0.state != .shown && $0.id != delivered && !ids.contains($0.id) }
    }

    private func refreshContext() async {
        do {
            if case .ok(let ok) = try await client.getDayContext() {
                let body = try ok.body.json
                chips = body.chips.map { DayChip(key: $0.key, label: $0.label, value: $0.value, sub: $0.sub) }
                questions = Array(body.questions.prefix(3))
            }
        } catch {
            log.info("day context not fetched: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Today's Boop conversation on the server. The server titles one with the OWNER's date ("2026. november 12.") and
    /// never renames it, while the phone's day is its own zone's — east of the owner the two differ in the morning. So
    /// the match is a Boop-titled conversation (any date title) started within the phone's day, else one carrying the
    /// phone day's own title; the newest wins, so a found one is reused and never made twice.
    private func findConversation(_ date: String) async -> UUID? {
        guard case .ok(let ok)? = try? await client.listConversations(), let list = try? ok.body.json else { return nil }
        let title = Self.title(of: date, calendar)
        let day = Self.bounds(of: date, calendar)
        let candidates = list.filter { c in
            if c.title == title { return true }
            guard let t = c.title, Self.isBoopTitle(t, calendar), let day else { return false }
            return day.contains(c.startedAt)
        }
        return candidates.max { $0.startedAt < $1.startedAt }.flatMap { UUID(uuidString: $0.id) }
    }

    /// The phone's day `date` as an instant range.
    private static func bounds(of date: String, _ calendar: Calendar) -> Range<Date>? {
        let p = date.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let start = calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2])),
              let end = calendar.date(byAdding: .day, value: 1, to: start) else { return nil }
        return start..<end
    }

    /// A title the server gives a Boop conversation ("2026. november 12."), whatever the day.
    static func isBoopTitle(_ title: String, _ calendar: Calendar) -> Bool {
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.locale = Locale(identifier: "hu")
        f.dateFormat = "y. MMMM d."
        return f.date(from: title) != nil
    }

    private func fetchTurns(_ id: UUID) async -> [ChatLine]? {
        guard case .ok(let ok)? = try? await client.listMessages(path: .init(conversationId: id.uuidString.lowercased())),
              let messages = try? ok.body.json else { return nil }
        return messages.map {
            ChatLine(id: UUID(uuidString: $0.id) ?? UUID(), who: $0.role == "user" ? .owner : .boop, text: $0.content)
        }
    }

    /// The day's questions still in the outbox, after the server's turns, in their order.
    private func addWaiting() async {
        let pending = await outbox.pending, failed = await outbox.failed
        let refused = Set(failed.map(\.id))
        let all = (pending + failed).filter { $0.kind == .chatQuestion && $0.date == day }
        for item in all where !lines.contains(where: { $0.id == item.id }) {
            guard let p = RitmusPayload.decode(ChatQuestionPayload.self, from: item.payload) else { continue }
            lines.append(ChatLine(id: item.id, who: .owner, text: p.text, state: refused.contains(item.id) ? .failed : .queued))
        }
    }

    // MARK: - Asking

    /// Asks Boop: the owner's bubble shows at once; online the answer follows, otherwise the question waits in the outbox.
    /// False when the question was not taken (empty, or another ask is still being handled) — the caller keeps the text.
    @discardableResult
    public func ask(_ raw: String, online: Bool) async -> Bool {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        // Taken synchronously, before the first await: two quick asks never both create today's conversation.
        guard !text.isEmpty, !busy else { return false }
        busy = true
        defer { busy = false }
        let today = Self.dayString(clock(), calendar)
        if today != day { day = today; lines = []; chips = []; questions = [] }
        let id = UUID()
        lines.append(ChatLine(id: id, who: .owner, text: text, state: online ? .sending : .queued))
        answering = online   // the waiting look shows at once; a question that queues turns it off
        await send(id: id, text: text, date: today, online: online, attempts: 0)
        return true
    }

    /// *Újra* on a refused question: the outbox's own item goes again; one refused online is asked again as is.
    public func retry(_ id: UUID, online: Bool) async {
        guard !busy, let i = lines.firstIndex(where: { $0.id == id && $0.state == .failed }) else { return }
        busy = true
        defer { busy = false }
        if await outbox.failed.contains(where: { $0.id == id }) {
            mark(id, online ? .sending : .queued)
            await outbox.retry(id)
            if await outbox.pending.contains(where: { $0.id == id }) { mark(id, .queued) }
            else if await outbox.failed.contains(where: { $0.id == id }) { mark(id, .failed) }
            return
        }
        // It may have been stored before it was refused: the resend reads the turns first (attempts > 0).
        await send(id: id, text: lines[i].text, date: day, online: online, attempts: 1)
    }

    private func send(id: UUID, text: String, date: String, online: Bool, attempts: Int) async {
        // An earlier question of the day still waiting keeps its place: this one queues behind it.
        let behind = await outbox.pending.contains { $0.kind == .chatQuestion && $0.date == date }
        guard online, !behind else {
            answering = false
            await enqueue(id: id, text: text, date: date, conversation: conversations[date], attempts: attempts)
            if online { Task { await outbox.flush(ignoringBackoff: true) } }
            return
        }
        mark(id, .sending)
        answering = true
        defer { answering = false }
        var conversation = conversations[date]
        if conversation == nil, let made = await createConversation() {
            keep(made, for: date)
            conversation = made
        }
        var item = OutboxItem(id: id, kind: .chatQuestion, date: date, capturedAt: clock(),
                              payload: RitmusPayload.encode(ChatQuestionPayload(conversationId: conversation, text: text)),
                              attempts: attempts)
        switch await sender.send(item) {
        case .sent(let body):
            mark(id, .shown)
            if let reply = body.flatMap({ RitmusPayload.decode(ChatReply.self, from: $0) }) {
                keep(reply.conversationId, for: date)
                if date == day, let i = lines.firstIndex(where: { $0.id == id }) {
                    lines.insert(ChatLine(id: UUID(), who: .boop, text: reply.content), at: i + 1)
                }
            }
        case .retryLater, .offline:
            // The answer may never come back on this connection; the same item (same id) waits for the net instead, marked
            // as tried, so its resend first checks whether the question arrived.
            item.attempts = max(item.attempts, 1)
            do { try await outbox.enqueue(item) } catch { log.error("chat question not kept on disk") }
            mark(id, .queued)
        case .failed:
            mark(id, .failed)
        }
    }

    private func enqueue(id: UUID, text: String, date: String, conversation: UUID?, attempts: Int) async {
        let item = OutboxItem(id: id, kind: .chatQuestion, date: date, capturedAt: clock(),
                              payload: RitmusPayload.encode(ChatQuestionPayload(conversationId: conversation, text: text)),
                              attempts: attempts)
        do { try await outbox.enqueue(item) } catch { log.error("chat question not kept on disk") }
        mark(id, .queued)
    }

    private func createConversation() async -> UUID? {
        guard case .created(let ok)? = try? await client.createConversation(body: .json(.init(channel: .boop))),
              let made = try? ok.body.json else { return nil }
        return UUID(uuidString: made.id)
    }

    // MARK: - Delivery

    /// The outbox delivered a question: keep the day's conversation, give it to the day's other waiting questions (so they
    /// do not each create one), then show the turns as the server has them. A delivery without a readable answer still
    /// shows the question as sent and fetches the turns.
    public func delivered(_ item: OutboxItem, body: Data?) async {
        guard item.kind == .chatQuestion else { return }
        let reply = body.flatMap { RitmusPayload.decode(ChatReply.self, from: $0) }
        let asked = RitmusPayload.decode(ChatQuestionPayload.self, from: item.payload)
        if let reply {
            keep(reply.conversationId, for: item.date)
            for other in await outbox.pending where other.kind == .chatQuestion && other.date == item.date && other.id != item.id {
                guard var p = RitmusPayload.decode(ChatQuestionPayload.self, from: other.payload), p.conversationId == nil else { continue }
                p.conversationId = reply.conversationId
                var updated = other
                updated.payload = RitmusPayload.encode(p)
                try? await outbox.enqueue(updated)
            }
        }
        guard item.date == day else { return }
        let conversation = reply?.conversationId ?? asked?.conversationId ?? conversations[item.date]
        if let conversation, let turns = await fetchTurns(conversation) {
            merge(turns, dropping: item.id)
        } else {
            mark(item.id, .shown)
            if let reply, !reply.content.isEmpty, let i = lines.firstIndex(where: { $0.id == item.id }) {
                lines.insert(ChatLine(id: UUID(), who: .boop, text: reply.content), at: i + 1)
            }
        }
    }

    // MARK: - Helpers

    private func mark(_ id: UUID, _ state: ChatLine.State) {
        if let i = lines.firstIndex(where: { $0.id == id }) { lines[i].state = state }
    }

    private func keep(_ id: UUID, for date: String) {
        guard conversations[date] != id else { return }
        conversations[date] = id
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try RitmusFiles.write(try JSONEncoder().encode(conversations.mapValues(\.uuidString)), to: file)
        } catch {
            log.error("chat conversation id not kept: \(error.localizedDescription, privacy: .public)")
        }
    }

    private static func load(_ file: URL) -> [String: UUID] {
        guard let data = try? Data(contentsOf: file),
              let raw = try? JSONDecoder().decode([String: String].self, from: data) else { return [:] }
        return raw.compactMapValues(UUID.init(uuidString:))
    }

    static func dayString(_ date: Date, _ calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// "2026. november 12." — the server's title of that day's Boop conversation.
    static func title(of date: String, _ calendar: Calendar) -> String {
        let p = date.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let d = calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) else { return date }
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.locale = Locale(identifier: "hu")
        f.dateFormat = "y. MMMM d."
        return f.string(from: d)
    }
}
