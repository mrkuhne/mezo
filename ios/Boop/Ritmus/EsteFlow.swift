import Foundation
import Observation
import BoopCore

/// The one-minute evening close (spec §5.4, §6, §7.4): four steps on one page — energy now, the goal of the day, the
/// day's rating, *Mesélj* (voice or typed, optional) — and *Lezárom a napot*, enabled by the rating. Closing writes the
/// day first (pending), then queues the close (no text), the journal line (typed / heard text as `journal`, a recording
/// as `voice`) and the relink carrying the journal's ref, in that order; Boop's sentence follows online, the calm line
/// offline. A day already closed (here, or on the web) opens on the summary; *Módosítom* re-opens the close.
@MainActor @Observable
final class EsteFlow {
    /// What *Mesélj* holds before closing.
    enum Journal: Equatable {
        case typed(String)
        /// Written down on the phone from the recording.
        case heard(String)
        /// A recording waiting for the server's transcription (file in the outbox folder).
        case recording(fileName: String)
    }

    /// The journal line on the summary.
    enum Quote: Equatable {
        case text(String)
        /// A recording still on its way to its transcript.
        case waitingForTranscript
        /// The recording could not be written down (the outbox item failed); *Újra* sends it again.
        case transcriptFailed
    }

    struct Row: Equatable {
        let label: String
        let value: String
    }

    static let offlineLine = "A napod a telefonon van. Amint lesz net, elküldöm, és reggel elmondom, mit tanultam belőle."
    static let waitingLine = "Mindjárt írok egy mondatot a napodról."
    /// The close (or its journal line) was refused by the server: kept on the phone, *Újra* sends it again.
    static let refusedLine = "A napod a telefonon van, de most nem sikerült elküldeni."
    static let ratingWords = NaploDays.ratingWords
    static let outcomes: [(id: String, label: String)] = [("done", "Sikerült"), ("partial", "Részben"), ("no", "Nem")]

    /// The evening's day: the day the close opened on, or the day before when it opened before 04:00 (the Este phase
    /// runs 18:00–04:00).
    let date: String
    /// The goal of the day (Ma's), copied into the close.
    let goalText: String?
    /// Boop's own goals (B2's `DayPlan.goals`), ticked from data, as seen at close.
    private(set) var planGoals: [PlanGoalPayload] = []
    private(set) var bedtimeTarget: String?

    private(set) var energy: Int?
    private(set) var outcome: String?
    private(set) var rating: Int?
    private(set) var journal: Journal?
    /// *Módosítom*: the closed day is open for a new close.
    private(set) var editing = false
    /// The close is on its way right now (the summary waits for Boop instead of saying "no net").
    private(set) var delivering = false
    /// The phone could not keep the close (disk) — shown under the button, nothing is lost silently.
    private(set) var saveProblem: String?

    @ObservationIgnored private let env: RitmusEnvironment

    init(env: RitmusEnvironment, brief: Brief?) {
        self.env = env
        let day = Self.eveningDay(at: env.clock(), env: env)
        date = day
        // Ma's goal; a closed day without one on the phone keeps the goal its close was made with.
        goalText = env.goal(on: day)?.text ?? env.ledger.ledger(for: day).close?.goalText
        use(brief)
    }

    /// Before 04:00 the evening still belongs to the day before.
    static func eveningDay(at now: Date, env: RitmusEnvironment) -> String {
        let hour = env.calendar.component(.hour, from: now)
        guard hour < 4, let before = env.calendar.date(byAdding: .day, value: -1, to: now) else { return env.day(of: now) }
        return env.day(of: before)
    }

    /// The day's brief (it may arrive after the close opened): Boop's own goals for the day and the bedtime target.
    func use(_ brief: Brief?) {
        guard let brief else { return }
        bedtimeTarget = brief.day.bedtimeTarget
        guard brief.date == date else { return }
        planGoals = DayPlan.goals(brief).map { PlanGoalPayload(id: $0.id, title: $0.title, result: $0.result, met: $0.met) }
    }

    // MARK: - What the screen shows

    /// The day's close as the phone knows it (written here, or merged from the server).
    var closed: LedgerClose? { env.ledger.ledger(for: date).close }
    /// The summary instead of the steps.
    var showsSummary: Bool { closed != nil && !editing }
    var canClose: Bool { rating != nil && !delivering }
    /// Each numbered step's tick; the goal step has nothing to answer when there is no goal.
    var stepsDone: [Bool] { [energy != nil, outcome != nil || goalText == nil, rating != nil, journal != nil] }
    /// Saved on the phone, waiting for the net (not refused).
    var offline: Bool { closed?.pending == true && !delivering && !sendFailed }
    /// The server refused the close, a relink or the typed line: the summary shows "nem sikerült elküldeni" with *Újra*.
    var sendFailed: Bool { !env.closeRefusals(on: date).isEmpty }
    /// The evening's recording stopped in the outbox (refused, or out of tries) — follows the outbox as it changes.
    var voiceFailed: Bool {
        guard let id = closed?.journalId, let item = env.refused[id] else { return false }
        return item.kind == .voice
    }

