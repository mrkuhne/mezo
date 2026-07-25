package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.Decision;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.Lever;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.RefSet;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class ProgressionDeciderTest {

    private static final BigDecimal INC = new BigDecimal("2.5");
    private static final BigDecimal STEP = new BigDecimal("2.5");

    private static RefSet ref(String kg, int reps, Integer rir) {
        return new RefSet(new BigDecimal(kg), reps, rir);
    }

    @Test
    void decide_shouldAddWeight_whenRepsAtTopOfRange() {
        Decision d = ProgressionDecider.decide(ref("60", 8, 2), 6, 8, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("62.5");
        assertThat(d.workingReps()).isEqualTo(6);
        assertThat(d.deltaKg()).isEqualByComparingTo("2.5");
        assertThat(d.deltaReps()).isNull();
    }

    @Test
    void decide_shouldBuildRep_whenInRangeWithRirSlack() {
        Decision d = ProgressionDecider.decide(ref("62.5", 8, 3), 6, 10, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.REP);
        assertThat(d.base()).isEqualByComparingTo("62.5");
        assertThat(d.workingReps()).isEqualTo(9);
        assertThat(d.deltaKg()).isNull();
        assertThat(d.deltaReps()).isEqualTo(1);
    }

    @Test
    void decide_shouldHold_whenInRangeOnTargetRir() {
        Decision d = ProgressionDecider.decide(ref("62.5", 7, 2), 6, 10, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.base()).isEqualByComparingTo("62.5");
        assertThat(d.workingReps()).isEqualTo(7);
        assertThat(d.deltaReps()).isNull();
    }

    @Test
    void decide_shouldDropWeight_whenBelowRangeAndGrind() {
        Decision d = ProgressionDecider.decide(ref("62.5", 5, 0), 6, 8, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("60");
        assertThat(d.deltaKg()).isEqualByComparingTo("-2.5");
    }

    @Test
    void decide_shouldHold_whenBelowRangeButNotGrind() {
        Decision d = ProgressionDecider.decide(ref("62.5", 5, 3), 6, 8, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.base()).isEqualByComparingTo("62.5");
    }

    @Test
    void decide_shouldRegress_whenDeloadWeek() {
        Decision d = ProgressionDecider.decide(ref("60", 8, 2), 6, 8, 2, INC, STEP, true);
        assertThat(d.lever()).isEqualTo(Lever.DELOAD);
        assertThat(d.base()).isEqualByComparingTo("54"); // round(0.9 * 60)
        assertThat(d.deltaKg().signum()).isNegative();
        assertThat(d.rationale()).contains("Deload");
    }

    @Test
    void decide_shouldTreatNullRirAsNeutral() {
        // reps in range, rir unknown → slack 0 → hold (never fabricate an "easy" bump)
        Decision d = ProgressionDecider.decide(ref("62.5", 7, null), 6, 10, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
    }
}
