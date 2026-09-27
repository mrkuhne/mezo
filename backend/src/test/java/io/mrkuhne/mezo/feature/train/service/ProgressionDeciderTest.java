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
    void decide_shouldHold_whenInRangeAndGrind() {
        Decision d = ProgressionDecider.decide(ref("62.5", 7, 0), 6, 10, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.base()).isEqualByComparingTo("62.5");
        assertThat(d.workingReps()).isEqualTo(7);
    }

    @Test
    void decide_shouldDropWeight_whenBelowRangeAndGrind() {
        Decision d = ProgressionDecider.decide(ref("62.5", 5, 0), 6, 8, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("60");
        assertThat(d.deltaKg()).isEqualByComparingTo("-2.5");
    }

    @Test
    void grindBelowRange_dropsLoad_withNegativeDelta() {
        // rp < repMin AND slack <= 0 → Lever.WEIGHT with a NEGATIVE deltaKg (pins the sign
        // contract the overload-summary tally in WorkoutService depends on)
        Decision d = ProgressionDecider.decide(ref("60", 6, 1), 8, 12, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.deltaKg()).isNegative();
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
        assertThat(d.base()).isEqualByComparingTo("55"); // round(0.9 * 60) = 55 (54 → nearest 2.5 plate)
        assertThat(d.deltaKg().signum()).isNegative();
        assertThat(d.rationale()).contains("Deload");
    }

    @Test
    void decide_shouldTreatNullRirAsNeutral() {
        // null rir → slack 0 (neutral) → default double-progression rep build, never a fabricated jump
        Decision d = ProgressionDecider.decide(ref("62.5", 7, null), 6, 10, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.REP);
        assertThat(d.workingReps()).isEqualTo(8);
    }

    @Test
    void decide_shouldSnapDeloadToPlateStep_whenRawWeightIsNotAMultiple() {
        // 57.5 × 0.9 = 51.75 → 51.75/2.5 = 20.7 → HALF_UP 21 → ×2.5 = 52.5
        Decision d = ProgressionDecider.decide(ref("57.5", 8, 2), 6, 8, 2, INC, STEP, true);
        assertThat(d.lever()).isEqualTo(Lever.DELOAD);
        assertThat(d.base()).isEqualByComparingTo("52.5");
        assertThat(d.deltaKg()).isEqualByComparingTo("-5");
    }

    // ── Readiness „Könnyítsük" (Check-in 2.0, mezo-ck2): capAtHold ─────────────────────────

    @Test
    void testCapAtHold_shouldHoldLastWeek_whenDecisionAddsWeight() {
        Decision d = ProgressionDecider.decide(ref("60", 8, 2), 6, 8, 2, INC, STEP, false);

        Decision held = ProgressionDecider.capAtHold(d, ref("60", 8, 2), 6, 8);

        assertThat(held.lever()).isEqualTo(Lever.HOLD);
        assertThat(held.base()).isEqualByComparingTo("60");
        assertThat(held.workingReps()).isEqualTo(8);
        assertThat(held.deltaKg()).isNull();
        assertThat(held.deltaReps()).isNull();
        assertThat(held.rationale()).isEqualTo(ProgressionDecider.LIGHTENED_RATIONALE);
    }

    @Test
    void testCapAtHold_shouldHoldLastWeekReps_whenDecisionBuildsARep() {
        Decision d = ProgressionDecider.decide(ref("62.5", 8, 3), 6, 10, 2, INC, STEP, false);

        Decision held = ProgressionDecider.capAtHold(d, ref("62.5", 8, 3), 6, 10);

        assertThat(held.lever()).isEqualTo(Lever.HOLD);
        assertThat(held.base()).isEqualByComparingTo("62.5");
        assertThat(held.workingReps()).isEqualTo(8);
    }

    @Test
    void testCapAtHold_shouldKeepLighterMove_whenDecisionIsDeloadOrWeightDown() {
        Decision deload = ProgressionDecider.decide(ref("60", 8, 0), 6, 8, 0, INC, STEP, true);
        Decision down = ProgressionDecider.decide(ref("60", 4, 0), 6, 8, 1, INC, STEP, false);

        assertThat(ProgressionDecider.capAtHold(deload, ref("60", 8, 0), 6, 8)).isSameAs(deload);
        assertThat(ProgressionDecider.capAtHold(down, ref("60", 4, 0), 6, 8)).isSameAs(down);
    }
}
