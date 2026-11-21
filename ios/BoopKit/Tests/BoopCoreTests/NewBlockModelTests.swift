import Foundation
import Testing
@testable import BoopCore

// The new-block intake (mezo-r36n9.113): season days → candidates, debounced refresh on every edit, the tier budget
// check, and "Ezzel kezdem" → generate (with the split) → create → start.

@Suite("NewBlockModel — the new-block intake")
@MainActor
struct NewBlockModelTests {
    /// Saturday 2026-11-21, noon in Budapest.
    private static let saturday: Date = {
        var c = DateComponents(); c.year = 2026; c.month = 11; c.day = 21; c.hour = 12
        return budapest.date(from: c)!
    }()
    private static let budapest: Calendar = {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!; return cal
    }()

    private func model(_ stub: StubTransport, days: [Int]? = [0, 3], now: Date = saturday,
                       debounce: Duration = .milliseconds(20)) -> NewBlockModel {
        NewBlockModel(client: PlanFixtures.planClient(stub), seasonGymDays: days, debounce: debounce,
                      now: { now }, calendar: Self.budapest)
    }

    private func body(_ stub: StubTransport, _ op: String) throws -> [String: Any] {
        let sent = try #require(stub.sent.last { $0.op == op }?.body)
        return try #require(JSONSerialization.jsonObject(with: Data(sent.utf8)) as? [String: Any])
    }

    private func withCandidates(_ stub: StubTransport, json: String = PlanFixtures.candidatesJSON()) async -> NewBlockModel {
        stub.on("getMesoPlanCandidates", .json(200, json))
        let m = model(stub)
        await m.refresh()
        return m
    }

    @Test(.timeLimit(.minutes(1))) func noSeasonNeedsSeasonWithoutCalls() async {
        for days in [nil, [Int]()] as [[Int]?] {
            let stub = StubTransport()
            let m = model(stub, days: days)
            #expect(m.phase == .needsSeason)
            await m.refresh()
            m.weeks = 7
            try? await Task.sleep(for: .milliseconds(80))
            #expect(m.phase == .needsSeason && stub.sent.isEmpty, "nothing is asked without season days")
        }
    }

    @Test(.timeLimit(.minutes(1))) func editRefreshesCandidatesDebounced() async throws {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        guard case .candidates(let first) = m.phase else { Issue.record("no candidates: \(m.phase)"); return }
        #expect(first.candidates.count == 2 && m.budget?.capacitySets == 60, "the budget is the recommended candidate's")
        let request = try body(stub, "getMesoPlanCandidates")
        #expect(request["daysOfWeek"] as? [String] == ["Hét", "Csü"])
        #expect(request["weeks"] as? Int == 6 && request["sessionMinutesTarget"] as? Int == 60)
        #expect(request["priorities"] == nil, "no tier chosen = nothing sent")

        stub.on("getMesoPlanCandidates", .json(200, PlanFixtures.candidatesJSON(budget: PlanFixtures.budgetJSON(capacity: 80))))
        m.weeks = 7
        m.minutes = 75
        m.tiers = ["back": "emphasize", "chest": "grow"]
        await m.pendingRefresh?.value
        #expect(stub.ops.filter { $0 == "getMesoPlanCandidates" }.count == 2, "three quick edits ask once")
        let again = try body(stub, "getMesoPlanCandidates")
        #expect(again["weeks"] as? Int == 7 && again["sessionMinutesTarget"] as? Int == 75)
        #expect(again["priorities"] as? [String: String] == ["back": "emphasize"], "Építés is the absence of a key")
        #expect(m.budget?.capacitySets == 80)
    }

    @Test(.timeLimit(.minutes(1))) func weeksStayInRange() {
        let m = model(StubTransport(), days: nil)
        m.weeks = 12; #expect(m.weeks == 8)
        m.weeks = 2; #expect(m.weeks == 4)
    }

    @Test(.timeLimit(.minutes(1))) func raiseBlockedWhenEmphasizeFull() async {
        let m = await withCandidates(StubTransport())
        m.tiers = ["back": "emphasize", "quad": "emphasize"]
        #expect(m.canRaise("chest") == .emphasizeFull, "chest is Építés (no key); two Hangsúly already")
        #expect(m.canRaise("back") == .emphasizeFull, "Hangsúly has no tier above it")
        m.tiers["chest"] = "maintain"
        #expect(m.canRaise("chest") == .ok, "maintain → grow is not a Hangsúly")
    }

    @Test(.timeLimit(.minutes(1))) func raiseBlockedWhenNoRoom() async {
        let m = await withCandidates(StubTransport())
        // capacity 60, used 52 → room 8: biceps costs 12, chest 4.
        #expect(m.canRaise("biceps") == .noRoom(minutes: 60, days: 2))
        #expect(m.canRaise("chest") == .ok)
        #expect(m.canRaise("calf") == .ok, "a muscle the budget has no cost for is not blocked")
    }

    @Test(.timeLimit(.minutes(1))) func noCapacityNeverBlocksForRoom() async {
        let m = await withCandidates(StubTransport(), json: PlanFixtures.candidatesJSON(budget: PlanFixtures.budgetJSON(capacity: nil)))
        #expect(m.canRaise("biceps") == .ok)
    }

    @Test(.timeLimit(.minutes(1))) func loweringAlwaysAllowed() async {
        let m = await withCandidates(StubTransport(), json: PlanFixtures.candidatesJSON(budget: PlanFixtures.budgetJSON(used: 90)))
        m.tiers = ["back": "emphasize", "quad": "emphasize", "biceps": "grow"]
        #expect(m.check("back", to: "grow") == .ok)
        #expect(m.check("biceps", to: "maintain") == .ok)
        #expect(m.check("quad", to: "maintain") == .ok)
        #expect(m.check("biceps", to: "emphasize") == .emphasizeFull)
    }

