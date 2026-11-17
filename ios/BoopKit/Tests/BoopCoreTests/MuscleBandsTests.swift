import Foundation
import Testing
@testable import BoopCore

/// Where each muscle stands in the block. The rules match the web app's own week page on
/// purpose — the owner reads both, and a muscle must not be at its ceiling on one screen and
/// have room on the other.
struct MuscleBandsTests {
    func volume(_ muscle: String, mev: Int, mav: Int, mrv: Int, current: Int,
                weeks: [(Int, Int, Int?)] = []) -> MuscleVolume {
        MuscleVolume(muscle: muscle, region: "coral", mev: mev, mav: mav, mrv: mrv, current: current,
                     weeks: weeks.map { MuscleVolumeWeek(week: $0.0, phase: .mav, planned: $0.1,
                                                         actual: $0.2, isCurrent: $0.0 == 3) })
    }

    func block(_ muscles: [MuscleVolume], priorities: [String: String] = [:]) -> BlockPlan {
        BlockPlan(id: UUID(), title: "Ősz", shortTitle: "Ősz", status: "active",
                  startDate: "2026-11-01", endDate: "2026-12-27", weeks: 8, currentWeek: 3,
                  split: "5 napos", style: "hypertrophy",
                  phaseCurve: [.mev, .mav, .mav, .mrv, .deload, .mav, .mrv, .mrv],
                  musclePriorities: priorities, muscles: muscles)
    }

    @Test func theCeilingIsWhatThePlanWillDo_notTheBodysLimit() {
        // The one idea the page rests on. The same muscle, three priorities, three ceilings.
        let m = volume("chest", mev: 8, mav: 14, mrv: 20, current: 10)
        let emphasise = muscleBands(block([m], priorities: ["chest": "emphasize"])).first
        let grow = muscleBands(block([m])).first                          // the default
        let maintain = muscleBands(block([m], priorities: ["chest": "maintain"])).first

        #expect(emphasise?.ceiling == 20)
        #expect(grow?.ceiling == 14)
        #expect(maintain?.ceiling == 8)
        // And a maintained muscle is never told it has room: the plan is not taking it there.
        #expect(maintain?.room == 0)
        #expect(maintain?.verdict == "Ezt most szinten tartod.")
        #expect(grow?.verdict == "Még 4 szett fér bele.")
    }

    @Test func aMuscleAtItsCeilingSaysSo() {
        let bands = muscleBands(block([volume("back", mev: 10, mav: 16, mrv: 22, current: 16)]))
        #expect(bands.first?.room == 0)
        #expect(bands.first?.standing == .atCeiling)
        #expect(bands.first?.verdict == "Elérte a felső értéket ebben a tervben.")
        #expect(bands.first?.step == 0)       // nothing to add on Monday
    }

    @Test func mondaysStepIsClampedToWhatFitsUnderTheCeiling() {
        // One set short of the ceiling gets +1, not the nominal +2: the engine never overshoots.
        let one = muscleBands(block([volume("quad", mev: 8, mav: 14, mrv: 20, current: 13)])).first
        let plenty = muscleBands(block([volume("quad", mev: 8, mav: 14, mrv: 20, current: 8)])).first
        #expect(one?.step == 1)
        #expect(plenty?.step == 2)
    }

    @Test func theMusclesWithRoomLeadTheList() {
        let bands = muscleBands(block([
            volume("chest", mev: 8, mav: 14, mrv: 20, current: 14),   // no room
            volume("back", mev: 10, mav: 16, mrv: 22, current: 10),   // 6 sets of room
            volume("calf", mev: 8, mav: 12, mrv: 18, current: 10),    // 2 sets of room
        ]))
        #expect(bands.map(\.muscle) == ["back", "calf", "chest"])
    }

    @Test func theLevelIsAgainstItsOwnCeiling_neverPastTheRim() {
        // A log that ran ahead of the plan must not draw a bar past the end of its vessel.
        let over = muscleBands(block([volume("chest", mev: 8, mav: 14, mrv: 20, current: 18)])).first
        #expect(over?.level == 1)
        #expect(over?.room == 0)
    }

    @Test func theWeekSummaryCountsAndCompares() {
        let bands = muscleBands(block([
            volume("chest", mev: 8, mav: 14, mrv: 20, current: 12, weeks: [(2, 10, 10), (3, 12, nil)]),
            volume("back", mev: 10, mav: 16, mrv: 22, current: 16, weeks: [(2, 14, 14), (3, 16, nil)]),
            volume("calf", mev: 8, mav: 12, mrv: 18, current: 8, weeks: [(2, 8, 8), (3, 8, nil)]),
        ], priorities: ["calf": "maintain"]))
        let summary = blockWeekSummary(bands)

        #expect(summary.muscles == 3)
        #expect(summary.total == 36)
        #expect(summary.previous == 32)
        #expect(summary.delta == 4)
        #expect(summary.deltaLine == "4 szettel több a múlt héthez képest.")
        #expect(summary.growing == 1)        // chest
        #expect(summary.atCeiling == 1)      // back
        #expect(summary.held == 1)           // calf, maintained
        #expect(summary.stateLine == "1 izomban van még hova nőni, 1 elérte a felső értéket, 1 izmot csak szinten tartasz.")
    }

    @Test func theFirstWeekHasNothingToCompareWith() {
        let bands = muscleBands(block([volume("chest", mev: 8, mav: 14, mrv: 20, current: 8)]))
        let summary = blockWeekSummary(bands)
        #expect(summary.previous == nil)
        #expect(summary.delta == nil)
        #expect(summary.deltaLine == "Ez a terv első hete — még nincs mihez mérni.")
    }

    @Test func anEmptyClauseIsLeftOutRatherThanPrintedAsZero() {
        let bands = muscleBands(block([volume("chest", mev: 8, mav: 14, mrv: 20, current: 10)]))
        #expect(blockWeekSummary(bands).stateLine == "1 izomban van még hova nőni.")
    }
}
