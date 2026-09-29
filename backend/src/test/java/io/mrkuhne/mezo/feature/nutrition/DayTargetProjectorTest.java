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
 * The ONE served-target rule (mezo-u2pd; mezo-tb3s2 spec §2): base + LOGGED movement (planned +
 * extra) + balance, floored at BMR, with an energy breakdown that always closes; pending is display
 * only. Without an energy base the pre-mezo-tb3s2 shape (seg.kcal + extra) is kept.
 * Pure, so a plain unit test: the Fuel day, the meal scorer, the diet-settings preview and the
 * character reads all go through exactly this.
 */
class DayTargetProjectorTest {

    private static final NutritionTargetsProperties FALLBACK =
        new NutritionTargetsProperties(2000, 150, 200, 60, 4000);

    private static final EnergyBase BASE = new EnergyBase(new BigDecimal("1963"), new BigDecimal("2356"));

    /** The owner-shaped example (spec §2): BMR 1961, base (BMR × NEAT) 2159. */
    private static final EnergyBase BASE_OWNER = new EnergyBase(new BigDecimal("1961"), new BigDecimal("2159"));

    private static Supplier<WorkoutWindowQueryService.DayMovement> mv(int planned, int extra, int pending) {
        return () -> new WorkoutWindowQueryService.DayMovement(planned + extra > 0, planned, extra, pending);
    }

    private static Supplier<WorkoutWindowQueryService.DayMovement> planned(boolean done) {
        return () -> new WorkoutWindowQueryService.DayMovement(done, 0, 0, 0);
    }

    /** seg kcal 1816 (weekly planning number), balance −769, carbs 161. */
    private static GoalPrescriptionJson.Segment ownerSeg() {
        return segment(1816, 170, 161, 60, null, null, -769);
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
    void testProject_shouldServeBasePlusLoggedMovementPlusBalance() {
        DailyTargets t = DayTargetProjector.project(ownerSeg(), BASE_OWNER, mv(300, 490, 0), FALLBACK);

        assertThat(t.kcal()).isEqualTo(2159 + 790 - 769);            // 2180
        assertThat(t.energy().plannedMovementKcal()).isEqualTo(300);
        assertThat(t.energy().extraMovementKcal()).isEqualTo(490);
        assertThat(t.energy().balanceKcal()).isEqualTo(-769);
        assertThat(t.energy().targetKcal()).isEqualTo(2180);
        assertThat(t.energy().pendingMovementKcal()).isNull();
        assertThat(t.c()).isEqualTo(161 + Math.round((2180 - 1816) / 4f));
    }

    @Test
    void testProject_shouldFloorAtBmrAndFoldIntoBalance_whenNothingLogged() {
        DailyTargets t = DayTargetProjector.project(ownerSeg(), BASE_OWNER, mv(0, 0, 650), FALLBACK);

        assertThat(t.kcal()).isEqualTo(1961);
        assertThat(t.energy().plannedMovementKcal() + t.energy().extraMovementKcal()).isZero();
        assertThat(t.energy().balanceKcal()).isEqualTo(1961 - 2159);   // −198
        assertThat(t.energy().pendingMovementKcal()).isEqualTo(650);   // display only: not in the target
        assertThat(t.c()).isEqualTo(161 + Math.round((1961 - 1816) / 4f));
    }

    @Test
    void testProject_shouldIgnoreLegacySplit() {
        GoalPrescriptionJson.Segment split = segment(1816, 170, 161, 60, 2000, 1700, -769);

        DailyTargets withSplit = DayTargetProjector.project(split, BASE_OWNER, mv(300, 490, 0), FALLBACK);
        DailyTargets without = DayTargetProjector.project(ownerSeg(), BASE_OWNER, mv(300, 490, 0), FALLBACK);

        assertThat(withSplit).isEqualTo(without);
        assertThat(DayTargetProjector.project(split, BASE_OWNER, mv(0, 0, 0), FALLBACK))
            .isEqualTo(DayTargetProjector.project(ownerSeg(), BASE_OWNER, mv(0, 0, 0), FALLBACK));
    }

    @Test
    void testProject_shouldKeepSegKcalPlusExtra_whenNoEnergyBase() {
        DailyTargets t = DayTargetProjector.project(ownerSeg(), null, mv(300, 490, 0), FALLBACK);

        assertThat(t.kcal()).isEqualTo(1816 + 490);
        assertThat(t.energy()).isNull();
        assertThat(t.c()).isEqualTo(161 + Math.round(490 / 4f));
    }

    @Test
    void testProject_shouldServeSegmentUnchanged_whenNoBaseAndNothingExtra() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, 250, 90, 2800, 2400), null, planned(true), FALLBACK);

        // mezo-tb3s2: no base → seg.kcal + extra; the legacy day-type split no longer picks.
        assertThat(t).isEqualTo(new DailyTargets(2600, 180, 250, 90, "goal", null));
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
    void aLearnedBaseCarriesItsProvenanceWithoutChangingTheArithmetic() {
        // mezo-zz91i: Alap is the learned 2356 (formula 2480); the equation still closes the same way.
        EnergyBase learned = EnergyBase.of(new io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson(
            new BigDecimal("1963"), new BigDecimal("1.26"), new BigDecimal("2356"), new BigDecimal("570"),
            new BigDecimal("2926"), "MSJ", java.time.OffsetDateTime.parse("2026-09-21T06:00:00Z"), 2,
            "learned", new BigDecimal("2480.40"), 140, "MEDIUM"));
        DailyTargets t = DayTargetProjector.project(segment(2599, 170, 300, 86, null, null, -327), learned,
            mv(570, 573, 0), FALLBACK);
        // 2356 + 570 + 573 − 327 = 3172
        assertThat(t.energy()).isEqualTo(
            new DailyTargets.Energy(2356, 570, 573, -327, 3172, null, "learned", 2480, 140, "MEDIUM"));
    }

    @Test
    void aPreLearningSnapshotReadsAsFormula() {
        EnergyBase base = EnergyBase.of(new io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson(
            new BigDecimal("1963"), new BigDecimal("1.2"), new BigDecimal("2355.60"), BigDecimal.ZERO,
            new BigDecimal("2355.60"), "MSJ", java.time.OffsetDateTime.parse("2026-09-21T06:00:00Z"), 2));
        assertThat(base).isEqualTo(new EnergyBase(new BigDecimal("1963"), new BigDecimal("2355.60"),
            "formula", 2356, null, null));
    }

    @Test
    void equationAlwaysCloses() {
        for (var m : List.of(mv(0, 0, 0), mv(300, 0, 200), mv(0, 573, 0), mv(900, 400, 0))) {
            DailyTargets t = DayTargetProjector.project(
                segment(2599, 170, 300, 86, 2800, 2400, -327), BASE, m, FALLBACK);
            DailyTargets.Energy e = t.energy();
            assertThat(e.baseKcal() + e.plannedMovementKcal() + e.extraMovementKcal() + e.balanceKcal())
                .isEqualTo(e.targetKcal()).isEqualTo(t.kcal());
        }
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
    void noEnergyBaseNoBreakdown() {
        DailyTargets t = DayTargetProjector.project(segment(2599, 170, 300, 86, null, null, -327), null,
            () -> WorkoutWindowQueryService.DayMovement.NONE, FALLBACK);
        assertThat(t.energy()).isNull();
        assertThat(t.kcal()).isEqualTo(2599);
    }
}
