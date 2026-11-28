import Foundation

// The Sport area's server shapes (`mezo-r36n9.203`), decoded by hand and leniently: enums stay strings so a value the
// server adds later never breaks the room. Contract: `api/feature/train/train-sport.yml` (S2, `mezo-r36n9.202`).

/// The sports the server knows (`SportSessionCreateRequest.sport`). Unknown kinds fall back to `.other`.
public enum SportKind: String, CaseIterable, Codable, Sendable {
    case volleyball, running, cross, trx, bike, swim, football, basketball, tennis, hike, other

    public init(wire: String?) { self = SportKind(rawValue: wire?.lowercased() ?? "") ?? .other }

    /// The sport's full name — the hero's title, the log sheet's chips.
    public var name: String {
        switch self {
        case .volleyball: "Röplabda"
        case .running: "Futás"
        case .cross: "Cross"
        case .trx: "TRX"
        case .bike: "Kerékpár"
        case .swim: "Úszás"
        case .football: "Foci"
        case .basketball: "Kosár"
        case .tennis: "Tenisz"
        case .hike: "Túra"
        case .other: "Sport"
        }
    }

    /// The everyday short name inside a sentence and on the small cards („röpi").
    public var short: String {
        switch self {
        case .volleyball: "Röpi"
        case .other: "Sport"
        default: name
        }
    }

    /// Lower-case, for the middle of a sentence („Ma este röpi").
    public var inSentence: String { self == .trx ? "TRX" : short.lowercased() }

    /// Volleyball is the one with sets and a shoulder to watch.
    public var hasSetsAndShoulder: Bool { self == .volleyball }

    /// The log sheet's chips, in the spike's order, then the rest.
    public static let chips: [SportKind] = [.volleyball, .running, .cross, .trx, .bike, .swim, .football, .basketball,
                                            .tennis, .hike, .other]
}

public struct SportLaneItem: Codable, Equatable, Sendable {
    public var layer: String
    public var sport: String?
    public var label: String?
    public var time: String?
    public var durationMin: Int?
    public var state: String
    public var load: Int?
    public var skipId: String?
    public init(layer: String, sport: String? = nil, label: String? = nil, time: String? = nil, durationMin: Int? = nil,
                state: String, load: Int? = nil, skipId: String? = nil) {
        self.layer = layer; self.sport = sport; self.label = label; self.time = time; self.durationMin = durationMin
        self.state = state; self.load = load; self.skipId = skipId
    }
    public var done: Bool { state == "DONE" }
    public var kind: SportKind { SportKind(wire: sport) }
}

public struct SportWeekDay: Codable, Equatable, Sendable {
    public var date: String
    public var gym: [SportLaneItem]
    public var sport: [SportLaneItem]
    public init(date: String, gym: [SportLaneItem] = [], sport: [SportLaneItem] = []) { self.date = date; self.gym = gym; self.sport = sport }
}

public struct SportWeekTotals: Codable, Equatable, Sendable {
    public var gymMinutes: Int
    public var sportMinutes: Int
    public var movementMinutes: Int
    public var gymSessions: Int
    public var sportSessions: Int
    public init(gymMinutes: Int = 0, sportMinutes: Int = 0, movementMinutes: Int = 0, gymSessions: Int = 0, sportSessions: Int = 0) {
        self.gymMinutes = gymMinutes; self.sportMinutes = sportMinutes; self.movementMinutes = movementMinutes
        self.gymSessions = gymSessions; self.sportSessions = sportSessions
    }
}

public struct SportWeekCount: Codable, Equatable, Sendable {
    public var done: Int
    public var planned: Int
    public init(done: Int, planned: Int) { self.done = done; self.planned = planned }
}

/// A workout the Watch / Health recorded: the log's pre-fill.
public struct SportHealthWorkout: Codable, Equatable, Sendable {
    public var activityType: String
    /// ISO-8601 instant, kept as text (the lenient decoder has no date strategy).
    public var start: String
    public var minutes: Int
    public var kcal: Int?
    public var avgHr: Int?
    public init(activityType: String, start: String, minutes: Int, kcal: Int? = nil, avgHr: Int? = nil) {
        self.activityType = activityType; self.start = start; self.minutes = minutes; self.kcal = kcal; self.avgHr = avgHr
    }
}

public struct SportLoggedSession: Codable, Equatable, Sendable {
    public var id: String
    public var sport: String
    public var durationMin: Int?
    public var rpe: Double?
    public var load: Int?
    public var kcal: Int?
    public var setsPlayed: Int?
    public var shoulderStrain: Int?
    public init(id: String, sport: String, durationMin: Int? = nil, rpe: Double? = nil, load: Int? = nil, kcal: Int? = nil,
                setsPlayed: Int? = nil, shoulderStrain: Int? = nil) {
        self.id = id; self.sport = sport; self.durationMin = durationMin; self.rpe = rpe; self.load = load; self.kcal = kcal
        self.setsPlayed = setsPlayed; self.shoulderStrain = shoulderStrain
    }
}

