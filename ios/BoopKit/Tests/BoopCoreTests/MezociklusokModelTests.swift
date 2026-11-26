import Foundation
import Testing
@testable import BoopCore

@Suite("MezociklusokModel — every mezociklus, its actions and its report (mezo-r36n9.177)")
@MainActor
struct MezociklusokModelTests {
    /// 2026-11-26 10:00 UTC — a Thursday, 11:00 in Budapest.
    static let now = Date(timeIntervalSince1970: 1_795_687_200)

    private var blocks: [WireBlock] {
        try! JSONDecoder().decode([WireBlock].self, from: Data(PlanFixtures.mezoBlocksJSON().utf8))
    }
    private var templates: [WireTemplate] {
        try! JSONDecoder().decode([WireTemplate].self, from: Data(PlanFixtures.templatesJSON().utf8))
    }

    private func model(_ stub: StubTransport, cache: ServerCache? = nil, clock: @escaping () -> Date = { Self.now }) -> MezociklusokModel {
        MezociklusokModel(client: PlanFixtures.planClient(stub), cache: cache, clock: clock)
    }

    private func scriptList(_ stub: StubTransport, times: Int = 1) {
        for _ in 0..<times {
            stub.on("listMesocycles", .json(200, PlanFixtures.mezoBlocksJSON()))
            stub.on("listMesoTemplates", .json(200, PlanFixtures.templatesJSON()))
            stub.on("getMesocycleReport", .json(200, PlanFixtures.reportJSON(aiStatus: "ready", volume: false)))
            stub.on("getMesocycleReport", .json(200, PlanFixtures.reportJSON(aiStatus: "ready", volume: false)))
        }
    }

    // MARK: the pure grouping

    @Test func groupsRunningPlannedClosedTemplates() {
        let g = mezoCards(blocks: blocks, templates: templates)
        #expect(g.running?.blockId == PlanFixtures.blockId)
        #expect(g.running?.kind == .running)
        #expect(g.running?.currentWeek == 2)
        #expect(g.upcoming.map(\.blockId) == [PlanFixtures.plannedId])
        #expect(g.upcoming.first?.kind == .planned)
        #expect(g.closed.map(\.blockId) == [PlanFixtures.closedA, PlanFixtures.closedB], "newest closed first")
        #expect(g.closed.allSatisfy { $0.kind == .closed && $0.hasReport })
        #expect(g.templates.map(\.templateId) == [PlanFixtures.templateA, PlanFixtures.templateB])
        #expect(g.templates.first?.runCount == 3)
        #expect(Set(([g.running!] + g.upcoming + g.closed + g.templates).map(\.id)).count == 6, "ids never collide")
    }

    @Test func heatNormalizesToMax() {
        let g = mezoCards(blocks: blocks, templates: templates)
        let heat = g.running!.heat
        #expect(heat["back"] == 1.0, "4 + 4 back sets is the most")
        #expect(heat["quad"] == 0.5)
        #expect(heat["chest"] == 0.25)
        #expect(g.running!.days.map(\.exerciseCount) == [2, 2])
        #expect(g.running!.days.first?.focus == "Felső")
    }

    @Test func curveMapsPhases() {
        let card = mezoCards(blocks: blocks, templates: templates).templates[1]
        #expect(card.phases == ["Alap", "Építés", "Csúcs", "Pihenőhét"])
        #expect(card.loads == [0.45, 0.72, 1.0, 0.3])
        #expect(card.weeks == 4)
    }

    @Test func dateTextHungarian() {
        let g = mezoCards(blocks: blocks, templates: templates)
        #expect(g.closed[0].dateText == "júl. 7. – aug. 17.")
        #expect(g.running?.dateText == "nov. 16-tól")
        #expect(g.upcoming[0].dateText == "jan. 4-től")
        #expect(mezoFromText("2026-10-13") == "okt. 13-tól")
        #expect(mezoFromText("2026-09-20") == "szept. 20-tól")
        #expect(mezoFromText("2026-03-05") == "márc. 5-től")
    }

