import Foundation
import Network
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
    /// The voice recorder (`VoiceJournal` in live builds); nil = the mic is dimmed and typing works.
    @ObservationIgnored var recorder: (any VoiceNoteRecorder)?
    @ObservationIgnored private let lineSource: @Sendable (_ date: String, _ slot: String) async throws -> String
    @ObservationIgnored private let snapshotSource: @Sendable (Date) async -> CheckInSnapshotValue
    @ObservationIgnored private let planSource: (@Sendable (String) async throws -> [String: CheckInPlanLite])?
    @ObservationIgnored private let daySource: (@Sendable (String) async throws -> ServerDay)?
    @ObservationIgnored private let goalsSource: (@Sendable ([String]) async throws -> [String: [String]])?
    @ObservationIgnored private let eventsSource: (@Sendable (Date) async -> [CalendarEventLite])?
    @ObservationIgnored private let closeLineSource: (@Sendable (String) async throws -> String)?
    /// The server's transcription, asked for directly (the goal field); nil = not available.
    @ObservationIgnored private let transcribeSource: (@Sendable (URL) async throws -> String)?
    /// Where recordings wait (the outbox folder).
    @ObservationIgnored let outboxDirectory: URL
    @ObservationIgnored private var pathMonitor: NWPathMonitor?
    /// The phone has a network path (live builds watch it; tests set it).
    var online = true
    /// Where the past days' goal texts are kept between launches (next to the ledger folder).
    @ObservationIgnored private let goalHistoryFile: URL
    /// The user's own folder (the ledger's parent): the chat keeps its day → conversation file here.
    @ObservationIgnored private let userDirectory: URL
    /// Lets the outbox's delivery listener reach the chat attached after it.
    @ObservationIgnored private let chatRef: ChatRef
    /// The Boop tab's chat (B3 Task 12); nil until `attachChat` (tests without a server leave it out).
    private(set) var chat: ChatStore?

    /// The goals typed on the last 30 days (server days fetched once, plus the phone's own), for the overdue chips.
    private(set) var pastGoals: [PastGoal] = []
    /// Today's events from the phone's calendar (read only; titles never leave the phone here).
    private(set) var todayEvents: [CalendarEventLite] = []
    /// Boop's sentence about a closed day, by date (fetched once the close is on the server).
    private(set) var closeLines: [String: String] = [:]

    /// `line`: Boop's sentence after a check-in (throws `RitmusFetchError`); `snapshot`: the watch at a moment;
    /// `plans`: the day's questions of the day (nil = never fetched, e.g. in tests); `day`: the server's day to merge;
    /// `goals`: the focus texts of past days; `events`: the phone calendar's events of a day; `closeLine`: Boop's
    /// sentence about a closed day.
    init(ledgerDirectory: URL, outboxDirectory: URL, sender: OutboxSender,
         line: @escaping @Sendable (String, String) async throws -> String,
         snapshot: @escaping @Sendable (Date) async -> CheckInSnapshotValue,
         plans: (@Sendable (String) async throws -> [String: CheckInPlanLite])?,
         day: (@Sendable (String) async throws -> ServerDay)? = nil,
         goals: (@Sendable ([String]) async throws -> [String: [String]])? = nil,
         events: (@Sendable (Date) async -> [CalendarEventLite])? = nil,
         closeLine: (@Sendable (String) async throws -> String)? = nil,
         transcribe: (@Sendable (URL) async throws -> String)? = nil,
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
        daySource = day; goalsSource = goals; eventsSource = events; closeLineSource = closeLine
        transcribeSource = transcribe
        self.outboxDirectory = outboxDirectory
        userDirectory = ledgerDirectory.deletingLastPathComponent()
        goalHistoryFile = userDirectory.appendingPathComponent("goal-history.json")
        // A delivery clears the pending flag only when no newer version of the same id (a note sent after an
        // in-flight check-in) is still queued — that one clears it when it arrives.
        let queue = OutboxRef()
        let chatRef = ChatRef()
        self.chatRef = chatRef
        outbox = Outbox(directory: outboxDirectory, sender: sender, clock: clock, calendar: greg) { item, body in
            // A recording's transcript lands on the day (its journal line or its check-in's note).
            await ledger.applyDelivered(item, body: body)
            // A question asked without the net: the chat keeps the conversation and fetches Boop's answer.
            if item.kind == .chatQuestion { await chatRef.store?.delivered(item, body: body) }
            if await queue.outbox?.isQueued(item.id) == true { return }
            await ledger.markSent(item.id, date: item.date)
        }
        queue.outbox = outbox
    }

    /// Lets the outbox's delivery listener ask the outbox itself (set once, right after creation).
    private final class OutboxRef: @unchecked Sendable { var outbox: Outbox? }
    private final class ChatRef: @unchecked Sendable { weak var store: ChatStore? }

    /// Gives the Boop tab its chat: reads go through `client`, a question goes out through `sender` (the outbox's own
    /// sender), and an offline one waits in this environment's outbox.
    func attachChat(client: Client, sender: OutboxSender) {
        let store = ChatStore(client: client, sender: sender, outbox: outbox, directory: userDirectory, clock: clock,
                              calendar: calendar)
        chat = store
        chatRef.store = store
    }

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
        let calendarReader = CalendarKitReader()
        let env = RitmusEnvironment(
            ledgerDirectory: dirs.ledger, outboxDirectory: dirs.outbox, sender: ritmus,
            line: { date, slot in try await ritmus.checkInLine(date, slot: slot) },
            snapshot: { now in await snapshots.snapshot(at: now) },
            plans: { date in try await ritmus.fetchPlans(date) },
            day: { date in try await ritmus.fetchDay(date) },
            goals: { dates in try await ritmus.fetchGoals(dates) },
            events: { day in await todaysEvents(calendarReader, day: day) },
            closeLine: { date in try await ritmus.line(date) },
            transcribe: { file in try await ritmus.transcribe(file) })
        env.attachChat(client: client, sender: ritmus)
        env.watchNetwork()
        // Records into the outbox folder, where the `voice` sender looks for the files.
        env.recorder = VoiceJournal(directory: dirs.outbox)
        return env
    }

    /// The phone calendar's timed and all-day events of `day`, only when access was already given (never asks here).
    private static func todaysEvents(_ reader: CalendarReader, day: Date) async -> [CalendarEventLite] {
        guard await reader.access() == .granted else { return [] }
        let start = Calendar.current.startOfDay(for: day)
        let end = Calendar.current.date(byAdding: .day, value: 1, to: start) ?? start
        return ((try? await reader.items(from: start, to: end)) ?? []).map(CalendarEventLite.init)
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

    // MARK: - The goal of the day (spec §7.5)

    /// The goal on screen for a day (a removal on its way hides it).
    func goal(on date: String) -> LedgerGoal? { ledger.ledger(for: date).currentGoal }

    /// Sets the day's goal: the goal shown so far is removed first (one goal per day; "csere" = remove + add), then the
    /// new one is written to the day (pending) and queued with its own client ref. Throws when the phone could not keep it.
    func setGoal(_ raw: String, date: String) async throws {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        if goal(on: date) != nil { try await queueGoalRemoval(date: date) }
        let now = clock()
        let new = LedgerGoal(id: UUID(), text: text, setAt: now, pending: true)
        try ledger.setGoal(new, date: date)
        try await outbox.enqueue(OutboxItem(id: new.id, kind: .goal, date: date, capturedAt: now,
                                            payload: RitmusPayload.encode(GoalPayload(text: text))))
        sendSoon()
    }

    /// "csere": the goal shown is removed (the field and the chips come back for the new one).
    func removeGoal(date: String) async throws {
        guard goal(on: date) != nil else { return }
        try await queueGoalRemoval(date: date)
        sendSoon()
    }

    /// The day keeps a tombstone (pending, `removed`) under the removal's own id, so the server's old goal stays hidden
    /// until the removal arrives; the removal goes by the focus id when known, else by the goal's client ref.
    private func queueGoalRemoval(date: String) async throws {
        guard let old = goal(on: date) else { return }
        let now = clock()
        let removal = LedgerGoal(id: UUID(), text: old.text, setAt: now, pending: true, removed: true)
        let payload = old.focusId.map(GoalRemovePayload.init(focusId:)) ?? GoalRemovePayload(goalRef: old.id, text: old.text)
        try ledger.setGoal(removal, date: date)
        try await outbox.enqueue(OutboxItem(id: removal.id, kind: .goalRemove, date: date, capturedAt: now,
                                            payload: RitmusPayload.encode(payload)))
    }

    /// Boop's chips for the day's goal: the calendar's biggest event, today's session, an overdue repeated goal.
    func goalSuggestions(brief: Brief, date: String) -> [GoalSuggestion] {
        GoalSuggestions.suggest(brief: brief, calendar: todayEvents, pastGoals: pastGoals.map { ($0.date, $0.text) },
                                today: date, in: calendar)
    }

    /// Fetches the 30 days before `today` that the cache does not have yet (past days, fetched once), then lists each
    /// day's goal — the day's FIRST focus, as Boop shows it (the web's other foci are not Boop's goal); the phone's own
    /// goal for a day wins over the fetched one.
    func refreshPastGoals(today: String) async {
        let p = today.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let anchor = calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) else { return }
        let days = (1...30).compactMap { calendar.date(byAdding: .day, value: -$0, to: anchor) }.map(day(of:))
        var history = GoalHistory.load(goalHistoryFile)
        let missing = days.filter { history.days[$0] == nil }
        if let goalsSource, !missing.isEmpty, let fetched = try? await goalsSource(missing) {
            history.days.merge(fetched) { _, fresh in fresh }
            history.days = history.days.filter { days.contains($0.key) }
            history.save(goalHistoryFile)
        }
        pastGoals = days.compactMap { d in
            (ledger.ledger(for: d).currentGoal?.text ?? history.days[d]?.first).map { PastGoal(date: d, text: $0) }
        }
    }

    /// Reads today's events from the phone's calendar.
    func refreshCalendar() async {
        guard let eventsSource else { return }
        todayEvents = await eventsSource(clock())
    }

    /// Merges the server's version of the day (anything still pending on the phone wins); quietly nothing offline.
    func refreshDay(_ date: String) async {
        guard let daySource else { return }
        let fetchedAt = clock()
        guard let server = try? await daySource(date) else { return }
        ledger.merge(server: server, fetchedAt: fetchedAt)
    }

    /// Follows the phone's network path (the goal field's mic needs the net when the phone cannot transcribe itself).
    private func watchNetwork() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            let up = path.status == .satisfied
            Task { @MainActor in self?.online = up }
        }
        monitor.start(queue: DispatchQueue(label: "boop.ritmus.path"))
        pathMonitor = monitor
    }

    // MARK: - The goal field's voice

    /// What a spoken goal became: text for the field, or a short line for the toast.
    enum HeardGoal: Equatable {
        case text(String)
        case problem(String)
    }

    static let goalOfflineHint = "Net nélkül most csak beírni tudod."
    static let speechDenied = "A beszédfelismerés nincs engedélyezve — a Beállításokban kapcsolhatod be, vagy írd be."
    static let notUnderstood = "Nem értettem — írd be inkább."

    /// The goal field's mic works when the phone writes Hungarian itself, or when it is online and can ask the server.
    func goalMicAvailable(_ recorder: (any VoiceNoteRecorder)?) -> Bool {
        guard let recorder else { return false }
        return recorder.transcribesOnDevice || (online && transcribeSource != nil)
    }

    /// Turns a goal recording into text for the field: the phone's transcript, else (online) the server's, asked for
    /// directly — nothing is queued, and the recording is deleted either way.
    func heardGoal(_ capture: VoiceCapture, speechDenied: Bool) async -> HeardGoal {
        switch capture {
        case .transcript(let text): return .text(text)
        case .recording(let name):
            let file = outboxDirectory.appendingPathComponent(name)
            defer { try? FileManager.default.removeItem(at: file) }
            guard online, let transcribeSource else { return .problem(speechDenied ? Self.speechDenied : Self.goalOfflineHint) }
            do {
                let text = try await transcribeSource(file).trimmingCharacters(in: .whitespacesAndNewlines)
                return text.isEmpty ? .problem(Self.notUnderstood) : .text(text)
            } catch RitmusFetchError.offline {
                return .problem(Self.goalOfflineHint)
            } catch {
                return .problem(Self.notUnderstood)
            }
        }
    }

    /// A close written again (*Módosítom*): the old sentence no longer describes it.
    func forgetCloseLine(_ date: String) { closeLines[date] = nil }

    /// Boop's sentence about the closed day, once the close is on the server (offline or 503: later).
    func refreshCloseLine(_ date: String) async {
        guard let closeLineSource, closeLines[date] == nil, let close = ledger.ledger(for: date).close, !close.pending,
              let line = try? await closeLineSource(date) else { return }
        closeLines[date] = line
    }

    /// Sends what is queued without holding the caller.
    private func sendSoon() {
        let outbox = outbox
        Task { await outbox.flush(ignoringBackoff: true) }
    }
}

