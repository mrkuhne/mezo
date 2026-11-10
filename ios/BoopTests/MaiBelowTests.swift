import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// Below the Mai hero (Task 12): path mapping, observation swipes, the session move words, the tiles' null rule.
struct MaiBelowTests {

    // MARK: PathStep → PathStation

    @Test func pathStepsMapOneToOneOntoKitStations() {
        let steps = [
            PathStep(id: "now", time: "08:40", glyph: "sun-ink", title: "Most", sub: "", done: false, isNow: true),
            PathStep(id: "session", time: "17:30", glyph: "dumbbell-ink", title: "Vállak és hát", sub: "60 perc · 4 gyakorlat",
                     done: false, isNow: false, opens: true),
            PathStep(id: "wake", time: "06:17", glyph: "sun-ink", title: "Ébredés", sub: "", done: true, isNow: false),
        ]
        let stations = pathStations(steps)
        #expect(stations.count == 3)
        for (st, step) in zip(stations, steps) {
            #expect(st.id == step.id)
            #expect(st.time == step.time)
            #expect(st.glyph == step.glyph)
            #expect(st.title == step.title)
            #expect(st.sub == step.sub)
            #expect(st.done == step.done)
            #expect(st.isNow == step.isNow)
            #expect(st.opens == step.opens)
        }
    }

    // MARK: Observation swipes

    @Test func swipeRightPastTheThresholdConfirmsLeftRejects() {
        #expect(swipeDecision(140) == true)
        #expect(swipeDecision(-140) == false)
        #expect(swipeDecision(111) == true)
        #expect(swipeDecision(-111) == false)
    }

    @Test func aShortDragDecidesNothing() {
        #expect(swipeDecision(0) == nil)
        #expect(swipeDecision(60) == nil)
        #expect(swipeDecision(-110) == nil)
        #expect(swipeDecision(110) == nil)
    }

    @Test func theDragLabelFollowsTheDirection() {
        #expect(swipeLabel(80) == "IGAZ")
        #expect(swipeLabel(-80) == "NEM RÓLAM SZÓL")
        #expect(swipeLabel(10) == nil)
    }

    // MARK: Session move words

    @Test func timeSuffixFollowsHowTheTimeIsSaid() {
        #expect(timeSuffix("18:30") == "ra")     // harminc
        #expect(timeSuffix("18:00") == "ra")     // tizennyolc óra
        #expect(timeSuffix("18:15") == "re")     // tizenöt
        #expect(timeSuffix("18:45") == "re")     // negyvenöt
        #expect(timeSuffix("19:20") == "ra")     // húsz
        #expect(timeSuffix("19:40") == "re")     // negyven
        #expect(timeSuffix("19:10") == "re")     // tíz
        #expect(timeSuffix("19:50") == "re")     // ötven
        #expect(timeSuffix("19:33") == "ra")     // harminchárom
        #expect(timeSuffix("19:36") == "ra")     // harminchat
        #expect(timeSuffix("19:38") == "ra")     // harmincnyolc
        #expect(timeSuffix("19:37") == "re")     // harminchét
    }

    @Test func theMoveButtonAndToastSayTheTime() {
        #expect(moveButtonTitle("18:30") == "Áttolom 18:30-ra")
        #expect(movedToast("18:30") == "Áttettem 18:30-ra")
        #expect(movedToast("18:45") == "Áttettem 18:45-re")
        #expect(undoneToast("17:30") == "Visszatettem 17:30-ra")
    }

    @Test func aFailedMoveSaysWhyASuccessfulOneSaysNothingExtra() {
        #expect(moveProblemToast(nil) == nil)
        #expect(moveProblemToast(.noSession) == "Ma nincs edzés, amit áttehetnék")
        #expect(moveProblemToast(.offline) == "Most nem érem el a szervert, próbáld újra")
        #expect(moveProblemToast(.server) == "Most nem sikerült áttenni")
    }

    // MARK: Tiles: null = no tile, never 0

    private func inputs(sleep: Bool = true, deep: Int? = 88, resting: [Int?] = [59, 58, 60, nil, 58, 59, 57],
                        hr: (Int?, Int?, Int?) = (54, 66, 92), stepsGoal: Int = 10000, kcalTarget: Int = 2400,
                        steps: Int? = 3240, activeKcal: Int? = 210) -> TileInputs {
        TileInputs(sleepTotalMin: sleep ? 432 : nil, bedtime: sleep ? "23:05" : nil, wakeup: sleep ? "06:17" : nil,
                   deepMin: sleep ? deep : nil, deepWeek: [72, 64, nil, 80, 70, 76, 88], restingHrWeek: resting,
                   hrMin: hr.0, hrAvg: hr.1, hrMax: hr.2, steps: steps, stepsGoal: stepsGoal, activeKcal: activeKcal,
                   kcalSoFar: 0, kcalTarget: kcalTarget, proteinG: 0, proteinTarget: 150, carbsG: 0, fatG: 0)
    }

    @Test func formaHasNoTiles() {
        #expect(maiTiles(.forma, inputs()).isEmpty)
    }

