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
    /// The check-in / close reminders (local notifications), kept in line with the ledger by the shell.
    @ObservationIgnored let reminders: RitmusReminders
    /// When a flush trigger (foreground, back online, a background wake) last went out; they coalesce within a second.
    @ObservationIgnored private var lastTriggerFlush: Date?
    @ObservationIgnored let clock: @Sendable () -> Date
    /// The voice recorder (`VoiceJournal` in live builds); nil = the mic is dimmed and typing works.
    @ObservationIgnored var recorder: (any VoiceNoteRecorder)?
    @ObservationIgnored private let lineSource: @Sendable (_ date: String, _ slot: String) async throws -> String
    @ObservationIgnored private let snapshotSource: @Sendable (Date) async -> CheckInSnapshotValue
    @ObservationIgnored private let planSource: (@Sendable (String) async throws -> [String: CheckInPlanLite])?
    @ObservationIgnored private let daySource: (@Sendable (String) async throws -> ServerDay)?
    @ObservationIgnored private let naploSource: (@Sendable (_ from: String, _ to: String) async throws -> [ServerDay])?
    @ObservationIgnored private var lastNaploRefresh: Date?
    @ObservationIgnored private let goalsSource: (@Sendable ([String]) async throws -> [String: [String]])?
    @ObservationIgnored private let eventsSource: (@Sendable (Date) async -> [CalendarEventLite])?
    @ObservationIgnored private let closeLineSource: (@Sendable (String) async throws -> String)?
    /// The server's transcription, asked for directly (the goal field, the chat composer); nil = not available.
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
    /// What stopped in the outbox — refused by the server, or out of tries — by item id: shown as a quiet
    /// "nem sikerült elküldeni" row with *Újra* where the item lives, never as "waiting for the net".
    private(set) var refused: [UUID: OutboxItem] = [:]
    /// The sender every write goes through; it sends nothing once the environment is retired (signed out).
    @ObservationIgnored let sender: OutboxSender
    @ObservationIgnored private let retirement: Retirement

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
         naplo: (@Sendable (String, String) async throws -> [ServerDay])? = nil,
         reminderCenter: ReminderCenter = SystemReminderCenter(),
         clock: @escaping @Sendable () -> Date = { Date() }, calendar: Calendar = .current) {
        let ledger = LedgerStore(directory: ledgerDirectory)
        self.ledger = ledger
        // Dates on the wire are Gregorian, in the device zone.
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        greg.locale = Locale(identifier: "en_US_POSIX")
        self.calendar = greg
        self.clock = clock
        reminders = RitmusReminders(center: reminderCenter, calendar: calendar, clock: clock)
        lineSource = line; snapshotSource = snapshot; planSource = plans
        daySource = day; goalsSource = goals; eventsSource = events; closeLineSource = closeLine
        transcribeSource = transcribe; naploSource = naplo
        self.outboxDirectory = outboxDirectory
        userDirectory = ledgerDirectory.deletingLastPathComponent()
        goalHistoryFile = userDirectory.appendingPathComponent("goal-history.json")
        // A delivery clears the pending flag only when no newer version of the same id (a note sent after an
        // in-flight check-in) is still queued — that one clears it when it arrives.
        let queue = OutboxRef()
        let chatRef = ChatRef()
        self.chatRef = chatRef
        let retirement = Retirement()
        self.retirement = retirement
        let gated = RetiringSender(inner: sender, retirement: retirement)
        self.sender = gated
        outbox = Outbox(directory: outboxDirectory, sender: gated, clock: clock, calendar: greg) { item, body in
            // A recording's transcript lands on the day (its journal line or its check-in's note).
            await ledger.applyDelivered(item, body: body)
            // A question asked without the net: the chat keeps the conversation and fetches Boop's answer.
            if item.kind == .chatQuestion { await chatRef.store?.delivered(item, body: body) }
            // The evening's line arrived after its relink went out (a retried recording): link it again.
            if let box = queue.outbox { await Self.relinkIfNeeded(item, ledger: ledger, outbox: box) }
            if await queue.outbox?.isQueued(item.id) == true { return }
            await ledger.markSent(item.id, date: item.date)
        }
        queue.outbox = outbox
        let me = EnvRef()
        me.env = self
        let box = outbox
        Task { await box.observeFailures { failed in await me.env?.useRefused(failed) } }
    }

    /// Lets the outbox's delivery listener ask the outbox itself (set once, right after creation).
    private final class OutboxRef: @unchecked Sendable { var outbox: Outbox? }
    private final class ChatRef: @unchecked Sendable { weak var store: ChatStore? }
    private final class EnvRef: @unchecked Sendable { weak var env: RitmusEnvironment? }

    /// Set once when the user signs out (or another signs in): from then on nothing more goes out with this user's
    /// queue — the session's client already carries someone else's token, or none.
    final class Retirement: @unchecked Sendable {
        private let lock = NSLock()
        private var done = false
        private var pathDown = false
        var retired: Bool { lock.withLock { done } }
        func retire() { lock.withLock { done = true } }
        /// The path monitor says there is no network: nothing is tried (not an attempt) until it comes back.
        var offline: Bool { lock.withLock { pathDown } }
        func set(offline: Bool) { lock.withLock { pathDown = offline } }
    }

    /// The real sender behind a gate: a retired environment, or a phone whose network path is down, answers
    /// `offline` (nothing sent, nothing counted; the items stay — for when the net is back, or that user signs in again).
    private struct RetiringSender: OutboxSender {
        let inner: OutboxSender
        let retirement: Retirement
        func send(_ item: OutboxItem) async -> OutboxSendResult {
            retirement.retired || retirement.offline ? .offline : await inner.send(item)
        }
    }

    /// The user signed out, or another signed in: this environment's queue stops sending (an in-flight request is
    /// the last), the network watch ends, and the reminders it planned stay as they are.
    func retire() {
        retirement.retire()
        pathMonitor?.cancel()
        pathMonitor = nil
    }

    private func useRefused(_ failed: [OutboxItem]) {
        refused = Dictionary(failed.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
    }

    // MARK: - What the server refused (spec §7.1: a quiet "nem sikerült elküldeni" row with Újra)

    /// The outbox item to retry for a check-in that did not get through: the check-in itself (or its typed note,
    /// same id), else a recorded note aimed at its slot. nil = nothing refused.
    func refusal(forCheckIn c: LedgerCheckIn, date: String) -> UUID? {
        if refused[c.id] != nil { return c.id }
        return refused.values.first { item in
            guard item.kind == .voice, item.date == date,
                  case .checkInNote(let p)? = RitmusPayload.decodeVoice(item.payload)?.target else { return false }
            return p.slot == c.slot
        }?.id
    }

    /// Whether a check-in shows the "még a telefonon" pending look (dashed dot, the glyph in its detail).
    /// A refused one shows only its "nem sikerült elküldeni" row instead.
    func showsPending(_ c: LedgerCheckIn, date: String) -> Bool { c.pending && refusal(forCheckIn: c, date: date) == nil }

    /// The goal (or its removal) the server did not take, for the goal row's *Újra*.
    func goalRefusal(on date: String) -> UUID? {
        guard let g = ledger.ledger(for: date).goal, refused[g.id] != nil else { return nil }
        return g.id
    }

    /// Everything of the evening's close that did not get through: the close, its relinks, a typed line (`retry` puts
    /// them in queue order). A recording has its own row (`Quote.transcriptFailed`).
    func closeRefusals(on date: String) -> [UUID] {
        let day = ledger.ledger(for: date)
        return refused.values.filter { item in
            guard item.date == date else { return false }
            switch item.kind {
            case .dayClose: return true
            case .journal: return item.id == day.close?.journalId
            default: return false
            }
        }
        .map(\.id)
    }

    /// *Újra*: the items get a fresh start, in their queue order.
    func retry(_ ids: [UUID]) async {
        let order = await outbox.queue.map(\.id)
        for id in order where ids.contains(id) { await outbox.retry(id) }
        useRefused(await outbox.failed)
    }

    /// The evening's journal line (typed, or a recording's transcript) was just delivered. Its relink normally waits
    /// right behind it; when none is queued any more — the relink went out while the line was failed or on its way, so
    /// the server could not resolve it — a fresh one goes out with the close's current values.
    static func relinkIfNeeded(_ item: OutboxItem, ledger: LedgerStore, outbox: Outbox) async {
        guard item.kind == .journal || item.kind == .voice else { return }
        if item.kind == .voice, RitmusPayload.decodeVoice(item.payload)?.target != .journal { return }
        guard let close = ledger.ledger(for: item.date).close, close.journalId == item.id, let rating = close.dayRating else { return }
        let waiting = await outbox.queue.contains { queued in
            queued.kind == .dayClose && queued.date == item.date
                && RitmusPayload.decodeClose(queued.payload)?.journalClientRef == item.id
        }
        guard !waiting else { return }
        let relink = DayClosePayload(clientRef: close.id, eveningEnergy: close.eveningEnergy, dayRating: rating,
                                     goalText: close.goalText, goalOutcome: close.goalOutcome,
                                     planGoals: close.planGoals ?? [], journalClientRef: item.id)
        try? await outbox.enqueue(OutboxItem(kind: .dayClose, date: item.date, capturedAt: close.capturedAt,
                                             payload: RitmusPayload.encode(relink)))
    }

    /// Gives the Boop tab its chat: reads go through `client`, a question goes out through this environment's own
    /// sender (stopped when it is retired), and an offline one waits in this environment's outbox.
    /// `direct` replaces the outbox's sender for the direct send (tests); it is gated by retirement all the same.
    func attachChat(client: Client, direct: OutboxSender? = nil) {
        let chatSender = direct.map { RetiringSender(inner: $0, retirement: retirement) as OutboxSender } ?? sender
        let store = ChatStore(client: client, sender: chatSender, outbox: outbox, directory: userDirectory, clock: clock,
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
            transcribe: { file in try await ritmus.transcribe(file) },
            naplo: { from, to in try await ritmus.fetchNaplo(from: from, to: to) })
        env.attachChat(client: client)
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
    ///
    /// A new check-in of a slot already answered today is a full replace (spec §7.2): the slot's older writes still
    /// queued are dropped (sent later, they would overwrite it), and a recorded note still waiting for the slot moves
    /// behind it carrying its values — the transcript becomes the new check-in's note, never the old values again.
    func capture(_ checkIn: LedgerCheckIn, payload: CheckInPayload, kind: OutboxKind = .checkIn, date: String) async throws {
        var local = checkIn
        local.pending = true
        try ledger.saveCheckIn(local, date: date)
        try await outbox.enqueue(OutboxItem(id: checkIn.id, kind: kind, date: date, capturedAt: checkIn.capturedAt,
                                            payload: RitmusPayload.encode(payload)))
        guard kind == .checkIn else { return }
        // A recording already on its way is left alone: moved, its copy would find the audio deleted after that send.
        // It lands as it is (its transcript still becomes the slot's note on the phone) and this check-in follows it.
        let sending = await outbox.inFlight
        for item in await outbox.queue where item.date == date && item.id != checkIn.id && item.id != sending {
            switch item.kind {
            case .checkIn, .checkInNote:
                if RitmusPayload.decodeCheckIn(item.payload)?.slot == payload.slot { await outbox.remove(item.id) }
            case .voice:
                guard var voice = RitmusPayload.decodeVoice(item.payload), case .checkInNote(let old) = voice.target,
                      old.slot == payload.slot else { continue }
                voice.target = .checkInNote(payload)
                var moved = item
                moved.payload = RitmusPayload.encode(voice)
                moved.capturedAt = checkIn.capturedAt
                await outbox.remove(item.id)
                try? await outbox.enqueue(moved)
            default: continue
            }
        }
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

    /// The last days for the Napló list: the server's closes and check-ins merged into the day files (what is pending on
    /// the phone wins), so the list can be drawn again offline from what was seen. Quietly nothing offline.
    /// Asked again within five minutes of the last good fetch it does nothing, unless `force`.
    func refreshNaplo(force: Bool = false) async {
        guard let naploSource else { return }
        if !force, let last = lastNaploRefresh, clock().timeIntervalSince(last) < 300 { return }
        let range = NaploDays.range(endingOn: today)
        let fetchedAt = clock()
        guard let days = try? await naploSource(range.from, range.to) else { return }
        for server in days where !server.checkIns.isEmpty || server.close != nil || ledger.days[server.date] != nil {
            ledger.mergeCheckInsAndClose(server: server, fetchedAt: fetchedAt)
        }
        lastNaploRefresh = fetchedAt
    }

    /// Follows the phone's network path (a field's mic needs the net when the phone cannot transcribe itself).
    private func watchNetwork() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            let up = path.status == .satisfied
            Task { @MainActor in self?.networkChanged(up: up) }
        }
        monitor.start(queue: DispatchQueue(label: "boop.ritmus.path"))
        pathMonitor = monitor
    }

    /// The network path changed. When it comes back, what waited goes out now (backoff or not), and what ran out of
    /// tries while the net was flaky starts afresh — a refusal still waits for *Újra*.
    func networkChanged(up: Bool) {
        let cameBack = up && !online
        online = up
        retirement.set(offline: !up)
        guard cameBack, !retirement.retired else { return }
        lastTriggerFlush = clock()
        let outbox = outbox
        Task { await outbox.networkReturned() }
    }

    // MARK: - Speaking into a field (the goal, the chat composer)

    /// What a spoken sentence became: text for the field, or a short line for the toast.
    enum HeardSpeech: Equatable {
        case text(String)
        case problem(String)
    }

    static let voiceOfflineHint = "Net nélkül most csak beírni tudod."
    static let speechDenied = "A beszédfelismerés nincs engedélyezve — a Beállításokban kapcsolhatod be, vagy írd be."
    static let notUnderstood = "Nem értettem — írd be inkább."

    /// A field's mic works when the phone writes Hungarian itself, or when it is online and can ask the server.
    func voiceInputAvailable(_ recorder: (any VoiceNoteRecorder)?) -> Bool {
        guard let recorder else { return false }
        return recorder.transcribesOnDevice || (online && transcribeSource != nil)
    }

    /// Turns a recording into text for the field: the phone's transcript, else (online) the server's, asked for
    /// directly — nothing is queued, and the recording is deleted either way.
    func heardSpeech(_ capture: VoiceCapture, speechDenied: Bool) async -> HeardSpeech {
        switch capture {
        case .transcript(let text): return .text(text)
        case .recording(let name):
            let file = outboxDirectory.appendingPathComponent(name)
            defer { try? FileManager.default.removeItem(at: file) }
            guard online, let transcribeSource else { return .problem(speechDenied ? Self.speechDenied : Self.voiceOfflineHint) }
            do {
                let text = try await transcribeSource(file).trimmingCharacters(in: .whitespacesAndNewlines)
                return text.isEmpty ? .problem(Self.notUnderstood) : .text(text)
            } catch RitmusFetchError.offline {
                return .problem(Self.voiceOfflineHint)
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

    /// The app-wide flush triggers (back to the foreground, the net coming back, a background wake): everything queued goes
    /// out now, backoff ignored. Triggers arriving within a second of the last one are folded into it.
    func flushOnTrigger() {
        let now = clock()
        if let last = lastTriggerFlush, now.timeIntervalSince(last) < 1, now >= last { return }
        lastTriggerFlush = now
        sendSoon()
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