/// Records a spoken sentence (B3 Task 10): one tap starts, the next stops. `VoiceJournal` is the real one.
@MainActor
protocol VoiceNoteRecorder: AnyObject {
    /// A transcript can come back right away (on-device Hungarian recognition); otherwise a stop hands back the kept
    /// recording for the upload.
    var transcribesOnDevice: Bool { get }
    /// The owner said no to speech recognition at the last stop.
    var speechDenied: Bool { get }
    /// Throws `VoiceJournalError.microphoneDenied` when the microphone is not allowed (other errors: it could not start).
    func start() async throws
    /// The transcript, or the kept recording (nil: nothing was recorded).
    func stop() async -> VoiceCapture?
    /// Throws away a kept recording.
    func discard(_ capture: VoiceCapture)
}

extension VoiceJournal: VoiceNoteRecorder {}

/// The mic's error lines.
enum MicCopy {
    static let denied = "A mikrofon nincs engedélyezve — a Beállításokban kapcsolhatod be, vagy írd be."
    static let failed = "Most nem sikerült elindítani a felvételt."
    static func line(for error: Error) -> String { (error as? VoiceJournalError) == .microphoneDenied ? denied : failed }
}

/// One goal typed on a past day.
struct PastGoal: Equatable, Sendable {
    let date: String
    let text: String
}

/// The past days' focus texts as fetched from the server (date → texts), kept in one small JSON file.
struct GoalHistory: Codable, Equatable {
    var days: [String: [String]] = [:]

    static func load(_ file: URL) -> GoalHistory {
        guard let data = try? Data(contentsOf: file), let h = try? JSONDecoder().decode(GoalHistory.self, from: data) else { return GoalHistory() }
        return h
    }

    func save(_ file: URL) {
        guard let data = try? JSONEncoder().encode(self) else { return }
        try? data.write(to: file, options: .atomic)
    }
}
