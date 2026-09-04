package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * V3.1 series extraction over populator-seeded days — window bounds, deterministic multi-row
 * aggregation (avg check-ins, sum sport minutes), gap semantics (weight delta never bridges).
 */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private MealPopulator mealPopulator;

    @Test
    void testSeries_shouldReturnQualityPerDayInsideWindow_whenSleepLogged() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("7.5"), 4);
        sleepLogPopulator.createSleepLog(owner, DAY.minusDays(1), new BigDecimal("6.0"), 2);
        sleepLogPopulator.createSleepLog(owner, DAY.plusDays(5), new BigDecimal("8.0"), 5); // outside

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.SLEEP_QUALITY, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY, DAY.minusDays(1));
        assertThat(series.get(DAY)).isEqualTo(4.0);
    }

    @Test
    void testSeries_shouldAverageSlots_whenMultipleCheckInsPerDay() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 4, 2, null);
        checkInPopulator.createCheckIn(owner, DAY, "20:00", 2, 4, null);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.CHECKIN_STRESS, DAY.minusDays(7), DAY);

        assertThat(series.get(DAY)).isCloseTo(3.0, within(1e-9));
    }

    @Test
    void testSeries_shouldSumSportMinutes_whenTwoSessionsSameDay() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSession(owner, DAY);
        trainPopulator.createSportSession(owner, DAY);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.SPORT_LOAD_MIN, DAY.minusDays(7), DAY);

        // the populator's default session carries a duration — two sessions must sum
        assertThat(series.get(DAY)).isNotNull();
        Map<LocalDate, Double> single = metricSeriesService.series(
                userPopulator.createUser().getId(), MetricKey.SPORT_LOAD_MIN, DAY.minusDays(7), DAY);
        assertThat(single).isEmpty();
    }

    @Test
    void testSeries_shouldComputeMorningDelta_whenConsecutiveDaysOnly() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, DAY.minusDays(4), new BigDecimal("105.0"));
        weightLogPopulator.createWeightLog(owner, DAY.minusDays(3), new BigDecimal("104.6"));
        // gap: minusDays(2) missing
        weightLogPopulator.createWeightLog(owner, DAY.minusDays(1), new BigDecimal("104.0"));

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.WEIGHT_DELTA_KG, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY.minusDays(3)); // gaps never bridged
        assertThat(series.get(DAY.minusDays(3))).isCloseTo(-0.4, within(1e-9));
    }

    @Test
    void testSeries_shouldUseLatestSameDayWeighIn_whenDayHasTwoRows() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, DAY.minusDays(1), new BigDecimal("105.0"));
        // same-day correction: the typo first, the real value second — the LATER row must win
        weightLogPopulator.createWeightLog(owner, DAY, new BigDecimal("108.5"));
        weightLogPopulator.createWeightLog(owner, DAY, new BigDecimal("104.5"));

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.WEIGHT_DELTA_KG, DAY.minusDays(7), DAY);

        assertThat(series.get(DAY)).isCloseTo(-0.5, within(1e-9));
    }

    @Test
    void testSeries_shouldSkipUnloggedDays_whenWaterQueried() {
        UUID owner = userPopulator.createUser().getId();
        waterLogPopulator.createWaterLog(owner, DAY, 2500);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.DAILY_WATER_ML, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY);
        assertThat(series.get(DAY)).isEqualTo(2500.0);
    }

    /** Bounded-read characterisation (mezo-9gp3, mezo-d58h.6): pins LATE_MEAL_HOUR's values —
     *  same-day max, out-of-window meals excluded — so the read-bound fix cannot move them. */
    @Test
    void testSeries_shouldReturnLatestMealHourInsideWindow_whenMealsLogged() {
        UUID owner = userPopulator.createUser().getId();
        List<MealPopulator.Line> lines = List.of(
                new MealPopulator.Line("Csirke", "500", "40", "30", "15", (short) 1));
        mealPopulator.createMealWithItems(owner, DAY, "breakfast",
                DAY.atTime(8, 0).atZone(ZoneId.systemDefault()).toInstant(), lines);
        mealPopulator.createMealWithItems(owner, DAY, "dinner",
                DAY.atTime(20, 30).atZone(ZoneId.systemDefault()).toInstant(), lines);
        // outside the window on both sides — must not surface or shift the DAY value
        mealPopulator.createMealWithItems(owner, DAY.minusDays(5), "dinner",
                DAY.minusDays(5).atTime(23, 0).atZone(ZoneId.systemDefault()).toInstant(), lines);
        mealPopulator.createMealWithItems(owner, DAY.plusDays(2), "dinner",
                DAY.plusDays(2).atTime(23, 0).atZone(ZoneId.systemDefault()).toInstant(), lines);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.LATE_MEAL_HOUR, DAY.minusDays(3), DAY);

        assertThat(series).containsOnlyKeys(DAY);
        assertThat(series.get(DAY)).isCloseTo(20.5, within(1e-9)); // the later of the two wins
    }

    /**
     * Bounded-read characterisation for WEIGHT_TREND_PCT_WK's left-edge trap: from == to == DAY,
     * so the 7-day rolling slope for DAY needs weigh-ins back to DAY-6 — all of which sit in
     * {@code [from-6, from-1]}, i.e. BEFORE {@code from}. A bound narrowed to {@code [from, to]}
     * would drop them, leave <4 points in the window, and silently erase this data point.
     */
    @Test
    void testSeries_shouldIncludeLeftEdgeMargin_whenComputingWeightTrendSlope() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, DAY.minusDays(6), new BigDecimal("100.0"));
        weightLogPopulator.createWeightLog(owner, DAY.minusDays(4), new BigDecimal("99.0"));
        weightLogPopulator.createWeightLog(owner, DAY.minusDays(2), new BigDecimal("98.0"));
        weightLogPopulator.createWeightLog(owner, DAY, new BigDecimal("97.0"));

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.WEIGHT_TREND_PCT_WK, DAY, DAY);

        assertThat(series).containsOnlyKeys(DAY);
        // linear -0.5 kg/day slope over a 98.5 kg window mean: -0.5 * 7 / 98.5 * 100
        assertThat(series.get(DAY)).isCloseTo(-3.5532994923857868, within(1e-6));
    }
}
