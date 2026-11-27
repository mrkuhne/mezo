import Foundation
import Testing
@testable import BoopCore

/// mezo-r36n9.195: the head says the challenge and the special last set in words, also on a day that skips them.
@Suite struct TechniqueHeadlineTests {

    @Test func plainExerciseHasNoLine() {
        #expect(TechniqueHeadline.today(technique: nil, challenge: false, best: nil) == nil)
        #expect(TechniqueHeadline.today(technique: SetTechnique.none, challenge: false, best: 9) == nil)
    }

    @Test func techniqueOnly() {
        #expect(TechniqueHeadline.today(technique: .myo, challenge: false, best: nil) == "Utolsó szett: Myo set")
    }

    @Test func challengeOnlyWithBestAndFirstTime() {
        #expect(TechniqueHeadline.today(technique: .partials, challenge: true, best: 12)
                == "Kihívás · az utolsó szett után félismétlések · a csúcsod 12 félismétlés")
        #expect(TechniqueHeadline.today(technique: .partials, challenge: true, best: nil)
                == "Kihívás · az utolsó szett után félismétlések · most állítod be a csúcsot")
    }

    @Test func techniqueAndChallenge() {
        #expect(TechniqueHeadline.today(technique: .myo, challenge: true, best: 8)
                == "Kihívás · utolsó szett: Myo set, utána félismétlések · a csúcsod 8 félismétlés")
    }

    @Test func deloadSkipsBoth() {
        let s = SkippedTechnique(technique: .restDrop, challenge: true, reason: .deload)
        #expect(TechniqueHeadline.skipped(s, keptTechnique: nil)
                == "A mezociklusban ehhez kihívás tartozik: Pihenős drop, utána félismétlések. Ma kimarad, mert pihenőhét van.")
    }

    @Test func gentleDaySkipsTechnique() {
        let s = SkippedTechnique(technique: .drop, challenge: false, reason: .gentle)
        #expect(TechniqueHeadline.skipped(s, keptTechnique: nil)
                == "A mezociklusban ehhez speciális utolsó szett tartozik: Drop set. Ma kimarad, mert kímélő nap van.")
    }

    @Test func sportDaySkipsChallengeOnly() {
        let s = SkippedTechnique(technique: nil, challenge: true, reason: .sport)
        #expect(TechniqueHeadline.skipped(s, keptTechnique: nil)
                == "A mezociklusban ehhez kihívás tartozik: félismétlések az utolsó szett után. Ma kimarad, mert sportnap van.")
        #expect(TechniqueHeadline.skipped(s, keptTechnique: .drop)
                == "A mezociklusban ehhez kihívás is tartozik. Ma kimarad, mert sportnap van.")
    }

    @Test func nothingSkipped() {
        #expect(TechniqueHeadline.skipped(nil, keptTechnique: .myo) == nil)
        #expect(TechniqueHeadline.skipped(SkippedTechnique(technique: SetTechnique.none, challenge: false, reason: .deload),
                                          keptTechnique: nil) == nil)
    }

    @Test func skippedSurvivesTheSessionSave() throws {
        let e = SessionExercise(id: UUID(), name: "Tricep Pushdown", muscle: "triceps", planned: [],
                                skippedToday: SkippedTechnique(technique: .myo, challenge: true, reason: .sport))
        let back = try JSONDecoder().decode(SessionExercise.self, from: JSONEncoder().encode(e))
        #expect(back.skippedToday == e.skippedToday)
    }
}
