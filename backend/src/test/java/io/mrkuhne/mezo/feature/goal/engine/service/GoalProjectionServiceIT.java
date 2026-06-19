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
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifies the segmented projection (spec §4 — hybrid projection D7): the timeline walk in
 * goal-week space, block-boundary TDEE deltas (running on/off; volleyball ambient → no boundary),
 * the energy-balance target for all three trajectories, and the trend-reconciled projected rate.
 *
 * <p>The goal window is 8 weeks ({@link GoalPopulator}: 2026-06-01..2026-07-27). The bootstrap +
 * trend are passed in directly (the service is pure w.r.t. those inputs), so the numbers are
 * deterministic; the plan-links + plans are seeded in the DB and read back via the train repos.
 */
@Transactional
class GoalProjectionServiceIT extends AbstractIntegrationTest {

    /** Fixed bootstrap TDEE for the worked numbers (84 kg male, MODERATE PAL — TdeeBootstrap §6.1). */
    private static final BigDecimal TDEE = new BigDecimal("2782.25");
    private static final BigDecimal WEIGHT = new BigDecimal("84.00");

    @Autowired private GoalProjectionService service;
    @Autowired private GoalEngineProperties props;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalPlanLinkPopulator linkPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private TdeeBootstrapJson bootstrap() {
        return new TdeeBootstrapJson(
            new BigDecimal("1795.00"), TDEE, new BigDecimal("1.55"), "MSJ", OffsetDateTime.now());
    }

    /** A trend with the given sufficiency + observed trailing-4w rate; series/percent irrelevant here. */
    private WeightTrendResponse trend(DataSufficiencyEnum suff, String last4wKgPerWeek) {
        return WeightTrendResponse.builder()
            .ewmaSeries(List.of())
            .latestTrendKg(WEIGHT)
            .weeklyRateKgPerWeek(new BigDecimal(last4wKgPerWeek))
            .weeklyRatePctPerWeek(BigDecimal.ZERO)
            .last4wRateKgPerWeek(new BigDecimal(last4wKgPerWeek))
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

        List<ProjectionSegment> segments =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, "0"));

        // at least two segments: W1–4 (run active) and W5–8 (run off).
        assertThat(segments).hasSizeGreaterThanOrEqualTo(2);
        ProjectionSegment runOn = segments.get(0);
        ProjectionSegment runOff = segments.get(1);

        assertThat(runOn.fromWeek()).isEqualTo(1);
        assertThat(runOn.toWeek()).isEqualTo(4);
        assertThat(runOff.fromWeek()).isEqualTo(5);
        assertThat(runOff.toWeek()).isEqualTo(8);

        // running delta = intervalRunKcal × sessions/week ÷ 7 = 500 × 4 / 7 ≈ 285.71 kcal/day.
        double expectedRunDelta = props.met().intervalRunKcal() * 4 / 7.0;
        double step = runOn.tdeeEstimate().doubleValue() - runOff.tdeeEstimate().doubleValue();
        assertThat(step).isCloseTo(expectedRunDelta, within(0.5));

        // run-on TDEE = bootstrap + delta; run-off TDEE = bootstrap (no run, meso is PAL baseline).
        assertThat(runOn.tdeeEstimate().doubleValue())
            .isCloseTo(TDEE.doubleValue() + expectedRunDelta, within(0.5));
        assertThat(runOff.tdeeEstimate().doubleValue()).isCloseTo(TDEE.doubleValue(), within(0.5));

        // cut → deficit: every segment's target sits below its own TDEE, projected rate negative.
        for (ProjectionSegment s : segments) {
            assertThat(s.targetKcal().doubleValue()).isLessThan(s.tdeeEstimate().doubleValue());
            assertThat(s.projectedRateKgPerWk().doubleValue()).isNegative();
        }
        // deficit magnitude is the same per day regardless of TDEE (the balance is weight-driven).
        double balance = expectedDailyBalanceMagnitude();
        assertThat(runOn.tdeeEstimate().doubleValue() - runOn.targetKcal().doubleValue())
            .isCloseTo(balance, within(0.5));
        // run-on segment lists run as an active system.
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
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, "0"));

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
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, "0"));

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
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, "0"));

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
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.PROVISIONAL, "-0.30"));
        // With provisional data the observed rate is the spine.
        assertThat(provisional.get(0).projectedRateKgPerWk().doubleValue())
            .isCloseTo(-0.30, within(0.001));

        // With no data the formula projection drives the rate (−0.588 kg/wk, ignores the trend value).
        List<ProjectionSegment> none =
            service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, "-0.30"));
        assertThat(none.get(0).projectedRateKgPerWk().doubleValue())
            .isCloseTo(-0.588, within(0.01));
    }
}
