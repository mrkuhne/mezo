package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.WeightSnapper.Snap;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class WeightSnapperTest {

    private static final BigDecimal STEP = new BigDecimal("2.5");

    private static BigDecimal kg(String v) {
        return new BigDecimal(v);
    }

    private static Set<BigDecimal> kgs(String... v) {
        return Arrays.stream(v).map(BigDecimal::new).collect(Collectors.toSet());
    }

    @Test
    void snap_shouldLeaveTheBaseAlone_whenItIsNotAKnownGap() {
        Optional<Snap> s = WeightSnapper.snap(kg("65"), 6, 0, 6, 8, kg("60"), kgs("67.5"), kgs("60"), STEP);
        assertThat(s).isEmpty();
    }

    @Test
    void snap_shouldPreferAWeightAlreadyUsed_overAnUntriedPlateStep() {
        // Owner example: 98 is missing, the stack has 95 and 100 (both logged before).
        Optional<Snap> s = WeightSnapper.snap(kg("98"), 10, 2, 8, 12, kg("93"), kgs("98"), kgs("93", "95", "100"), STEP);
        assertThat(s).isPresent();
        assertThat(s.get().weightKg()).isEqualByComparingTo("95");
        assertThat(s.get().reps()).isEqualTo(11);
    }

    @Test
    void snap_shouldGoHeavier_whenTheLighterWeightWouldOverflowTheRepRange() {
        Optional<Snap> s = WeightSnapper.snap(kg("98"), 10, 2, 8, 10, kg("93"), kgs("98"), kgs("93", "95", "100"), STEP);
        assertThat(s.get().weightKg()).isEqualByComparingTo("100");
        assertThat(s.get().reps()).isEqualTo(9);
    }

    @Test
    void snap_shouldFallBackToThePlateGrid_whenNothingNearbyWasEverUsed() {
        // 65 missing, only 60 ever used: 60 is the reference itself (never a candidate for an
        // upward move), so the grid's 62.5 is tried — 78 kg e1RM → 7 reps, inside 6–8.
        Optional<Snap> s = WeightSnapper.snap(kg("65"), 6, 0, 6, 8, kg("60"), kgs("65"), kgs("60"), STEP);
        assertThat(s.get().weightKg()).isEqualByComparingTo("62.5");
        assertThat(s.get().reps()).isEqualTo(7);
    }

    @Test
    void snap_shouldNeverSnapBackOntoTheReference_soProgressionCannotStall() {
        // 62.5 and 65 both missing: the only lighter option would be the reference (60) itself,
        // which would re-prescribe last week forever (Liftosaur #338) — go heavier instead.
        Optional<Snap> s = WeightSnapper.snap(kg("65"), 6, 0, 6, 8, kg("60"), kgs("62.5", "65"), kgs("60"), STEP);
        assertThat(s.get().weightKg()).isEqualByComparingTo("67.5");
        assertThat(s.get().reps()).isEqualTo(5);
    }

    @Test
    void snap_shouldStayBelowTheReference_onADownwardMove() {
        // Deload 100 → 90, 90 missing; 95 and 85 were used. Both land inside 6–10 → the lighter.
        Optional<Snap> s = WeightSnapper.snap(kg("90"), 8, 2, 6, 10, kg("100"), kgs("90"), kgs("100", "95", "85"), STEP);
        assertThat(s.get().weightKg()).isEqualByComparingTo("85");
        assertThat(s.get().reps()).isEqualTo(10);
    }

    @Test
    void snap_shouldGiveUp_whenNoCandidateSurvives() {
        Optional<Snap> s = WeightSnapper.snap(kg("65"), 6, 0, 6, 8, kg("60"),
            kgs("62.5", "65", "67.5", "70", "72.5", "75"), kgs("60"), STEP);
        assertThat(s).isEmpty();
    }

    @Test
    void snap_shouldTreatScaleDifferencesAsTheSameWeight() {
        Optional<Snap> s = WeightSnapper.snap(kg("98.00"), 10, 2, 8, 12, kg("93"), kgs("98"), kgs("95.0", "100"), STEP);
        assertThat(s.get().weightKg()).isEqualByComparingTo("95");
    }

    @Test
    void equivalentReps_shouldMirrorTheFrontendHelper() {
        assertThat(WeightSnapper.equivalentReps(kg("98"), 10, 2, kg("95"))).isEqualTo(11);
        assertThat(WeightSnapper.equivalentReps(kg("98"), 10, 2, kg("98"))).isEqualTo(10);
        assertThat(WeightSnapper.equivalentReps(kg("98"), 10, 2, kg("75"))).isNull();
    }

    @Test
    void isNearSwap_shouldSeparateAMissingWeightFromAChoice() {
        BigDecimal frac = new BigDecimal("0.10");
        assertThat(WeightSnapper.isNearSwap(kg("98"), kg("95"), kg("5.0"), frac)).isTrue();
        assertThat(WeightSnapper.isNearSwap(kg("98"), kg("80"), kg("5.0"), frac)).isFalse();
        assertThat(WeightSnapper.isNearSwap(kg("12"), kg("10"), kg("2.5"), frac)).isTrue();
        assertThat(WeightSnapper.isNearSwap(kg("50"), kg("45"), kg("2.5"), frac)).isTrue();
        assertThat(WeightSnapper.isNearSwap(kg("98"), kg("98.0"), kg("5.0"), frac)).isFalse();
    }
}
