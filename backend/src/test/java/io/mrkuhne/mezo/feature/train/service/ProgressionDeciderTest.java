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

    // ── Range conversion + ramped grind + per-style overshoot (T1, mezo-r36n9.79) ───────

    private static Decision convert(RefSet r, int repMin, int repMax, int targetRir, Set<BigDecimal> gaps) {
        return ProgressionDecider.convert(r, repMin, repMax, targetRir, COMPOUND, Set.of(), gaps);
    }

    @Test
    void convertHigherRangeGoesLighter() {
        // e1RM = 80 × (1 + (8+2)/30) = 106.667; wanted = 106.667 / (1 + (12+2)/30) = 72.73 → grid 72.5.
        // reps = 30 × (106.667/72.5 − 1) − 2 = 12.14 → 12.
        Decision d = convert(ref("80", 8, 2), 12, 15, 2, Set.of());
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("72.5");
        assertThat(d.deltaKg()).isEqualByComparingTo("-7.5");
        assertThat(d.deltaReps()).isNull();
        assertThat(d.workingReps()).isEqualTo(12);
        assertThat(d.rationale()).isEqualTo("Új tartomány (12–15): a 8×80 kg alapján → 72,5 kg × 12");
    }

    @Test
    void convertLowerRangeGoesHeavier() {
        // wanted = 106.667 / (1 + (4+2)/30) = 88.89 → 90 (1.11 away vs 87.5 at 1.39).
        // reps = 30 × (106.667/90 − 1) − 2 = 3.56 → 4 (clamped to the floor).
        Decision d = convert(ref("80", 8, 2), 4, 6, 2, Set.of());
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("90");
        assertThat(d.deltaKg()).isEqualByComparingTo("10");
        assertThat(d.workingReps()).isEqualTo(4);
    }

    @Test
    void convertKeepsWeightWhenItFits() {
        // wanted = 106.667 / (1 + (8+2)/30) = 80 exactly → the reference weight itself; reps = 8.
        Decision d = convert(ref("80", 8, 2), 8, 12, 2, Set.of());
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.base()).isEqualByComparingTo("80");
        assertThat(d.deltaKg()).isNull();
        assertThat(d.deltaReps()).isNull();
        assertThat(d.workingReps()).isEqualTo(8);
    }

    @Test
    void convertRespectsGaps() {
        // Same as the lighter case but 72.5 is a known gap → 75 (2.27 away; 70 is 2.73).
        // reps = 30 × (106.667/75 − 1) − 2 = 10.67 → 11 → clamped up to 12.
        Decision d = convert(ref("80", 8, 2), 12, 15, 2, Set.of(new BigDecimal("72.5")));
        assertThat(d.base()).isEqualByComparingTo("75");
        assertThat(d.workingReps()).isEqualTo(12);
    }

    private static Decision ramped(boolean on) {
        return ProgressionDecider.decide(ref("80", 8, 0), 6, 10, 0, COMPOUND, Set.of(), Set.of(), false, 10, on);
    }

    @Test
    void rampedGrindTwoBelowPrescribedHolds() {
        // Prescribed 10, logged 8 (= 10 − 2) at RIR 0 → grind (slack −1) → hold/consolidate.
        Decision d = ramped(true);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.base()).isEqualByComparingTo("80");
        assertThat(d.workingReps()).isEqualTo(8);
    }

    @Test
    void rampedGrindOffKeepsOldRule() {
        // Same set, ramped off: RIR 0 at target 0 → slack 0 → no grind → +1 rep.
        Decision d = ramped(false);
        assertThat(d.lever()).isEqualTo(Lever.REP);
        assertThat(d.workingReps()).isEqualTo(9);
    }

    @Test
    void heavyOverflowTwoForcesEarlier() {
        StepPolicy heavy = new StepPolicy(new BigDecimal("0.05"), new BigDecimal("0.10"),
            new BigDecimal("0.15"), 2, 2, STEP);
        StepPolicy balanced = new StepPolicy(new BigDecimal("0.05"), new BigDecimal("0.10"),
            new BigDecimal("0.15"), 2, 3, STEP);
        // 8 × 14 @1, range 10–12, next real weight 10 kg = +25% (too big). repMax + 2 = 14 → forced.
        // equal-effort reps at 10 kg = 5, clamped up to repMin − overflow = 8.
        Decision forced = ProgressionDecider.decide(ref("8", 14, 1), 10, 12, 1, heavy, Set.of(), Set.of(), false);
        assertThat(forced.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(forced.base()).isEqualByComparingTo("10");
        // overflow 3 still builds a rep at the same point.
        Decision builds = ProgressionDecider.decide(ref("8", 14, 1), 10, 12, 1, balanced, Set.of(), Set.of(), false);
        assertThat(builds.lever()).isEqualTo(Lever.REP);
        assertThat(builds.workingReps()).isEqualTo(15);
    }
}
