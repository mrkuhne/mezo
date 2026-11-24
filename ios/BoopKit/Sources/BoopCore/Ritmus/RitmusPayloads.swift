import Foundation

/// The encoded request body of each `OutboxKind` — what the capture flow enqueues and `RitmusClient` sends.
/// `OutboxItem.id` is the write's client ref (the server's idempotency key), `.date` its local day and
/// `.capturedAt` the record's moment.
public enum RitmusPayload {
    public static func encode<T: Encodable>(_ value: T) -> Data {
        let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601
        return (try? e.encode(value)) ?? Data()
    }

    static func decode<T: Decodable>(_ type: T.Type, from data: Data) -> T? {
        let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601
        return try? d.decode(type, from: data)
    }

    /// A queued item's body read back (nil when it is not that kind's shape).
    public static func decodeCheckIn(_ data: Data) -> CheckInPayload? { decode(CheckInPayload.self, from: data) }
    public static func decodeVoice(_ data: Data) -> VoicePayload? { decode(VoicePayload.self, from: data) }
    public static func decodeClose(_ data: Data) -> DayClosePayload? { decode(DayClosePayload.self, from: data) }
    public static func decodePenzExpense(_ data: Data) -> PenzExpensePayload? { decode(PenzExpensePayload.self, from: data) }
    public static func decodeWeightLog(_ data: Data) -> WeightLogPayload? { decode(WeightLogPayload.self, from: data) }
    public static func decodeSleepLog(_ data: Data) -> SleepLogPayload? { decode(SleepLogPayload.self, from: data) }
}

/// `penzExpense`: a cash expense typed on the phone (Pénz L5). The item id is the transaction's `clientRef`, so a
/// resend after a lost answer returns the stored row instead of a second one. Amounts are minor units (1/100 Ft).
public struct PenzExpensePayload: Codable, Equatable, Sendable {
    public var accountId: String
    public var amountMinor: Int64
    public var currency: String
    public var categoryId: String?
    /// `YYYY-MM-DD` — the day he spent it.
    public var date: String
    public var note: String?

    public init(accountId: String, amountMinor: Int64, currency: String = "HUF", categoryId: String? = nil,
                date: String, note: String? = nil) {
        self.accountId = accountId; self.amountMinor = amountMinor; self.currency = currency
        self.categoryId = categoryId; self.date = date; self.note = note
    }

    /// The request the sender posts for the item `id`.
    public func request(clientRef id: UUID) -> PenzTransactionRequest {
        PenzTransactionRequest(clientRef: id.uuidString.lowercased(), accountId: accountId, kind: "expense",
                               amountMinor: amountMinor, currency: currency, categoryId: categoryId, date: date, note: note)
    }
}

/// `checkIn` and `checkInNote`: the whole slot (a note follow-up is an upsert of the same slot carrying every value
/// again). For a note, `OutboxItem.capturedAt` stays the check-in's own moment so the record does not move on the curve.
public struct CheckInPayload: Codable, Equatable, Sendable {
    /// The configured slot id the moment maps to (`06:30` / `10:00` / `14:00`); `20:00` is never sent from here.
    public var slot: String
    /// Scale answers by wire item id (`energy`, `mood`, `stress`, `body`, `mental`, `rested`, `soreness`, `motivation`,
    /// `hunger`, `craving`, `digestion`, `connection`, `day`).
    public var values: [String: Int]
    public var pain: Bool?
    public var painRegions: [String]
    public var painIntensity: Int?
    public var cravingKinds: [String]
    public var askedItems: [String]
    /// The question of the day shown (`CheckInPlanLite.adaptiveItem`).
    public var adaptiveItem: String?
    public var quickExit: Bool
    public var note: String?
    public var snapshot: CheckInSnapshotValue?

    public init(slot: String, values: [String: Int], pain: Bool? = nil, painRegions: [String] = [],
                painIntensity: Int? = nil, cravingKinds: [String] = [], askedItems: [String] = [],
                adaptiveItem: String? = nil, quickExit: Bool = false, note: String? = nil,
                snapshot: CheckInSnapshotValue? = nil) {
        self.slot = slot; self.values = values; self.pain = pain; self.painRegions = painRegions
        self.painIntensity = painIntensity; self.cravingKinds = cravingKinds; self.askedItems = askedItems
        self.adaptiveItem = adaptiveItem; self.quickExit = quickExit; self.note = note; self.snapshot = snapshot
    }
}

/// `goal`: the day's single focus.
public struct GoalPayload: Codable, Equatable, Sendable {
    public var text: String
    public init(text: String) { self.text = text }
}

/// `goalRemove`: the focus to delete — the server's focus id when the phone knows it (a goal fetched from the server),
/// else the goal's own client ref and text (a goal set on the phone, maybe still on its way): the sender replays the
/// idempotent add with that ref to learn the focus id, then removes it.
public struct GoalRemovePayload: Codable, Equatable, Sendable {
    public var focusId: UUID?
    public var goalRef: UUID?
    public var text: String?
    public init(focusId: UUID) { self.focusId = focusId }
    public init(goalRef: UUID, text: String) { self.goalRef = goalRef; self.text = text }
}

/// `journal`: a typed line (source `boop`).
public struct JournalPayload: Codable, Equatable, Sendable {
    public var text: String
    public init(text: String) { self.text = text }
}

/// Where a recording's transcript goes once it is written.
public enum VoiceTarget: Codable, Equatable, Sendable {
    /// A journal line of the day (the evening's *Mesélj*), created with the voice item's id as its client ref.
    case journal
    /// The note of a check-in already saved (spec §7.2): the same-slot follow-up upsert carrying all its values plus the
    /// transcript as `note`. The voice item's date and `capturedAt` are the check-in's own.
    case checkInNote(CheckInPayload)
}