    @Test func eachOrbShowsItsOwnTiles() {
        #expect(maiTiles(.alvas, inputs()).map(\.label) == ["ALVÁSIDŐ", "MÉLYALVÁS", "ELALVÁS"])
        #expect(maiTiles(.mozgas, inputs()).map(\.label) == ["LÉPÉSEK", "AKTÍV KALÓRIA"])
        #expect(maiTiles(.fuel, inputs()).map(\.label) == ["VÍZ", "KALÓRIA", "MAKRÓK"])
        #expect(maiTiles(.pulzus, inputs()).map(\.label) == ["NYUGALMI PULZUS", "PULZUS MA"])
    }

    @Test func tileValuesReadLikeTheHero() {
        let alvas = maiTiles(.alvas, inputs())
        #expect(alvas[0].value == "7ó 12p")
        #expect(alvas[0].sub == "23:05 – 06:17")
        #expect(alvas[1].value == "1ó 28p")
        #expect(alvas[1].sub == "+16 p az átlaghoz")
        #expect(alvas[2].value == "23:05")
        let steps = maiTiles(.mozgas, inputs())[0]
        #expect(steps.value == "3\u{00A0}240")
        #expect(steps.sub == "/ 10\u{00A0}000")
        let pulse = maiTiles(.pulzus, inputs())
        #expect(pulse[0].value == "57")
        #expect(pulse[0].sub == "heti átlag 59")
        #expect(pulse[1].value == "54 · 66 · 92")
    }

    @Test func missingSleepDropsTheSleepTiles() {
        #expect(maiTiles(.alvas, inputs(sleep: false)).isEmpty)
        let noDeep = maiTiles(.alvas, inputs(deep: nil))
        #expect(noDeep.map(\.label) == ["ALVÁSIDŐ", "ELALVÁS"])
    }

    @Test func missingHeartDataDropsTheHeartTilesNeverZero() {
        let none = maiTiles(.pulzus, inputs(resting: [nil, nil, nil], hr: (nil, 66, nil)))
        #expect(none.isEmpty)
        let partial = maiTiles(.pulzus, inputs(hr: (54, nil, 92)))
        #expect(partial.map(\.label) == ["NYUGALMI PULZUS"])
        #expect(!partial.contains { $0.value.contains("0") && $0.value == "0" })
    }

    /// Final review M1: no wearable day → no Mozgás tile at all, never "0 / 9 000".
    @Test func missingStepsDropsTheMovementTilesNeverZero() {
        #expect(maiTiles(.mozgas, inputs(steps: nil, activeKcal: nil)).isEmpty)
        #expect(maiTiles(.mozgas, inputs(activeKcal: nil)).map(\.label) == ["LÉPÉSEK"])
    }

    /// Final review I3: a night without times keeps its length tile and drops the times.
    @Test func aNightWithoutTimesKeepsItsLengthOnly() {
        let x = TileInputs(sleepTotalMin: 420, bedtime: nil, wakeup: nil, deepMin: nil, deepWeek: [], restingHrWeek: [],
                           hrMin: nil, hrAvg: nil, hrMax: nil, steps: nil, stepsGoal: 9000, activeKcal: nil,
                           kcalSoFar: 0, kcalTarget: 0, proteinG: 0, proteinTarget: 0, carbsG: 0, fatG: 0)
        let tiles = maiTiles(.alvas, x)
        #expect(tiles.map(\.label) == ["ALVÁSIDŐ"])
        #expect(tiles.first?.sub == "")
    }

    @Test func noGoalsMeansNoFractionAndNoKcalTiles() {
        let steps = maiTiles(.mozgas, inputs(stepsGoal: 0))[0]
        #expect(steps.sub == "lépés ma")
        let fuel = maiTiles(.fuel, inputs(kcalTarget: 0))
        #expect(fuel.map(\.label) == ["VÍZ", "MAKRÓK"])
    }

    @Test func waterHasNoDataYetAndSaysDashNotZero() {
        let water = maiTiles(.fuel, inputs())[0]
        #expect(water.value == "–")
    }

    // MARK: Fix round 1

    @Test func restingPulseTileShowsOnlyTodayDashWhenTodayIsMissing() {
        let tile = maiTiles(.pulzus, inputs(resting: [59, 58, 60, nil, 58, 59, nil]))[0]
        #expect(tile.label == "NYUGALMI PULZUS")
        #expect(tile.value == "–")
        #expect(tile.sub == "heti átlag 59")
    }

    private let lines = [Brief.Line(text: "Nyugodt napnak nézel elébe.", link: .sleep),
                         Brief.Line(text: "A nyugalmi pulzusod rendben.", link: .heart),
                         Brief.Line(text: "Ma edzés van.", link: nil)]

    @Test func boopSaysCardReadsExactlyTheSpokenText() {
        #expect(String(boopSaysText(lines, revealed: nil).characters) == BoopVoice.spokenText(lines))
        #expect(String(boopSaysText(lines, revealed: nil).characters).contains("elébe. A"))
    }

    @Test func theRevealPrefixMatchesTheVoiceAtEveryWordBoundary() {
        let spoken = BoopVoice.spokenText(lines)
        for (i, ch) in spoken.enumerated() where ch == " " {
            #expect(String(boopSaysText(lines, revealed: i).characters) == String(spoken.prefix(i)))
        }
    }

    @Test func aCardInFlightCannotBeDecidedTwice() {
        var gate = DecideGate()
        let first = gate.begin("a"), again = gate.begin("a"), other = gate.begin("b")
        gate.end("a")
        let afterEnd = gate.begin("a")
        #expect(first && !again && other && afterEnd)
    }
}
