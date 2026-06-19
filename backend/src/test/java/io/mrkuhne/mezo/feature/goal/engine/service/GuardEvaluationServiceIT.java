package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson.GuardStatus;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifies the soft guards (spec §5.3, D9 — WARN, never block): the strength guard (e1RM trend on
 * the main lift, Epley, reps&gt;10 discarded), the muscle-volume guard (per-muscle weekly hard sets
 * vs maintenance/warn floor), and the rate-cap guard (the trailing-4w EWMA slope, NOT the lagging
 * whole-series slope). Protein monitoring is deferred (Fuel not built) → always {@code false}.
 *
 * <p>The {@link WeightTrendResponse} is passed in directly (the service is pure w.r.t. that input),
 * so the rate-cap numbers are deterministic; the goal/meso/sets/volume-logs are seeded in the DB and
 * read back via the train repos + {@code ExerciseRecordService} grouping.
 */
@Transactional
class GuardEvaluationServiceIT extends AbstractIntegrationTest {

    @Autowired private GuardEvaluationService service;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private GoalRepository goalRepository;

    /** A trend with the given trailing-4w + whole-series rates against an 84 kg latest weight. */
    private WeightTrendResponse trend(String last4wKgPerWeek, String weeklyKgPerWeek) {
        java.math.BigDecimal weight = new java.math.BigDecimal("84.00");
        return WeightTrendResponse.builder()
            .ewmaSeries(List.of())
            .latestTrendKg(weight)
            .weeklyRateKgPerWeek(new java.math.BigDecimal(weeklyKgPerWeek))
            .weeklyRatePctPerWeek(new java.math.BigDecimal(weeklyKgPerWeek)
                .divide(weight, 6, java.math.RoundingMode.HALF_UP)
                .multiply(new java.math.BigDecimal("100")))
            .last4wRateKgPerWeek(new java.math.BigDecimal(last4wKgPerWeek))
            .dataSufficiency(DataSufficiencyEnum.PROVISIONAL)
            .build();
    }

    /** Overwrite the goal's guard set (the populator seeds both guards). */
    private GoalEntity goalWithGuards(UUID user, List<String> guards) {
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        goal.setGuards(guards);
        return goalRepository.saveAndFlush(goal);
    }

    /**
     * Seed a main-lift e1RM series with the given total percentage change between an early week and
     * a recent week. {@code earlyTopWeight} is the early best-set weight (×5 reps), the recent best
     * is {@code earlyTopWeight × (1 + pctChange/100)} at the same reps so the e1RM moves by exactly
     * {@code pctChange}. Returns the meso so the muscle guard can reuse it.
     */
    private MesocycleEntity seedStrengthSeries(UUID user, double earlyTopWeight, double pctChange) {
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        WorkoutSessionEntity session =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Push", "lift", 0, "completed");
        // catalogId null → identity keys on the name (no exercise_catalog FK dependency).
        ExerciseEntity bench = trainPopulator.createExercise(
            user, session.getId(), "Fekvenyomás", 0, "mell", "compound", null);

        Instant early = Instant.now().minus(28, ChronoUnit.DAYS);
        Instant recent = Instant.now().minus(2, ChronoUnit.DAYS);
        double recentTopWeight = earlyTopWeight * (1.0 + pctChange / 100.0);
        // 5 reps so the Epley factor (35/30) is identical across both points → e1RM moves with weight.
        trainPopulator.createLoggedSet(
            user, bench.getId(), session.getId(), 0, fmt(earlyTopWeight), 5, 1, early);
        trainPopulator.createLoggedSet(
            user, bench.getId(), session.getId(), 1, fmt(recentTopWeight), 5, 1, recent);
        return meso;
    }