    @Test(.timeLimit(.minutes(1))) func chooseCreatesAndStarts() async throws {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        guard case .candidates(let c) = m.phase else { Issue.record("no candidates"); return }
        stub.on("generateMesoPlan", .json(200, PlanFixtures.generateJSON))
        stub.on("createMesoTemplate", .json(200, #"{"id":"\#(PlanFixtures.templateId)"}"#))
        stub.on("startMesoTemplate", .json(200, PlanFixtures.startedBlockJSON()))
        await m.choose(c.candidates[0])
        #expect(m.phase == .created(blockId: PlanFixtures.newBlockId))
        #expect(stub.ops.suffix(3) == ["generateMesoPlan", "createMesoTemplate", "startMesoTemplate"])
        let generate = try body(stub, "generateMesoPlan")
        #expect(generate["split"] as? String == "ul" && generate["weeks"] as? Int == 6)
        #expect(generate["daysOfWeek"] as? [String] == ["Hét", "Csü"])
        let created = try body(stub, "createMesoTemplate")
        #expect(created["title"] as? String == "Generált", "the generated template is what is saved")
        let start = try body(stub, "startMesoTemplate")
        #expect(start["startDate"] as? String == "2026-11-23" && start["status"] as? String == "planned")
        #expect(stub.sent.last?.path == "/api/train/meso-templates/\(PlanFixtures.templateId)/start")
    }

    @Test(.timeLimit(.minutes(1))) func startTodayIsActive() async throws {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        guard case .candidates(let c) = m.phase else { Issue.record("no candidates"); return }
        m.startChoice = .today
        stub.on("generateMesoPlan", .json(200, PlanFixtures.generateJSON))
        stub.on("createMesoTemplate", .json(200, #"{"id":"\#(PlanFixtures.templateId)"}"#))
        stub.on("startMesoTemplate", .json(200, PlanFixtures.startedBlockJSON(status: "active")))
        await m.choose(c.candidates[1])
        let start = try body(stub, "startMesoTemplate")
        #expect(start["startDate"] as? String == "2026-11-21" && start["status"] as? String == "active")
    }

    @Test func nextMondayIsStrictlyAfterToday() {
        var c = DateComponents(); c.year = 2026; c.month = 11; c.day = 23; c.hour = 8
        let monday = Self.budapest.date(from: c)!
        #expect(NewBlockModel.startDate(.nextMonday, now: monday, calendar: Self.budapest) == "2026-11-30")
        c.day = 22
        let sunday = Self.budapest.date(from: c)!
        #expect(NewBlockModel.startDate(.nextMonday, now: sunday, calendar: Self.budapest) == "2026-11-23")
        #expect(NewBlockModel.startDate(.today, now: sunday, calendar: Self.budapest) == "2026-11-22")
    }

    @Test(.timeLimit(.minutes(1))) func generateFailureUsesCandidateTemplate() async throws {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        guard case .candidates(let c) = m.phase else { Issue.record("no candidates"); return }
        stub.on("generateMesoPlan", .status(500))
        stub.on("createMesoTemplate", .json(200, #"{"id":"\#(PlanFixtures.templateId)"}"#))
        stub.on("startMesoTemplate", .json(200, PlanFixtures.startedBlockJSON()))
        await m.choose(c.candidates[0])
        #expect(m.phase == .created(blockId: PlanFixtures.newBlockId))
        #expect(try body(stub, "createMesoTemplate")["title"] as? String == "Felső-alsó", "the candidate's own template")
    }

    @Test(.timeLimit(.minutes(1))) func seasonRequired409GoesToNeedsSeason() async throws {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        guard case .candidates(let c) = m.phase else { Issue.record("no candidates"); return }
        stub.on("generateMesoPlan", .json(200, PlanFixtures.generateJSON))
        stub.on("createMesoTemplate", .json(200, #"{"id":"\#(PlanFixtures.templateId)"}"#))
        stub.on("startMesoTemplate", .json(409, #"{"messages":[{"code":"SEASON_REQUIRED","message":"x"}]}"#))
        await m.choose(c.candidates[0])
        #expect(m.phase == .needsSeason)
    }

    @Test(.timeLimit(.minutes(1))) func retryAfterAFailedStartReusesTheTemplate() async throws {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        guard case .candidates(let c) = m.phase else { Issue.record("no candidates"); return }
        stub.on("generateMesoPlan", .json(200, PlanFixtures.generateJSON))
        stub.on("createMesoTemplate", .json(200, #"{"id":"\#(PlanFixtures.templateId)"}"#))
        stub.on("startMesoTemplate", .fail(URLError(.notConnectedToInternet)))
        await m.choose(c.candidates[0])
        #expect(m.phase == .failed(.offline))
        stub.on("startMesoTemplate", .json(200, PlanFixtures.startedBlockJSON()))
        await m.choose(c.candidates[0])
        #expect(m.phase == .created(blockId: PlanFixtures.newBlockId))
        #expect(stub.ops.filter { $0 == "createMesoTemplate" }.count == 1, "no second template for the same choice")
    }

    @Test(.timeLimit(.minutes(1))) func candidatesFailureIsShown() async {
        let stub = StubTransport()
        stub.on("getMesoPlanCandidates", .json(400, #"{"messages":[{"code":"TRAIN_MESO_EMPHASIZE_CAP"}]}"#))
        let m = model(stub)
        await m.refresh()
        #expect(m.phase == .failed(.rejected("TRAIN_MESO_EMPHASIZE_CAP")))
    }
}