/// `voice`: a recording waiting for its transcript. `fileName` lives in the client's audio directory (the outbox
/// directory by default), so the path survives a container move. After the transcript the target's write is sent (a
/// journal line, or the check-in carrying its note), and the file is deleted only then. Items queued before the target
/// existed decode as `journal`.
public struct VoicePayload: Codable, Equatable, Sendable {
    public var fileName: String
    public var target: VoiceTarget
    public init(fileName: String, target: VoiceTarget = .journal) { self.fileName = fileName; self.target = target }

    private enum CodingKeys: String, CodingKey { case fileName, target }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fileName = try c.decode(String.self, forKey: .fileName)
        target = try c.decodeIfPresent(VoiceTarget.self, forKey: .target) ?? .journal
    }
}

/// One of B2's goals as seen at close.
public struct PlanGoalPayload: Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var result: String
    public var met: Bool?
    public init(id: String, title: String, result: String, met: Bool? = nil) {
        self.id = id; self.title = title; self.result = result; self.met = met
    }
}

/// `dayClose`. The close syncs first without text (`journalClientRef` nil); once the evening transcript's journal line
/// is sent, the same close is enqueued again — a new outbox item carrying `clientRef` (the close's own ref) and the
/// journal's ref — so the server links the entry (spec §7.4).
public struct DayClosePayload: Codable, Equatable, Sendable {
    /// The close's client ref; nil = the outbox item's own id.
    public var clientRef: UUID?
    public var eveningEnergy: Int?
    /// 1–5.
    public var dayRating: Int
    public var goalText: String?
    /// `done` / `partial` / `no`.
    public var goalOutcome: String?
    public var planGoals: [PlanGoalPayload]
    public var journalClientRef: UUID?

    public init(clientRef: UUID? = nil, eveningEnergy: Int? = nil, dayRating: Int, goalText: String? = nil,
                goalOutcome: String? = nil, planGoals: [PlanGoalPayload] = [], journalClientRef: UUID? = nil) {
        self.clientRef = clientRef; self.eveningEnergy = eveningEnergy; self.dayRating = dayRating
        self.goalText = goalText; self.goalOutcome = goalOutcome; self.planGoals = planGoals
        self.journalClientRef = journalClientRef
    }
}

/// `chatQuestion`: a question for Boop. Without a `conversationId` the sender first creates a conversation
/// (channel `boop`); `title` is not sent (the server titles a Boop conversation with the owner's date).
public struct ChatQuestionPayload: Codable, Equatable, Sendable {
    public var conversationId: UUID?
    public var text: String
    public var title: String?
    public init(conversationId: UUID? = nil, text: String, title: String? = nil) {
        self.conversationId = conversationId; self.text = text; self.title = title
    }
}

/// What a delivered `chatQuestion` hands to `Outbox.onSent`.
public struct ChatReply: Codable, Equatable, Sendable {
    public var conversationId: UUID
    public var content: String
    public init(conversationId: UUID, content: String) { self.conversationId = conversationId; self.content = content }
}

/// What a delivered `voice` item hands to `Outbox.onSent` (the transcript to show in the ledger).
public struct VoiceTranscript: Codable, Equatable, Sendable {
    public var text: String
    public init(text: String) { self.text = text }
}

// MARK: - The quick log (`mezo-r36n9.154`)

/// `weightLog`: a weight read off the scale, `POST /api/weight/logs` with the day it belongs to.
public struct WeightLogPayload: Codable, Equatable, Sendable {
    public var date: String
    public var weightKg: Double
    public init(date: String, weightKg: Double) { self.date = date; self.weightKg = weightKg }
}

/// `sleepLog`: a night typed by hand (no watch, or a nap), `POST /api/sleep/logs`. `date` is the morning the night
/// ended on, the times are `HH:mm`, the length is what the phone computed from them (`sleepDurationHours`).
public struct SleepLogPayload: Codable, Equatable, Sendable {
    public var date: String
    public var bedtime: String
    public var wakeup: String
    public var durationH: Double
    public var quality: Int?
    public init(date: String, bedtime: String, wakeup: String, durationH: Double, quality: Int?) {
        self.date = date; self.bedtime = bedtime; self.wakeup = wakeup; self.durationH = durationH; self.quality = quality
    }
}

/// Hours between two clock times, two decimals; a wake-up at or before the bedtime is read as the next day. nil when
/// the two are the same instant or either is not `HH:mm`.
public func sleepDurationHours(bedtime: String, wakeup: String) -> Double? {
    func minutes(_ s: String) -> Int? {
        let p = s.split(separator: ":")
        guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]), (0..<24).contains(h), (0..<60).contains(m) else { return nil }
        return h * 60 + m
    }
    guard let bed = minutes(bedtime), let wake = minutes(wakeup) else { return nil }
    var span = wake - bed
    if span <= 0 { span += 24 * 60 }
    guard span > 0, span < 24 * 60 else { return nil }
    return (Double(span) / 60 * 100).rounded() / 100
}

/// The sports a session can be logged as (the server's own ten), with their names on the sheet.
public enum QuickSport: String, CaseIterable, Sendable {
    case volleyball, cross, trx, bike, swim, football, basketball, tennis, hike, other

    public var name: String {
        switch self {
        case .volleyball: "Röplabda"
        case .cross: "Cross"
        case .trx: "TRX"
        case .bike: "Kerékpár"
        case .swim: "Úszás"
        case .football: "Foci"
        case .basketball: "Kosár"
        case .tennis: "Tenisz"
        case .hike: "Túra"
        case .other: "Egyéb"
        }
    }
}