    private static String fmt(double kg) {
        return new java.math.BigDecimal(kg).setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    // ── Muscle guard: below-maintenance volume is flagged, at/above maintenance is not ────────────

    @Test
    void testEvaluate_shouldFlagBelowMaintenanceMuscle_whenSetsUnderWarnFloor() {
        UUID user = databasePopulator.populateUser("guard-vol@test.local");
        GoalEntity goal = goalWithGuards(user, List.of("muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        // calves below the warn floor (6); chest comfortably above maintenance (8).
        trainPopulator.createVolumeLog(user, meso.getId(), "vádli", 4);
        trainPopulator.createVolumeLog(user, meso.getId(), "mell", 14);

        GuardStatus status = service.evaluate(goal, List.of(meso.getId()), trend("-0.40", "-0.40"));

        assertThat(status.muscle().active()).isTrue();
        assertThat(status.muscle().belowMaintenanceMuscles()).contains("vádli").doesNotContain("mell");
        assertThat(status.muscle().minWeeklySetsPerMuscle()).isEqualTo(4);
        assertThat(status.muscle().notes()).isNotEmpty();
        assertThat(status.muscle().proteinMonitored()).isFalse();
        assertThat(status.muscle().notes()).anyMatch(n -> n.toLowerCase().contains("fehérje"));
    }

    @Test
    void testEvaluate_shouldNotFlagMuscle_whenAllAtOrAboveMaintenance() {
        UUID user = databasePopulator.populateUser("guard-vol-ok@test.local");
        GoalEntity goal = goalWithGuards(user, List.of("muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        trainPopulator.createVolumeLog(user, meso.getId(), "hát");  // currentSets 14
        trainPopulator.createVolumeLog(user, meso.getId(), "láb");  // currentSets 14

        GuardStatus status = service.evaluate(goal, List.of(meso.getId()), trend("-0.40", "-0.40"));

        assertThat(status.muscle().active()).isTrue();
        assertThat(status.muscle().belowMaintenanceMuscles()).isEmpty();
        assertThat(status.muscle().minWeeklySetsPerMuscle()).isEqualTo(14);
    }

    // ── Strength guard: a sustained −6% e1RM trend breaches, −3% (noise band) does not ────────────

    @Test
    void testEvaluate_shouldBreachStrength_whenE1rmTrendBelowBreachPct() {
        UUID user = databasePopulator.populateUser("guard-str-breach@test.local");
        GoalEntity goal = goalWithGuards(user, List.of("strength"));
        MesocycleEntity meso = seedStrengthSeries(user, 100.0, -6.0);

        GuardStatus status = service.evaluate(goal, List.of(meso.getId()), trend("-0.40", "-0.40"));

        assertThat(status.strength().active()).isTrue();
        assertThat(status.strength().breached()).isTrue();
        assertThat(status.strength().e1rmTrendPct().doubleValue()).isLessThanOrEqualTo(-5.0);
        assertThat(status.strength().notes()).isNotEmpty();
    }

    @Test
    void testEvaluate_shouldNotBreachStrength_whenE1rmTrendInNoiseBand() {
        UUID user = databasePopulator.populateUser("guard-str-ok@test.local");
        GoalEntity goal = goalWithGuards(user, List.of("strength"));
        MesocycleEntity meso = seedStrengthSeries(user, 100.0, -3.0);

        GuardStatus status = service.evaluate(goal, List.of(meso.getId()), trend("-0.40", "-0.40"));

        assertThat(status.strength().active()).isTrue();
        assertThat(status.strength().breached()).isFalse();
        assertThat(status.strength().e1rmTrendPct().doubleValue()).isGreaterThan(-5.0);
    }

    // ── Rate-cap: reacts to the trailing-4w rate, NOT the lagging whole-series rate ───────────────

    @Test
    void testEvaluate_shouldBreakRateCap_whenLast4wExceedsCapEvenIfWholeSeriesWithin() {
        UUID user = databasePopulator.populateUser("guard-rate-over@test.local");
        GoalEntity goal = goalWithGuards(user, List.of("muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        trainPopulator.createVolumeLog(user, meso.getId(), "hát");

        // last4w = −1.20 kg/wk ≈ −1.43 %BW/wk (over the 1.0% cap); whole-series = −0.40 kg/wk
        // ≈ −0.48 %BW/wk (within the cap). The guard MUST follow last4w → cap broken.
        GuardStatus status = service.evaluate(goal, List.of(meso.getId()), trend("-1.20", "-0.40"));

        assertThat(status.muscle().rateWithinCap()).isFalse();
    }

    @Test
    void testEvaluate_shouldKeepRateCap_whenLast4wWithinCapEvenIfWholeSeriesOver() {
        UUID user = databasePopulator.populateUser("guard-rate-ok@test.local");
        GoalEntity goal = goalWithGuards(user, List.of("muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        trainPopulator.createVolumeLog(user, meso.getId(), "hát");

        // last4w = −0.40 kg/wk ≈ −0.48 %BW/wk (within the 1.0% cap); whole-series = −1.20 kg/wk
        // (over). The guard must follow last4w → cap held (proves it ignores the lagging series).
        GuardStatus status = service.evaluate(goal, List.of(meso.getId()), trend("-0.40", "-1.20"));

        assertThat(status.muscle().rateWithinCap()).isTrue();
    }

    // ── Active flags: a guard absent from goal.guards is inactive ─────────────────────────────────

    @Test
    void testEvaluate_shouldDeactivateStrength_whenStrengthNotInGuards() {
        UUID user = databasePopulator.populateUser("guard-no-str@test.local");
        GoalEntity goal = goalWithGuards(user, List.of("muscle"));
        MesocycleEntity meso = seedStrengthSeries(user, 100.0, -6.0); // breach data present...
        trainPopulator.createVolumeLog(user, meso.getId(), "hát");

        GuardStatus status = service.evaluate(goal, List.of(meso.getId()), trend("-0.40", "-0.40"));

        // ...but strength is not an active guard → inactive, no breach, no trend computed.
        assertThat(status.strength().active()).isFalse();
        assertThat(status.strength().breached()).isFalse();
        assertThat(status.strength().e1rmTrendPct()).isNull();
        assertThat(status.muscle().active()).isTrue();
    }

    @Test
    void testEvaluate_shouldDeactivateMuscle_whenMuscleNotInGuards() {
        UUID user = databasePopulator.populateUser("guard-no-musc@test.local");
        GoalEntity goal = goalWithGuards(user, List.of("strength"));
        MesocycleEntity meso = seedStrengthSeries(user, 100.0, -3.0);
        trainPopulator.createVolumeLog(user, meso.getId(), "vádli"); // would-be flag ignored

        GuardStatus status = service.evaluate(goal, List.of(meso.getId()), trend("-0.40", "-0.40"));

        assertThat(status.muscle().active()).isFalse();
        assertThat(status.muscle().minWeeklySetsPerMuscle()).isNull();
        assertThat(status.muscle().belowMaintenanceMuscles()).isEmpty();
        assertThat(status.strength().active()).isTrue();
    }

    // ── proteinMonitored is always false (Fuel not built) with an explanatory note ────────────────

    @Test
    void testEvaluate_shouldNeverMonitorProtein_whenMuscleGuardActive() {
        UUID user = databasePopulator.populateUser("guard-protein@test.local");
        GoalEntity goal = goalWithGuards(user, List.of("muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        trainPopulator.createVolumeLog(user, meso.getId(), "hát");

        GuardStatus status = service.evaluate(goal, List.of(meso.getId()), trend("-0.40", "-0.40"));

        assertThat(status.muscle().proteinMonitored()).isFalse();
        assertThat(status.muscle().notes()).anyMatch(n -> n.toLowerCase().contains("fehérje"));
    }
}
