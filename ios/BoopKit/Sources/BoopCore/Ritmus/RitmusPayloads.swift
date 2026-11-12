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

/// `goalRemove`: the focus to delete — the server's focus id (the `addFocus` answer), not the client ref.
public struct GoalRemovePayload: Codable, Equatable, Sendable {
    public var focusId: UUID
    public init(focusId: UUID) { self.focusId = focusId }
}

/// `journal`: a typed line (source `boop`).
public struct JournalPayload: Codable, Equatable, Sendable {
    public var text: String
    public init(text: String) { self.text = text }
}

/// `voice`: a recording waiting for its transcript. `fileName` lives in the client's audio directory (the outbox
/// directory by default), so the path survives a container move. After the transcript the journal line is created with
/// the item's client ref, and the file is deleted only then.
public struct VoicePayload: Codable, Equatable, Sendable {
    public var fileName: String
    public init(fileName: String) { self.fileName = fileName }
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
/// (channel `boop`); `title` is the owner's wish for its name and is not sent (the server names it from the first message).
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
}

/// What a delivered `voice` item hands to `Outbox.onSent` (the transcript to show in the ledger).
public struct VoiceTranscript: Codable, Equatable, Sendable {
    public var text: String
}
