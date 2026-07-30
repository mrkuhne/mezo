package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.MedalEvaluator.Candidate;
import io.mrkuhne.mezo.feature.train.service.MedalEvaluator.MedalKind;
import io.mrkuhne.mezo.feature.train.service.MedalEvaluator.Prior;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class MedalEvaluatorTest {

    private static Prior prior(String kg, int reps) {
        return new Prior(new BigDecimal(kg), reps);
    }

    private static Candidate set(String kg, int reps) {
        return new Candidate(new BigDecimal(kg), reps, null, null);
    }

    private static Candidate set(String kg, int reps, String targetKg, Integer targetReps) {
        return new Candidate(new BigDecimal(kg), reps,
            targetKg == null ? null : new BigDecimal(targetKg), targetReps);
    }

    private static List<MedalKind> kinds(List<MedalEvaluator.Award> awards) {
        return awards.stream().map(MedalEvaluator.Award::kind).toList();
    }

    @Test
    void testForSet_shouldAwardNothing_whenThereIsNoPriorHistory() {
        assertThat(MedalEvaluator.forSet(set("100", 8), List.of())).isEmpty();
    }

    @Test
    void testForSet_shouldAwardWeightAndE1rm_whenTheLoadBeatsEveryPrior() {
        var awards = MedalEvaluator.forSet(set("102.5", 8), List.of(prior("100", 8)));
        assertThat(kinds(awards)).containsExactlyInAnyOrder(MedalKind.WEIGHT, MedalKind.E1RM);
        assertThat(awards.stream().filter(a -> a.kind() == MedalKind.WEIGHT).findFirst().orElseThrow()
            .previousValue()).isEqualByComparingTo("100");
    }

    @Test
    void testForSet_shouldAwardRepsAtWeight_whenMoreRepsAtAWeightAlreadyLifted() {
        var awards = MedalEvaluator.forSet(set("100", 9), List.of(prior("100", 8)));
        assertThat(kinds(awards)).contains(MedalKind.REPS_AT_WEIGHT);
        assertThat(awards.stream().filter(a -> a.kind() == MedalKind.REPS_AT_WEIGHT).findFirst()
            .orElseThrow().previousValue()).isEqualByComparingTo("8");
    }

    @Test
    void testForSet_shouldNotAwardRepsAtWeight_whenThatWeightWasNeverLiftedBefore() {
        var awards = MedalEvaluator.forSet(set("97.5", 12), List.of(prior("100", 8)));
        assertThat(kinds(awards)).doesNotContain(MedalKind.REPS_AT_WEIGHT);
    }

    @Test
    void testForSet_shouldAwardNothing_whenTheSetOnlyTiesTheRecord() {
        assertThat(MedalEvaluator.forSet(set("100", 8), List.of(prior("100", 8)))).isEmpty();
    }

    @Test
    void testForSet_shouldAwardTargetHit_whenBothPrescribedValuesAreMet() {
        var awards = MedalEvaluator.forSet(set("100", 8, "100", 8), List.of(prior("100", 8)));
        assertThat(kinds(awards)).containsExactly(MedalKind.TARGET_HIT);
        assertThat(awards.getFirst().previousValue()).isNull();
        assertThat(awards.getFirst().value()).isEqualByComparingTo("8");
    }

    @Test
    void testForSet_shouldAwardTargetHit_whenThereIsNoPriorHistoryAtAll() {
        var awards = MedalEvaluator.forSet(set("60", 10, "60", 10), List.of());
        assertThat(kinds(awards)).containsExactly(MedalKind.TARGET_HIT);
    }

    @Test
    void testForSet_shouldNotAwardTargetHit_whenTheRepsFallShort() {
        assertThat(MedalEvaluator.forSet(set("100", 7, "100", 8), List.of(prior("100", 8))))
            .noneMatch(a -> a.kind() == MedalKind.TARGET_HIT);
    }

    @Test
    void testForSet_shouldNotAwardTargetHit_whenNoTargetWasPrescribed() {
        assertThat(MedalEvaluator.forSet(set("100", 8, null, null), List.of()))
            .noneMatch(a -> a.kind() == MedalKind.TARGET_HIT);
    }

    @Test
    void testForSet_shouldAwardE1rmAlone_whenMoreRepsAtALighterLoadBeatTheEstimate() {
        // 95 × 12 → e1RM 133.0 beats 100 × 8 → e1RM 126.67, but the load itself is lower.
        var awards = MedalEvaluator.forSet(set("95", 12), List.of(prior("100", 8)));
        assertThat(kinds(awards)).containsExactly(MedalKind.E1RM);
    }

    @Test
    void testSessionVolume_shouldAward_whenThisSessionBeatsEveryPriorSession() {
        var award = MedalEvaluator.sessionVolume(new BigDecimal("2400"), new BigDecimal("2200"));
        assertThat(award).isNotNull();
        assertThat(award.value()).isEqualByComparingTo("2400");
        assertThat(award.previousValue()).isEqualByComparingTo("2200");
    }

    @Test
    void testSessionVolume_shouldAwardNothing_whenThereIsNoPriorSession() {
        assertThat(MedalEvaluator.sessionVolume(new BigDecimal("2400"), null)).isNull();
    }

    @Test
    void testEpley_shouldMatchTheRecordServiceFormula_whenGivenAWeightedSet() {
        assertThat(MedalEvaluator.epley(new BigDecimal("100"), 8)).isEqualByComparingTo("126.6667");
    }
}
