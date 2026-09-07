package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Pair;
import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Verdict;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ToneJudgePairingTest {

    @Test
    void testPair_shouldKeepOnlySharedCasesInIdOrder_whenOneSideIsMissingAnAnswer() {
        List<Pair> pairs = ToneJudgePairing.pair(
            Map.of("b", "alap-b", "a", "alap-a", "c", "alap-c"),
            Map.of("a", "jelolt-a", "b", "jelolt-b"), 42L);

        assertThat(pairs).extracting(Pair::caseId).containsExactly("a", "b");
    }

    @Test
    void testPair_shouldPlaceEachSideBehindTheLabelItsFlagClaims_whenSidesAreSwapped() {
        List<Pair> pairs = ToneJudgePairing.pair(
            Map.of("a", "alap-a"), Map.of("a", "jelolt-a"), 42L);

        Pair pair = pairs.getFirst();
        assertThat(pair.aIsBaseline() ? pair.optionA() : pair.optionB()).isEqualTo("alap-a");
        assertThat(pair.aIsBaseline() ? pair.optionB() : pair.optionA()).isEqualTo("jelolt-a");
    }

    @Test
    void testPair_shouldSwapSomePairsAndNotOthers_whenTheSeedIsFixed() {
        Map<String, String> baseline = Map.of("a", "1", "b", "2", "c", "3", "d", "4", "e", "5", "f", "6");
        Map<String, String> candidate = Map.of("a", "x", "b", "y", "c", "z", "d", "w", "e", "v", "f", "u");

        List<Pair> pairs = ToneJudgePairing.pair(baseline, candidate, 7L);

        assertThat(pairs).extracting(Pair::aIsBaseline).contains(true, false);
        assertThat(ToneJudgePairing.pair(baseline, candidate, 7L)).isEqualTo(pairs);
    }

    @Test
    void testParseVerdict_shouldReadTheVerdictWord_whenTheJudgeWrapsItInProse() {
        assertThat(ToneJudgePairing.parseVerdict("Az A változat természetesebb.\nVERDICT: A")).isEqualTo(Verdict.A);
        assertThat(ToneJudgePairing.parseVerdict("verdict: b")).isEqualTo(Verdict.B);
        assertThat(ToneJudgePairing.parseVerdict("VERDICT: TIE")).isEqualTo(Verdict.TIE);
        assertThat(ToneJudgePairing.parseVerdict("nem tudom eldönteni")).isEqualTo(Verdict.UNPARSEABLE);
    }

    @Test
    void testTally_shouldCreditTheCandidate_whenTheJudgePickedTheLabelTheCandidateSatBehind() {
        List<Pair> pairs = List.of(
            new Pair("a", "alap", "jelolt", true),
            new Pair("b", "jelolt", "alap", false));

        var tally = ToneJudgePairing.tally(pairs, List.of(Verdict.B, Verdict.A));

        assertThat(tally.candidateWins()).isEqualTo(2);
        assertThat(tally.baselineWins()).isZero();
        assertThat(tally.ties()).isZero();
    }
}
