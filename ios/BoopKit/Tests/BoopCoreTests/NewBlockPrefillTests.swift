import Foundation
import Testing
@testable import BoopCore

// The intake pre-filled from a year block (mezo-r36n9.113): the block's focus is Hangsúly and everything else Tartás,
// its weeks are the block length, a consolidation locks the tiers and rides `consolidation: true`, the start carries
// the year block id and the block's own date when it is still ahead.

@Suite("NewBlockModel — pre-filled from the year plan")
@MainActor
struct NewBlockPrefillTests {
    private static let saturday = YearPlanModelTests.saturday
    private static let budapest = YearPlanModelTests.budapest

    private func prefill(_ index: Int, today: Date = saturday) -> YearBlockPrefill {
        let m = YearPlanModel(client: PlanFixtures.planClient(StubTransport()), cache: nil, now: { today }, calendar: Self.budapest)
        return m.prefill(for: PlanFixtures.yearPlan.blocks[index], today: today)
    }

    private func model(_ stub: StubTransport, _ prefill: YearBlockPrefill, now: Date = saturday) -> NewBlockModel {
        NewBlockModel(client: PlanFixtures.planClient(stub), seasonGymDays: [0, 3], debounce: .milliseconds(20),
                      now: { now }, calendar: Self.budapest, prefill: prefill)
    }

    private func body(_ stub: StubTransport, _ op: String) throws -> [String: Any] {
        let sent = try #require(stub.sent.last { $0.op == op }?.body)
        return try #require(JSONSerialization.jsonObject(with: Data(sent.utf8)) as? [String: Any])
    }

