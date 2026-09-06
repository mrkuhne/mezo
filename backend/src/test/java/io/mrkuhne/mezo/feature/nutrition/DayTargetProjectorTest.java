package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.nutrition.service.DayTargetProjector;
import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.Test;

/**
 * The extracted segment → served-targets rule (mezo-u2pd). Pure, so a plain unit test: the Fuel
 * day, the meal scorer and the diet-settings preview all go through exactly this.
 */
class DayTargetProjectorTest {

    private static final NutritionTargetsProperties FALLBACK =
        new NutritionTargetsProperties(2000, 150, 200, 60, 4000);

    private static GoalPrescriptionJson.Segment segment(
        Integer kcal, Integer p, Integer c, Integer f, Integer trainingKcal, Integer restKcal) {
        return new GoalPrescriptionJson.Segment(
            1, 4, "label", kcal, p, c, f, new BigDecimal("8.0"), List.of(),
            null, null, trainingKcal, restKcal, "rationale");
    }

    @Test
    void testProject_shouldReturnConfigFallback_whenNoSegmentCoversTheDate() {
        DailyTargets t = DayTargetProjector.project(null, () -> true, FALLBACK);

        assertThat(t).isEqualTo(new DailyTargets(2000, 150, 200, 60, "config"));
    }

    @Test
    void testProject_shouldServeSegmentUnchanged_whenSegmentCarriesNoDayTypeSplit() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, 250, 90, null, null), () -> true, FALLBACK);

        assertThat(t).isEqualTo(new DailyTargets(2600, 180, 250, 90, "goal"));
    }

    @Test
    void testProject_shouldNotProbeTheDayType_whenSegmentIsUniform() {
        AtomicInteger probes = new AtomicInteger();
        BooleanSupplier probe = () -> {
            probes.incrementAndGet();
            return true;
        };

        DayTargetProjector.project(segment(2600, 180, 250, 90, null, null), probe, FALLBACK);

        assertThat(probes).hasValue(0); // the probe is a DB round-trip a uniform segment must not pay
    }

    @Test
    void testProject_shouldServeTrainingDayKcalWithCarbDelta_whenTheDateIsATrainingDay() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, 250, 90, 2800, 2400), () -> true, FALLBACK);

        assertThat(t.kcal()).isEqualTo(2800);
        assertThat(t.c()).isEqualTo(300); // +200 kcal / 4 = +50 g — the whole delta lands in carbs
        assertThat(t.p()).isEqualTo(180);
        assertThat(t.f()).isEqualTo(90);
    }

    @Test
    void testProject_shouldServeRestDayKcalWithNegativeCarbDelta_whenTheDateIsARestDay() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, 250, 90, 2800, 2400), () -> false, FALLBACK);

        assertThat(t.kcal()).isEqualTo(2400);
        assertThat(t.c()).isEqualTo(200);
    }

    @Test
    void testProject_shouldKeepSegmentKcal_whenOnlyTheOtherDayTypeFieldIsSet() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, 250, 90, 2800, null), () -> false, FALLBACK);

        assertThat(t.kcal()).isEqualTo(2600);
        assertThat(t.c()).isEqualTo(250);
    }

    @Test
    void testProject_shouldFallBackPerField_whenSegmentPredatesTheCarbsFatSplit() {
        DailyTargets t = DayTargetProjector.project(
            segment(2600, 180, null, null, null, null), () -> false, FALLBACK);

        assertThat(t).isEqualTo(new DailyTargets(2600, 180, 200, 60, "goal"));
    }
}
