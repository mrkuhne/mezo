import Foundation

/// The Sport area's calls over the lenient JSON caller (`RawJSONClient`, the Pénz / Súly way). Reads the week; skips
/// and takes a skip back. A session log is not here: it goes through the outbox (`OutboxKind.sportSession`), so it
/// works without the net.
public struct SportClient: Sendable {
    let raw: RawJSONClient

    public init(raw: RawJSONClient) { self.raw = raw }

    /// One Monday–Sunday week of both layers; `week` is any date of it (`yyyy-MM-dd`), nil = this week.
    public func overview(week: String? = nil) async throws(PlanFetchError) -> SportOverview {
        let path = week.map { "/api/train/sport/overview?week=\($0)" } ?? "/api/train/sport/overview"
        return try await raw.get(path, operationID: "getSportOverview")
    }

    /// Skips today's sport occurrence. The server keys a sport skip on the legacy weekday (0 = hétfő) and the start.
    public func skip(date: String, time: String?, reason: SportSkipReason) async throws(PlanFetchError) -> SportSkipResponse {
        let body = SportSkipRequest(date: date, dayOfWeek: sportLegacyWeekday(date), time: time, reasonCategory: reason.rawValue)
        return try await raw.send(.put, "/api/train/skips", operationID: "upsertPlannedSkip", body: body)
    }

    /// Takes a skip back: the occurrence is planned again. Gone already counts as undone.
    public func undoSkip(id: String) async throws(PlanFetchError) {
        do {
            _ = try await raw.sendRaw(.delete, "/api/train/skips/\(id)", operationID: "undoPlannedSkip")
        } catch .notFound {
            return
        }
    }
}

/// The server's legacy sport weekday for a `yyyy-MM-dd` date: 0 = hétfő … 6 = vasárnap; nil for an unreadable date.
public func sportLegacyWeekday(_ ymd: String) -> Int? {
    guard let date = sportDate(ymd) else { return nil }
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "UTC")!
    return (cal.component(.weekday, from: date) + 5) % 7
}

/// A `yyyy-MM-dd` day as a UTC midnight (only ever used for weekday and day arithmetic).
func sportDate(_ ymd: String) -> Date? {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd"
    return f.date(from: ymd)
}
