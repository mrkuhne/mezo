import Foundation
import Observation
import BoopCore
import BoopDesign

/// One check-in from open to payoff (spec §5.2, §6, §7.2): the five core items and the question of the day, answered by
/// swiping the orb; *Tovább* keeps the shown value (an unchanged item needs no swipe), *Kihagyom* leaves it out,
/// "Most csak ennyi" (from the second item) saves what is answered with `quickExit`. Saving writes the phone first,
/// then the outbox delivers; Boop's line follows online, a calm line offline.
@MainActor @Observable
final class CheckinFlow {
    enum PainStage: Equatable { case gate, details }

    /// Boop's sentence on the payoff screen.
    enum Line: Equatable {
        case waiting
        case line(String)
        /// Saved on the phone; Boop looks once there is net.
        case offline(String)
        /// No sentence (the model is resting, or the server refused the check-in).
        case none
    }

    struct Saved: Equatable {
        var checkIn: LedgerCheckIn
        var payload: CheckInPayload
        let date: String
    }

    /// One swipe step on the orb, in points.
    static let stepHeight: Double = 26

    /// The day and the moment shown at open; saving re-decides both from the capture time (spec §7.2), so a check-in
    /// opened at 14:29 and saved at 14:31 is délután, and one saved after midnight belongs to the new day.
    private(set) var date: String
    private(set) var moment: CheckInMoment
    let openedAt: Date
    /// "A délit már kitöltötted 12:40-kor — felülírod?" when this moment's slot is already done today.
    let overwriteNotice: String?
    private(set) var questions: [CheckInQuestion]
    private(set) var index = 0
    private(set) var answers: [String: Int] = [:]
    private(set) var pain: Bool?
    private(set) var painStage: PainStage = .gate
    private(set) var painRegions: [String] = []
    private(set) var cravingKinds: [String] = []
    private(set) var saving = false
    /// The phone could not keep the check-in (disk) — shown under the buttons, nothing is lost silently.
    private(set) var saveProblem: String?
    private(set) var saved: Saved?
    /// After saving: the check-in is waiting for the net.
    private(set) var offline = false
    private(set) var line: Line = .waiting

    @ObservationIgnored private let env: RitmusEnvironment
    @ObservationIgnored private var startValues: [String: Int] = [:]
    /// Items the day already has an answer to (the orb starts there).
    @ObservationIgnored private var answeredToday: Set<String> = []
    @ObservationIgnored private var dragStart: Int?
    private var draft: [String: Int] = [:]

    init(env: RitmusEnvironment) {
        self.env = env
        let now = env.clock()
        openedAt = now
        date = env.day(of: now)
        let moment = CheckInMoment.moment(at: now, calendar: env.calendar)
        self.moment = moment
        let day = env.ledger.ledger(for: env.day(of: now))
        questions = CheckInQuestions.questions(plan: day.plans[moment.slotId])
        if let done = day.checkIns.first(where: { $0.slot == moment.slotId }) {
            overwriteNotice = "A \(Self.doneWord(moment)) már kitöltötted \(Self.clock(done.capturedAt, env.calendar))-kor — felülírod?"
        } else {
            overwriteNotice = nil
        }
        for q in questions { remember(q.key, from: day.checkIns) }
    }

    // MARK: - What the screen shows

    var current: CheckInQuestion { questions[min(index, questions.count - 1)] }
    var isLast: Bool { index == questions.count - 1 }
    /// "Most csak ennyi" from the second item on.
    var canQuickExit: Bool { index >= 1 && saved == nil }
    /// The orb's value: the swipe, else what was kept, else the last answer of the day (else 5).
    var value: Int { draft[current.key] ?? answers[current.key] ?? startValues[current.key] ?? 5 }
    /// The day's last answer to the shown item, for "legutóbb N volt" (nil when there is none yet).
    var previous: Int? { answeredToday.contains(current.key) ? startValues[current.key] : nil }
    /// "Délután · 16:02".
    var momentLabel: String { "\(Self.momentName(moment)) · \(Self.clock(openedAt, env.calendar))" }
    /// "MENTVE · 16:02" — the capture time.
    var savedTimeLabel: String? { saved.map { "MENTVE · \(Self.clock($0.checkIn.capturedAt, env.calendar))" } }
    func isSelected(_ option: String) -> Bool {
        current.kind == .pain ? painRegions.contains(option) : cravingKinds.contains(option)
    }

    // MARK: - Swiping the orb

    func beginSwipe() { dragStart = value }

    /// Up is more: every 26 pt one step, 1…10. True when the value changed (one soft haptic per step).
    @discardableResult
    func swipe(dy: Double) -> Bool {
        guard saved == nil else { return false }
        let start = dragStart ?? value
        let next = max(1, min(10, start - Int((dy / Self.stepHeight).rounded())))
        guard next != value else { return false }
        draft[current.key] = next
        return true
    }

    func endSwipe() { dragStart = nil }

    // MARK: - Moving on

