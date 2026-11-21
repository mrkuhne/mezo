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
}