    @Test func restartDropsOnlyThePlannedInsideTheNewWeeks() {
        let g = mezoCards(blocks: blocks, templates: templates)
        guard let running = g.running, let planned = g.upcoming.first, let start = planned.startDate else {
            Issue.record("fixture needs a running and a planned run"); return
        }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "Europe/Budapest")
        let plannedDay = f.date(from: start)!
        let inside = plannedDay.addingTimeInterval(-Double(running.weeks * 7 - 2) * 86_400)
        let before = plannedDay.addingTimeInterval(-Double(running.weeks * 7 + 2) * 86_400)
        #expect(MezociklusokModel.restartDrops(running: running, upcoming: g.upcoming, today: inside).map(\.id) == [planned.id])
        #expect(MezociklusokModel.restartDrops(running: running, upcoming: g.upcoming, today: before).isEmpty)
    }

    // MARK: load

    @Test func loadFillsGroupsAndAdherence() async {
        let stub = StubTransport()
        scriptList(stub)
        let m = model(stub)
        await m.load()
        #expect(m.phase == .ready)
        #expect(m.ageText == nil)
        #expect(m.groups.closed.first?.adherence == 0.83)
        #expect(stub.ops.filter { $0 == "getMesocycleReport" }.count == 2)
    }

    @Test func offlineShowsCacheWithAge() async {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("mezo-cache-\(UUID().uuidString)")
        nonisolated(unsafe) var clock = Self.now.addingTimeInterval(-2 * 86_400)
        let cache = ServerCache(directory: dir, clock: { clock })
        let online = StubTransport()
        scriptList(online)
        await model(online, cache: cache).load()

        clock = Self.now
        let offline = StubTransport()
        offline.on("listMesocycles", .fail(URLError(.notConnectedToInternet)))
        let m = model(offline, cache: cache)
        await m.load()
        #expect(m.phase == .ready)
        #expect(m.ageText == "2 napos adat")
        #expect(m.offline)
        #expect(m.groups.running?.blockId == PlanFixtures.blockId)
    }

    @Test func failedRefreshAfterGoodLoadGoesOffline() async {
        let stub = StubTransport()
        scriptList(stub)
        nonisolated(unsafe) var now = Self.now
        let m = model(stub, clock: { now })
        await m.load()
        #expect(!m.offline)

        now = Self.now.addingTimeInterval(3 * 3600)
        stub.on("listMesocycles", .fail(URLError(.notConnectedToInternet)))
        await m.load()
        #expect(m.phase == .ready)
        #expect(m.offline)
        #expect(m.groups.running?.blockId == PlanFixtures.blockId)
    }

    @Test func offlineWithoutCacheFails() async {
        let stub = StubTransport()
        stub.on("listMesocycles", .fail(URLError(.notConnectedToInternet)))
        let m = model(stub)
        await m.load()
        #expect(m.phase == .failed(.offline))
    }

    // MARK: actions

    @Test func restartIgnoresSecondTapWhileBusy() async {
        let s2 = StubTransport()
        scriptList(s2, times: 2)
        s2.on("restartMesocycle", .slowJson(200, PlanFixtures.startedBlockJSON(status: "active"), ms: 150))
        let m = model(s2)
        await m.load()
        let running = m.groups.running!
        async let first = m.restart(running: running, updateTemplate: false)
        try? await Task.sleep(for: .milliseconds(20))
        let second = await m.restart(running: running, updateTemplate: false)
        let one = await first
        #expect(second == nil)
        #expect(one?.status == "active")
        #expect(s2.ops.filter { $0 == "restartMesocycle" }.count == 1)
    }

    @Test func rerunClosesTheRunningOneThenStartsTodayAsActive() async throws {
        let stub = StubTransport()
        scriptList(stub, times: 2)
        stub.on("closeMesocycle", .json(200, PlanFixtures.startedBlockJSON(status: "archived")))
        stub.on("rerunMesocycle", .json(200, #"{"templateId":"\#(PlanFixtures.templateA)"}"#))
        stub.on("startMesoTemplate", .json(200, PlanFixtures.startedBlockJSON(status: "active")))
        let m = model(stub)
        await m.load()
        let started = await m.rerun(closed: m.groups.closed[0])
        #expect(started?.status == "active")
        let lifecycle = stub.ops.filter { ["closeMesocycle", "rerunMesocycle", "startMesoTemplate"].contains($0) }
        #expect(lifecycle == ["closeMesocycle", "rerunMesocycle", "startMesoTemplate"])
        let start = try #require(stub.sent.first { $0.op == "startMesoTemplate" })
        #expect(start.path == "/api/train/meso-templates/\(PlanFixtures.templateA)/start")
        let body = try JSONSerialization.jsonObject(with: Data(try #require(start.body).utf8)) as? [String: String]
        #expect(body == ["startDate": "2026-11-26", "status": "active"])
    }

    @Test func seasonRequiredSaysItInWords() async {
        let stub = StubTransport()
        scriptList(stub, times: 2)
        stub.on("restartMesocycle", .json(409, #"[{"code":"SEASON_REQUIRED","message":"x"}]"#))
        let m = model(stub)
        await m.load()
        #expect(await m.restart(running: m.groups.running!, updateTemplate: false) == nil)
        #expect(m.lastError?.contains("évad") == true)
        #expect(!m.busy)
    }

    @Test func saveAndCloseReload() async {
        let stub = StubTransport()
        scriptList(stub, times: 3)
        stub.on("saveMesocycleToTemplate", .json(200, #"{"templateId":"\#(PlanFixtures.templateA)"}"#))
        stub.on("closeMesocycle", .json(200, PlanFixtures.startedBlockJSON(status: "archived")))
        let m = model(stub)
        await m.load()
        #expect(await m.saveToTemplate(running: m.groups.running!))
        #expect(await m.close(running: m.groups.running!, selfEval: "Jó volt")?.status == "archived")
        #expect(stub.sent.first { $0.op == "closeMesocycle" }?.body == #"{"selfEval":"Jó volt"}"#)
        #expect(stub.ops.filter { $0 == "listMesocycles" }.count == 3)
    }

    @Test func restartStatsOmitMissedWhenUnknown() async {
        let card = mezoCards(blocks: blocks, templates: templates).running!
        let s = MezociklusokModel.restartStats(running: card)
        #expect(s.week == 2 && s.of == 6 && s.done == nil)
    }

    // MARK: the report

    @Test func reportPollsUntilReady() async {
        let stub = StubTransport()
        stub.on("getMesocycleReport", .json(200, PlanFixtures.reportJSON(aiStatus: "pending", volume: true)))
        stub.on("getMesocycleReport", .json(200, PlanFixtures.reportJSON(aiStatus: "ready", volume: true)))
        let r = MezoReportModel(client: PlanFixtures.planClient(stub), interval: .milliseconds(30))
        await r.load(blockId: PlanFixtures.closedA)
        #expect(r.aiState == .pending)
        for _ in 0..<50 where r.aiState == .pending { try? await Task.sleep(for: .milliseconds(20)) }
        #expect(r.aiState == .ready("Erős hat hét volt."))
        r.stop()
        #expect(stub.ops.count == 2)
    }

    @Test func reportOffWhenDisabled() throws {
        let json = PlanFixtures.reportJSON(aiStatus: "pending", volume: false)
            .replacingOccurrences(of: #""aiEvalEnabled":true"#, with: #""aiEvalEnabled":false"#)
        let report = try JSONDecoder().decode(WireReport.self, from: Data(json.utf8))
        #expect(MezoReportModel.aiState(of: report) == .off)
    }
}
