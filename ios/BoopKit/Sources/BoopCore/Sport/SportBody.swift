import Foundation

// The Test tab's wire and reads (`mezo-r36n9.205`, spec §5.5): the week's muscle heat for gym, sport and the two
// together (`getSportBody`), six weeks of shoulder strain after sport (`getSportShoulder`), and the rest gap between
// the layers per day with Boop's hints (`getSportGaps`). Read-only; lenient decoding (a missing number is 0 / nil).

public struct SportMuscleHeat: Codable, Equatable, Sendable {
    public var muscle: String
    public var gymLoad: Int
    public var sportLoad: Int
    /// 0…1 of the week's top gym muscle.
    public var gym: Double
    /// 0…1 of the week's top sport muscle.
    public var sport: Double
    /// 0…1 of the week's top combined muscle.
    public var together: Double

    public init(muscle: String, gymLoad: Int = 0, sportLoad: Int = 0, gym: Double = 0, sport: Double = 0, together: Double = 0) {
        self.muscle = muscle; self.gymLoad = gymLoad; self.sportLoad = sportLoad; self.gym = gym; self.sport = sport
        self.together = together
    }

    enum CodingKeys: String, CodingKey { case muscle, gymLoad, sportLoad, gym, sport, together }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        muscle = try c.decode(String.self, forKey: .muscle)
        gymLoad = try c.decodeIfPresent(Int.self, forKey: .gymLoad) ?? 0
        sportLoad = try c.decodeIfPresent(Int.self, forKey: .sportLoad) ?? 0
        gym = try c.decodeIfPresent(Double.self, forKey: .gym) ?? 0
        sport = try c.decodeIfPresent(Double.self, forKey: .sport) ?? 0
        together = try c.decodeIfPresent(Double.self, forKey: .together) ?? 0
    }
}

/// `GET /api/train/sport/body`.
public struct SportBodyWeek: Codable, Equatable, Sendable {
    public var weekStart: String
    public var muscles: [SportMuscleHeat]
    public var sharedMuscles: Int
    public var shoulderAverage: Double?
    /// Sport sessions that add no heat (no effort, no length, or a kind with no muscle table).
    public var sportUnknown: Int

    public init(weekStart: String, muscles: [SportMuscleHeat] = [], sharedMuscles: Int = 0, shoulderAverage: Double? = nil,
                sportUnknown: Int = 0) {
        self.weekStart = weekStart; self.muscles = muscles; self.sharedMuscles = sharedMuscles
        self.shoulderAverage = shoulderAverage; self.sportUnknown = sportUnknown
    }

    enum CodingKeys: String, CodingKey { case weekStart, muscles, sharedMuscles, shoulderAverage, sportUnknown }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        weekStart = try c.decode(String.self, forKey: .weekStart)
        muscles = try c.decodeIfPresent([SportMuscleHeat].self, forKey: .muscles) ?? []
        sharedMuscles = try c.decodeIfPresent(Int.self, forKey: .sharedMuscles) ?? 0
        shoulderAverage = try c.decodeIfPresent(Double.self, forKey: .shoulderAverage)
        sportUnknown = try c.decodeIfPresent(Int.self, forKey: .sportUnknown) ?? 0
    }
}

public struct SportShoulderWeek: Codable, Equatable, Sendable {
    public var weekStart: String
    public var average: Double?
    public var sessions: Int
    public init(weekStart: String, average: Double? = nil, sessions: Int = 0) {
        self.weekStart = weekStart; self.average = average; self.sessions = sessions
    }
}

/// `GET /api/train/sport/shoulder`, oldest week first, ending with this week.
public struct SportShoulder: Codable, Equatable, Sendable {
    public var weeks: [SportShoulderWeek]
    public init(weeks: [SportShoulderWeek]) { self.weeks = weeks }
}

public struct SportBlock: Codable, Equatable, Sendable {
    public var layer: String
    public var sport: String?
    public var start: String
    public var end: String
    public var done: Bool
    public init(layer: String, sport: String? = nil, start: String, end: String, done: Bool = false) {
        self.layer = layer; self.sport = sport; self.start = start; self.end = end; self.done = done
    }
    public var isGym: Bool { layer == "GYM" }
}

public struct SportGapDay: Codable, Equatable, Sendable {
    public var date: String
    public var blocks: [SportBlock]
    /// Shortest rest between a gym and a sport block; nil unless both are on the day.
    public var gapHours: Double?
    public init(date: String, blocks: [SportBlock] = [], gapHours: Double? = nil) {
        self.date = date; self.blocks = blocks; self.gapHours = gapHours
    }
}

/// `GET /api/train/sport/gaps`.
public struct SportGaps: Codable, Equatable, Sendable {
    public var weekStart: String
    public var days: [SportGapDay]
    public var hints: [SportHint]
    public init(weekStart: String, days: [SportGapDay] = [], hints: [SportHint] = []) {
        self.weekStart = weekStart; self.days = days; self.hints = hints
    }
}

extension SportClient {
    public func body(week: String? = nil) async throws(PlanFetchError) -> SportBodyWeek {
        try await raw.get(week.map { "/api/train/sport/body?week=\($0)" } ?? "/api/train/sport/body", operationID: "getSportBody")
    }

    public func shoulder(weeks: Int = 6) async throws(PlanFetchError) -> SportShoulder {
        try await raw.get("/api/train/sport/shoulder?weeks=\(weeks)", operationID: "getSportShoulder")
    }

    public func gaps(week: String? = nil) async throws(PlanFetchError) -> SportGaps {
        try await raw.get(week.map { "/api/train/sport/gaps?week=\($0)" } ?? "/api/train/sport/gaps", operationID: "getSportGaps")
    }
}
