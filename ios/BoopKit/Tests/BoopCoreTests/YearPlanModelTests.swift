import Foundation
import Testing
@testable import BoopCore

// The Éves terv model (mezo-r36n9.113): no plan is a state, the draft's preview is debounced, every edit returns the
// whole re-dated plan, notes decode leniently, and a failed load falls back to the cached plan with its age [RF 5].

@Suite("YearPlanModel — the year plan")
@MainActor
struct YearPlanModelTests {
    final class Clock: @unchecked Sendable { var now: Date; init(_ now: Date) { self.now = now } }

    /// Saturday 2026-11-21, noon in Budapest.
    nonisolated static let saturday: Date = {
        var c = DateComponents(); c.year = 2026; c.month = 11; c.day = 21; c.hour = 12
        return budapest.date(from: c)!
    }()
    nonisolated static let budapest: Calendar = {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!; return cal
    }()

    private func model(_ stub: StubTransport, cache: ServerCache? = nil, debounce: Duration = .milliseconds(20)) -> YearPlanModel {
        YearPlanModel(client: PlanFixtures.planClient(stub), cache: cache, debounce: debounce, now: { Self.saturday },
                      calendar: Self.budapest)
    }

    private func body(_ stub: StubTransport, _ op: String) throws -> [String: Any] {
        let sent = try #require(stub.sent.last { $0.op == op }?.body)
        return try #require(JSONSerialization.jsonObject(with: Data(sent.utf8)) as? [String: Any])
    }