    /// "LEZÁRVA · 21:33".
    var closedLabel: String? { closed.map { "LEZÁRVA · \(CheckinFlow.clock($0.capturedAt, env.calendar))" } }

    /// Boop's sentence about the day: the calm line offline, his sentence once it is here, a short wait line meanwhile.
    var boopText: String {
        if sendFailed { return Self.refusedLine }
        if offline { return Self.offlineLine }
        return env.closeLines[date] ?? closed?.boopLine ?? Self.waitingLine
    }

    /// "A MAI NAPOD": értékelés, a nap célja, energia este, Boop céljai n / m (when there were any).
    var summaryRows: [Row] { closed.map(Self.summaryRows(for:)) ?? [] }

    /// The same rows for any closed day (Napló opens past days with them).
    static func summaryRows(for c: LedgerClose) -> [Row] {
        var rows = [
            Row(label: "Értékelés", value: NaploDays.ratingWord(c.dayRating) ?? "–"),
            Row(label: "A nap célja", value: outcomes.first { $0.id == c.goalOutcome }?.label ?? "–"),
            Row(label: "Energia este", value: c.eveningEnergy.map(String.init) ?? "–"),
        ]
        if let goals = c.planGoals, !goals.isEmpty {
            rows.append(Row(label: "Boop céljai", value: "\(goals.filter { $0.met == true }.count) / \(goals.count)"))
        }
        return rows
    }

    /// The evening's journal line: the server's text, else the phone's line (a recording until its transcript).
    var journalQuote: Quote? {
        guard let c = closed else { return nil }
        return Self.quote(for: c, in: env.ledger.ledger(for: date), voiceFailed: voiceFailed)
    }

    static func quote(for c: LedgerClose, in day: DayLedger, voiceFailed: Bool) -> Quote? {
        if let text = c.journalText, !text.isEmpty { return .text(text) }
        guard let id = c.journalId, let line = day.journal.first(where: { $0.id == id }) else { return nil }
        if let text = line.text, !text.isEmpty { return .text(text) }
        return voiceFailed ? .transcriptFailed : .waitingForTranscript
    }

    /// "22:15-kor szólok a lefekvés miatt" — the bedtime reminder's ring time (half an hour before the target).
    var bedtimeLine: String? {
        guard let target = bedtimeTarget, let t = BedtimeTime.trigger(for: target) else { return nil }
        return String(format: "%02d:%02d-kor szólok a lefekvés miatt", t.hour, t.minute)
    }

    // MARK: - Answering

    func pickEnergy(_ value: Int) { energy = max(1, min(10, value)) }
    func pickOutcome(_ id: String) { if Self.outcomes.contains(where: { $0.id == id }) { outcome = id } }
    func pickRating(_ value: Int) { rating = max(1, min(5, value)) }