    /// *Tovább* / *Kész*: keeps the shown value and moves on (the last one saves). In the pain gate it waits for Nem/Igen.
    func next() async {
        guard saved == nil, !saving else { return }
        let q = current
        if q.kind == .pain {
            guard painStage == .details else { return }
            pain = true
        } else {
            answers[q.key] = value
        }
        await advance()
    }

    /// *Kihagyom*: the item was shown but is not sent.
    func skip() async {
        guard saved == nil, !saving else { return }
        let q = current
        answers[q.key] = nil
        draft[q.key] = nil
        switch q.kind {
        case .pain: pain = nil; painRegions = []; painStage = .gate
        case .craving: cravingKinds = []
        case .scale: break
        }
        await advance()
    }

    /// The pain gate: *Nem* moves on, *Igen* opens the regions and the intensity.
    func answerPain(_ yes: Bool) async {
        guard saved == nil, current.kind == .pain, painStage == .gate else { return }
        if yes {
            pain = true
            painStage = .details
        } else {
            pain = false
            painRegions = []
            draft["pain"] = nil
            await advance()
        }
    }

    /// A pain region or a craving kind chip.
    func toggleOption(_ id: String) {
        let order = current.options.map(\.id)
        func toggled(_ list: [String]) -> [String] {
            let set = list.contains(id) ? Set(list).subtracting([id]) : Set(list).union([id])
            return order.filter(set.contains)
        }
        if current.kind == .pain { painRegions = toggled(painRegions) }
        else if current.kind == .craving { cravingKinds = toggled(cravingKinds) }
    }

    /// "Most csak ennyi": saves what is answered so far (a value swiped on the shown item counts).
    func quickExit() async {
        guard canQuickExit, !saving else { return }
        let q = current
        if q.kind == .pain {
            if painStage == .details { pain = true }
        } else if let swiped = draft[q.key] {
            answers[q.key] = swiped
        }
        await save(quickExit: true)
    }

    /// The plan arrived after opening: the question of the day joins the end (the core five stay as they are).
    func refreshQuestions() {
        guard saved == nil, !questions.contains(where: \.isQuestionOfDay) else { return }
        let fresh = CheckInQuestions.questions(plan: env.ledger.ledger(for: date).plans[moment.slotId])
        guard fresh.count > questions.count, let qod = fresh.last else { return }
        remember(qod.key, from: env.ledger.ledger(for: date).checkIns)
        questions = fresh
    }

    private func remember(_ key: String, from checkIns: [LedgerCheckIn]) {
        startValues[key] = CheckInQuestions.startValue(for: key, checkIns: checkIns)
        if checkIns.contains(where: { key == "pain" ? $0.painIntensity != nil : $0.values[key] != nil }) { answeredToday.insert(key) }
    }

    private func advance() async {
        if index < questions.count - 1 {
            index += 1
            painStage = .gate
        } else {
            await save(quickExit: false)
        }
    }

    // MARK: - Saving

    private func save(quickExit: Bool) async {
        guard saved == nil, !saving else { return }
        saving = true
        saveProblem = nil
        let capturedAt = env.clock()
        // The slot and the day are the capture's (the phone's clock at saving), not the opening's.
        moment = CheckInMoment.moment(at: capturedAt, calendar: env.calendar)
        date = env.day(of: capturedAt)
        let shown = Array(questions.prefix(index + 1))
        let asked = shown.map(\.key)
        let painAsked = asked.contains("pain")
        let painIntensity = painAsked && pain == true ? (draft["pain"] ?? answers["pain"] ?? startValues["pain"] ?? 5) : nil
        var values = answers.filter { asked.contains($0.key) }
        values["pain"] = nil
        let snapshot = await env.snapshot(at: capturedAt)
        let payload = CheckInPayload(
            slot: moment.slotId, values: values, pain: painAsked ? pain : nil,
            painRegions: painAsked && pain == true ? painRegions : [], painIntensity: painIntensity,
            cravingKinds: asked.contains("craving") && values["craving"] != nil ? cravingKinds : [],
            askedItems: asked, adaptiveItem: shown.first(where: \.isQuestionOfDay)?.key, quickExit: quickExit,
            snapshot: snapshot.isEmpty ? nil : snapshot)
        let checkIn = LedgerCheckIn(
            id: UUID(), slot: payload.slot, capturedAt: capturedAt, values: values, pain: payload.pain,
            painRegions: payload.painRegions, painIntensity: payload.painIntensity, cravingKinds: payload.cravingKinds,
            askedItems: asked, quickExit: quickExit, snapshot: payload.snapshot)
        do {
            try await env.capture(checkIn, payload: payload, date: date)
        } catch {
            saveProblem = "Nem sikerült elmenteni a telefonra. Próbáld újra."
            saving = false
            return
        }
        saved = Saved(checkIn: checkIn, payload: payload, date: date)
        saving = false
        await settle(checkIn.id)
    }

