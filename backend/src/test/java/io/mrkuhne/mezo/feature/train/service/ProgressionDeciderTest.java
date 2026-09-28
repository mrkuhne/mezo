package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.Decision;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.Lever;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.RefSet;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.StepPolicy;
import java.math.BigDecimal;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ProgressionDeciderTest {

    private static final BigDecimal STEP = new BigDecimal("2.5");
    private static final StepPolicy COMPOUND = policy("0.025");
    private static final StepPolicy ISOLATION = policy("0.05");

    private static StepPolicy policy(String pct) {
        return new StepPolicy(new BigDecimal(pct), new BigDecimal("0.10"), new BigDecimal("0.15"), 2, 3, STEP);
    }

    private static RefSet ref(String kg, int reps, Integer rir) {
        return new RefSet(new BigDecimal(kg), reps, rir);
    }

    private static Decision decide(RefSet r, int repMin, int repMax, int targetRir, StepPolicy p, boolean deload) {
        return ProgressionDecider.decide(r, repMin, repMax, targetRir, p, Set.of(), Set.of(), deload);
    }

    // ── Up branch (mezo-bk7sn spec §3.2 / §3.8) ─────────────────────────────────────────

    @Test
    void decide_shouldStepOnePlateAtEqualEffortReps_whenJumpFitsTheCap() {
        Decision d = decide(ref("60", 10, 1), 6, 10, 1, COMPOUND, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("62.5");
        assertThat(d.workingReps()).isEqualTo(8);
        assertThat(d.deltaKg()).isEqualByComparingTo("2.5");
        assertThat(d.rationale()).isEqualTo("Múlt hét 10×60 kg a tartomány tetején → +2,5 kg (+4%)");
    }

    @Test
    void decide_shouldKeepRepsInRange_whenEqualEffortRepsLandInside() {
        Decision d = decide(ref("50", 7, 1), 4, 6, 1, COMPOUND, false);
        assertThat(d.base()).isEqualByComparingTo("52.5");
        assertThat(d.workingReps()).isEqualTo(5);
    }

    @Test
    void decide_shouldBuildRepPastTheTop_whenNextRealWeightIsTooFar() {
        Decision d = decide(ref("8", 12, 1), 10, 12, 1, ISOLATION, false);
        assertThat(d.lever()).isEqualTo(Lever.REP);
        assertThat(d.base()).isEqualByComparingTo("8");
        assertThat(d.workingReps()).isEqualTo(13);
        assertThat(d.deltaReps()).isEqualTo(1);
        assertThat(d.deltaKg()).isNull();
        assertThat(d.rationale()).isEqualTo("A 10 kg +25% ugrás lenne → előbb 13 ismétlés 8 kg-mal");
    }

    @Test
    void decide_shouldBuildRepForCompound_whenOnePlateIsTwentyPercent() {
        Decision d = decide(ref("12.5", 15, 1), 10, 15, 1, COMPOUND, false);
        assertThat(d.lever()).isEqualTo(Lever.REP);
        assertThat(d.workingReps()).isEqualTo(16);
    }

    @Test
    void decide_shouldForceTheJump_whenOverflowRepsAreDone() {
        Decision d = decide(ref("8", 15, 1), 10, 12, 1, ISOLATION, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("10");
        assertThat(d.workingReps()).isEqualTo(7); // equal effort 6, floored at repMin − 3
        assertThat(d.deltaKg()).isEqualByComparingTo("2");
        assertThat(d.rationale()).isEqualTo("15 ismétlés 8 kg-mal megvan → 10 kg (+25%)");
    }

    @Test
    void decide_shouldStepOneFurther_whenRirReserveIsBig() {
        Decision d = decide(ref("60", 10, 3), 6, 10, 1, COMPOUND, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("65");
        assertThat(d.workingReps()).isEqualTo(9);
        assertThat(d.rationale()).isEqualTo("Múlt hét 10×60 kg, RIR 3 — sok tartalék → +5 kg (+8%)");
    }

    @Test
    void decide_shouldFallBackToNormalStep_whenReserveStepBreaksItsCap() {
        // 30 → 32.5 (8 %) fits 10 %, 35 (17 %) breaks 15 %
        Decision d = decide(ref("30", 10, 3), 6, 10, 1, COMPOUND, false);
        assertThat(d.base()).isEqualByComparingTo("32.5");
    }

    @Test
    void decide_shouldScaleTheStep_whenLoadIsHeavy() {
        // 140 × 1.025 = 143.5 → nearest real weight above is 142.5
        Decision d = decide(ref("140", 10, 1), 6, 10, 1, COMPOUND, false);
        assertThat(d.base()).isEqualByComparingTo("142.5");
        Decision iso = decide(ref("95", 15, 1), 10, 15, 1, ISOLATION, false);
        assertThat(iso.base()).isEqualByComparingTo("100"); // 99.75 → 100
    }

    @Test
    void decide_shouldPreferALoggedOffGridWeight_whenItIsNearest() {
        Decision d = ProgressionDecider.decide(ref("36", 15, 1), 10, 15, 1, ISOLATION,
            Set.of(new BigDecimal("36"), new BigDecimal("38")), Set.of(), false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("38"); // 37.8 wanted: 38 beats 37.5
        assertThat(d.deltaKg()).isEqualByComparingTo("2");
    }

    @Test
    void decide_shouldSkipAKnownGap_whenPickingTheCandidate() {
        Decision d = ProgressionDecider.decide(ref("60", 10, 1), 6, 10, 1, COMPOUND,
            Set.of(), Set.of(new BigDecimal("62.5")), false);
        assertThat(d.base()).isEqualByComparingTo("65");
    }

    // ── In range (unchanged) ────────────────────────────────────────────────────────────

    @Test
    void decide_shouldBuildRep_whenInRangeWithRirSlack() {
        Decision d = decide(ref("62.5", 8, 3), 6, 10, 2, COMPOUND, false);
        assertThat(d.lever()).isEqualTo(Lever.REP);
        assertThat(d.base()).isEqualByComparingTo("62.5");
        assertThat(d.workingReps()).isEqualTo(9);
        assertThat(d.deltaKg()).isNull();
        assertThat(d.deltaReps()).isEqualTo(1);
    }

    @Test
    void decide_shouldHold_whenInRangeAndGrind() {
        Decision d = decide(ref("62.5", 7, 0), 6, 10, 2, COMPOUND, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.workingReps()).isEqualTo(7);
    }

    @Test
    void decide_shouldTreatNullRirAsNeutral() {
        Decision d = decide(ref("62.5", 7, null), 6, 10, 2, COMPOUND, false);
        assertThat(d.lever()).isEqualTo(Lever.REP);
        assertThat(d.workingReps()).isEqualTo(8);
    }

    // ── Down branch (spec §3.3) ────────────────────────────────────────────────────────

    @Test
    void decide_shouldDropProportionally_whenBelowRangeAndGrind() {
        Decision d = decide(ref("60", 5, 0), 6, 8, 1, COMPOUND, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("57.5");
        assertThat(d.workingReps()).isEqualTo(6);
        assertThat(d.deltaKg()).isEqualByComparingTo("-2.5");
        assertThat(d.rationale()).isEqualTo("Múlt hét 5 rep a cél alatt, grind → −2,5 kg");
    }

    @Test
    void decide_shouldBuildFromBelow_whenTheDropIsTooFarAndTheMissIsSmall() {
        Decision d = decide(ref("10", 7, 1), 10, 12, 1, ISOLATION, false);
        assertThat(d.lever()).isEqualTo(Lever.REP);
        assertThat(d.base()).isEqualByComparingTo("10");
        assertThat(d.workingReps()).isEqualTo(8);
        assertThat(d.rationale()).isEqualTo("A 7,5 kg −25% lenne → maradunk, 8 ismétlés a cél");
    }

    @Test
    void decide_shouldHoldFromBelow_whenTheDropIsTooFarAndItWasAGrind() {
        Decision d = decide(ref("10", 7, 0), 10, 12, 1, ISOLATION, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.workingReps()).isEqualTo(7);
    }

    @Test
    void decide_shouldDropAnyway_whenTheMissIsBeyondTheOverflow() {
        Decision d = decide(ref("10", 5, 0), 10, 12, 1, ISOLATION, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("7.5");
        assertThat(d.deltaKg()).isNegative();
    }

    @Test
    void decide_shouldHold_whenBelowRangeButNotGrind() {
        Decision d = decide(ref("62.5", 5, 3), 6, 8, 2, COMPOUND, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.base()).isEqualByComparingTo("62.5");
    }

    // ── Deload (unchanged) ─────────────────────────────────────────────────────────────

    @Test
    void decide_shouldRegress_whenDeloadWeek() {
        Decision d = decide(ref("60", 8, 2), 6, 8, 2, COMPOUND, true);
        assertThat(d.lever()).isEqualTo(Lever.DELOAD);
        assertThat(d.base()).isEqualByComparingTo("55");
        assertThat(d.deltaKg().signum()).isNegative();
        assertThat(d.rationale()).contains("Deload");
    }

    @Test
    void decide_shouldSnapDeloadToPlateStep_whenRawWeightIsNotAMultiple() {
        Decision d = decide(ref("57.5", 8, 2), 6, 8, 2, COMPOUND, true);
        assertThat(d.base()).isEqualByComparingTo("52.5");
        assertThat(d.deltaKg()).isEqualByComparingTo("-5");
    }

    // ── Readiness „Könnyítsük" (Check-in 2.0, mezo-ck2): capAtHold ─────────────────────────

    @Test
    void testCapAtHold_shouldHoldLastWeek_whenDecisionAddsWeight() {
        Decision d = decide(ref("60", 8, 2), 6, 8, 2, COMPOUND, false);

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
        Decision d = decide(ref("62.5", 8, 3), 6, 10, 2, COMPOUND, false);

        Decision held = ProgressionDecider.capAtHold(d, ref("62.5", 8, 3), 6, 10);

        assertThat(held.lever()).isEqualTo(Lever.HOLD);
        assertThat(held.base()).isEqualByComparingTo("62.5");
        assertThat(held.workingReps()).isEqualTo(8);
    }

    @Test
    void testCapAtHold_shouldHold_whenDecisionBuildsARepPastTheTop() {
        Decision d = decide(ref("8", 12, 1), 10, 12, 1, ISOLATION, false);

        Decision held = ProgressionDecider.capAtHold(d, ref("8", 12, 1), 10, 12);

        assertThat(held.lever()).isEqualTo(Lever.HOLD);
        assertThat(held.workingReps()).isEqualTo(12);
    }

    @Test
    void testCapAtHold_shouldKeepLighterMove_whenDecisionIsDeloadOrWeightDown() {
        Decision deload = decide(ref("60", 8, 0), 6, 8, 0, COMPOUND, true);
        Decision down = decide(ref("60", 4, 0), 6, 8, 1, COMPOUND, false);

        assertThat(ProgressionDecider.capAtHold(deload, ref("60", 8, 0), 6, 8)).isSameAs(deload);
        assertThat(ProgressionDecider.capAtHold(down, ref("60", 4, 0), 6, 8)).isSameAs(down);
    }
}
