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

    /// The draft week's missing complementary movements (coverage hints, mezo-r36n9.114): 0..3 findings, each with at
    /// most one proposed exercise on a named weekday. Read-only advice; a 409 means the block is archived.
    public func coverage(blockId: String, days: [WireCoverageDay]) async throws(PlanFetchError) -> WireCoverage {
        try await raw.send(.post, "/api/train/mesocycles/\(blockId)/coverage", operationID: "getBlockCoverage",
                           body: WireCoverageRequest(days: days))
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

    /// Starts a block from a template. A 409 `SEASON_REQUIRED` means no season covers the start date. `yearBlockId`
    /// names the Éves terv block this run starts; an id the server cannot use falls back to its ±14-day rule.
    public func startTemplate(id: String, startDate: String, status: String,
                              yearBlockId: String? = nil) async throws(PlanFetchError) -> WireBlock {
        try await raw.send(.post, "/api/train/meso-templates/\(id)/start", operationID: "startMesoTemplate",
                           body: WireTemplateStart(startDate: startDate, status: status, yearBlockId: yearBlockId))
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

    // MARK: the Éves terv (mezo-r36n9.113)

    /// The proposed year: rotation, re-dated layout and warnings. Nothing is saved.
    public func yearPlanPreview(_ request: WireYearPlanRequest) async throws(PlanFetchError) -> WireYearPlan {
        try await raw.send(.post, "/api/train/year-plans/preview", operationID: "previewYearPlan", body: request)
    }

    /// Creates the active plan. A 409 `TRAIN_YEAR_PLAN_ACTIVE_EXISTS` means one is active and `replaceActive` was not set.
    public func createYearPlan(_ request: WireYearPlanRequest) async throws(PlanFetchError) -> WireYearPlan {
        try await raw.send(.post, "/api/train/year-plans", operationID: "createYearPlan", body: request)
    }

    /// The active plan, re-dated against today; nil when he has none (404 `TRAIN_YEAR_PLAN_NONE`) — a state, not a failure.
    public func activeYearPlan() async throws(PlanFetchError) -> WireYearPlan? {
        do throws(PlanFetchError) {
            return try await raw.get("/api/train/year-plans/active", operationID: "getActiveYearPlan", as: WireYearPlan.self)
        } catch .notFound {
            return nil
        }
    }

    /// One edit of a block; the whole re-dated plan comes back with its warnings. 409 `TRAIN_YEAR_BLOCK_LOCKED` /
    /// `TRAIN_YEAR_NOTHING_TO_LINK`.
    public func patchYearBlock(id: String, _ patch: WireYearBlockPatch) async throws(PlanFetchError) -> WireYearPlan {
        try await raw.send(.patch, "/api/train/year-plans/blocks/\(id)", operationID: "patchYearBlock", body: patch)
    }

    /// Closes the plan; afterwards there is no active one.
    public func archiveYearPlan(id: String) async throws(PlanFetchError) -> WireYearPlan {
        try await raw.decodeBody(try await raw.sendRaw(.post, "/api/train/year-plans/\(id)/archive", operationID: "archiveYearPlan"))
    }
}
