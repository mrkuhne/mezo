package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class OneRepMaxTest {

    private static ExerciseSetEntity set(String kind, boolean skipped, String weightKg, Integer reps) {
        ExerciseSetEntity entity = new ExerciseSetEntity();
        entity.setKind(kind);
        entity.setSkipped(skipped);
        entity.setWeightKg(weightKg == null ? null : new BigDecimal(weightKg));
        entity.setReps(reps);
        return entity;
    }

    @Test
    void repCapIsTwelve_byProductDecision() {
        assertThat(OneRepMax.REP_CAP).isEqualTo(12);
    }

    @Test
    void estimatesInsideTheCap_andRefusesAboveIt() {
        assertThat(OneRepMax.estimate(new BigDecimal("100"), 12))
            .isEqualByComparingTo(new BigDecimal("140.0000")); // 100 × 42/30
        assertThat(OneRepMax.estimate(new BigDecimal("100"), 13)).isNull();
    }

    @Test
    void nullNeverZeroNeverThrows() {
        assertThat(OneRepMax.estimate(null, 5)).isNull();
        assertThat(OneRepMax.estimate(BigDecimal.ZERO, 5)).isNull();
        assertThat(OneRepMax.estimate(new BigDecimal("-10"), 5)).isNull();
        assertThat(OneRepMax.estimate(new BigDecimal("60"), null)).isNull();
        assertThat(OneRepMax.estimate(new BigDecimal("60"), 0)).isNull();
    }

    @Test
    void matchesTheHistoricFormulaAtScaleFour() {
        assertThat(OneRepMax.estimate(new BigDecimal("62.5"), 8))
            .isEqualByComparingTo(new BigDecimal("79.1667")); // 62.5 × 38/30, HALF_UP
    }

    @Test
    void eligible_true_forWorkingWeightedSetAtTheCap() {
        assertThat(OneRepMax.eligible(set("working", false, "100", 12))).isTrue();
    }

    @Test
    void eligible_false_forWarmupKind() {
        assertThat(OneRepMax.eligible(set("warmup", false, "100", 8))).isFalse();
    }

    @Test
    void eligible_false_forSkippedSet() {
        assertThat(OneRepMax.eligible(set("working", true, "100", 8))).isFalse();
    }

    @Test
    void eligible_false_forRepsAboveTheCap() {
        assertThat(OneRepMax.eligible(set("working", false, "100", 13))).isFalse();
    }

    @Test
    void eligible_false_forNullWeight() {
        assertThat(OneRepMax.eligible(set("working", false, null, 8))).isFalse();
    }
}
