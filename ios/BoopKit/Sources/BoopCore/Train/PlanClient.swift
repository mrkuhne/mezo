import Foundation

/// The block builder's and the weekly review's server calls (mezo-r36n9.83), over `RawJSONClient` — lenient wire
/// types, typed failures. Paths and operation ids are the contract's own (`api/feature/train/*.yml`).
public struct PlanClient: Sendable {
    let raw: RawJSONClient

    public init(raw: RawJSONClient) { self.raw = raw }

    /// The running block (else a planned one); nil when he has none — a real state, not a failure.
    public func runningBlock() async throws(PlanFetchError) -> WireBlock? {
        let blocks: [WireBlock] = try await raw.get("/api/train/mesocycles", operationID: "listMesocycles")
        return blocks.first { $0.status == "active" } ?? blocks.first { $0.status == "planned" }
    }

    public func catalog() async throws(PlanFetchError) -> [WireCatalogItem] {
        try await raw.get("/api/train/exercises", operationID: "getExerciseCatalog")
    }

    /// Read-only: where a draft stands against the bands. Nothing is saved.
    public func evaluate(_ request: WireEvaluateRequest) async throws(PlanFetchError) -> WireEvaluation {
        try await raw.send(.post, "/api/train/meso-plans/evaluate", operationID: "evaluateMesoPlan", body: request)
    }

    /// This week's weekly proposal first, then pending tier changes. Opening it generates the week's proposal when due.
    public func weekProposals(blockId: String) async throws(PlanFetchError) -> [WireProposal] {
        try await raw.get("/api/train/mesocycles/\(blockId)/week-proposals", operationID: "listWeekProposals")
    }

    public func decide(blockId: String, proposalId: String, _ request: WireDecisionRequest) async throws(PlanFetchError) -> WireProposal {
        try await raw.send(.post, "/api/train/mesocycles/\(blockId)/week-proposals/\(proposalId)/decisions",
                           operationID: "decideWeekProposal", body: request)
    }

    /// Full-list replace of one template day; the style fields omitted are carried over by the server.
    public func saveDay(blockId: String, dayId: String, _ exercises: [WireExerciseInput]) async throws(PlanFetchError) {
        let _: WireDay = try await raw.send(.put, "/api/train/mesocycles/\(blockId)/days/\(dayId)/exercises",
                                            operationID: "replaceDayExercises", body: exercises)
    }

    public func savePriorities(blockId: String, _ request: WirePrioritiesRequest) async throws(PlanFetchError) {
        let _: WireBlock = try await raw.send(.put, "/api/train/mesocycles/\(blockId)/muscle-priorities",
                                              operationID: "updateMesocycleMusclePriorities", body: request)
    }

    /// The running block's style, techniques switch and weekly review mode (absent = keep).
    public func saveSettings(blockId: String, _ request: WireSettingsRequest) async throws(PlanFetchError) -> WireBlock {
        try await raw.send(.put, "/api/train/mesocycles/\(blockId)/settings", operationID: "updateMesocycleSettings", body: request)
    }

    /// Add / swap suggestions for one day of the block, best fit first, each with the style's prescription (mezo-r36n9.116).
    /// Read-only; a 409 (`TRAIN_RUN_NOT_EDITABLE`) means the block is archived.
    public func suggestions(blockId: String, _ request: WireSuggestionsRequest) async throws(PlanFetchError) -> WireSuggestions {
        try await raw.send(.post, "/api/train/mesocycles/\(blockId)/exercise-suggestions",
                           operationID: "getBlockExerciseSuggestions", body: request)
    }

    // MARK: the new-block intake (mezo-r36n9.113)

    /// Ranked, flawless split candidates for the chosen days — read-only, no AI.
    public func candidates(_ request: WireCandidatesRequest) async throws(PlanFetchError) -> WireCandidates {
        try await raw.send(.post, "/api/train/meso-plans/candidates", operationID: "getMesoPlanCandidates", body: request)
    }

    /// The full plan for the chosen split (the AI picks the exercises). Nothing is saved.
    public func generate(_ request: WireGenerateRequest) async throws(PlanFetchError) -> WireGenerateResponse {
        try await raw.send(.post, "/api/train/meso-plans/generate", operationID: "generateMesoPlan", body: request)
    }

    /// Saves a template exactly as the server generated it; returns its id.
    public func createTemplate(_ template: WireTemplate) async throws(PlanFetchError) -> String {
        struct Created: Decodable { let id: String }
        let created: Created = try await raw.send(.post, "/api/train/meso-templates", operationID: "createMesoTemplate", body: template)
        return created.id
    }

    /// Starts a block from a template. A 409 `SEASON_REQUIRED` means no season covers the start date.
    public func startTemplate(id: String, startDate: String, status: String) async throws(PlanFetchError) -> WireBlock {
        try await raw.send(.post, "/api/train/meso-templates/\(id)/start", operationID: "startMesoTemplate",
                           body: WireTemplateStart(startDate: startDate, status: status))
    }

    /// Closes (archives) a block — idempotent on the server.
    public func closeBlock(id: String) async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.post, "/api/train/mesocycles/\(id)/close", operationID: "closeMesocycle")
    }

    /// Throws away a block that was never trained, with the template it came from when nothing else used it — no
    /// report, no AI review. A 409 `TRAIN_MESO_DISCARD_HAS_LOGS` means a workout was already logged in it.
    public func discardBlock(id: String) async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.post, "/api/train/mesocycles/\(id)/discard", operationID: "discardMesocycle")
    }
}
