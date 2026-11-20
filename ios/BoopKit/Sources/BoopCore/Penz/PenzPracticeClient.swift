import Foundation

/// The Pénz L7 practice calls (`mezo-r36n9.105`, `api/feature/penz/penz-practice.yml`), on the lenient `RawJSONClient`.
/// Every write is **online** and he watches it land: the cap refusal (422 `PENZ_PRACTICE_CAP_EXCEEDED`), a stop on the
/// wrong side, a wrong transition are said in his words, and what he typed is kept.
extension PenzClient {
    // MARK: - Reads

    /// The Gyakorlás tab for `date` (`YYYY-MM-DD`); nil = today on the server.
    public func practice(date: String? = nil) async throws(PlanFetchError) -> PenzPracticeOverview {
        try await raw.get("/api/penz/practice" + (date.map { "?date=\($0)" } ?? ""), operationID: "getPenzPractice")
    }

    /// The full journal, newest first.
    public func practiceTrades(from: String? = nil, to: String? = nil) async throws(PlanFetchError) -> [PenzPaperTrade] {
        let query = [from.map { "from=\($0)" }, to.map { "to=\($0)" }].compactMap { $0 }.joined(separator: "&")
        return try await raw.get("/api/penz/practice/trades" + (query.isEmpty ? "" : "?" + query),
                                 operationID: "listPenzPaperTrades")
    }

    // MARK: - Writes (online)

    public func createTrade(_ request: PenzTradeRequest) async throws(PlanFetchError) -> PenzPaperTrade {
        try await raw.send(.post, "/api/penz/practice/trades", operationID: "createPenzPaperTrade", body: request)
    }

    public func updateTrade(id: String, _ request: PenzTradeRequest) async throws(PlanFetchError) -> PenzPaperTrade {
        try await raw.send(.put, "/api/penz/practice/trades/\(id)", operationID: "updatePenzPaperTrade", body: request)
    }

    public func openTrade(id: String, _ request: PenzTradeOpenRequest) async throws(PlanFetchError) -> PenzPaperTrade {
        try await raw.send(.post, "/api/penz/practice/trades/\(id)/open", operationID: "openPenzPaperTrade", body: request)
    }

    public func closeTrade(id: String, _ request: PenzTradeCloseRequest) async throws(PlanFetchError) -> PenzPaperTrade {
        try await raw.send(.post, "/api/penz/practice/trades/\(id)/close", operationID: "closePenzPaperTrade", body: request)
    }

    public func recordLastClose(id: String, _ request: PenzLastCloseRequest) async throws(PlanFetchError) -> PenzPaperTrade {
        try await raw.send(.post, "/api/penz/practice/trades/\(id)/last-close", operationID: "recordPenzPaperTradeLastClose",
                           body: request)
    }

    public func cancelTrade(id: String) async throws(PlanFetchError) -> PenzPaperTrade {
        try await raw.get(method: .post, "/api/penz/practice/trades/\(id)/cancel", operationID: "cancelPenzPaperTrade")
    }

    public func deleteTrade(id: String) async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.delete, "/api/penz/practice/trades/\(id)", operationID: "deletePenzPaperTrade")
    }
}