    /// Delivers the check-in, then asks Boop for his line (online) or says the calm line (offline).
    private func settle(_ id: UUID) async {
        if await env.deliver(id) {
            offline = false
            do {
                line = .line(try await env.checkInLine(date: date, slot: moment.slotId))
            } catch RitmusFetchError.offline {
                line = .offline(Self.calmLine(moment))
            } catch {
                line = .none
            }
        } else if await env.isWaiting(id) {
            offline = true
            line = .offline(Self.calmLine(moment))
        } else {
            line = .none
        }
    }

    /// The optional sentence after saving: the check-in's `note`, sent as a follow-up of the same slot carrying every
    /// value again (same client ref and moment, so the pending dot clears and does not move). False when the phone
    /// could not keep it (`saveProblem` says so) — the row must not show it as saved.
    @discardableResult
    func addNote(_ text: String) async -> Bool {
        let note = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !note.isEmpty, var s = saved else { return false }
        saveProblem = nil
        s.checkIn.note = note
        s.payload.note = note
        do {
            try await env.capture(s.checkIn, payload: s.payload, kind: .checkInNote, date: s.date)
        } catch {
            saveProblem = "Nem sikerült elmenteni a mondatot. Próbáld újra."
            return false
        }
        saved = s
        if !(await env.deliver(s.checkIn.id)), await env.isWaiting(s.checkIn.id) { offline = true }
        return true
    }

    /// What became of a recorded sentence the phone could not write down itself.
    enum VoiceNoteOutcome: Equatable {
        /// The server wrote it down; it is the check-in's note now.
        case transcribed(String)
        /// No net: the recording waits in the outbox and becomes the note later.
        case waiting
        /// The phone could not keep it, or the server could not use it (`saveProblem` says so).
        case failed
    }

    /// A recording without an on-device transcript (B3 Task 10 ruling): queued as a `voice` item aimed at this check-in's
    /// note — after the transcript the sender upserts the same slot with every value plus the note. Its own id keeps the
    /// check-in in front of it in the queue; its date and moment are the check-in's.
    func addVoiceNote(fileName: String) async -> VoiceNoteOutcome {
        guard let s = saved else { return .failed }
        saveProblem = nil
        let item = OutboxItem(id: UUID(), kind: .voice, date: s.date, capturedAt: s.checkIn.capturedAt,
                              payload: RitmusPayload.encode(VoicePayload(fileName: fileName, target: .checkInNote(s.payload))))
        do {
            try await env.outbox.enqueue(item)
        } catch {
            saveProblem = "Nem sikerült elmenteni a felvételt. Próbáld újra."
            return .failed
        }
        if await env.deliver(item.id) {
            let note = env.ledger.ledger(for: s.date).checkIns.first { $0.slot == s.payload.slot }?.note ?? ""
            if !note.isEmpty { saved?.checkIn.note = note; saved?.payload.note = note }
            return .transcribed(note)
        }
        if await env.isWaiting(item.id) { offline = true; return .waiting }
        saveProblem = "Ebből a felvételből nem tudtam szöveget írni. Írd be inkább."
        return .failed
    }

    #if DEBUG
    /// Simulator review (`-previewOpen checkinDone`): every item answered, then saved.
    func previewSave() async {
        let preset = ["energy": 5, "mood": 6, "stress": 6, "body": 6, "mental": 4]
        for q in questions { answers[q.key] = preset[q.key] ?? 7 }
        index = questions.count - 1
        await save(quickExit: false)
    }
    #endif

    // MARK: - Copy

    /// "Délutánra lejjebb mentél, mint jósoltam." — the new dot against Boop's prediction (nil without one).
    static func verdict(energy: Int, hour: Double, predicted: [Double], moment: CheckInMoment) -> String? {
        guard let p = EnergyCurveGeometry.predicted(predicted, at: hour) else { return nil }
        let diff = Double(energy) / 10 - p
        let when = ["Reggelre", "Délre", "Délutánra"][CheckInMoment.allCases.firstIndex(of: moment) ?? 2]
        if diff <= -0.1 { return "\(when) lejjebb mentél, mint jósoltam." }
        if diff >= 0.1 { return "\(when) feljebb jöttél, mint jósoltam." }
        return "Pont ott vagy, ahol jósoltam."
    }

    static func calmLine(_ moment: CheckInMoment) -> String {
        let what = ["reggeledet", "délelőttödet", "délutánodat"][CheckInMoment.allCases.firstIndex(of: moment) ?? 2]
        return "Megvan. Amint lesz net, megnézem a \(what), és szólok."
    }

    static func momentName(_ moment: CheckInMoment) -> String {
        ["Reggel", "Délben", "Délután"][CheckInMoment.allCases.firstIndex(of: moment) ?? 2]
    }

    private static func doneWord(_ moment: CheckInMoment) -> String {
        ["reggelit", "délit", "délutánit"][CheckInMoment.allCases.firstIndex(of: moment) ?? 2]
    }

    static func clock(_ date: Date, _ calendar: Calendar) -> String {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}
