import Testing
@testable import BoopCore

/// The ring and the hero orbs (`mezo-r36n9.152`): a brief that is still "learning" means only that Forma is unknown
/// (last night missing, or fewer nights than needed) — the four other areas keep the score the server sent.
struct OrbScoreTests {
    @Test func learningHidesOnlyForma() {
        #expect(visibleScore(74, key: .forma, learning: true) == nil)
        #expect(visibleScore(64, key: .fuel, learning: true) == 64)
        #expect(visibleScore(78, key: .alvas, learning: true) == 78)
        #expect(visibleScore(40, key: .mozgas, learning: true) == 40)
        #expect(visibleScore(66, key: .pulzus, learning: true) == 66)
    }

    @Test func outsideLearningEveryScorePasses() {
        for key in MetricKey.allCases { #expect(visibleScore(55, key: key, learning: false) == 55) }
    }

    @Test func noScoreStaysNoScore() {
        for key in MetricKey.allCases {
            #expect(visibleScore(nil, key: key, learning: true) == nil)
            #expect(visibleScore(nil, key: key, learning: false) == nil)
        }
    }
}
