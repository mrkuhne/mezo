import Foundation

// The Sport area's weekly rhythm, one-off events and six-week load (`mezo-r36n9.204`), decoded by hand and leniently.
// Contract: `api/openapi.yml` `getSportSchedule` / `replaceSportSchedule` / `listSportEvents` / `createSportEvent` /
// `deleteSportEvent` / `getSportLoad`.

/// One recurring weekly slot (`SportScheduleSlotResponse`). Editable in the slot sheet; `id` is nil for a new one.
public struct SportSlot: Codable, Equatable, Sendable, Identifiable {
    public var id: String?
    /// 0 = hétfő … 6 = vasárnap.
    public var dayOfWeek: Int
    /// „HH:mm".
    public var time: String
    public var durationMin: Int
    /// `training` or `match`.
    public var kind: String
    public var location: String?
    /// Kept as the server has it: the phone never edits it, the full replace sends it back.
    public var intensityLabel: String?
    public var sport: String

    public init(id: String? = nil, dayOfWeek: Int, time: String, durationMin: Int, kind: String = "training",
                location: String? = nil, intensityLabel: String? = nil, sport: String = "volleyball") {
        self.id = id; self.dayOfWeek = dayOfWeek; self.time = time; self.durationMin = durationMin; self.kind = kind
        self.location = location; self.intensityLabel = intensityLabel; self.sport = sport
    }

    enum CodingKeys: String, CodingKey { case id, dayOfWeek, time, durationMin, kind, location, intensityLabel, sport }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        dayOfWeek = try c.decodeIfPresent(Int.self, forKey: .dayOfWeek) ?? 0
        time = try c.decodeIfPresent(String.self, forKey: .time) ?? "18:00"
        durationMin = try c.decodeIfPresent(Int.self, forKey: .durationMin) ?? 90
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? "training"
        location = try c.decodeIfPresent(String.self, forKey: .location)
        intensityLabel = try c.decodeIfPresent(String.self, forKey: .intensityLabel)
        sport = try c.decodeIfPresent(String.self, forKey: .sport) ?? "volleyball"
    }

    public var sportKind: SportKind { SportKind(wire: sport) }
    public var isMatch: Bool { kind == "match" }

    /// The slot as the full-replace body carries it: every field the server has, the id left out.
    public var input: SportSlotInput {
        SportSlotInput(dayOfWeek: dayOfWeek, time: time, durationMin: durationMin, kind: kind,
                       location: location.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 },
                       intensityLabel: intensityLabel, sport: sport)
    }
}

/// `SportScheduleSlotInput`: one element of the full-replace `PUT /api/train/sport-schedule`.
public struct SportSlotInput: Codable, Equatable, Sendable {
    public var dayOfWeek: Int
    public var time: String
    public var durationMin: Int
    public var kind: String
    public var location: String?
    public var intensityLabel: String?
    public var sport: String
}

/// One dated one-off event (`SportEventResponse`).
public struct SportEvent: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var date: String
    public var time: String
    public var durationMin: Int
    public var kind: String
    public var sport: String
    public var location: String?
    public var intensityLabel: String?

    public init(id: String, date: String, time: String, durationMin: Int, kind: String = "training", sport: String = "volleyball",
                location: String? = nil, intensityLabel: String? = nil) {
        self.id = id; self.date = date; self.time = time; self.durationMin = durationMin; self.kind = kind; self.sport = sport
        self.location = location; self.intensityLabel = intensityLabel
    }

    enum CodingKeys: String, CodingKey { case id, date, time, durationMin, kind, sport, location, intensityLabel }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        date = try c.decode(String.self, forKey: .date)
        time = try c.decodeIfPresent(String.self, forKey: .time) ?? "09:00"
        durationMin = try c.decodeIfPresent(Int.self, forKey: .durationMin) ?? 90
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? "training"
        sport = try c.decodeIfPresent(String.self, forKey: .sport) ?? "volleyball"
        location = try c.decodeIfPresent(String.self, forKey: .location)
        intensityLabel = try c.decodeIfPresent(String.self, forKey: .intensityLabel)
    }

    public var sportKind: SportKind { SportKind(wire: sport) }
    public var isMatch: Bool { kind == "match" }
}

/// `SportEventCreateRequest`: what the event sheet sends.
public struct SportEventDraft: Codable, Equatable, Sendable {
    public var date: String
    public var time: String
    public var durationMin: Int
    public var kind: String
    public var sport: String
    public var location: String?

    public init(date: String, time: String = "09:00", durationMin: Int = 120, kind: String = "match", sport: String = "volleyball",
                location: String? = nil) {
        self.date = date; self.time = time; self.durationMin = durationMin; self.kind = kind; self.sport = sport
        self.location = location
    }

    public var sportKind: SportKind { SportKind(wire: sport) }

    /// The body as sent: an empty place is left out.
    var body: SportEventDraft {
        var b = self
        b.location = location.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
        return b
    }
}

/// One week of `GET /api/train/sport/load`: sport and gym on one scale (RPE × minutes).
public struct SportLoadWeek: Codable, Equatable, Sendable {
    public var weekStart: String
    public var sportLoad: Int
    public var gymLoad: Int
    public var sportSessions: Int
    public var gymSessions: Int
    public var sportUnknown: Int
    public var gymUnknown: Int

    public init(weekStart: String, sportLoad: Int = 0, gymLoad: Int = 0, sportSessions: Int = 0, gymSessions: Int = 0,
                sportUnknown: Int = 0, gymUnknown: Int = 0) {
        self.weekStart = weekStart; self.sportLoad = sportLoad; self.gymLoad = gymLoad; self.sportSessions = sportSessions
        self.gymSessions = gymSessions; self.sportUnknown = sportUnknown; self.gymUnknown = gymUnknown
    }

    enum CodingKeys: String, CodingKey { case weekStart, sportLoad, gymLoad, sportSessions, gymSessions, sportUnknown, gymUnknown }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        weekStart = try c.decode(String.self, forKey: .weekStart)
        sportLoad = try c.decodeIfPresent(Int.self, forKey: .sportLoad) ?? 0
        gymLoad = try c.decodeIfPresent(Int.self, forKey: .gymLoad) ?? 0
        sportSessions = try c.decodeIfPresent(Int.self, forKey: .sportSessions) ?? 0
        gymSessions = try c.decodeIfPresent(Int.self, forKey: .gymSessions) ?? 0
        sportUnknown = try c.decodeIfPresent(Int.self, forKey: .sportUnknown) ?? 0
        gymUnknown = try c.decodeIfPresent(Int.self, forKey: .gymUnknown) ?? 0
    }
}

public struct SportLoad: Codable, Equatable, Sendable {
    public var weeks: [SportLoadWeek]
    public init(weeks: [SportLoadWeek]) { self.weeks = weeks }
}
