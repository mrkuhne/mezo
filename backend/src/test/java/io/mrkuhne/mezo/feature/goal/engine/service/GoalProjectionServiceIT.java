package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalProjectionService.ProjectionSegment;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifies the segmented projection (spec §4 — hybrid projection D7): the timeline walk in
 * goal-week space, the per-segment maintenance (NEAT baseline + scheduled gym/sport EAT + this
 * segment's running EAT, MET×kg×óra based; running on/off is the only boundary the fixtures move),
 * the energy-balance target for all three trajectories, and the trend-reconciled projected rate.
 *
 * <p>The goal window is 8 weeks ({@link GoalPopulator}: 2026-06-01..2026-07-27). The bootstrap +
 * trend are passed in directly (the service is pure w.r.t. those inputs), so the numbers are
 * deterministic; the plan-links + plans are seeded in the DB and read back via the train repos.
 */
@Transactional
class GoalProjectionServiceIT extends AbstractIntegrationTest {

    /** Energy-balance weight basis for the worked numbers (84 kg male — TdeeBootstrap §6.1). */
    private static final BigDecimal WEIGHT = new BigDecimal("84.00");

    @Autowired private GoalProjectionService service;
    @Autowired private GoalEngineProperties props;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalPlanLinkPopulator linkPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** Bootstrap as a NEAT baseline (bmr × neat) with zero scheduled EAT — the projection adds the
     *  scheduled + running EAT itself (MET×kg×óra), so the baseline is the only bootstrap input it uses. */
    private TdeeBootstrapJson bootstrap() {
        BigDecimal bmr = new BigDecimal("1795.00");
        BigDecimal neat = new BigDecimal("1.35");
        BigDecimal baseline = bmr.multiply(neat).setScale(2, java.math.RoundingMode.HALF_UP); // 2423.25
        return new TdeeBootstrapJson(
            bmr, neat, baseline, BigDecimal.ZERO, baseline, "MSJ", OffsetDateTime.now());
    }

    /** A trend with the given sufficiency + observed trailing-4w rate; series/percent irrelevant here.
     *  A null rate models "no observed rate yet" (sufficiency NONE → the formula projection drives). */
    private WeightTrendResponse trend(DataSufficiencyEnum suff, String last4wKgPerWeek) {
        BigDecimal rate = last4wKgPerWeek == null ? null : new BigDecimal(last4wKgPerWeek);
        return WeightTrendResponse.builder()
            .ewmaSeries(List.of())
            .latestTrendKg(WEIGHT)
            .weeklyRateKgPerWeek(rate)
            .weeklyRatePctPerWeek(BigDecimal.ZERO)
            .last4wRateKgPerWeek(rate)
            .dataSufficiency(suff)
            .build();
    }

    /** Daily energy balance magnitude for the GoalPopulator goal: 0.70 %BW/wk × 84 × 7700 / 7. */
    private double expectedDailyBalanceMagnitude() {
        return 0.70 / 100.0 * 84.0 * props.kcalPerKg() / 7.0; // = 0.588 kg/wk → 646.8 kcal/day
    }

    // ── Cut: meso W1–8 + running W1–4 → ≥2 segments with a kcal step-down at W4→W5 ──────────────

    @Test
    void testProject_shouldStepTdeeDownAtRunningBoundary_whenRunningEndsMidWindow() {
        UUID user = databasePopulator.populateUser("proj-cut@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active"); // 8-week window
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP block", "active", 8, "MAV");
        // a 4-session/week, 8-week running block — but linked only over weeks 1..4.
        RunningBlockEntity run = runningPopulator.createBlockWithSessions(user, "intervals", "planned", 8, 4);
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, 8);
        linkPopulator.createLink(user, goal.getId(), "running_block", run.getId(), 1, 4);

        // With no gym/sport schedule seeded, scheduledWeeklyEat = 0; the only delta between the run-on and
        // run-off segments is the running EAT (MET run × weight × runDefaultMin/60 × sessions ÷ 7).
        List<ProjectionSegment> segments =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, null), 0);

        // exactly two segments: W1–4 (run active) and W5–8 (run off) — the meso is a single phase class.
        assertThat(segments).hasSize(2);
        ProjectionSegment runOn = segments.get(0);
        ProjectionSegment runOff = segments.get(1);

        assertThat(runOn.fromWeek()).isEqualTo(1);
        assertThat(runOn.toWeek()).isEqualTo(4);
        assertThat(runOff.fromWeek()).isEqualTo(5);
        assertThat(runOff.toWeek()).isEqualTo(8);

        // run-on TDEE steps down to run-off; run-off == the bootstrap's neat baseline (no schedule, no run).
        assertThat(runOn.tdeeEstimate().doubleValue()).isGreaterThan(runOff.tdeeEstimate().doubleValue());
        assertThat(runOff.tdeeEstimate().doubleValue())
            .isCloseTo(bootstrap().neatBaselineKcal().doubleValue(), within(1.0));

        // cut → deficit: every segment's target sits below its own TDEE, projected rate negative.
        for (ProjectionSegment s : segments) {
            assertThat(s.targetKcal().doubleValue()).isLessThan(s.tdeeEstimate().doubleValue());
            assertThat(s.projectedRateKgPerWk().doubleValue()).isNegative();
        }
        // deficit magnitude is the same per day regardless of TDEE (the balance is weight-driven).
        double balance = expectedDailyBalanceMagnitude();
        assertThat(runOn.tdeeEstimate().doubleValue() - runOn.targetKcal().doubleValue())
            .isCloseTo(balance, within(0.5));
        // the daily energy balance is surfaced onto the segment (whole kcal, cut → negative), and run
        // is the only system.
        assertThat(segments.get(0).dailyEnergyBalanceKcal()).isNegative();
        assertThat(runOn.activeSystems()).contains("run");
        assertThat(runOff.activeSystems()).doesNotContain("run");
    }

    // ── Maintain: flat target ≈ TDEE, rate ≈ 0 ──────────────────────────────────────────────────

    @Test
    void testProject_shouldHoldTargetAtTdee_whenMaintain() {
        UUID user = databasePopulator.populateUser("proj-maintain@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "maintain", "active");
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP block", "active", 8, "MAV");
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, 8);

        List<ProjectionSegment> segments =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, "0"), 0);

        assertThat(segments).isNotEmpty();
        for (ProjectionSegment s : segments) {
            assertThat(s.targetKcal().doubleValue()).isCloseTo(s.tdeeEstimate().doubleValue(), within(0.01));
            assertThat(s.projectedRateKgPerWk().doubleValue()).isCloseTo(0.0, within(0.001));
        }
    }

    // ── Bulk: surplus + positive rate, surplus magnitude matches the rate formula (spec §9 item 4) ─

    @Test
    void testProject_shouldAddSurplusAndProjectPositiveRate_whenBulk() {
        UUID user = databasePopulator.populateUser("proj-bulk@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP block", "active", 8, "MAV");
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, 8);

        List<ProjectionSegment> segments =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, "0"), 0);

        assertThat(segments).isNotEmpty();
        double balance = expectedDailyBalanceMagnitude(); // 646.8 kcal/day surplus
        for (ProjectionSegment s : segments) {
            assertThat(s.targetKcal().doubleValue()).isGreaterThan(s.tdeeEstimate().doubleValue());
            assertThat(s.projectedRateKgPerWk().doubleValue()).isPositive();
            // surplus = rateTargetPctPerWeek × weight × 7700 / 7.
            assertThat(s.targetKcal().doubleValue() - s.tdeeEstimate().doubleValue())
                .isCloseTo(balance, within(0.5));
        }
        // positive rate magnitude = balance × 7 / kcalPerKg = 0.70 %BW × 84 / 100 = 0.588 kg/wk.
        assertThat(segments.get(0).projectedRateKgPerWk().doubleValue())
            .isCloseTo(0.588, within(0.01));
    }

    // ── Ambient volleyball does NOT create a segment boundary ────────────────────────────────────

    @Test
    void testProject_shouldNotSplitSegment_whenVolleyballAmbientAcrossWindow() {
        UUID user = databasePopulator.populateUser("proj-vb@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP block", "active", 8, "MAV");
        // A meso spanning the whole window with a single phase class → one segment, no running.
        // (Volleyball is ambient: it is never a plan-link and never splits a segment — verified by
        // the absence of any extra boundary beyond the meso/running structure.)
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, 8);

        List<ProjectionSegment> segments =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, "0"), 0);

        // No running, single meso phase class over 1..8 → exactly one segment spanning the window.
        assertThat(segments).hasSize(1);
        assertThat(segments.get(0).fromWeek()).isEqualTo(1);
        assertThat(segments.get(0).toWeek()).isEqualTo(8);
        assertThat(segments.get(0).activeSystems()).doesNotContain("run");
    }

    // ── Trend reconciliation: provisional → observed rate is the spine; none → formula rate ───────

    @Test
    void testProject_shouldUseObservedRate_whenSufficiencyProvisional() {
        UUID user = databasePopulator.populateUser("proj-trend@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP block", "active", 8, "MAV");
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, 8);

        // Observed trailing-4w rate −0.30 kg/wk differs from the formula rate (−0.588 kg/wk).
        List<ProjectionSegment> provisional =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.PROVISIONAL, "-0.30"), 0);
        // With provisional data the observed rate is the spine.
        assertThat(provisional.get(0).projectedRateKgPerWk().doubleValue())
            .isCloseTo(-0.30, within(0.001));

        // With no data the formula projection drives the rate (−0.588 kg/wk, ignores the trend value).
        List<ProjectionSegment> none =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, "-0.30"), 0);
        assertThat(none.get(0).projectedRateKgPerWk().doubleValue())
            .isCloseTo(-0.588, within(0.01));
    }

    // ── Day-type shift (slice 3 — mezo-sxlj): the weekly-invariant kcal split off rest days ────────

    @Test
    void dayTypeShiftSplitsSegmentKcalWeeklyInvariant() {
        UUID user = databasePopulator.populateUser("proj-daytype@test.local");
        // gym slots on 2 weekdays + a sport slot on a 3rd → scheduledTrainingDayOfWeeks unions to 3
        // distinct days; no running block, no meso link → the whole window is one segment.
        trainPopulator.createGymSlot(user, 0, "07:00");
        trainPopulator.createGymSlot(user, 1, "07:00");
        trainPopulator.createScheduleSlot(user, 2, "18:00", 90, "training");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active"); // 8-week window

        List<ProjectionSegment> segments =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, null), 200);

        ProjectionSegment seg = segments.get(0);
        int kcal = seg.targetKcal().setScale(0, RoundingMode.HALF_UP).intValueExact();
        assertThat(seg.restDayKcal()).isEqualTo(Math.max(kcal - 200, 1795)); // floored at ceil(bmr)
        int effective = kcal - seg.restDayKcal();
        assertThat(seg.trainingDayKcal())
            .isEqualTo(kcal + Math.round(effective * 4 / 3f));
        assertThat(3 * seg.trainingDayKcal() + 4 * seg.restDayKcal())
            .isCloseTo(7 * kcal, within(2));
    }

    @Test
    void zeroShiftLeavesDayTypeFieldsNull() {
        UUID user = databasePopulator.populateUser("proj-daytype-zero@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");

        List<ProjectionSegment> segments =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, null), 0);

        assertThat(segments.get(0).trainingDayKcal()).isNull();
        assertThat(segments.get(0).restDayKcal()).isNull();
    }
}
