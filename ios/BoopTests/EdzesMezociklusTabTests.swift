import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// The Mezociklus tab after the Edzés redesign (mezo-r36n9.197.2, spec 2026-11-27 §5.2): the hero decides its own state —
/// and never says „Nincs futó mezociklusod" before the first answer did — and the muscle card shows the top five.
@MainActor
struct EdzesMezociklusTabTests {
    let transport = ScriptedTransport()

    func block() -> BlockPlan {
        BlockPlan(id: UUID(), title: "Hypertrophy", shortTitle: "Hyp", status: "active", startDate: "2026-11-02",
                  endDate: "2026-12-06", weeks: 5, currentWeek: 3, split: "felső–alsó", style: "rp")
    }

    @Test func heroIsLoadingUntilFirstAnswer() {
        #expect(MezoHeroState.resolve(block: nil, firstAnswerArrived: false, failure: nil, planned: nil) == .loading)
        #expect(MezoHeroState.resolve(block: nil, firstAnswerArrived: true, failure: nil, planned: nil) == .none(planned: nil))
        #expect(MezoHeroState.resolve(block: nil, firstAnswerArrived: true, failure: "A mezociklusodat most nem érem el",
                                      planned: nil) == .failed("A mezociklusodat most nem érem el"))
    }

    @Test func aBlockWinsOverEverythingElse() {
        let b = block()
        // A cached block shows even before the first answer, and a failed refresh never hides it.
        #expect(MezoHeroState.resolve(block: b, firstAnswerArrived: false, failure: nil, planned: nil) == .running(b))
        #expect(MezoHeroState.resolve(block: b, firstAnswerArrived: true, failure: "x", planned: nil) == .running(b))
    }

    @Test func muscleRowsCapsAtFiveWithMore() {
        let bands = (1...8).map {
            MuscleBand(muscle: "m\($0)", tier: .emphasize, current: $0, ceiling: 20, mev: 6, mrv: 20, step: 2)
        }
        let result = muscleRows(bands)
        #expect(result.rows.count == 5)
        #expect(result.more == 3)
        #expect(result.rows.first?.current == 8, "hardest-worked first")
        #expect(muscleRows(Array(bands.prefix(3))).more == 0)
    }

    @Test func weeksArcLabelsTheCurrentWeek() {
        let weeks = [NKBlockWeek(week: 1, load: 0.5, phase: "Alap", state: .past),
                     NKBlockWeek(week: 2, load: 0.8, phase: "Építés", state: .current),
                     NKBlockWeek(week: 3, load: 0.3, phase: "Deload", state: .future, isDeload: true)]
        #expect(EdzesWeeksArc.accessibilityText(weeks) == "3 hetes mezociklus, a 2. héten jársz: Építés")
        #expect(EdzesWeeksArc.accessibilityText([]) == "A mezociklus hetei")
    }

    @Test func storeMarksTheFirstBlockAnswer() async {
        transport.on("listMesocycles", 200, "[]")
        let store = EdzesStore(client: TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)),
                               cache: nil, clock: { Date() })
        #expect(store.blockAnswered == false)
        await store.loadBlock()
        #expect(store.blockAnswered == true)
        #expect(store.block == nil)
    }
}
