import Foundation

/// The Pénz L7 catalog, proposal and strategy calls (`mezo-r36n9.105`, `api/feature/penz/penz-proposals.yml`).
/// All online: a proposal is asked for while he watches, and an accept carries exactly the numbers he set.
extension PenzClient {
    // MARK: - Catalog

    /// Approved first, then suggested, then declined.
    public func catalog() async throws(PlanFetchError) -> [PenzProduct] {
        try await raw.get("/api/penz/catalog", operationID: "listPenzProducts")
    }

    public func approveProduct(id: String) async throws(PlanFetchError) -> PenzProduct {
        try await raw.get(method: .post, "/api/penz/catalog/\(id)/approve", operationID: "approvePenzProduct")
    }

    public func declineProduct(id: String) async throws(PlanFetchError) -> PenzProduct {
        try await raw.get(method: .post, "/api/penz/catalog/\(id)/decline", operationID: "declinePenzProduct")
    }

    // MARK: - Proposals

    /// Newest first; `status` filters (`proposed`, `accepted`, …).
    public func proposals(status: String? = nil) async throws(PlanFetchError) -> [PenzProposal] {
        try await raw.get("/api/penz/proposals" + (status.map { "?status=\($0)" } ?? ""), operationID: "listPenzProposals")
    }

    public func proposal(id: String) async throws(PlanFetchError) -> PenzProposal {
        try await raw.get("/api/penz/proposals/\(id)", operationID: "getPenzProposal")
    }

    public func createProposal(_ request: PenzProposalRequest) async throws(PlanFetchError) -> PenzProposal {
        try await raw.send(.post, "/api/penz/proposals", operationID: "createPenzProposal", body: request)
    }

    public func acceptProposal(id: String, _ request: PenzAcceptRequest) async throws(PlanFetchError) -> PenzProposal {
        try await raw.send(.post, "/api/penz/proposals/\(id)/accept", operationID: "acceptPenzProposal", body: request)
    }

    public func dismissProposal(id: String) async throws(PlanFetchError) -> PenzProposal {
        try await raw.get(method: .post, "/api/penz/proposals/\(id)/dismiss", operationID: "dismissPenzProposal")
    }

    public func setProposalStep(id: String, index: Int, done: Bool) async throws(PlanFetchError) -> PenzProposal {
        try await raw.send(.post, "/api/penz/proposals/\(id)/steps/\(index)", operationID: "setPenzProposalStep",
                           body: PenzStepRequest(done: done))
    }

    // MARK: - Strategy

    public func strategy(date: String? = nil) async throws(PlanFetchError) -> PenzStrategy {
        try await raw.get("/api/penz/strategy" + (date.map { "?date=\($0)" } ?? ""), operationID: "getPenzStrategy")
    }
}
