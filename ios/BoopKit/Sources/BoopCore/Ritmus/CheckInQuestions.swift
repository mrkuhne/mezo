import Foundation

/// How the check-in screen renders an item: a 1–10 scale, the pain gate (yes/no → regions → intensity), or the
/// craving scale plus its kind chips (mirrors the contract's `CheckInItemKind`).
public enum QuestionKind: String, Codable, Sendable {
    case scale, pain, craving
}

/// A selectable sub-option (pain region or craving kind) with its Hungarian label.
public struct QuestionOption: Equatable, Sendable {
    public let id: String
    public let label: String
}

public struct CheckInQuestion: Equatable, Sendable {
    /// The wire item id (`CheckInItemId`): `energy`, `mood`, … `day`.
    public let key: String
    public let label: String
    public let question: String
    /// Anchors of 1 and 10 (for pain: the intensity scale's anchors).
    public let low: String
    public let high: String
    public let kind: QuestionKind
    /// Pain regions or craving kinds; empty for a scale item.
    public let options: [QuestionOption]
    /// Boop's "why" line under the question of the day; nil for the core five.
    public let why: String?
    public let isQuestionOfDay: Bool
}

/// The part of a slot's `GET /api/biometrics/checkin/plan` answer the phone keeps (Task 7 fills it, the ledger caches
/// it per date) so an offline check-in still has its question of the day.
public struct CheckInPlanLite: Codable, Equatable, Sendable {
    public var slot: String
    /// The adaptive item's id (`adaptive.id`); nil when the plan has no question of the day.
    public var adaptiveItem: String?
    /// The adaptive item's one-sentence "why" (`adaptive.why`).
    public var adaptiveWhy: String?

    public init(slot: String, adaptiveItem: String?, adaptiveWhy: String?) {
        self.slot = slot; self.adaptiveItem = adaptiveItem; self.adaptiveWhy = adaptiveWhy
    }
}

/// The check-in item set (spec §5.2): the five core items, then the question of the day from the cached plan.
public enum CheckInQuestions {
    struct Copy { let label, question, low, high: String; let kind: QuestionKind }

    /// The five core items in ask order, with the approved spike's questions (`RitmusCheckin.swift`).
    static let core: [(key: String, copy: Copy)] = [
        ("energy", Copy(label: "Energia", question: "Mennyi energia van benned most?", low: "Üres", high: "Tele", kind: .scale)),
        ("mood", Copy(label: "Hangulat", question: "Milyen a hangulatod?", low: "Nagyon rossz", high: "Nagyon jó", kind: .scale)),
        ("stress", Copy(label: "Feszültség", question: "Mennyire vagy feszült?", low: "Nyugodt", high: "Túlfeszült", kind: .scale)),
        ("body", Copy(label: "Test", question: "Hogy érzed a tested?", low: "Lerakva", high: "Friss", kind: .scale)),
        ("mental", Copy(label: "Fejtisztaság", question: "Mennyire tiszta a fejed?", low: "Köd", high: "Éles", kind: .scale)),
    ]

    /// The other nine items that may come as the question of the day — copy of the backend `CheckInItem`.
    static let others: [String: Copy] = [
        "rested": Copy(label: "Kipihentség", question: "Mennyire pihented ki magad éjjel?", low: "Egyáltalán nem", high: "Teljesen", kind: .scale),
        "soreness": Copy(label: "Izomláz", question: "Mennyire van izomlázad?", low: "Nincs", high: "Nagyon erős", kind: .scale),
        "pain": Copy(label: "Fájdalom", question: "Fáj valami?", low: "Alig", high: "Nagyon", kind: .pain),
        "motivation": Copy(label: "Motiváció", question: "Mennyi kedved van a mai dolgaidhoz?", low: "Semmi", high: "Tele vagyok vele", kind: .scale),
        "hunger": Copy(label: "Éhség", question: "Mennyire vagy éhes most?", low: "Egyáltalán nem", high: "Nagyon", kind: .scale),
        "craving": Copy(label: "Sóvárgás", question: "Kívánsz most valamit?", low: "Nem", high: "Nagyon", kind: .craving),
        "digestion": Copy(label: "Emésztés", question: "Hogy érzi magát most a gyomrod?", low: "Nehéz, puffadt", high: "Könnyű, rendben", kind: .scale),
        "connection": Copy(label: "Kapcsolódás", question: "Mennyire érezted magad ma kapcsolódva másokhoz?", low: "Egyedül", high: "Nagyon", kind: .scale),
        "day": Copy(label: "A nap mérlege", question: "Milyen volt a napod összességében?", low: "Nagyon rossz", high: "Nagyon jó", kind: .scale),
    ]

    /// Backend `PainRegion`, in its order.
    static let painRegions: [QuestionOption] = [
        ("FEJ", "Fej"), ("NYAK", "Nyak"), ("VALL", "Váll"), ("KONYOK", "Könyök"), ("CSUKLO_KEZ", "Csukló, kéz"),
        ("FELSO_HAT", "Felső hát"), ("DEREK", "Derék"), ("CSIPO", "Csípő"), ("HAS", "Has"), ("TERD", "Térd"),
        ("BOKA_LABFEJ", "Boka, lábfej"), ("EGYEB", "Egyéb"),
    ].map { QuestionOption(id: $0.0, label: $0.1) }

    /// Backend `CravingKind`, in its order.
    static let cravingKinds: [QuestionOption] = [("EDES", "Édes"), ("SOS", "Sós"), ("ZSIROS", "Zsíros"), ("BARMIT", "Bármit")]
        .map { QuestionOption(id: $0.0, label: $0.1) }

    /// The items to ask: the core five always first, then the plan's question of the day. No cached plan, no
    /// adaptive item, an id this build does not know, or a core id → no question of the day (never a crash).
    public static func questions(plan: CheckInPlanLite?) -> [CheckInQuestion] {
        var out = core.map { item in
            CheckInQuestion(key: item.key, label: item.copy.label, question: item.copy.question, low: item.copy.low,
                            high: item.copy.high, kind: .scale, options: [], why: nil, isQuestionOfDay: false)
        }
        if let key = plan?.adaptiveItem, let copy = others[key] {
            let options: [QuestionOption] = switch copy.kind {
            case .pain: painRegions
            case .craving: cravingKinds
            case .scale: []
            }
            out.append(CheckInQuestion(key: key, label: "A nap kérdése", question: copy.question, low: copy.low,
                                       high: copy.high, kind: copy.kind, options: options, why: plan?.adaptiveWhy,
                                       isQuestionOfDay: true))
        }
        return out
    }

    /// Where an item's orb starts: the last answer given today (latest capture first), else 5. For pain that is the
    /// last intensity.
    public static func startValue(for key: String, checkIns: [LedgerCheckIn]) -> Int {
        for checkIn in checkIns.sorted(by: { $0.capturedAt > $1.capturedAt }) {
            if key == "pain", let intensity = checkIn.painIntensity { return intensity }
            if let value = checkIn.values[key] { return value }
        }
        return 5
    }
}
