import Foundation

/// The Pénz L6 calls (`mezo-r36n9.104`, `api/feature/penz/penz-portfolio.yml`), on the same lenient `RawJSONClient`.
/// Every write is **online** and carries a `clientRef`: he watches the answer land (a refused symbol, a sell above
/// the position, an FX rate the server could not fetch), so none of them goes through the outbox.
extension PenzClient {
    // MARK: - Reads

    /// Pénzem for `date` (`YYYY-MM-DD`); nil = today on the server.
    public func portfolio(date: String? = nil) async throws(PlanFetchError) -> PenzPortfolio {
        try await raw.get("/api/penz/portfolio" + (date.map { "?date=\($0)" } ?? ""), operationID: "getPenzPortfolio")
    }

    /// The day's news digest; nil = today in his money timezone.
    public func digest(date: String? = nil) async throws(PlanFetchError) -> PenzDigest {
        try await raw.get("/api/penz/digest" + (date.map { "?date=\($0)" } ?? ""), operationID: "getPenzDigest")
    }

    public func holdings() async throws(PlanFetchError) -> [PenzHolding] {
        try await raw.get("/api/penz/holdings", operationID: "listPenzHoldings")
    }

    /// One holding's buys and sells, newest first.
    public func investTransactions(holdingId: String) async throws(PlanFetchError) -> [PenzInvestTxn] {
        try await raw.get("/api/penz/holdings/\(holdingId)/transactions", operationID: "listPenzInvestTransactions")
    }

    /// Events from `from` (default today), soonest first.
    public func holdingEvents(from: String? = nil) async throws(PlanFetchError) -> [PenzHoldingEvent] {
        try await raw.get("/api/penz/holding-events" + (from.map { "?from=\($0)" } ?? ""), operationID: "listPenzHoldingEvents")
    }

    // MARK: - Writes (online)

    /// Asks the server to rebuild today's digest in the background (202). At most every 15 minutes: a 429
    /// `PENZ_DIGEST_REFRESH_LIMITED` arrives as `.conflict("PENZ_DIGEST_REFRESH_LIMITED")`.
    public func refreshDigest() async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.post, "/api/penz/digest/refresh", operationID: "refreshPenzDigest")
    }

    public func createHolding(_ request: PenzHoldingRequest) async throws(PlanFetchError) -> PenzHolding {
        try await raw.send(.post, "/api/penz/holdings", operationID: "createPenzHolding", body: request)
    }

    public func updateHolding(id: String, _ request: PenzHoldingRequest) async throws(PlanFetchError) -> PenzHolding {
        try await raw.send(.put, "/api/penz/holdings/\(id)", operationID: "updatePenzHolding", body: request)
    }

    public func deleteHolding(id: String) async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.delete, "/api/penz/holdings/\(id)", operationID: "deletePenzHolding")
    }

    public func createInvestTransaction(_ request: PenzInvestTxnRequest) async throws(PlanFetchError) -> PenzInvestTxn {
        try await raw.send(.post, "/api/penz/invest-transactions", operationID: "createPenzInvestTransaction", body: request)
    }

    public func deleteInvestTransaction(id: String) async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.delete, "/api/penz/invest-transactions/\(id)", operationID: "deletePenzInvestTransaction")
    }

    public func createHoldingEvent(_ request: PenzHoldingEventRequest) async throws(PlanFetchError) -> PenzHoldingEvent {
        try await raw.send(.post, "/api/penz/holding-events", operationID: "createPenzHoldingEvent", body: request)
    }

    public func deleteHoldingEvent(id: String) async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.delete, "/api/penz/holding-events/\(id)", operationID: "deletePenzHoldingEvent")
    }
}