    /// False for an empty line (nothing is kept, *Mesélj* stays open).
    @discardableResult
    func typed(_ raw: String) -> Bool {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return false }
        replaceJournal(with: .typed(text))
        return true
    }

    func recorded(_ capture: VoiceCapture) {
        switch capture {
        case .transcript(let text):
            let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !t.isEmpty { replaceJournal(with: .heard(t)) }
        case .recording(let name): replaceJournal(with: .recording(fileName: name))
        }
    }

    /// The cover closes without closing the day: a kept recording is thrown away.
    func abandon() { discardRecording() }

    /// A new *Mesélj* replaces the old one; a kept recording it replaces is thrown away.
    private func replaceJournal(with new: Journal) {
        if journal != new { discardRecording() }
        journal = new
    }

    private func discardRecording() {
        if case .recording(let name) = journal { env.recorder?.discard(.recording(fileName: name)) }
        if case .recording = journal { journal = nil }
    }

    /// *Módosítom*: the steps come back with the day's answers; a new *Mesélj* adds a new line.
    func reopen() {
        guard let c = closed else { return }
        energy = c.eveningEnergy
        outcome = c.goalOutcome
        rating = c.dayRating
        discardRecording()
        journal = nil
        saveProblem = nil
        editing = true
    }

    // MARK: - Closing

    /// *Lezárom a napot*: the day (pending), then the queue — close, journal line, relink — then delivery and Boop's line.
    func closeDay() async {
        guard let rating, !delivering else { return }
        saveProblem = nil
        let now = env.clock()
        let previous = closed
        // A re-close upserts the same close (same client ref; a queued older version is replaced in place).
        let closeId = previous?.id ?? UUID()
        let goal = goalText
        let payload = DayClosePayload(eveningEnergy: energy, dayRating: rating, goalText: goal,
                                      goalOutcome: goal == nil ? nil : outcome, planGoals: planGoals)
        let journalId = journal == nil ? nil : UUID()
        // A re-close replaces its queued close in place and rewrites the relinks still queued for it with the new
        // values (sent after the close, an old relink would bring the old values back); a rollback restores both.
        let previousQueued = await env.outbox.queued(closeId)
        let relinks = await env.outbox.queue.filter { item in
            item.kind == .dayClose && item.id != closeId && item.date == date
                && RitmusPayload.decodeClose(item.payload)?.clientRef == closeId
        }
        let journalText: String? = switch journal {
        case .typed(let t), .heard(let t): t
        case .recording, nil: nil
        }
        let local = LedgerClose(id: closeId, capturedAt: now, eveningEnergy: energy, dayRating: rating, goalText: goal,
                                goalOutcome: payload.goalOutcome, journalId: journalId ?? previous?.journalId, pending: true,
                                planGoals: planGoals, journalText: journalId == nil ? previous?.journalText : nil)
        // An enqueue that throws has already queued the item for this run: the undo below takes it back out.
        var enqueued: [UUID] = []
        var rewritten: [OutboxItem] = []
        do {
            try env.ledger.setClose(local, date: date)
            enqueued.append(closeId)
            try await env.outbox.enqueue(OutboxItem(id: closeId, kind: .dayClose, date: date, capturedAt: now,
                                                    payload: RitmusPayload.encode(payload)))
            for old in relinks {
                guard let ref = RitmusPayload.decodeClose(old.payload)?.journalClientRef else { continue }
                var values = payload
                values.clientRef = closeId
                values.journalClientRef = ref
                var updated = old
                updated.payload = RitmusPayload.encode(values)
                rewritten.append(old)
                try await env.outbox.enqueue(updated)
            }
            if let journalId, let journal {
                try env.ledger.addJournal(LedgerJournal(id: journalId, capturedAt: now, text: journalText, pending: true), date: date)
                let (kind, body): (OutboxKind, Data) = switch journal {
                case .typed(let t), .heard(let t): (.journal, RitmusPayload.encode(JournalPayload(text: t)))
                case .recording(let name): (.voice, RitmusPayload.encode(VoicePayload(fileName: name, target: .journal)))
                }
                enqueued.append(journalId)
                try await env.outbox.enqueue(OutboxItem(id: journalId, kind: kind, date: date, capturedAt: now, payload: body))
                var relink = payload
                relink.clientRef = closeId
                relink.journalClientRef = journalId
                let relinkId = UUID()
                enqueued.append(relinkId)
                try await env.outbox.enqueue(OutboxItem(id: relinkId, kind: .dayClose, date: date, capturedAt: now,
                                                        payload: RitmusPayload.encode(relink)))
            }
        } catch {
            // Undo what got kept, so the day is as it was (a half close never shows as closed).
            try? env.ledger.setClose(previous, date: date)
            if let journalId { try? env.ledger.removeJournal(journalId, date: date) }
            // A re-close replaced its older queued version and relinks in place: those come back as they were.
            for id in enqueued {
                if id == closeId, let previousQueued { try? await env.outbox.enqueue(previousQueued) }
                else { await env.outbox.remove(id) }
            }
            for old in rewritten { try? await env.outbox.enqueue(old) }
            saveProblem = "Nem sikerült elmenteni a telefonra. Próbáld újra."
            editing = true
            return
        }
        // The recording now belongs to the queue (it is not ours to throw away any more).
        journal = nil
        editing = false
        // A close written again no longer matches the old sentence, whether or not it reaches the server now.
        env.forgetCloseLine(date)
        delivering = true
        if await env.deliver(closeId) { await env.refreshCloseLine(date) }
        delivering = false
    }

    /// *Újra* on a recording that could not be written down.
    func retryVoice() async {
        guard let id = closed?.journalId else { return }
        await env.retry([id])
    }

    /// *Újra* on a close (or its line) the server refused: everything of it goes again, then Boop's sentence.
    func retrySend() async {
        await env.retry(env.closeRefusals(on: date))
        if closed?.pending == false { await env.refreshCloseLine(date) }
    }

    /// When the summary opens: the server's version of the day (a close made on the web) and Boop's sentence.
    func refresh() async {
        await env.refreshDay(date)
        await env.refreshCloseLine(date)
    }
}
