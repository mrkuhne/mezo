import Foundation

/// The day capacity's server calls (B7 K2, `mezo-r36n9.17`), over the lenient JSON caller (`RawJSONClient`): typed
/// failures (`PlanFetchError`). Paths and operation ids are the contract's own (`api/feature/capacity/capacity.yml`).
///
/// Nothing here moves anything: `feedback` only stores his label of how an event felt; the server re-scores the event
/// and the next brief reflects it. No model call behind it.
public struct KapacitasClient: Sendable {
    let raw: RawJSONClient

    public init(raw: RawJSONClient) { self.raw = raw }

    /// His label for one calendar event (`eventKey` = the brief's demand-item key; `effect` drains | neutral | feeds).
    /// 204 on success; a bad key or effect is `.rejected`.
    public func feedback(eventKey: String, effect: String) async throws(PlanFetchError) {
        let data: Data
        do { data = try PlanJSON.encoder.encode(KapacitasFeedbackBody(eventKey: eventKey, effect: effect)) } catch { throw .server }
        _ = try await raw.sendRaw(.put, "/api/capacity/event-feedback", operationID: "putCapacityEventFeedback", body: data)
    }

    public func feedback(eventKey: String, effect: KapacitasEffect) async throws(PlanFetchError) {
        try await feedback(eventKey: eventKey, effect: effect.rawValue)
    }

    /// The season's weekly load against recovery. `.notFound` = no active season (the Évad block is left out).
    public func season() async throws(PlanFetchError) -> KapacitasSeasonLoad {
        try await raw.get("/api/capacity/season", operationID: "getCapacitySeason")
    }

    // MARK: - Átrendezés (K3)

    /// The week of `monday` (yyyy-MM-dd): day verdicts, proposals, ledger rows. The current or next week gets its
    /// proposals generated on this read.
    public func week(monday: String) async throws(PlanFetchError) -> KapacitasWeek {
        try await raw.get("/api/capacity/week?monday=\(monday)", operationID: "getCapacityWeek")
    }

    /// „Kérek más javaslatot": open proposals are replaced; accepted and declined ones stay.
    public func regenerate(monday: String) async throws(PlanFetchError) -> KapacitasWeek {
        let data = try await raw.sendRaw(.post, "/api/capacity/proposals/regenerate?monday=\(monday)",
                                         operationID: "regenerateCapacityProposals")
        do { return try PlanJSON.decoder.decode(KapacitasWeek.self, from: data) } catch { throw .server }
    }

    /// Accepts a proposal; the same `clientRef` again returns the rows already written. 409 `.conflict(code)` for a
    /// stale proposal, a started day or a reused key.
    @discardableResult
    public func accept(proposalId: String, clientRef: String) async throws(PlanFetchError) -> [KapacitasAdjustment] {
        try await raw.send(.post, "/api/capacity/proposals/\(proposalId)/accept", operationID: "acceptCapacityProposal",
                           body: KapacitasAcceptBody(clientRef: clientRef))
    }

    /// „Most nem": nothing moves.
    @discardableResult
    public func decline(proposalId: String) async throws(PlanFetchError) -> KapacitasProposal {
        let data = try await raw.sendRaw(.post, "/api/capacity/proposals/\(proposalId)/decline",
                                         operationID: "declineCapacityProposal")
        do { return try PlanJSON.decoder.decode(KapacitasProposal.self, from: data) } catch { throw .server }
    }

    /// „vissza" on an accepted card: undoes the whole bundle the row belongs to.
    public func undo(adjustmentId: String) async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.delete, "/api/capacity/adjustments/\(adjustmentId)", operationID: "undoCapacityAdjustment")
    }
}
