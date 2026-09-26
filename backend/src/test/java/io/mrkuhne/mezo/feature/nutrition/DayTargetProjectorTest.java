package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.nutrition.service.DayTargetProjector;
import io.mrkuhne.mezo.feature.nutrition.service.EnergyBase;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

/**
 * The ONE served-target rule (mezo-u2pd, extended by mezo-32m82): day-type pick on PLANNED training
 * done, plus unplanned extra movement, floored at BMR, with an energy breakdown that always closes.
 * Pure, so a plain unit test: the Fuel day, the meal scorer, the diet-settings preview and the
 * character reads all go through exactly this.
 */
class DayTargetProjectorTest {

    private static final NutritionTargetsProperties FALLBACK =
        new NutritionTargetsProperties(2000, 150, 200, 60, 4000);

    private static final EnergyBase BASE = new EnergyBase(new BigDecimal("1963"), new BigDecimal("2356"));

    private static Supplier<WorkoutWindowQueryService.DayMovement> planned(boolean done) {
        return () -> new WorkoutWindowQueryService.DayMovement(done, 0);
    }

    private static GoalPrescriptionJson.Segment segment(
        Integer kcal, Integer p, Integer c, Integer f, Integer trainingKcal, Integer restKcal) {
        return segment(kcal, p, c, f, trainingKcal, restKcal, null);
    }

    private static GoalPrescriptionJson.Segment segment(
        Integer kcal, Integer p, Integer c, Integer f, Integer trainingKcal, Integer restKcal,
        Integer dailyEnergyBalanceKcal) {
        return new GoalPrescriptionJson.Segment(
            1, 4, "label", kcal, p, c, f, new BigDecimal("8.0"), List.of(),
            null, dailyEnergyBalanceKcal, trainingKcal, restKcal, "rationale");
    }

    @Test
    void testProject_shouldReturnConfigFallback_whenNoSegmentCoversTheDate() {
        DailyTargets t = DayTargetProjector.project(null, BASE, planned(true), FALLBACK);

        assertThat(t).isEqualTo(new DailyTargets(2000, 150, 200, 60, "config", null));
    }

    @Test
    void testProject_shouldNotProbeMovement_whenNoSegmentCoversTheDate() {
        AtomicInteger probes = new AtomicInteger();
        Supplier<WorkoutWindowQueryService.DayMovement> probe = () -> {
            probes.incrementAndGet();
            return WorkoutWindowQueryService.DayMovement.NONE;
        };

        DayTargetProjector.project(null, BASE, probe, FALLBACK);

        assertThat(probes).hasValue(0); // the probe is a DB round-trip the config path must not pay
    }

    @Test
    void testProject_shouldServeSegmentUnchanged_whenSegmentCarriesNoDayTypeSplit() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, 250, 90, null, null), null, planned(true), FALLBACK);

        assertThat(t).isEqualTo(new DailyTargets(2600, 180, 250, 90, "goal", null));
    }

    @Test
    void testProject_shouldServeTrainingDayKcalWithCarbDelta_whenPlannedTrainingWasDone() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, 250, 90, 2800, 2400), null, planned(true), FALLBACK);

        assertThat(t.kcal()).isEqualTo(2800);
        assertThat(t.c()).isEqualTo(300); // +200 kcal / 4 = +50 g — the whole delta lands in carbs
        assertThat(t.p()).isEqualTo(180);
        assertThat(t.f()).isEqualTo(90);
    }

    @Test
    void testProject_shouldServeRestDayKcalWithNegativeCarbDelta_whenNoPlannedTrainingWasDone() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, 250, 90, 2800, 2400), null, planned(false), FALLBACK);

        assertThat(t.kcal()).isEqualTo(2400);
        assertThat(t.c()).isEqualTo(200);
    }

    @Test
    void testProject_shouldKeepSegmentKcal_whenOnlyTheOtherDayTypeFieldIsSet() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, 250, 90, 2800, null), null, planned(false), FALLBACK);

        assertThat(t.kcal()).isEqualTo(2600);
        assertThat(t.c()).isEqualTo(250);
    }

    @Test
    void testProject_shouldFallBackPerField_whenSegmentPredatesTheCarbsFatSplit() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, null, null, null, null), null, planned(false), FALLBACK);

        assertThat(t).isEqualTo(new DailyTargets(2600, 180, 200, 60, "goal", null));
    }

    @Test
    void testProject_shouldUseConfigKcalWithoutBreakdown_whenSegmentHasNoKcal() {
        DailyTargets t = DayTargetProjector.project(
            segment(null, 180, 250, null, null, null), BASE, planned(true), FALLBACK);

        assertThat(t).isEqualTo(new DailyTargets(2000, 180, 250, 60, "goal", null));
    }

    @Test
    void extraMovementRaisesTargetAndCarbs() {
        // segment 2599 = base 2356 + planned 570 + balance −327; +573 unplanned volleyball
        DailyTargets t = DayTargetProjector.project(segment(2599, 170, 300, 86, null, null, -327), BASE,
            () -> new WorkoutWindowQueryService.DayMovement(false, 573), FALLBACK);
        assertThat(t.kcal()).isEqualTo(3172);
        assertThat(t.c()).isEqualTo(300 + Math.round(573 / 4f));
        assertThat(t.energy()).isEqualTo(new DailyTargets.Energy(2356, 570, 573, -327, 3172));
    }

    @Test
    void equationAlwaysCloses() {
        DailyTargets t = DayTargetProjector.project(segment(2599, 170, 300, 86, 2800, 2400, -327), BASE,
            () -> new WorkoutWindowQueryService.DayMovement(true, 0), FALLBACK);
        DailyTargets.Energy e = t.energy();
        assertThat(e.baseKcal() + e.plannedMovementKcal() + e.extraMovementKcal() + e.balanceKcal())
            .isEqualTo(e.targetKcal()).isEqualTo(t.kcal()).isEqualTo(2800);
    }

    @Test
    void bmrFloorLandsInBalance() {
        DailyTargets t = DayTargetProjector.project(segment(1500, 170, 100, 60, null, null, -1200), BASE,
            () -> WorkoutWindowQueryService.DayMovement.NONE, FALLBACK);
        assertThat(t.kcal()).isEqualTo(1963);
        DailyTargets.Energy e = t.energy();
        assertThat(e.baseKcal() + e.plannedMovementKcal() + e.extraMovementKcal() + e.balanceKcal()).isEqualTo(1963);
    }

    @Test
    void negativePlannedShareFoldsIntoBalance() {
        // rest-day kcal below base+balance → Mozgás never shows a negative number
        DailyTargets t = DayTargetProjector.project(segment(2600, 170, 300, 86, 2900, 1950, -327), BASE,
            () -> WorkoutWindowQueryService.DayMovement.NONE, FALLBACK);
        assertThat(t.energy().plannedMovementKcal()).isZero();
        assertThat(t.energy().balanceKcal()).isEqualTo(1963 - 2356); // floor 1963 > 1950
    }

    @Test
    void noEnergyBaseNoBreakdown() {
        DailyTargets t = DayTargetProjector.project(segment(2599, 170, 300, 86, null, null, -327), null,
            () -> WorkoutWindowQueryService.DayMovement.NONE, FALLBACK);
        assertThat(t.energy()).isNull();
        assertThat(t.kcal()).isEqualTo(2599);
    }
}
