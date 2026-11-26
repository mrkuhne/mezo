import Foundation
import Testing
@testable import BoopCore

@Suite("PlanClient — the mezociklus lifecycle calls (mezo-r36n9.177)")
struct MezociklusClientTests {
    private func client(_ stub: StubTransport) -> PlanClient { PlanFixtures.planClient(stub) }

    @Test func allBlocksListsEveryRunWithTheNewFields() async throws {
        let stub = StubTransport()
        stub.on("listMesocycles", .json(200, PlanFixtures.mezoBlocksJSON()))
        let blocks = try await client(stub).allBlocks()
        #expect(blocks.count == 4)
        #expect(stub.sent[0].path == "/api/train/mesocycles")
        let closed = try #require(blocks.first { $0.id == PlanFixtures.closedA })
        #expect(closed.closedAt == "2026-08-17T18:00:00Z")
        #expect(closed.templateId == PlanFixtures.templateA)
        #expect(closed.hasReport == true)
        #expect(closed.endDate == "2026-08-17")
        #expect(closed.split == "upper-lower")
    }

    @Test func templatesExposeIdRunCountAndCurve() async throws {
        let stub = StubTransport()
        stub.on("listMesoTemplates", .json(200, PlanFixtures.templatesJSON()))
        let t = try await client(stub).templates()
        #expect(stub.sent[0].path == "/api/train/meso-templates")
        #expect(t.count == 2)
        #expect(t[0].id == PlanFixtures.templateA)
        #expect(t[0].runCount == 3)
        #expect(t[0].weeks == 6)
        #expect(t[0].phaseCurve == ["MEV", "MAV", "MAV", "MAV", "MRV", "Deload"])
        #expect(t[0].split == "upper-lower")
    }

    @Test func lifecycleCallsHitTheirPaths() async throws {
        let stub = StubTransport()
        let id = PlanFixtures.blockId
        stub.on("activateMesocycle", .json(200, PlanFixtures.startedBlockJSON(status: "active")))
        stub.on("closeMesocycle", .json(200, PlanFixtures.startedBlockJSON(status: "archived")))
        stub.on("closeMesocycle", .json(200, PlanFixtures.startedBlockJSON(status: "archived")))
        stub.on("rerunMesocycle", .json(200, #"{"templateId":"\#(PlanFixtures.templateA)"}"#))
        stub.on("restartMesocycle", .json(200, PlanFixtures.startedBlockJSON(status: "active")))
        stub.on("restartMesocycle", .json(200, PlanFixtures.startedBlockJSON(status: "active")))
        stub.on("saveMesocycleToTemplate", .json(200, #"{"templateId":"\#(PlanFixtures.templateB)"}"#))
        let c = client(stub)

        #expect(try await c.activate(id: id).status == "active")
        #expect(try await c.closeBlock(id: id, selfEval: "jó volt").status == "archived")
        _ = try await c.closeBlock(id: id, selfEval: nil)
        #expect(try await c.rerun(id: id) == PlanFixtures.templateA)
        #expect(try await c.restart(id: id, updateTemplate: true).status == "active")
        _ = try await c.restart(id: id, updateTemplate: false)
        #expect(try await c.saveToTemplate(id: id) == PlanFixtures.templateB)

        let paths = stub.sent.map(\.path)
        #expect(paths == ["/api/train/mesocycles/\(id)/activate", "/api/train/mesocycles/\(id)/close",
                          "/api/train/mesocycles/\(id)/close", "/api/train/mesocycles/\(id)/rerun",
                          "/api/train/mesocycles/\(id)/restart", "/api/train/mesocycles/\(id)/restart",
                          "/api/train/mesocycles/\(id)/save-to-template"])
        #expect(stub.sent[1].body == #"{"selfEval":"jó volt"}"#)
        #expect(stub.sent[2].body == nil)
        #expect(stub.sent[4].body == #"{"updateTemplate":true}"#)
        #expect(stub.sent[5].body == #"{"updateTemplate":false}"#)
    }

    @Test func seasonRequiredIsAConflict() async {
        let stub = StubTransport()
        stub.on("restartMesocycle", .json(409, #"[{"code":"SEASON_REQUIRED","message":"x"}]"#))
        await #expect(throws: PlanFetchError.conflict("SEASON_REQUIRED")) {
            _ = try await client(stub).restart(id: "b", updateTemplate: false)
        }
    }

    @Test func reportDecodesPendingWithoutVolume() async throws {
        let stub = StubTransport()
        stub.on("getMesocycleReport", .json(200, PlanFixtures.reportJSON(aiStatus: "pending", volume: false)))
        let r = try await client(stub).report(id: PlanFixtures.closedA)
        #expect(stub.sent[0].path == "/api/train/mesocycles/\(PlanFixtures.closedA)/report")
        #expect(r.aiEvalStatus == "pending")
        #expect(r.volume == nil)
        #expect(r.adherence?.completionPct == 83)
        #expect(r.strength?.first?.lastTopKg == 85)
        #expect(r.records?.top?.first?.kind == "weight")
    }

    @Test func reportDecodesVolumeWeeks() throws {
        let r = try JSONDecoder().decode(WireReport.self, from: Data(PlanFixtures.reportJSON(aiStatus: "ready", volume: true).utf8))
        #expect(r.aiEval == "Erős hat hét volt.")
        #expect(r.volume?.muscles?.first?.weeks?.count == 2)
        #expect(r.volume?.muscles?.first?.weeks?[1].actual == nil)
    }

    @Test func updateTemplatePutsTheJson() async throws {
        let stub = StubTransport()
        stub.on("updateMesoTemplate", .json(200, PlanFixtures.templateJSON(title: "Új név")))
        let base = try JSONDecoder().decode(WireTemplate.self, from: Data(PlanFixtures.templateJSON().utf8))
        let saved = try await client(stub).updateTemplate(id: PlanFixtures.templateA, base)
        #expect(stub.sent[0].path == "/api/train/meso-templates/\(PlanFixtures.templateA)")
        #expect(stub.sent[0].body?.contains(#""title":"Felső-alsó""#) == true)
        #expect(saved.title == "Új név")
    }
}
