import CryptoKit
import Foundation
import HTTPTypes
import OpenAPIRuntime
import BoopAPI

/// Why a day / plan / line fetch did not come back.
public enum RitmusFetchError: Error, Equatable, Sendable {
    case offline, unauthorized
    /// 503: the model is not available — the caller shows its calm placeholder and asks again later.
    case unavailable
    case server
}

/// The server's version of one day, shaped as a ledger for `LedgerStore.merge(server:fetchedAt:)`.
public typealias ServerDay = DayLedger

/// Boop's Napi ritmus API client (Task 7, spec §7): the real `OutboxSender` — each `OutboxKind` goes to its generated
/// operation — plus the day, plan and line fetches. Every write is idempotent on the server (natural key or the item
/// id as `clientRef`), so a resend after a lost answer never duplicates.
///
/// Status mapping of a write: 2xx → `.sent`; 401, 409, 429, 5xx, no network and anything the transport throws →
/// `.retryLater` (the item is fine, the moment is not; a 401 is an expired session, not a bad item, so the item must
/// survive until the owner signs in again); every other 4xx → `.failed("HTTP <code>")` and the item waits for the
/// owner's "Újra". Exceptions: an `addFocus` 409 is the focus cap (`.failed("INTENTION_FOCUS_CAP")`, retrying never
/// helps), and an `addFocus` 2xx whose body cannot be read is retried (the replay is idempotent and returns the focus id).
public struct RitmusClient: OutboxSender {
    private let client: Client
    private let audioDirectory: URL
    private let memo = Memo()

    /// `audioDirectory`: where `VoicePayload.fileName` is resolved (the outbox directory by default).
    public init(client: Client, audioDirectory: URL = Outbox.defaultDirectory()) {
        self.client = client; self.audioDirectory = audioDirectory
    }

    /// Work a retry must not repeat while the app runs: a transcript already paid for, a conversation already created.
    private actor Memo {
        var transcripts: [UUID: String] = [:]
        var conversations: [UUID: UUID] = [:]
        func transcript(_ id: UUID) -> String? { transcripts[id] }
        func conversation(_ id: UUID) -> UUID? { conversations[id] }
        func keep(transcript: String, for id: UUID) { transcripts[id] = transcript }
        func keep(conversation: UUID, for id: UUID) { conversations[id] = conversation }
        func forget(_ id: UUID) { transcripts[id] = nil; conversations[id] = nil }
    }

    // MARK: - OutboxSender

    public func send(_ item: OutboxItem) async -> OutboxSendResult {
        do {
            switch item.kind {
            case .checkIn, .checkInNote: return try await sendCheckIn(item)
            case .goal: return try await sendGoal(item)
            case .goalRemove: return try await sendGoalRemove(item)
            case .journal: return try await sendJournal(item)
            case .voice: return try await sendVoice(item)
            case .dayClose: return try await sendDayClose(item)
            case .chatQuestion: return try await sendChatQuestion(item)
            }
        } catch {
            // An answer whose body would not decode still carries its status; otherwise (no network, a timeout) the
            // write is idempotent, so asking again is safe.
            if let status = (error as? ClientError)?.response?.status.code {
                return (200..<300).contains(status) ? .sent(nil) : Self.map(status)
            }
            return .retryLater
        }
    }

    /// 2xx is handled by each caller; this is every other status.
    static func map(_ status: Int) -> OutboxSendResult {
        switch status {
        case 401, 409, 429, 500...599: .retryLater
        default: .failed("HTTP \(status)")
        }
    }

    private func malformed(_ what: String) -> OutboxSendResult { .failed("unreadable \(what) payload") }

    // MARK: - Check-in

