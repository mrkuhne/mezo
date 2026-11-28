import Foundation

// The Napló tab's wire and calls (`mezo-r36n9.205`, spec §5.4): the logged sessions (`listSportSessions`), and a
// correction (`updateSportSession`) or a delete (`deleteSportSession`). These need the net; a new log still goes
// through the outbox (`OutboxKind.sportSession`).

/// One logged session as `GET /api/train/sport-sessions` returns it. Lenient: a missing optional field is nil.
public struct SportSessionRecord: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var sport: String
    public var date: String
    public var time: String?
    /// Minutes (the server's `duration`).
    public var duration: Int?
    public var setsPlayed: Int?
    public var rounds: Int?
    public var rpe: Double?
    public var shoulderStrain: Int?
    public var notes: String?
    public var kcal: Int?
    /// true = the server's estimate; false = a measured number (the watch's, given at logging).
    public var kcalIsEstimate: Bool?

    public init(id: String, sport: String, date: String, time: String? = nil, duration: Int? = nil, setsPlayed: Int? = nil,
                rounds: Int? = nil, rpe: Double? = nil, shoulderStrain: Int? = nil, notes: String? = nil, kcal: Int? = nil,
                kcalIsEstimate: Bool? = nil) {
        self.id = id; self.sport = sport; self.date = date; self.time = time; self.duration = duration
        self.setsPlayed = setsPlayed; self.rounds = rounds; self.rpe = rpe; self.shoulderStrain = shoulderStrain
        self.notes = notes; self.kcal = kcal; self.kcalIsEstimate = kcalIsEstimate
    }

    enum CodingKeys: String, CodingKey {
        case id, sport, date, time, duration, setsPlayed, rounds, rpe, shoulderStrain, notes, kcal, kcalIsEstimate
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        sport = try c.decodeIfPresent(String.self, forKey: .sport) ?? "other"
        date = try c.decode(String.self, forKey: .date)
        time = try c.decodeIfPresent(String.self, forKey: .time)
        duration = try c.decodeIfPresent(Int.self, forKey: .duration)
        setsPlayed = try c.decodeIfPresent(Int.self, forKey: .setsPlayed)
        rounds = try c.decodeIfPresent(Int.self, forKey: .rounds)
        rpe = try c.decodeIfPresent(Double.self, forKey: .rpe)
        shoulderStrain = try c.decodeIfPresent(Int.self, forKey: .shoulderStrain)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        kcal = try c.decodeIfPresent(Int.self, forKey: .kcal)
        kcalIsEstimate = try c.decodeIfPresent(Bool.self, forKey: .kcalIsEstimate)
    }

    public var kind: SportKind { SportKind(wire: sport) }

    /// Session-RPE × minutes (the server's load rule); nil when either is unknown.
    public var load: Int? {
        guard let rpe, let duration, duration > 0 else { return nil }
        return Int((rpe * Double(duration)).rounded())
    }
}

/// `PUT /api/train/sport-sessions/{id}`: every editable field again. Date and time stay as stored (not sent).
public struct SportSessionEdit: Encodable, Equatable, Sendable {
    public var sport: String
    public var duration: Int
    public var setsPlayed: Int?
    public var rounds: Int?
    public var rpe: Double
    public var shoulderStrain: Int?
    public var notes: String?
    /// A measured kcal kept as it was; nil = the server estimates again.
    public var kcalOverride: Int?

    public init(sport: String, duration: Int, setsPlayed: Int? = nil, rounds: Int? = nil, rpe: Double, shoulderStrain: Int? = nil,
                notes: String? = nil, kcalOverride: Int? = nil) {
        self.sport = sport; self.duration = duration; self.setsPlayed = setsPlayed; self.rounds = rounds; self.rpe = rpe
        self.shoulderStrain = shoulderStrain; self.notes = notes; self.kcalOverride = kcalOverride
    }

    /// The correction of `record` with what the sheet now shows. Sets and shoulder only for a kind that has them; the
    /// rounds of a cross/TRX session stay; a measured kcal is kept unless the length changed (then it is estimated).
    public static func of(_ record: SportSessionRecord, kind: SportKind, minutes: Int, rpe: Int, sets: Int, shoulder: Int,
                          note: String) -> SportSessionEdit {
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let measured = record.kcalIsEstimate == false && record.duration == minutes && record.kind == kind
        return SportSessionEdit(sport: kind.rawValue, duration: minutes,
                                setsPlayed: kind.hasSetsAndShoulder ? sets : nil,
                                rounds: kind == record.kind ? record.rounds : nil,
                                rpe: Double(rpe),
                                shoulderStrain: kind.hasSetsAndShoulder ? shoulder : nil,
                                notes: trimmed.isEmpty ? nil : trimmed,
                                kcalOverride: measured ? record.kcal : nil)
    }
}

extension SportClient {
    /// The logged sessions in `from…to` (inclusive, `yyyy-MM-dd`), newest first.
    public func sessions(from: String, to: String) async throws(PlanFetchError) -> [SportSessionRecord] {
        try await raw.get("/api/train/sport-sessions?from=\(from)&to=\(to)", operationID: "listSportSessions")
    }

    /// Corrects a session; returns it as the server stored it.
    public func updateSession(id: String, _ edit: SportSessionEdit) async throws(PlanFetchError) -> SportSessionRecord {
        try await raw.send(.put, "/api/train/sport-sessions/\(id)", operationID: "updateSportSession", body: edit)
    }

    /// Deletes a session. Gone already counts as deleted.
    public func deleteSession(id: String) async throws(PlanFetchError) {
        do {
            _ = try await raw.sendRaw(.delete, "/api/train/sport-sessions/\(id)", operationID: "deleteSportSession")
        } catch .notFound {
            return
        }
    }
}
