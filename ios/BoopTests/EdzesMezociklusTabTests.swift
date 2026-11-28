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

    // Step 4 (mezo-r36n9.197.4): the sub-pages' hero helpers.

    @Test func verdictLineIsTheFirstSentence() {
        #expect(mezoVerdictLine("Erős blokk volt. A guggolás 5 kilót nőtt.") == "Erős blokk volt.")
        #expect(mezoVerdictLine("  \n ") == nil)
        #expect(mezoVerdictLine("Egyetlen mondat pont nélkül") == "Egyetlen mondat pont nélkül")
        let long = String(repeating: "nagyon ", count: 30) + "hosszú."
        let cut = mezoVerdictLine(long, limit: 40)
        #expect(cut?.hasSuffix("…") == true)
        #expect((cut?.count ?? 0) <= 41)
        #expect(cut?.contains("nagyo…") == false, "cut between words, never inside one")
    }

    @Test func muscleWeeksChartReadsTheCurrentWeek() {
        let weeks = [MuscleVolumeWeek(week: 1, phase: .mav, planned: 10, actual: 10, isCurrent: false),
                     MuscleVolumeWeek(week: 2, phase: .mav, planned: 12, actual: 9, isCurrent: true),
                     MuscleVolumeWeek(week: 3, phase: .mav, planned: 14, isCurrent: false)]
        #expect(MuscleWeeksChart.accessibilityText(weeks) == "3 hét szettjei; a 2. héten 9 megvolt a tervezett 12-\(evesBolBol(12))")
        #expect(MuscleWeeksChart.accessibilityText([]) == "0 hét szettjei")
    }
}