    private func sendCheckIn(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = RitmusPayload.decode(CheckInPayload.self, from: item.payload) else { return malformed("check-in") }
        // Only the evening close writes the 20:00 slot (a merge write on the server); a Boop check-in never does.
        guard p.slot != "20:00" else { return .failed("the 20:00 slot is written by the day close only") }
        typealias Schemas = Components.Schemas
        let v = p.values
        let snapshot: Schemas.CheckInSnapshot? = p.snapshot.flatMap { s in
            s.isEmpty ? nil : Schemas.CheckInSnapshot(
                hrBpm: s.hrBpm, hrAt: s.hrAt, hrvMs: s.hrvMs, hrvAt: s.hrvAt, hrvUsualMs: s.hrvUsualMs, steps: s.steps,
                stepsIsDayTotal: false, sleepMinutes: s.sleepMinutes, source: s.source, computedBy: .phone)
        }
        let request = Schemas.SaveCheckInRequest(
            date: item.date, slotTime: p.slot, state: "done",
            energy: v["energy"], stress: v["stress"], body: v["body"], mental: v["mental"], mood: v["mood"],
            rested: v["rested"], soreness: v["soreness"], pain: p.pain,
            painRegions: p.painRegions.isEmpty ? nil : p.painRegions.compactMap(Schemas.PainRegion.init(rawValue:)),
            painIntensity: p.painIntensity, motivation: v["motivation"], hunger: v["hunger"], craving: v["craving"],
            cravingKinds: p.cravingKinds.isEmpty ? nil : p.cravingKinds.compactMap(Schemas.CravingKind.init(rawValue:)),
            digestion: v["digestion"], connection: v["connection"], dayRating: v["day"],
            askedItems: p.askedItems.compactMap(Schemas.CheckInItemId.init(rawValue:)),
            adaptiveItem: p.adaptiveItem.flatMap(Schemas.CheckInItemId.init(rawValue:)),
            quickExit: p.quickExit, note: p.note, capturedAt: item.capturedAt, snapshot: snapshot)
        switch try await client.saveCheckIn(body: .json(request)) {
        case .ok: return .sent(nil)
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    // MARK: - Goal

    private func sendGoal(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = RitmusPayload.decode(GoalPayload.self, from: item.payload) else { return malformed("goal") }
        let focusCap = OutboxSendResult.failed("INTENTION_FOCUS_CAP")
        do {
            switch try await client.addFocus(body: .json(.init(date: item.date, text: p.text, clientRef: item.id.uuidString))) {
            case .ok(let ok): return .sent(RitmusPayload.encode(try ok.body.json))
            case .badRequest: return Self.map(400)
            case .unauthorized: return Self.map(401)
            case .conflict: return focusCap
            case .undocumented(409, _): return focusCap
            case .undocumented(let code, _): return Self.map(code)
            }
        } catch let error as ClientError {
            // The focus id lives in the body; a 2xx we cannot read is replayed rather than reported as sent without it.
            if let status = error.response?.status.code, (200..<300).contains(status) { return .retryLater }
            throw error
        }
    }

    private func sendGoalRemove(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = RitmusPayload.decode(GoalRemovePayload.self, from: item.payload) else { return malformed("goal removal") }
        switch try await client.removeFocus(path: .init(id: p.focusId.uuidString.lowercased())) {
        case .noContent, .notFound: return .sent(nil)   // already gone is as good as removed
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    // MARK: - Journal and voice

    private func sendJournal(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = RitmusPayload.decode(JournalPayload.self, from: item.payload) else { return malformed("journal") }
        return try await createJournal(item, text: p.text)
    }

    private func createJournal(_ item: OutboxItem, text: String) async throws -> OutboxSendResult {
        let request = Components.Schemas.CreateJournalEntryRequest(
            text: text, occurredOn: item.date, source: "boop", clientRef: item.id.uuidString)
        switch try await client.createJournalEntry(body: .json(request)) {
        case .created: return .sent(nil)
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    /// Transcript first (once per run), then the journal line with the item's client ref; the recording is deleted
    /// only after the line is stored.
    private func sendVoice(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = RitmusPayload.decode(VoicePayload.self, from: item.payload) else { return malformed("voice") }
        let file = audioDirectory.appendingPathComponent(p.fileName)
        var text = await memo.transcript(item.id)
        if text == nil {
            guard let audio = try? Data(contentsOf: file) else { return .failed("audio file missing") }
            let part = Operations.transcribeVoiceNote.Input.Body.multipartFormPayload.audio(
                .init(payload: .init(body: HTTPBody(audio)), filename: file.lastPathComponent))
            switch try await client.transcribeVoiceNote(body: .multipartForm(MultipartBody([part]))) {
            case .ok(let ok): text = try ok.body.json.text.trimmingCharacters(in: .whitespacesAndNewlines)
            case .badRequest: return Self.map(400)
            case .unauthorized: return Self.map(401)
            case .notFound: return Self.map(404)
            case .badGateway: return Self.map(502)
            case .undocumented(let code, _): return Self.map(code)
            }
            await memo.keep(transcript: text ?? "", for: item.id)
        }
        guard let transcript = text, !transcript.isEmpty else { return .failed("no speech in the recording") }
        let result = try await createJournal(item, text: transcript)
        guard case .sent = result else { return result }
        try? FileManager.default.removeItem(at: file)
        await memo.forget(item.id)
        return .sent(RitmusPayload.encode(VoiceTranscript(text: transcript)))
    }

    // MARK: - Day close

    private func sendDayClose(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = RitmusPayload.decode(DayClosePayload.self, from: item.payload) else { return malformed("day close") }
        let request = Components.Schemas.DayCloseRequest(
            capturedAt: item.capturedAt, clientRef: (p.clientRef ?? item.id).uuidString, eveningEnergy: p.eveningEnergy,
            dayRating: p.dayRating, goalText: p.goalText,
            goalOutcome: p.goalOutcome.flatMap(Components.Schemas.DayCloseRequest.goalOutcomePayload.init(rawValue:)),
            planGoals: p.planGoals.map { .init(id: $0.id, title: $0.title, result: $0.result, met: $0.met) },
            journalClientRef: p.journalClientRef?.uuidString)
        switch try await client.putDayClose(path: .init(date: item.date), body: .json(request)) {
        case .ok: return .sent(nil)
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    // MARK: - Chat

    /// A conversation is created on the first question (channel `boop`); once created it is remembered for the retries of
    /// this run, so a failed send does not leave a conversation behind per attempt.
    private func sendChatQuestion(_ item: OutboxItem) async throws -> OutboxSendResult {
        guard let p = RitmusPayload.decode(ChatQuestionPayload.self, from: item.payload) else { return malformed("chat") }
        var conversation = p.conversationId
        if conversation == nil { conversation = await memo.conversation(item.id) }
        if conversation == nil {
            switch try await client.createConversation(body: .json(.init(channel: .boop))) {
            case .created(let ok):
                guard let made = UUID(uuidString: try ok.body.json.id) else { return .failed("conversation id is not a UUID") }
                conversation = made
                await memo.keep(conversation: made, for: item.id)
            case .unauthorized: return Self.map(401)
            case .undocumented(let code, _): return Self.map(code)
            }
        }
        guard let id = conversation else { return .retryLater }
        switch try await client.sendMessage(path: .init(conversationId: id.uuidString.lowercased()),
                                            body: .json(.init(content: p.text))) {
        case .ok(let ok):
            await memo.forget(item.id)
            return .sent(RitmusPayload.encode(ChatReply(conversationId: id, content: try ok.body.json.content)))
        case .badRequest: return Self.map(400)
        case .unauthorized: return Self.map(401)
        case .notFound: return Self.map(404)
        case .undocumented(let code, _): return Self.map(code)
        }
    }

    // MARK: - Fetches

    /// The day as the server has it: done check-ins, the day's focus, the close (404 = not closed).
    public func fetchDay(_ date: String) async throws -> ServerDay {
        var day = ServerDay(date: date)
        do {
            switch try await client.listCheckInsForDay(query: .init(date: date)) {
            case .ok(let ok): day.checkIns = try ok.body.json.filter { $0.state == "done" }.map(Self.ledgerCheckIn)
            case .unauthorized: throw RitmusFetchError.unauthorized
            case .undocumented: throw RitmusFetchError.server
            }
            switch try await client.getIntentionDay(path: .init(date: date)) {
            case .ok(let ok):
                day.goal = try ok.body.json.foci.first.map {
                    LedgerGoal(id: UUID(uuidString: $0.id) ?? Self.stableId("focus-\($0.id)"), text: $0.text, setAt: .distantPast)
                }
            case .unauthorized: throw RitmusFetchError.unauthorized
            case .undocumented: throw RitmusFetchError.server
            }
            switch try await client.getDayClose(path: .init(date: date)) {
            case .ok(let ok):
                let c = try ok.body.json
                day.close = LedgerClose(id: Self.stableId("close-\(date)"), capturedAt: c.closedAt, eveningEnergy: c.eveningEnergy,
                                        dayRating: c.dayRating, goalText: c.goalText, goalOutcome: c.goalOutcome?.rawValue)
            case .notFound: break
            case .unauthorized: throw RitmusFetchError.unauthorized
            case .undocumented: throw RitmusFetchError.server
            }
        } catch { throw Self.fetchError(error) }
        return day
    }

    /// The question of the day for each of the three slots (the plan's adaptive item and its "why").
    public func fetchPlans(_ date: String) async throws -> [String: CheckInPlanLite] {
        var plans: [String: CheckInPlanLite] = [:]
        do {
            for moment in CheckInMoment.allCases {
                switch try await client.getCheckInPlan(query: .init(date: date, slotTime: moment.slotId)) {
                case .ok(let ok):
                    let adaptive = try ok.body.json.adaptive
                    plans[moment.slotId] = CheckInPlanLite(slot: moment.slotId, adaptiveItem: adaptive?.id.rawValue,
                                                           adaptiveWhy: adaptive?.why)
                case .unauthorized: throw RitmusFetchError.unauthorized
                case .badRequest, .undocumented: throw RitmusFetchError.server
                }
            }
        } catch { throw Self.fetchError(error) }
        return plans
    }

    /// Fetches the day's plans and keeps them in the ledger store, so an offline check-in still has its question.
    @MainActor
    public func refreshPlans(_ date: String, into store: LedgerStore) async throws {
        store.cachePlans(Array(try await fetchPlans(date).values), date: date)
    }

    /// Boop's one sentence for a closed day (cached on the server; 503 → `.unavailable`).
    public func line(_ date: String) async throws -> String {
        do {
            switch try await client.generateDayCloseLine(path: .init(date: date)) {
            case .ok(let ok): return try ok.body.json.line
            case .unauthorized: throw RitmusFetchError.unauthorized
            case .serviceUnavailable: throw RitmusFetchError.unavailable
            case .notFound, .undocumented: throw RitmusFetchError.server
            }
        } catch { throw Self.fetchError(error) }
    }

    /// Boop's line after a check-in of that slot (503 → `.unavailable`).
    public func checkInLine(_ date: String, slot: String) async throws -> String {
        do {
            switch try await client.generateCheckInLine(path: .init(date: date), body: .json(.init(slot: slot))) {
            case .ok(let ok): return try ok.body.json.line
            case .unauthorized: throw RitmusFetchError.unauthorized
            case .serviceUnavailable: throw RitmusFetchError.unavailable
            case .badRequest, .undocumented: throw RitmusFetchError.server
            }
        } catch { throw Self.fetchError(error) }
    }

    private static func fetchError(_ error: Error) -> RitmusFetchError {
        if let e = error as? RitmusFetchError { return e }
        switch (error as? ClientError)?.response?.status.code {
        case 401?: return .unauthorized
        case 503?: return .unavailable
        case .some: return .server
        case nil: break
        }
        return isNetworkFailure(error) ? .offline : .server
    }

    private static func ledgerCheckIn(_ c: Components.Schemas.CheckInResponse) -> LedgerCheckIn {
        let numbers: [(String, Int?)] = [
            ("energy", c.energy), ("mood", c.mood), ("stress", c.stress), ("body", c.body), ("mental", c.mental),
            ("rested", c.rested), ("soreness", c.soreness), ("motivation", c.motivation), ("hunger", c.hunger),
            ("craving", c.craving), ("digestion", c.digestion), ("connection", c.connection), ("day", c.dayRating),
        ]
        var values: [String: Int] = [:]
        for (key, value) in numbers { if let value { values[key] = value } }
        return LedgerCheckIn(
            id: UUID(uuidString: c.id) ?? stableId("checkin-\(c.id)"), slot: c.slotTime, capturedAt: c.savedAt, values: values,
            pain: c.pain, painRegions: (c.painRegions ?? []).map(\.rawValue), painIntensity: c.painIntensity,
            cravingKinds: (c.cravingKinds ?? []).map(\.rawValue), askedItems: (c.askedItems ?? []).map(\.rawValue),
            quickExit: c.quickExit ?? false, note: c.note)
    }

    /// A UUID derived from a string, for server rows that carry no id of their own (the close of a day).
    static func stableId(_ key: String) -> UUID {
        let bytes = Array(SHA256.hash(data: Data(key.utf8)).prefix(16))
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7], bytes[8], bytes[9],
                           bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
    }
}
