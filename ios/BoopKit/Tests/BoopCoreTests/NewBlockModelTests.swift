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
        #expect(first.candidates.count == 2 && m.intakeBudget?.capacitySets == 60, "the keret is the server's intake budget")
        let request = try body(stub, "getMesoPlanCandidates")
        #expect(request["daysOfWeek"] as? [String] == ["Hét", "Csü"])
        #expect(request["weeks"] as? Int == 6 && request["sessionMinutesTarget"] as? Int == 60)
        #expect(request["priorities"] == nil, "no tier chosen = nothing sent")

        stub.on("getMesoPlanCandidates", .json(200, PlanFixtures.candidatesJSON(intake: PlanFixtures.intakeJSON(capacity: 80))))
        m.weeks = 7
        m.minutes = 75
        m.tiers = ["back": "emphasize", "chest": "grow"]
        await m.pendingRefresh?.value
        #expect(stub.ops.filter { $0 == "getMesoPlanCandidates" }.count == 2, "three quick edits ask once")
        let again = try body(stub, "getMesoPlanCandidates")
        #expect(again["weeks"] as? Int == 7 && again["sessionMinutesTarget"] as? Int == 75)
        #expect(again["priorities"] as? [String: String] == ["back": "emphasize"], "Építés is the absence of a key")
        #expect(m.intakeBudget?.capacitySets == 80)
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
        // The server tried each raise: biceps one tier up leaves no candidate, chest still offers one.
        #expect(m.canRaise("biceps") == .noRoom(minutes: 60, days: 2))
        #expect(m.canRaise("chest") == .ok)
        #expect(m.canRaise("calf") == .ok, "a muscle the server did not price is not blocked")
    }

    @Test(.timeLimit(.minutes(1))) func noVerdictsNeverBlockForRoom() async {
        // Without a target the server sends no verdicts: only the Hangsúly cap can block.
        let m = await withCandidates(StubTransport(), json: PlanFixtures.candidatesJSON(intake: PlanFixtures.intakeJSON(capacity: nil, raiseAllowed: "{}")))
        #expect(m.canRaise("biceps") == .ok)
        let old = await withCandidates(StubTransport(), json: PlanFixtures.candidatesJSON().replacingOccurrences(of: #""intakeBudget":"#, with: #""oldServer":"#))
        #expect(old.intakeBudget == nil && old.canRaise("biceps") == .ok, "a server without the intake budget blocks nothing")
    }

    @Test(.timeLimit(.minutes(1))) func verdictPricesOnlyTheTierTheServerSaw() async {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        stub.on("getMesoPlanCandidates", .slowJson(200, PlanFixtures.candidatesJSON(), ms: 2_000))
        // biceps was priced from Építés; once it is Tartás on screen (the ask still on its way) the verdict is about
        // another step and does not block.
        m.tiers["biceps"] = "maintain"
        #expect(m.canRaise("biceps") == .ok)
        m.pendingRefresh?.cancel()
    }

    @Test(.timeLimit(.minutes(1))) func failedRefreshClearsTheKeret() async {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        #expect(m.intakeBudget != nil)
        stub.on("getMesoPlanCandidates", .fail(URLError(.notConnectedToInternet)))
        m.minutes = 75
        await m.pendingRefresh?.value
        #expect(m.phase == .failed(.offline))
        #expect(m.intakeBudget == nil, "no stale keret beside the failure notice")
    }

    @Test(.timeLimit(.minutes(1))) func seasonDaysOutsideTwoToSixAskNothing() async {
        for days in [[2], [0, 1, 2, 3, 4, 5, 6]] {
            let stub = StubTransport()
            let m = model(stub, days: days)
            #expect(m.phase == .seasonDaysOutOfRange(days.count))
            await m.refresh()
            m.minutes = 75
            try? await Task.sleep(for: .milliseconds(80))
            #expect(m.phase == .seasonDaysOutOfRange(days.count) && stub.sent.isEmpty, "no candidates call for \(days.count) days")
        }
        #expect(model(StubTransport(), days: [0, 1, 2, 3, 4, 5]).phase == .editing)
    }

    @Test(.timeLimit(.minutes(1))) func minutesAboveTheChoicesGetTheirOwnPill() async {
        let m = await withCandidates(StubTransport(), json: PlanFixtures.candidatesJSON(nothingFits: true))
        #expect(m.minuteOptions == [45, 60, 75, 90])
        #expect(m.applyFix(WireFix(code: "more_minutes", value: 105)) == .applied)
        #expect(m.minuteOptions == [45, 60, 75, 90, 105] && m.minutes == 105)
        m.pendingRefresh?.cancel()
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
        #expect(generate["sessionMinutesTarget"] as? Int == 60, "the offered minutes ride along")
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
        #expect(m.phase == .candidates(c), "a failed start keeps the candidates on screen")
        #expect(m.createError == .offline, "the start's failure is not a candidates failure")
        stub.on("startMesoTemplate", .json(200, PlanFixtures.startedBlockJSON()))
        await m.choose(c.candidates[0])
        #expect(m.phase == .created(blockId: PlanFixtures.newBlockId))
        #expect(m.createError == nil)
        #expect(stub.ops.filter { $0 == "createMesoTemplate" }.count == 1, "no second template for the same choice")
    }

    // MARK: Task 6 review fixes (mezo-r36n9.113)

    @Test(.timeLimit(.minutes(1))) func clampedWeeksStillRefresh() async throws {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        stub.on("getMesoPlanCandidates", .json(200, PlanFixtures.candidatesJSON()))
        m.weeks = 12
        #expect(m.weeks == 8)
        await m.pendingRefresh?.value
        #expect(stub.ops.filter { $0 == "getMesoPlanCandidates" }.count == 2, "a clamped change is still a change")
        #expect(try body(stub, "getMesoPlanCandidates")["weeks"] as? Int == 8)
        m.weeks = 9
        #expect(m.weeks == 8)
        try? await Task.sleep(for: .milliseconds(80))
        #expect(stub.ops.filter { $0 == "getMesoPlanCandidates" }.count == 2,
                "clamped back to the same value: nothing to ask (\(stub.ops))")
    }

    @Test(.timeLimit(.minutes(1))) func savedTemplateIsKeyedOnMinutesToo() async throws {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        guard case .candidates(let c) = m.phase else { Issue.record("no candidates"); return }
        stub.on("generateMesoPlan", .json(200, PlanFixtures.generateJSON))
        stub.on("createMesoTemplate", .json(200, #"{"id":"\#(PlanFixtures.templateId)"}"#))
        stub.on("startMesoTemplate", .fail(URLError(.notConnectedToInternet)))
        await m.choose(c.candidates[0])
        #expect(m.createError == .offline)
        stub.on("getMesoPlanCandidates", .json(200, PlanFixtures.candidatesJSON()))
        m.minutes = 75
        await m.pendingRefresh?.value
        stub.on("generateMesoPlan", .json(200, PlanFixtures.generateJSON))
        stub.on("createMesoTemplate", .json(200, #"{"id":"\#(PlanFixtures.templateId)"}"#))
        stub.on("startMesoTemplate", .json(200, PlanFixtures.startedBlockJSON()))
        await m.choose(c.candidates[0])
        #expect(m.phase == .created(blockId: PlanFixtures.newBlockId))
        #expect(stub.ops.filter { $0 == "createMesoTemplate" }.count == 2, "another session length is another choice")
    }

    @Test(.timeLimit(.minutes(1))) func raisesStepOneTierAtATime() async {
        let m = await withCandidates(StubTransport())
        m.tiers = ["back": "emphasize", "quad": "emphasize", "chest": "maintain"]
        // Tartás → Hangsúly is two tiers: only the adjacent step (Építés) is checked and taken.
        #expect(m.check("chest", to: "emphasize") == .ok, "the step to Építés fits (cost 4, room 8)")
        #expect(m.setTier("chest", "emphasize") == .ok)
        #expect(m.tier("chest") == "grow", "one tier per tap")
        #expect(m.setTier("chest", "emphasize") == .emphasizeFull, "the next step meets the Hangsúly cap")
        #expect(m.tier("chest") == "grow")
        #expect(m.setTier("back", "maintain") == .ok && m.tier("back") == "maintain", "lowering jumps straight")
    }

    @Test(.timeLimit(.minutes(1))) func blockedRaiseLeavesTheTier() async {
        let m = await withCandidates(StubTransport())
        #expect(m.setTier("biceps", "emphasize") == .noRoom(minutes: 60, days: 2))
        #expect(m.tier("biceps") == "grow")
    }

    @Test(.timeLimit(.minutes(1))) func fixesApply() async {
        let m = await withCandidates(StubTransport(), json: PlanFixtures.candidatesJSON(nothingFits: true))
        m.tiers = ["back": "emphasize", "biceps": "emphasize"]
        #expect(m.applyFix(WireFix(code: "more_minutes", value: 75)) == .applied)
        #expect(m.minutes == 75)
        // back has 7 weekly sets in the closest candidate, biceps 3: the bigger one comes down to Építés.
        #expect(m.applyFix(WireFix(code: "fewer_emphasis", value: nil)) == .applied)
        #expect(m.tier("back") == "grow" && m.tier("biceps") == "emphasize")
        #expect(m.applyFix(WireFix(code: "more_days", value: nil)) == .needsSeasonDays)
        // The server names the muscle: exactly that one comes down, even when it is not the heaviest.
        m.tiers = ["back": "emphasize", "biceps": "emphasize"]
        #expect(m.applyFix(WireFix(code: "fewer_emphasis", value: nil, muscle: "biceps")) == .applied)
        #expect(m.tier("biceps") == "grow" && m.tier("back") == "emphasize")
        // A named muscle no longer on Hangsúly falls back to the heaviest.
        m.tiers = ["back": "emphasize", "quad": "emphasize"]
        #expect(m.applyFix(WireFix(code: "fewer_emphasis", value: nil, muscle: "biceps")) == .applied)
        #expect(m.tier("back") == "grow" && m.tier("quad") == "emphasize")
        #expect(m.applyFix(WireFix(code: "future_fix", value: nil)) == .unknown)
    }

    @Test(.timeLimit(.minutes(1))) func startFailureKeepsCandidatesAndRetriesTheStart() async throws {
        let stub = StubTransport()
        let m = await withCandidates(stub)
        guard case .candidates(let c) = m.phase else { Issue.record("no candidates"); return }
        stub.on("generateMesoPlan", .status(500))
        stub.on("createMesoTemplate", .status(500))
        await m.choose(c.candidates[1])
        #expect(m.phase == .candidates(c) && m.createError == .server, "nothing created: the choices stay, the error is the start's")
        #expect(!stub.ops.contains("startMesoTemplate"))
        stub.on("generateMesoPlan", .json(200, PlanFixtures.generateJSON))
        stub.on("createMesoTemplate", .json(200, #"{"id":"\#(PlanFixtures.templateId)"}"#))
        stub.on("startMesoTemplate", .json(200, PlanFixtures.startedBlockJSON()))
        await m.choose(c.candidates[1])
        #expect(m.phase == .created(blockId: PlanFixtures.newBlockId) && m.createError == nil)
        #expect(stub.ops.filter { $0 == "getMesoPlanCandidates" }.count == 1, "retrying the start does not ask for candidates again")
    }

    @Test(.timeLimit(.minutes(1))) func candidatesFailureIsShown() async {
        let stub = StubTransport()
        stub.on("getMesoPlanCandidates", .json(400, #"{"messages":[{"code":"TRAIN_MESO_EMPHASIZE_CAP"}]}"#))
        let m = model(stub)
        await m.refresh()
        #expect(m.phase == .failed(.rejected("TRAIN_MESO_EMPHASIZE_CAP")))
    }
}