public struct SportSkipInfo: Codable, Equatable, Sendable {
    public var id: String
    public var reason: String
    public var reasonText: String?
    public var freePass: Bool
    public var serious: Bool
    public init(id: String, reason: String, reasonText: String? = nil, freePass: Bool = false, serious: Bool = false) {
        self.id = id; self.reason = reason; self.reasonText = reasonText; self.freePass = freePass; self.serious = serious
    }
}

/// Today's sport: BEFORE · RECORDED (the Watch has it, no log yet) · DONE · SKIPPED.
public struct SportTonight: Codable, Equatable, Sendable {
    public var sport: String
    public var time: String?
    public var durationMin: Int?
    public var kind: String?
    public var location: String?
    public var moment: String
    public var startsInMinutes: Int?
    public var health: SportHealthWorkout?
    public var session: SportLoggedSession?
    public var skip: SportSkipInfo?
    public init(sport: String, time: String? = nil, durationMin: Int? = nil, kind: String? = nil, location: String? = nil,
                moment: String, startsInMinutes: Int? = nil, health: SportHealthWorkout? = nil,
                session: SportLoggedSession? = nil, skip: SportSkipInfo? = nil) {
        self.sport = sport; self.time = time; self.durationMin = durationMin; self.kind = kind; self.location = location
        self.moment = moment; self.startsInMinutes = startsInMinutes; self.health = health; self.session = session; self.skip = skip
    }
    public var sportKind: SportKind { SportKind(wire: sport) }
}

public struct SportHint: Codable, Equatable, Sendable {
    public var key: String
    public var date: String
    public var severity: String
    public var sport: String?
    public var gapHours: Double?
    public var heavy: Bool?
    public var pairs: Int?
    public init(key: String, date: String, severity: String = "INFO", sport: String? = nil, gapHours: Double? = nil,
                heavy: Bool? = nil, pairs: Int? = nil) {
        self.key = key; self.date = date; self.severity = severity; self.sport = sport; self.gapHours = gapHours
        self.heavy = heavy; self.pairs = pairs
    }
}

/// `GET /api/train/sport/overview`: one Monday–Sunday week of both layers.
public struct SportOverview: Codable, Equatable, Sendable {
    public var weekStart: String
    public var weekEnd: String
    public var today: String
    public var days: [SportWeekDay]
    public var totals: SportWeekTotals
    public var weekCount: SportWeekCount?
    public var tonight: SportTonight?
    public var hints: [SportHint]
    public init(weekStart: String, weekEnd: String, today: String, days: [SportWeekDay], totals: SportWeekTotals = .init(),
                weekCount: SportWeekCount? = nil, tonight: SportTonight? = nil, hints: [SportHint] = []) {
        self.weekStart = weekStart; self.weekEnd = weekEnd; self.today = today; self.days = days; self.totals = totals
        self.weekCount = weekCount; self.tonight = tonight; self.hints = hints
    }

    public var todayDay: SportWeekDay? { days.first { $0.date == today } }
}

/// The skip reasons of the sheet, in the spike's order, with the server's category.
public enum SportSkipReason: String, CaseIterable, Sendable {
    case ILLNESS, STOMACH, INJURY, TRAVEL, TIRED, NO_TIME, NO_MOOD, OTHER

    public init?(wire: String) { self.init(rawValue: wire) }

    /// The sheet's chip („Fáradt vagyok").
    public var label: String {
        switch self {
        case .ILLNESS: "Beteg vagyok"
        case .STOMACH: "Gyomorpanasz"
        case .INJURY: "Sérülés"
        case .TRAVEL: "Utazom"
        case .TIRED: "Fáradt vagyok"
        case .NO_TIME: "Nincs időm"
        case .NO_MOOD: "Nincs kedvem"
        case .OTHER: "Egyéb"
        }
    }

    /// The hero's chip after the skip („Fáradt voltam").
    public var pastLabel: String {
        switch self {
        case .ILLNESS: "Beteg voltam"
        case .STOMACH: "Gyomorpanasz"
        case .INJURY: "Sérülés"
        case .TRAVEL: "Utazom"
        case .TIRED: "Fáradt voltam"
        case .NO_TIME: "Nem volt időm"
        case .NO_MOOD: "Nem volt kedvem"
        case .OTHER: "Egyéb"
        }
    }

    /// The head's sentence opening („Fáradt voltál.").
    public var sentence: String {
        switch self {
        case .ILLNESS: "Beteg vagy."
        case .STOMACH: "Gyomorpanaszod van."
        case .INJURY: "Sérült vagy."
        case .TRAVEL: "Utazol."
        case .TIRED: "Fáradt voltál."
        case .NO_TIME: "Nem volt időd."
        case .NO_MOOD: "Nem volt kedved."
        case .OTHER: "Más dolgod volt."
        }
    }
}

/// `PUT /api/train/skips` for a sport occurrence.
struct SportSkipRequest: Encodable {
    let date: String
    let kind = "SPORT"
    let dayOfWeek: Int?
    let time: String?
    let reasonCategory: String
}

/// The bits of `PlannedSkipResponse` the room needs.
public struct SportSkipResponse: Decodable, Equatable, Sendable {
    public let id: String
    public let reasonCategory: String
    public let freePass: Bool
    public let serious: Bool
}