    /// Candidates → choose the lead → generate → save → start.
    private func start(_ stub: StubTransport, _ m: NewBlockModel) async {
        stub.on("getMesoPlanCandidates", .json(200, PlanFixtures.candidatesJSON()))
        stub.on("generateMesoPlan", .json(200, PlanFixtures.generateJSON))
        stub.on("createMesoTemplate", .json(201, #"{"id":"7e000000-0000-4000-8000-000000000001"}"#))
        stub.on("startMesoTemplate", .json(201, PlanFixtures.startedBlockJSON()))
        await m.refresh()
        guard case .candidates(let c) = m.phase, let lead = c.candidates.first else { Issue.record("no candidates: \(m.phase)"); return }
        await m.choose(lead)
    }

    @Test(.timeLimit(.minutes(1))) func prefillSetsTiersAndWeeks() async throws {
        let stub = StubTransport()
        let m = model(stub, prefill(1))
        #expect(m.weeks == 6 && !m.tiersLocked)
        #expect(m.tier("quad") == "emphasize" && m.tier("back") == "maintain" && m.tier("calf") == "maintain")
        stub.on("getMesoPlanCandidates", .json(200, PlanFixtures.candidatesJSON()))
        await m.refresh()
        let sent = try body(stub, "getMesoPlanCandidates")
        let priorities = try #require(sent["priorities"] as? [String: String])
        #expect(priorities["quad"] == "emphasize" && priorities.count == 9)
        #expect(sent["consolidation"] == nil, "a loading block sends no flag")
        m.weeks = 12; #expect(m.weeks == 8, "a loading block keeps the 4–8 range")
    }

    @Test(.timeLimit(.minutes(1))) func consolidationLocksTiersAndSendsFlag() async throws {
        let stub = StubTransport()
        let m = model(stub, prefill(2))
        #expect(m.tiersLocked && m.weeks == 2)
        #expect(m.tiers.values.allSatisfy { $0 == "maintain" })
        m.setTier("back", "emphasize")
        #expect(m.tier("back") == "maintain", "the consolidation's tiers do not move")
        m.weeks = 6
        #expect(m.weeks == 2, "no stepper on the consolidation")
        await start(stub, m)
        let candidates = try body(stub, "getMesoPlanCandidates")
        #expect(candidates["consolidation"] as? Bool == true && candidates["weeks"] as? Int == 2)
        let generate = try body(stub, "generateMesoPlan")
        #expect(generate["consolidation"] as? Bool == true && generate["weeks"] as? Int == 2)
        #expect(m.phase == .created(blockId: PlanFixtures.newBlockId))
    }

    @Test(.timeLimit(.minutes(1))) func startCarriesYearBlockId() async throws {
        let stub = StubTransport()
        let m = model(stub, prefill(1))
        await start(stub, m)
        let sent = try body(stub, "startMesoTemplate")
        #expect(sent["yearBlockId"] as? String == PlanFixtures.yearBlock2)

        // Without a prefill nothing extra rides.
        let plain = StubTransport()
        let n = NewBlockModel(client: PlanFixtures.planClient(plain), seasonGymDays: [0, 3], debounce: .milliseconds(20),
                              now: { Self.saturday }, calendar: Self.budapest)
        await start(plain, n)
        let plainSent = try body(plain, "startMesoTemplate")
        #expect(plainSent["yearBlockId"] == nil && plainSent["startDate"] as? String == "2026-11-23")
        #expect(try body(plain, "getMesoPlanCandidates")["consolidation"] == nil)
    }

    @Test(.timeLimit(.minutes(1))) func plannedStartDateUsed() async throws {
        let stub = StubTransport()
        let m = model(stub, prefill(1))
        #expect(m.startChoice == .planned("2027-01-11"))
        await start(stub, m)
        let sent = try body(stub, "startMesoTemplate")
        #expect(sent["startDate"] as? String == "2027-01-11" && sent["status"] as? String == "planned")
    }

    @Test(.timeLimit(.minutes(1))) func dueOrOverdueBlockStartsToday() async throws {
        var c = DateComponents(); c.year = 2027; c.month = 1; c.day = 13; c.hour = 12  // a Wednesday, block 2 is due
        let wednesday = Self.budapest.date(from: c)!
        let p = prefill(1, today: wednesday)
        #expect(p.startDate == nil)
        let stub = StubTransport()
        let m = model(stub, p, now: wednesday)
        #expect(m.startChoice == .today)
        await start(stub, m)
        let sent = try body(stub, "startMesoTemplate")
        #expect(sent["startDate"] as? String == "2027-01-13" && sent["status"] as? String == "active")
        #expect(sent["yearBlockId"] as? String == PlanFixtures.yearBlock2)

        // On the block's own day too.
        var d = DateComponents(); d.year = 2027; d.month = 1; d.day = 11; d.hour = 8
        let monday = Self.budapest.date(from: d)!
        #expect(model(StubTransport(), prefill(1, today: monday), now: monday).startChoice == .today)
    }

    @Test func prefillCarriesOrdinalAndFocus() {
        let p = prefill(1)
        #expect(p.ordinal == PlanFixtures.yearPlan.blocks[1].ordinal)
        #expect(p.focus == PlanFixtures.yearPlan.blocks[1].focus)
        #expect(prefill(2).focus.isEmpty, "a consolidation has no focus")
    }

    /// The start-day choices: the year block's own day first (when it is still ahead), then next Monday, then today;
    /// next Monday is left out when it is that same day.
    @Test func startOptionsOfferThePlannedDate() {
        let ahead = model(StubTransport(), prefill(1))
        #expect(ahead.startOptions == [.planned("2027-01-11"), .nextMonday, .today])

        // Planned for next Monday (2026-11-23 from Saturday 2026-11-21): one choice for that day, not two.
        let nextWeek = YearBlockPrefill(yearBlockId: "x", tiers: [:], weeks: 6, consolidation: false, startDate: "2026-11-23")
        #expect(model(StubTransport(), nextWeek).startOptions == [.planned("2026-11-23"), .today])

        // Due: no planned day, the plain pair.
        var c = DateComponents(); c.year = 2027; c.month = 1; c.day = 13; c.hour = 12
        let wednesday = Self.budapest.date(from: c)!
        #expect(model(StubTransport(), prefill(1, today: wednesday), now: wednesday).startOptions == [.nextMonday, .today])

        // A free new block: the plain pair.
        let free = NewBlockModel(client: PlanFixtures.planClient(StubTransport()), seasonGymDays: [0, 3],
                                 now: { Self.saturday }, calendar: Self.budapest)
        #expect(free.startOptions == [.nextMonday, .today])
    }
}
