import Foundation
import Testing
@testable import BoopCore

// The builder's tier budget (mezo-r36n9.113): the session-minutes target rides every evaluation, raises are checked
// against the server's budget, and a block created a moment ago can be thrown away.

@Suite("BlockBuilderModel — the tier budget")
@MainActor
struct BlockBuilderBudgetTests {
    private func loaded(_ stub: StubTransport, evaluation: String = PlanFixtures.evaluationJSON,
                        minutes: Int? = nil, status: String = "active") async -> BlockBuilderModel {
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON(status: status)))
        stub.on("getExerciseCatalog", .json(200, PlanFixtures.catalogJSON))
        stub.on("listWeekProposals", .json(200, "[]"))
        stub.on("evaluateMesoPlan", .json(200, evaluation))
        let m = BlockBuilderModel(client: PlanFixtures.planClient(stub), debounce: .milliseconds(20))
        m.minutesTarget = minutes
        await m.load()
        return m
    }

    private func lastEvaluate(_ stub: StubTransport) throws -> [String: Any] {
        let sent = try #require(stub.sent.last { $0.op == "evaluateMesoPlan" }?.body)
        return try #require(JSONSerialization.jsonObject(with: Data(sent.utf8)) as? [String: Any])
    }

    @Test(.timeLimit(.minutes(1))) func minutesTargetSent() async throws {
        let stub = StubTransport()
        let m = await loaded(stub, evaluation: PlanFixtures.evaluationJSON(budget: PlanFixtures.budgetJSON()), minutes: 60)
        #expect(try lastEvaluate(stub)["sessionMinutesTarget"] as? Int == 60)
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON(budget: PlanFixtures.budgetJSON())))
        m.minutesTarget = 75
        try await Task.sleep(for: .milliseconds(150))
        #expect(try lastEvaluate(stub)["sessionMinutesTarget"] as? Int == 75, "a new target re-evaluates")
        // back is emphasize (fixture), so one more Hangsúly fills the two slots.
        #expect(m.canRaise("biceps") == .noRoom(minutes: 75, days: 2), "room 8, biceps costs 12")
        #expect(m.canRaise("chest") == .ok, "chest maintain → grow costs 4")
        m.draft?.setTier("quad", .emphasize)
        #expect(m.canRaise("biceps") == .emphasizeFull)
    }

    @Test(.timeLimit(.minutes(1))) func noTargetNoBudgetNoCrash() async throws {
        let stub = StubTransport()
        let m = await loaded(stub)
        #expect(try lastEvaluate(stub)["sessionMinutesTarget"] == nil, "no target is not sent")
        #expect(m.evaluation?.budget == nil)
        #expect(m.canRaise("biceps") == .ok)
        let noCapacity = await loaded(StubTransport(), evaluation: PlanFixtures.evaluationJSON(budget: PlanFixtures.budgetJSON(capacity: nil, used: 500)))
        #expect(noCapacity.canRaise("biceps") == .ok, "without a target there is no room to run out of")
    }

    @Test(.timeLimit(.minutes(1))) func tierSwitchStepsAndBlocks() async throws {
        let stub = StubTransport()
        let m = await loaded(stub, evaluation: PlanFixtures.evaluationJSON(budget: PlanFixtures.budgetJSON()), minutes: 60)
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON(budget: PlanFixtures.budgetJSON())))
        // chest is Tartás: a tap on Hangsúly takes one step (Építés, cost 4 fits in the room of 8).
        #expect(m.setTier("chest", .emphasize) == .ok)
        #expect(m.draft?.tier("chest") == .grow)
        #expect(m.setTier("biceps", .emphasize) == .noRoom(minutes: 60, days: 2))
        #expect(m.draft?.tier("biceps") == .grow, "a blocked raise changes nothing")
        #expect(m.setTier("back", .maintain) == .ok && m.draft?.tier("back") == .maintain, "lowering jumps straight")
    }

    @Test(.timeLimit(.minutes(1))) func concurrentLoadsReadOnce() async throws {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON()))
        stub.on("getExerciseCatalog", .json(200, PlanFixtures.catalogJSON))
        stub.on("listWeekProposals", .json(200, "[]"))
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        let m = BlockBuilderModel(client: PlanFixtures.planClient(stub), debounce: .milliseconds(20))
        // The create path and the page's own task both ask: the second waits for the first.
        async let a: Void = m.load()
        async let b: Void = m.load()
        _ = await (a, b)
        #expect(stub.ops.filter { $0 == "listMesocycles" }.count == 1)
        #expect(m.phase == .ready)
    }

    @Test(.timeLimit(.minutes(1))) func discardClosesJustCreatedBlock() async throws {
        let stub = StubTransport()
        let m = await loaded(stub, status: "planned")
        m.justCreated = true
        stub.on("closeMesocycle", .json(200, PlanFixtures.startedBlockJSON(status: "archived")))
        #expect(await m.discard())
        #expect(stub.sent.last?.path == "/api/train/mesocycles/\(PlanFixtures.blockId)/close")
        #expect(m.phase == .noBlock && m.draft == nil && !m.justCreated)
    }

    @Test(.timeLimit(.minutes(1))) func failedDiscardKeepsTheBlock() async throws {
        let stub = StubTransport()
        let m = await loaded(stub, status: "planned")
        m.justCreated = true
        stub.on("closeMesocycle", .fail(URLError(.notConnectedToInternet)))
        #expect(await m.discard() == false)
        #expect(m.phase == .ready && m.justCreated && m.discardError == .offline)
    }
}
