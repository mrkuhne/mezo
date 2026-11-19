import Foundation
import Testing
@testable import BoopCore

@Suite("PlanClient + screen models — the builder's and the review's calls")
@MainActor
struct PlanClientTests {
    @Test func readsTheRunningBlockLenientlyWithTheToken() async throws {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON()))
        let block = try await PlanFixtures.planClient(stub).runningBlock()
        #expect(block?.id == PlanFixtures.blockId)
        #expect(stub.sent[0].path == "/api/train/mesocycles" && stub.sent[0].auth == "Bearer tok")
    }

    @Test func noRunningBlockIsNil() async throws {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON(status: "archived")))
        #expect(try await PlanFixtures.planClient(stub).runningBlock() == nil)
    }

    @Test func mapsFailures() async {
        let stub = StubTransport()
        stub.on("decideWeekProposal", .json(409, #"[{"code":"TRAIN_WEEK_PROPOSAL_CLOSED","message":"x"}]"#))
        stub.on("evaluateMesoPlan", .status(400))
        stub.on("listWeekProposals", .fail(URLError(.notConnectedToInternet)))
        stub.on("listMesocycles", .status(401))
        let c = PlanFixtures.planClient(stub)
        await #expect(throws: PlanFetchError.conflict("TRAIN_WEEK_PROPOSAL_CLOSED")) {
            _ = try await c.decide(blockId: "b", proposalId: "p", WeekReview.acceptEverything)
        }
        await #expect(throws: PlanFetchError.rejected(nil)) { _ = try await c.evaluate(PlanFixtures.draft.evaluateRequest()) }
        await #expect(throws: PlanFetchError.offline) { _ = try await c.weekProposals(blockId: "b") }
        await #expect(throws: PlanFetchError.unauthorized) { _ = try await c.runningBlock() }
    }

    @Test func evaluationDecodesWithT3Extras() throws {
        let e = try JSONDecoder().decode(WireEvaluation.self, from: Data(PlanFixtures.evaluationJSON.utf8))
        #expect(e.path[1].techniques == 2, "a list counts")
        #expect(e.path[2].techniques == 0)
        #expect(e.path[0].techniques == nil)
        #expect(e.days[1].sessionCapWarnings.first?.muscle == "back")
    }

    // MARK: the builder model

    private func loadedBuilder(_ stub: StubTransport) async -> BlockBuilderModel {
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON()))
        stub.on("getExerciseCatalog", .json(200, PlanFixtures.catalogJSON))
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        let m = BlockBuilderModel(client: PlanFixtures.planClient(stub), debounce: .milliseconds(20))
        await m.load()
        return m
    }

    @Test func loadEvaluatesTheBlock() async {
        let m = await loadedBuilder(StubTransport())
        #expect(m.phase == .ready)
        #expect(m.outside.map(\.muscle) == ["back", "biceps"])
        #expect(m.sets("back", day: 1) == 3)
        #expect(!m.hasChanges)
    }

    @Test func noBlockState() async {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, "[]"))
        stub.on("getExerciseCatalog", .json(200, "[]"))
        let m = BlockBuilderModel(client: PlanFixtures.planClient(stub))
        await m.load()
        #expect(m.phase == .noBlock)
    }

    @Test func offlineLoadFails() async {
        let stub = StubTransport()
        stub.on("listMesocycles", .fail(URLError(.notConnectedToInternet)))
        stub.on("getExerciseCatalog", .fail(URLError(.notConnectedToInternet)))
        let m = BlockBuilderModel(client: PlanFixtures.planClient(stub))
        await m.load()
        #expect(m.phase == .failed(.offline))
    }

    @Test func editsAreDebouncedIntoOneEvaluation() async throws {
        let stub = StubTransport()
        let m = await loadedBuilder(stub)
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        m.draft?.step(day: 0, exercise: 0, by: 1)
        m.draft?.step(day: 0, exercise: 0, by: 1)
        m.draft?.step(day: 0, exercise: 0, by: 1)
        #expect(m.evaluationStale)
        try await Task.sleep(for: .milliseconds(200))
        #expect(stub.ops.filter { $0 == "evaluateMesoPlan" }.count == 2, "one at load, one for three taps")
        #expect(!m.evaluationStale)
        #expect(stub.sent.last?.body?.contains("\"workingSets\":7") == true)
    }

    @Test func aFailedEvaluationKeepsTheLastNumbers() async throws {
        let stub = StubTransport()
        let m = await loadedBuilder(stub)
        stub.on("evaluateMesoPlan", .fail(URLError(.timedOut)))
        m.draft?.step(day: 0, exercise: 0, by: 1)
        try await Task.sleep(for: .milliseconds(200))
        #expect(m.evaluation != nil && m.evaluationStale && m.evaluationError == .offline)
    }

    @Test func applyAllUsesTheProposals() async {
        let m = await loadedBuilder(StubTransport())
        m.applyAllProposals()
        #expect(m.draft?.days[0].exercises[0].sets == 5)
        #expect(m.draft?.days[0].exercises[1].sets == 6)
        #expect(m.draft?.days[1].exercises[1].sets == 5)
    }

    @Test func saveWritesSettingsThenTiersThenChangedDaysOnly() async {
        let stub = StubTransport()
        let m = await loadedBuilder(stub)
        m.draft?.style = .heavy
        m.draft?.cycleTier("biceps")
        m.draft?.step(day: 1, exercise: 1, by: 1)
        stub.on("updateMesocycleSettings", .json(200, String(PlanFixtures.blocksJSON(style: "heavy").dropFirst().dropLast())))
        stub.on("updateMesocycleMusclePriorities", .json(200, String(PlanFixtures.blocksJSON().dropFirst().dropLast())))
        stub.on("replaceDayExercises", .json(200, #"{"id":"\#(PlanFixtures.dayThu)","day":"Csü","type":"x","exercises":[]}"#))
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON(style: "heavy")))
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        await m.save()
        #expect(m.saveState == .saved)
        let writes = stub.sent.filter { ["updateMesocycleSettings", "updateMesocycleMusclePriorities", "replaceDayExercises"].contains($0.op) }
        #expect(writes.map(\.op) == ["updateMesocycleSettings", "updateMesocycleMusclePriorities", "replaceDayExercises"])
        #expect(writes[0].body == #"{"trainingStyle":"heavy"}"#)
        #expect(writes[1].body?.contains(#""biceps":"emphasize""#) == true)
        #expect(writes[2].path.hasSuffix("/days/\(PlanFixtures.dayThu)/exercises"))
        #expect(writes[2].body?.contains(#""workingSets":4"#) == true, "the edit survived the settings re-read")
        #expect(m.hasChanges == false)
    }

    @Test func aFailedSaveSaysWhatWasSaved() async {
        let stub = StubTransport()
        let m = await loadedBuilder(stub)
        m.draft?.cycleTier("biceps")
        m.draft?.techniquesEnabled = true
        m.draft?.cycleTechnique(day: 0, exercise: 0)
        stub.on("updateMesocycleSettings", .json(200, String(PlanFixtures.blocksJSON(techniques: true).dropFirst().dropLast())))
        stub.on("updateMesocycleMusclePriorities", .json(200, String(PlanFixtures.blocksJSON().dropFirst().dropLast())))
        stub.on("replaceDayExercises", .json(400, #"[{"code":"TRAIN_TECHNIQUE_NOT_ALLOWED"}]"#))
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON(techniques: true)))
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        await m.save()
        #expect(m.saveState == .failed(saved: ["az edzésmód és a beállítások", "az izmok szintje"],
                                      error: .rejected("TRAIN_TECHNIQUE_NOT_ALLOWED")))
        #expect(m.draft?.days[0].exercises[0].technique == .restDrop, "the unsaved edit is still on screen")
        #expect(m.hasChanges, "so he can save again")
    }

    @Test func proposalsWaitForAFreshEvaluation() async {
        let stub = StubTransport()
        let m = await loadedBuilder(stub)
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        m.applyAllProposals()
        let once = m.draft?.days[0].exercises[0].sets
        m.applyAllProposals()                        // the old evaluation is stale now: no second application
        #expect(m.draft?.days[0].exercises[0].sets == once)
        #expect(!m.canApplyProposals)
    }

    @Test func reviewPrefersWhatIsStillPending() async {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON(mode: "manual")))
        let applied = String(PlanFixtures.proposalJSON(status: "applied").dropFirst().dropLast())
        let pendingTier = applied.replacingOccurrences(of: "p0000000-0000-4000-8000-000000000001", with: "p0000000-0000-4000-8000-000000000002")
            .replacingOccurrences(of: #""kind":"weekly","status":"applied""#, with: #""kind":"tier_change","status":"pending""#)
        stub.on("listWeekProposals", .json(200, "[\(applied),\(pendingTier)]"))
        let m = WeekReviewModel(client: PlanFixtures.planClient(stub))
        await m.load()
        #expect(m.review?.kind == "tier_change" && m.review?.isOpen == true)
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON(mode: "manual")))
        stub.on("listWeekProposals", .json(200, "[]"))
        await m.load()
        #expect(m.review == nil && m.phase == .nothing, "a stale card is cleared")
    }

    // MARK: the review model

    @Test func reviewLoadsDecidesAndAcceptsEverything() async {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON(mode: "manual")))
        stub.on("listWeekProposals", .json(200, PlanFixtures.proposalJSON()))
        let m = WeekReviewModel(client: PlanFixtures.planClient(stub))
        await m.load()
        #expect(m.phase == .ready && m.review?.reviewMuscles == ["back", "biceps"])
        stub.on("decideWeekProposal", .json(200, String(PlanFixtures.proposalJSON(status: "applied").dropFirst().dropLast())))
        #expect(await m.acceptEverything())
        #expect(stub.sent.last?.body == #"{"acceptRest":true}"#)
        #expect(m.review?.isOpen == false)
    }

    @Test func reviewWithNoProposalIsNothing() async {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON()))
        stub.on("listWeekProposals", .json(200, "[]"))
        let m = WeekReviewModel(client: PlanFixtures.planClient(stub))
        await m.load()
        #expect(m.phase == .nothing)
    }

    @Test func aClosedWeekReloads() async {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON(mode: "manual")))
        stub.on("listWeekProposals", .json(200, PlanFixtures.proposalJSON()))
        let m = WeekReviewModel(client: PlanFixtures.planClient(stub))
        await m.load()
        stub.on("decideWeekProposal", .json(409, #"[{"code":"TRAIN_WEEK_PROPOSAL_CLOSED"}]"#))
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON(mode: "manual")))
        stub.on("listWeekProposals", .json(200, PlanFixtures.proposalJSON(status: "expired")))
        #expect(await m.submitFinal() == false)
        #expect(m.sendError == .conflict("TRAIN_WEEK_PROPOSAL_CLOSED"))
        #expect(m.review?.status == "expired")
    }
}
