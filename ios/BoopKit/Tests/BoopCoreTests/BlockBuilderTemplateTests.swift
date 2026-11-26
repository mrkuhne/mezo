import Foundation
import Testing
@testable import BoopCore

@Suite("BlockBuilderModel — a planned run and the template mode (mezo-r36n9.177)")
@MainActor
struct BlockBuilderTemplateTests {
    private func builder(_ stub: StubTransport, _ source: BlockBuilderModel.Source) -> BlockBuilderModel {
        BlockBuilderModel(client: PlanFixtures.planClient(stub), source: source, debounce: .milliseconds(20), coverageHints: true)
    }

    @Test func runSourceLoadsThatBlock() async {
        let stub = StubTransport()
        let planned = PlanFixtures.mezoBlocksJSON()
        stub.on("listMesocycles", .json(200, planned))
        stub.on("getExerciseCatalog", .json(200, PlanFixtures.catalogJSON))
        stub.on("listWeekProposals", .json(200, "[]"))
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        stub.on("getBlockCoverage", .json(200, #"{"findings":[]}"#))
        let m = BlockBuilderModel(client: PlanFixtures.planClient(stub), source: .run(id: PlanFixtures.plannedId),
                                  debounce: .milliseconds(20), coverageHints: false)
        await m.load()
        #expect(m.phase == .ready)
        #expect(m.draft?.blockId == PlanFixtures.plannedId)
        #expect(m.draft?.title == "Téli alap")
        #expect(!m.isTemplate)
    }

    private func loadedTemplate(_ stub: StubTransport) async -> BlockBuilderModel {
        stub.on("listMesoTemplates", .json(200, PlanFixtures.templatesJSON()))
        stub.on("getExerciseCatalog", .json(200, PlanFixtures.catalogJSON))
        stub.on("listMesocycles", .json(200, "[]"))
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        let m = builder(stub, .template(id: PlanFixtures.templateA))
        await m.load()
        return m
    }

    @Test func templateLoadBuildsDraftFromTemplate() async {
        let stub = StubTransport()
        let m = await loadedTemplate(stub)
        #expect(m.phase == .ready)
        #expect(m.isTemplate)
        #expect(m.draft?.title == "Felső-alsó")
        #expect(m.draft?.days.map(\.title) == ["Felső", "Alsó"])
        #expect(m.draft?.days[0].exercises.map(\.name) == ["Chest Supported Row", "Bench Press"])
        #expect(m.lockedDayIndex == nil)
        #expect(!stub.ops.contains("listWeekProposals"))
        #expect(!stub.ops.contains("getBlockCoverage"), "no coverage hints in template mode")
    }

    @Test func templateSaveSendsOnePutWithEditedDays() async throws {
        let stub = StubTransport()
        let m = await loadedTemplate(stub)
        m.draft?.days[0].exercises[1].sets = 3
        stub.on("updateMesoTemplate", .json(200, PlanFixtures.templateJSON()))
        stub.on("listMesoTemplates", .json(200, PlanFixtures.templatesJSON()))
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        await m.save()
        #expect(m.saveState == .saved)
        let puts = stub.sent.filter { $0.op == "updateMesoTemplate" }
        #expect(puts.count == 1)
        #expect(puts[0].path == "/api/train/meso-templates/\(PlanFixtures.templateA)")
        let text = try #require(puts[0].body)
        let body = try #require(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
        #expect(body["id"] == nil && body["runCount"] == nil && body["createdAt"] == nil && body["updatedAt"] == nil)
        #expect(body["title"] as? String == "Felső-alsó")
        #expect(body["split"] as? String == "upper-lower", "untouched fields ride along")
        let days = try #require(body["days"] as? [[String: Any]])
        let ex = try #require(days[0]["exercises"] as? [[String: Any]])
        #expect(ex[1]["name"] as? String == "Bench Press")
        #expect(ex[1]["workingSets"] as? Int == 3)
        #expect(ex.allSatisfy { $0["id"] == nil }, "synthetic row ids never leave the phone")
        let writes = stub.sent.filter { $0.path.contains("/mesocycles/") }
        #expect(writes.isEmpty, "template mode never writes a mesocycle")
    }

    @Test func templateGoneIsNotFound() async {
        let stub = StubTransport()
        stub.on("listMesoTemplates", .json(200, "[]"))
        stub.on("getExerciseCatalog", .json(200, PlanFixtures.catalogJSON))
        stub.on("listMesocycles", .json(200, "[]"))
        let m = builder(stub, .template(id: PlanFixtures.templateA))
        await m.load()
        #expect(m.phase == .failed(.notFound))
    }

    @Test func templateSuggestWithoutRunningBlockIsEmpty() async throws {
        let stub = StubTransport()
        let m = await loadedTemplate(stub)
        let s = try await m.suggest(mode: "add", day: 0, muscle: "back")
        #expect(s.suggestions.isEmpty)
        #expect(!stub.ops.contains("getBlockExerciseSuggestions"))
    }
}
