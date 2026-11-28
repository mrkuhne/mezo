import Foundation

/// The Hét tab's calls (`mezo-r36n9.204`): the weekly rhythm (read + full replace), the one-off events and the six-week
/// load. They need the net; nothing here is queued on the phone.
extension SportClient {
    /// The recurring slots, day then time ascending.
    public func schedule() async throws(PlanFetchError) -> [SportSlot] {
        try await raw.get("/api/train/sport-schedule", operationID: "getSportSchedule")
    }

    /// Replaces the whole weekly rhythm with `slots` (the server soft-deletes the old ones). Returns what it saved.
    public func replaceSchedule(_ slots: [SportSlotInput]) async throws(PlanFetchError) -> [SportSlot] {
        try await raw.send(.put, "/api/train/sport-schedule", operationID: "replaceSportSchedule", body: slots)
    }

    /// The one-off events from `from` (`yyyy-MM-dd`) on, date then time ascending.
    public func events(from: String?) async throws(PlanFetchError) -> [SportEvent] {
        let path = from.map { "/api/train/sport-events?from=\($0)" } ?? "/api/train/sport-events"
        return try await raw.get(path, operationID: "listSportEvents")
    }

    public func createEvent(_ draft: SportEventDraft) async throws(PlanFetchError) -> SportEvent {
        try await raw.send(.post, "/api/train/sport-events", operationID: "createSportEvent", body: draft.body)
    }

    /// Deletes an event. Gone already counts as deleted.
    public func deleteEvent(id: String) async throws(PlanFetchError) {
        do {
            _ = try await raw.sendRaw(.delete, "/api/train/sport-events/\(id)", operationID: "deleteSportEvent")
        } catch .notFound {
            return
        }
    }

    /// Sport and gym load per week on one scale, oldest first, ending with this week.
    public func load(weeks: Int = 6) async throws(PlanFetchError) -> SportLoad {
        try await raw.get("/api/train/sport/load?weeks=\(weeks)", operationID: "getSportLoad")
    }
}