    private static func tempDir() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("year-plan-cache-\(UUID().uuidString)")
    }

    private func ready(_ stub: StubTransport, json: String = PlanFixtures.yearPlanJSON()) async -> YearPlanModel {
        stub.on("getActiveYearPlan", .json(200, json))
        let m = model(stub)
        await m.load()
        return m
    }

    @Test(.timeLimit(.minutes(1))) func noPlanIsNoneNotFailure() async {
        let stub = StubTransport()
        stub.on("getActiveYearPlan", .json(404, PlanFixtures.noYearPlanJSON))
        let m = model(stub)
        #expect(m.phase == .loading)
        await m.load()
        #expect(m.phase == .none)
        #expect(stub.sent.last?.path == "/api/train/year-plans/active")
        #expect(m.freshPlan == nil)
    }

    @Test(.timeLimit(.minutes(1))) func previewDebouncedOnEdit() async throws {
        let stub = StubTransport()
        let m = model(stub)
        #expect(m.startMonday == "2026-11-23", "the Monday on/after today")
        #expect(m.blockWeeks == 6 && m.emphasis.isEmpty)
        stub.on("previewYearPlan", .json(200, PlanFixtures.yearPlanJSON(id: false)))
        m.emphasis = ["back"]
        m.blockWeeks = 7
        m.stepStart(by: 1)
        await m.pendingPreview?.value
        #expect(stub.ops.filter { $0 == "previewYearPlan" }.count == 1, "three quick edits ask once")
        let sent = try body(stub, "previewYearPlan")
        #expect(sent["startDate"] as? String == "2026-11-30")
        #expect(sent["emphasis"] as? [String] == ["back"] && sent["blockWeeks"] as? Int == 7)
        #expect(sent["replaceActive"] == nil, "a preview never replaces")
        #expect(m.preview?.blocks.count == 3 && m.preview?.id == nil && m.preview?.blocks[0].id == nil)

        m.blockWeeks = 12; #expect(m.blockWeeks == 8)
        m.blockWeeks = 1; #expect(m.blockWeeks == 4)
        m.stepStart(by: -5); #expect(m.startMonday == "2026-11-23", "never before the Monday on/after today")
        stub.on("previewYearPlan", .json(200, PlanFixtures.yearPlanJSON(id: false)))
        await m.pendingPreview?.value
        #expect(try body(stub, "previewYearPlan")["blockWeeks"] as? Int == 4)
    }

    @Test(.timeLimit(.minutes(1))) func acceptCreatesThenReady() async throws {
        let stub = StubTransport()
        stub.on("createYearPlan", .json(201, PlanFixtures.yearPlanJSON()))
        let m = model(stub)
        m.emphasis = ["back", "quad"]
        await m.accept()
        let sent = try body(stub, "createYearPlan")
        #expect(stub.sent.last { $0.op == "createYearPlan" }?.path == "/api/train/year-plans")
        #expect(sent["startDate"] as? String == "2026-11-23" && Set(sent["emphasis"] as? [String] ?? []) == ["back", "quad"])
        #expect(sent["replaceActive"] == nil)
        guard case .ready(let plan, let age) = m.phase else { Issue.record("not ready: \(m.phase)"); return }
        #expect(plan.id == PlanFixtures.yearPlanId && age == nil && m.freshPlan == plan)
        #expect(plan.next?.reason == "last_week" && plan.blocks[0].adopted && plan.focusCount["quad"] == 1)

        stub.on("createYearPlan", .json(201, PlanFixtures.yearPlanJSON()))
        await m.accept(replaceActive: true)
        #expect(try body(stub, "createYearPlan")["replaceActive"] as? Bool == true)

        stub.on("createYearPlan", .json(409, #"{"messages":[{"code":"TRAIN_YEAR_PLAN_ACTIVE_EXISTS"}]}"#))
        await m.accept()
        #expect(m.actionError == .conflict("TRAIN_YEAR_PLAN_ACTIVE_EXISTS"))
        if case .ready = m.phase {} else { Issue.record("a refused create keeps the plan") }
    }

    @Test(.timeLimit(.minutes(1))) func focusCapsAtTwo() async throws {
        let stub = StubTransport()
        let m = await ready(stub)
        await m.setFocus(PlanFixtures.yearBlock2, ["quad", "ham", "glute"])
        await m.setFocus(PlanFixtures.yearBlock2, [])
        #expect(!stub.ops.contains("patchYearBlock"), "more than two (or none) is never sent")

        stub.on("patchYearBlock", .json(200, PlanFixtures.yearPlanJSON()))
        await m.setFocus(PlanFixtures.yearBlock2, ["quad", "ham"])
        #expect(stub.sent.last?.path == "/api/train/year-plans/blocks/\(PlanFixtures.yearBlock2)")
        let sent = try body(stub, "patchYearBlock")
        #expect(sent["focus"] as? [String] == ["quad", "ham"] && sent.count == 1, "only the edit rides")

        stub.on("patchYearBlock", .json(200, PlanFixtures.yearPlanJSON()))
        await m.move(PlanFixtures.yearBlock2, by: -1)
        #expect(try body(stub, "patchYearBlock")["ordinal"] as? Int == 1)
        await m.move(PlanFixtures.yearBlock2, by: 1)
        await m.move(PlanFixtures.yearBlockC, by: -1)
        #expect(stub.ops.filter { $0 == "patchYearBlock" }.count == 2, "past the last loading block / the consolidation: no call")

        stub.on("patchYearBlock", .json(200, PlanFixtures.yearPlanJSON()))
        await m.shift(PlanFixtures.yearBlock2, by: 1)
        #expect(try body(stub, "patchYearBlock")["shiftWeeks"] as? Int == 1)

        stub.on("patchYearBlock", .json(409, #"{"messages":[{"code":"TRAIN_YEAR_BLOCK_LOCKED"}]}"#))
        await m.linkRunning(PlanFixtures.yearBlock2)
        #expect(try body(stub, "patchYearBlock")["linkRunning"] as? Bool == true)
        #expect(m.actionError == .conflict("TRAIN_YEAR_BLOCK_LOCKED"))
        if case .ready = m.phase {} else { Issue.record("a refused edit keeps the plan") }
    }

    @Test(.timeLimit(.minutes(1))) func skipDecodesSuggestion() async throws {
        let stub = StubTransport()
        let m = await ready(stub)
        let warning = #"[{"code":"no_focus_this_year","group":"quad","blockId":"\#(PlanFixtures.yearBlock1)","replaces":"biceps"}]"#
        stub.on("patchYearBlock", .json(200, PlanFixtures.yearPlanJSON(warnings: warning, block2Status: "skipped")))
        await m.skip(PlanFixtures.yearBlock2, true)
        #expect(try body(stub, "patchYearBlock")["skip"] as? Bool == true)
        guard case .ready(let plan, nil) = m.phase else { Issue.record("not ready: \(m.phase)"); return }
        #expect(plan.blocks[1].status == "skipped")
        let note = try #require(plan.warnings.first)
        #expect(note.code == "no_focus_this_year" && note.group == "quad" && note.blockId == PlanFixtures.yearBlock1
                && note.replaces == "biceps")
        #expect(m.actionError == nil)
    }

    @Test(.timeLimit(.minutes(1))) func unknownNoteCodeDecodes() async throws {
        let stub = StubTransport()
        let notes = #"[{"code":"brand_new_rule","weeks":3},{"code":"pair_relaxed","ordinal":4}]"#
        let m = await ready(stub, json: PlanFixtures.yearPlanJSON(status: "future_status", warnings: notes, relaxed: notes))
        guard case .ready(let plan, _) = m.phase else { Issue.record("not ready: \(m.phase)"); return }
        #expect(plan.warnings.map(\.code) == ["brand_new_rule", "pair_relaxed"] && plan.relaxed.count == 2)
        #expect(plan.warnings[1].ordinal == 4 && plan.status == "future_status")
    }

    @Test(.timeLimit(.minutes(1))) func archiveLeavesNoPlan() async throws {
        let stub = StubTransport()
        let m = await ready(stub)
        stub.on("archiveYearPlan", .json(200, PlanFixtures.yearPlanJSON(status: "archived")))
        await m.archive()
        #expect(stub.sent.last?.path == "/api/train/year-plans/\(PlanFixtures.yearPlanId)/archive")
        #expect(m.phase == .none)
    }

    @Test(.timeLimit(.minutes(1))) func failedLoadKeepsCachedPlanWithAge() async throws {
        let dir = Self.tempDir()
        let clock = Clock(Self.saturday)
        let cache = ServerCache(directory: dir, clock: { clock.now })
        let online = StubTransport()
        online.on("getActiveYearPlan", .json(200, PlanFixtures.yearPlanJSON()))
        let first = model(online, cache: cache)
        await first.load()
        #expect(first.freshPlan?.id == PlanFixtures.yearPlanId)

        clock.now = clock.now.addingTimeInterval(3 * 3600)
        for failure in [StubTransport.Reply.fail(URLError(.notConnectedToInternet)), .status(500)] {
            let offline = StubTransport()
            offline.on("getActiveYearPlan", failure)
            let later = model(offline, cache: cache)
            await later.load()
            guard case .ready(let plan, let age) = later.phase else { Issue.record("no cached plan: \(later.phase)"); continue }
            #expect(plan.id == PlanFixtures.yearPlanId && age == "3 órás adat")
            #expect(later.freshPlan == nil, "the Következik card never shows a stale plan")
        }

        // A fresh cache entry still says it is not fresh.
        clock.now = clock.now.addingTimeInterval(-3 * 3600 + 120)
        let offline = StubTransport()
        offline.on("getActiveYearPlan", .fail(URLError(.notConnectedToInternet)))
        let soon = model(offline, cache: cache)
        await soon.load()
        guard case .ready(_, let age) = soon.phase else { Issue.record("no cached plan: \(soon.phase)"); return }
        #expect(age == "2 perces adat")
    }

    @Test(.timeLimit(.minutes(1))) func failedLoadWithoutCacheIsFailed() async {
        let stub = StubTransport()
        stub.on("getActiveYearPlan", .fail(URLError(.notConnectedToInternet)))
        let m = model(stub, cache: ServerCache(directory: Self.tempDir()))
        await m.load()
        #expect(m.phase == .failed(.offline))

        // A reload failure after a fresh read keeps the plan on screen, marked as not fresh.
        let again = StubTransport()
        let r = await ready(again)
        again.on("getActiveYearPlan", .status(500))
        await r.load()
        guard case .ready(_, let age) = r.phase else { Issue.record("plan lost: \(r.phase)"); return }
        #expect(age != nil && r.freshPlan == nil)
    }

    @Test func prefillFromYearBlock() {
        let plan = PlanFixtures.yearPlan
        let m = model(StubTransport())
        let p = m.prefill(for: plan.blocks[1], today: Self.saturday)
        #expect(p.yearBlockId == PlanFixtures.yearBlock2 && p.weeks == 6 && !p.consolidation && p.startDate == "2027-01-11")
        #expect(p.tiers["quad"] == "emphasize" && p.tiers.count == 9)
        #expect(p.tiers.filter { $0.value == "maintain" }.count == 8)

        let c = m.prefill(for: plan.blocks[2], today: Self.saturday)
        #expect(c.consolidation && c.weeks == 2 && c.tiers.values.allSatisfy { $0 == "maintain" } && c.tiers.count == 9)

        var c2 = DateComponents(); c2.year = 2026; c2.month = 11; c2.day = 30; c2.hour = 9
        let onTheDay = Self.budapest.date(from: c2)!
        let past = m.prefill(for: plan.blocks[0], today: onTheDay)
        #expect(past.startDate == nil, "a block whose day has come starts on the intake's own choice")
        #expect(m.prefill(for: plan.blocks[0], today: Self.saturday).startDate == "2026-11-30")
    }
}
