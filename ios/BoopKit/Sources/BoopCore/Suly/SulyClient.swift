import Foundation

/// The Súly room's two reads over the lenient JSON caller (`RawJSONClient`, the Pénz / Évad way): the smoothed trend
/// and the weigh-ins. Paths and operation ids are the contract's own (`api/feature/weight/weight.yml`). Nothing here
/// writes — a weigh-in goes through the outbox (`OutboxKind.weightLog`).
public struct SulyClient: Sendable {
    let raw: RawJSONClient

    public init(raw: RawJSONClient) { self.raw = raw }

    /// The EWMA trend with its weekly rates and how much data backs it.
    public func trend() async throws(PlanFetchError) -> SulyTrend {
        try await raw.get("/api/biometrics/weight/trend", operationID: "getWeightTrend")
    }

    /// Every weigh-in, date ascending.
    public func logs() async throws(PlanFetchError) -> [SulyLog] {
        try await raw.get("/api/biometrics/weight", operationID: "listWeightLogs")
    }
}
