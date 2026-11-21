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
        stub.on("listWeekProposals", .json(200, PlanFixtures.proposalJSON().replacingOccurrences(
            of: #""kind":"reps","from":12,"to":13,"reasons":["reserve_left"]"#,
            with: #""kind":"reps","from":12,"to":13,"reasons":["ai_suggested"],"note":"A bicepsz itt gyorsan regenerálódik.""#)))
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

    @Test func aiNotesAndRecommendationsReachThePicker() async throws {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON()))
        stub.on("getExerciseCatalog", .json(200, PlanFixtures.catalogJSON))
        stub.on("listWeekProposals", .json(200, PlanFixtures.proposalJSON().replacingOccurrences(
            of: #""kind":"reps","from":12,"to":13,"reasons":["reserve_left"]"#,
            with: #""kind":"reps","from":12,"to":13,"reasons":["ai_suggested"],"note":"A bicepsz itt gyorsan regenerálódik.""#)))
        let withRecs = PlanFixtures.evaluationJSON.replacingOccurrences(of: #""techniqueWarnings":[]"#,
            with: #""techniqueWarnings":[],"recommendations":[{"dayIndex":0,"exerciseIndex":1,"technique":"partials","reason":"lengthened_safe","challengeFit":true},{"dayIndex":0,"exerciseIndex":0,"technique":"future_thing","reason":"x"}]"#)
        stub.on("evaluateMesoPlan", .json(200, withRecs))
        let m = BlockBuilderModel(client: PlanFixtures.planClient(stub))
        await m.load()
        #expect(m.aiNotes[PlanFixtures.rowB] == "A bicepsz itt gyorsan regenerálódik.")
        let r = try #require(m.recommendation(day: 0, exercise: 1))
        #expect(r.technique == .partials && r.challengeFit && r.reason.contains("nyújtott"))
        #expect(m.recommendation(day: 0, exercise: 0) == nil, "an unknown technique is not recommended")
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

    // MARK: the new-block intake's calls (mezo-r36n9.113)

    @Test func candidatesDecodeLenientlyWithUnknownCodes() throws {
        let c = try JSONDecoder().decode(WireCandidates.self, from: Data(PlanFixtures.candidatesJSON(nothingFits: true).utf8))
        #expect(c.nothingFits && c.candidates.count == 2)
        #expect(c.candidates[0].splitKey == "ul" && c.candidates[0].splitLabel == "Felső-alsó")
        #expect(c.candidates[0].reasons.map(\.code) == ["fits_time", "freq_2x", "brand_new_reason"], "an unknown code is kept as text")
        #expect(c.candidates[0].reasons[0].value == 58 && c.candidates[0].reasons[1].value == nil)
        #expect(c.fixes.map(\.code) == ["more_minutes", "future_fix"] && c.fixes[0].value == 75)
        let budget = try #require(c.candidates[0].evaluation.budget)
        #expect(budget.capacitySets == 60 && budget.usedSets == 52 && budget.emphasizeMax == 2 && budget.raiseCost["biceps"] == 12)
        #expect(c.candidates[1].evaluation.budget == nil, "an evaluation without a budget still decodes")
        #expect(c.candidates[0].template.trainingStyle == "balanced" && c.candidates[0].template.dayCount == 2)
    }

    @Test func evaluationReadsBasisAndConsecutiveHeavy() throws {
        let json = PlanFixtures.evaluationJSON.replacingOccurrences(of: #""proposal":[],"proposalBlocked":false}"#,
            with: #""proposal":[],"proposalBlocked":false,"basis":{"source":"maintain_third"},"consecutiveHeavy":[{"dayIndex":0,"nextDayIndex":1,"sets":5,"nextSets":4}]}"#)
        let e = try JSONDecoder().decode(WireEvaluation.self, from: Data(json.utf8))
        let chest = try #require(e.muscles.first { $0.muscle == "chest" })
        #expect(chest.basis?.source == "maintain_third")
        #expect(chest.consecutiveHeavy?.first == WireConsecutive(dayIndex: 0, nextDayIndex: 1, sets: 5, nextSets: 4))
        #expect(e.muscles[0].basis == nil && e.muscles[0].consecutiveHeavy == nil)
    }

    @Test func templateIsRelayedUnchanged() async throws {
        let stub = StubTransport()
        stub.on("createMesoTemplate", .json(200, #"{"id":"\#(PlanFixtures.templateId)","title":"x","weeks":6,"phaseCurve":[],"days":[],"runCount":0}"#))
        let template = try JSONDecoder().decode(WireTemplate.self, from: Data(PlanFixtures.templateJSON().utf8))
        let id = try await PlanFixtures.planClient(stub).createTemplate(template)
        #expect(id == PlanFixtures.templateId)
        #expect(stub.sent[0].path == "/api/train/meso-templates")
        let sent = try JSONSerialization.jsonObject(with: Data(try #require(stub.sent[0].body).utf8)) as? NSDictionary
        let original = try JSONSerialization.jsonObject(with: Data(PlanFixtures.templateJSON().utf8)) as? NSDictionary
        #expect(sent == original, "every field, the unknown ones included, goes back as it came")
    }

    @Test func startAndCloseUseTheContractPaths() async throws {
        let stub = StubTransport()
        stub.on("startMesoTemplate", .json(200, PlanFixtures.startedBlockJSON()))
        stub.on("closeMesocycle", .json(200, PlanFixtures.startedBlockJSON(status: "archived")))
        let c = PlanFixtures.planClient(stub)
        let block = try await c.startTemplate(id: PlanFixtures.templateId, startDate: "2026-11-23", status: "planned")
        #expect(block.id == PlanFixtures.newBlockId && block.status == "planned")
        #expect(stub.sent[0].path == "/api/train/meso-templates/\(PlanFixtures.templateId)/start")
        let body = try JSONSerialization.jsonObject(with: Data(try #require(stub.sent[0].body).utf8)) as? [String: String]
        #expect(body == ["startDate": "2026-11-23", "status": "planned"])
        try await c.closeBlock(id: PlanFixtures.newBlockId)
        #expect(stub.sent[1].path == "/api/train/mesocycles/\(PlanFixtures.newBlockId)/close")
    }

    @Test func discardUsesItsOwnPathAndReadsTheLogsConflict() async throws {
        let stub = StubTransport()
        stub.on("discardMesocycle", .status(204))
        stub.on("discardMesocycle", .json(409, #"[{"code":"TRAIN_MESO_DISCARD_HAS_LOGS","type":"REQUEST"}]"#))
        let c = PlanFixtures.planClient(stub)
        try await c.discardBlock(id: PlanFixtures.newBlockId)
        #expect(stub.sent[0].path == "/api/train/mesocycles/\(PlanFixtures.newBlockId)/discard")
        await #expect(throws: PlanFetchError.conflict("TRAIN_MESO_DISCARD_HAS_LOGS")) {
            try await c.discardBlock(id: PlanFixtures.newBlockId)
        }
    }

    @Test func yearPlanCallsUseTheContractPathsAndDecodeLeniently() async throws {
        let stub = StubTransport()
        stub.on("getActiveYearPlan", .json(404, PlanFixtures.noYearPlanJSON))
        stub.on("getActiveYearPlan", .json(200, PlanFixtures.yearPlanJSON(unlinked: #"{"mesocycleId":"\#(PlanFixtures.blockId)","title":"V-forma","startDate":"2026-11-16"}"#)))
        stub.on("previewYearPlan", .json(200, PlanFixtures.yearPlanJSON(id: false)))
        stub.on("startMesoTemplate", .json(201, PlanFixtures.startedBlockJSON()))
        let c = PlanFixtures.planClient(stub)
        #expect(try await c.activeYearPlan() == nil, "404 = no plan, not a failure")
        let plan = try #require(try await c.activeYearPlan())
        #expect(plan.blocks.map(\.kind) == ["upper", "lower", "consolidation"] && plan.bufferWeeks == 1)
        #expect(plan.unlinkedRunning?.title == "V-forma" && plan.review.unfocused.count == 7)
        #expect(plan.blocks[1].skipConsequence == ["quad"] && plan.blocks[0].mesocycleId == PlanFixtures.blockId)
        let preview = try await c.yearPlanPreview(WireYearPlanRequest(startDate: "2026-11-30"))
        #expect(preview.id == nil)
        #expect(stub.sent.last?.body == #"{"startDate":"2026-11-30"}"#, "absent optionals are not sent")
        _ = try await c.startTemplate(id: "t", startDate: "2026-11-30", status: "planned", yearBlockId: PlanFixtures.yearBlock2)
        #expect(stub.sent.last?.body?.contains(#""yearBlockId":"\#(PlanFixtures.yearBlock2)""#) == true)

        // A required number missing is the error state, not an invented value; an unknown enum value is fine.
        for broken in [PlanFixtures.yearPlanJSON().replacingOccurrences(of: #""loadingBlocks":2,"#, with: ""),
                       PlanFixtures.yearPlanJSON().replacingOccurrences(of: #""kind":"lower","#, with: "")] {
            #expect(throws: (any Error).self) { try JSONDecoder().decode(WireYearPlan.self, from: Data(broken.utf8)) }
        }
        let odd = PlanFixtures.yearPlanJSON().replacingOccurrences(of: #""kind":"lower""#, with: #""kind":"full_body""#)
        #expect(try JSONDecoder().decode(WireYearPlan.self, from: Data(odd.utf8)).blocks[1].kind == "full_body")

        // A plan round-trips through the cache's encoder.
        let again = try JSONDecoder().decode(WireYearPlan.self, from: JSONEncoder().encode(plan))
        #expect(again == plan)
    }
}
