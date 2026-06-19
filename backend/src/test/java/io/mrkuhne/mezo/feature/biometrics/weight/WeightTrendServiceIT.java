package io.mrkuhne.mezo.feature.biometrics.weight;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Load-bearing spine test: the EWMA weight trend feeds the projection (Task 6) and the
 * rate-cap guard (Task 7), so its rate and smoothing are asserted against hand-computed
 * expectations.
 *
 * <p>EWMA constant for the configured half-life 10 days:
 * {@code α = 1 − 0.5^(1/10) ≈ 0.066967}.
 */
@Transactional
class WeightTrendServiceIT extends AbstractIntegrationTest {

    private static final LocalDate START = LocalDate.of(2026, 5, 1);

    @Autowired private WeightTrendService service;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;

    @Test
    void testComputeTrend_shouldReturnNoneWithZeroRates_whenNoWeighIns() {
        UUID user = databasePopulator.populateUser("empty@test.local");

        WeightTrendResponse trend = service.computeTrend(user);

        assertThat(trend.getDataSufficiency()).isEqualTo(DataSufficiencyEnum.NONE);
        assertThat(trend.getEwmaSeries()).isEmpty();
        assertThat(trend.getWeeklyRateKgPerWeek()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(trend.getWeeklyRatePctPerWeek()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(trend.getLast4wRateKgPerWeek()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void testComputeTrend_shouldReturnNoneAndZeroRate_whenSingleWeighIn() {
        UUID user = databasePopulator.populateUser("single@test.local");
        weightLogPopulator.createWeightLog(user, START, new BigDecimal("80.00"));

        WeightTrendResponse trend = service.computeTrend(user);

        // One distinct day → no slope is defined: none + zero rate, but the EWMA seed is exposed.
        assertThat(trend.getDataSufficiency()).isEqualTo(DataSufficiencyEnum.NONE);
        assertThat(trend.getEwmaSeries()).hasSize(1);
        assertThat(trend.getLatestTrendKg()).isEqualByComparingTo(new BigDecimal("80.000"));
        assertThat(trend.getWeeklyRateKgPerWeek()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void testComputeTrend_shouldMatchHandComputedWeeklyRate_whenSteadilyDescending() {
        UUID user = databasePopulator.populateUser("descending@test.local");
        // Perfectly linear input: 84.0 → 82.5 over 22 daily weigh-ins (days 0..21, span 21d).
        // Input slope = -1.5 kg / 21 d × 7 = -0.5 kg/week.
        //
        // A 10-day-half-life EWMA lags hard over a window this short: roughly half the window is
        // warm-up where the trend has not yet caught the true slope, so the OLS slope of the EWMA
        // is attenuated to ~half the input rate. The deterministic, hand-reproducible answer for
        // this exact series is -0.253 kg/week (α = 1 − 0.5^(1/10) ≈ 0.066967, EWMA seeded at the
        // first point, OLS over all 22 trend points). We assert that exact value (tight band) — it
        // is the engine's ground truth, and the attenuation vs the -0.5 input is itself the point:
        // the rate the engine reports is the trend's own slope, never the raw input slope.
        double perDay = -1.5 / 21.0;
        for (int day = 0; day <= 21; day++) {
            BigDecimal w = BigDecimal.valueOf(84.0 + perDay * day).setScale(2, java.math.RoundingMode.HALF_UP);
            weightLogPopulator.createWeightLog(user, START.plusDays(day), w);
        }

        WeightTrendResponse trend = service.computeTrend(user);

        assertThat(trend.getEwmaSeries()).hasSize(22);
        // EWMA lags a falling series, so the latest trend sits ABOVE the raw last weigh-in (82.5).
        assertThat(trend.getLatestTrendKg().doubleValue()).isGreaterThan(82.5).isLessThan(83.5);
        // Hand-computed EWMA-OLS slope for this series: -0.253 kg/week (attenuated from the -0.5
        // input by the 10-day-half-life lag). Negative, attenuated, deterministic.
        assertThat(trend.getWeeklyRateKgPerWeek().doubleValue()).isCloseTo(-0.253, within(0.02));
        assertThat(trend.getWeeklyRateKgPerWeek().doubleValue()).isNegative().isGreaterThan(-0.5);
        // weeklyRatePct = weeklyRate / latestTrend × 100; ~-0.253 / ~83 → roughly -0.3 %.
        assertThat(trend.getWeeklyRatePctPerWeek().doubleValue()).isNegative().isGreaterThan(-1.0);
        // 22 logs over a 21-day span at 7/week → full sufficiency.
        assertThat(trend.getDataSufficiency()).isEqualTo(DataSufficiencyEnum.FULL);
    }

    @Test
    void testComputeTrend_shouldAttenuateSingleDaySpike_whenOneOutlier() {
        UUID user = databasePopulator.populateUser("spike@test.local");
        // 10 flat days at 80.0, then a single +10 kg spike on the last day.
        for (int day = 0; day < 10; day++) {
            weightLogPopulator.createWeightLog(user, START.plusDays(day), new BigDecimal("80.00"));
        }
        weightLogPopulator.createWeightLog(user, START.plusDays(10), new BigDecimal("90.00"));

        WeightTrendResponse trend = service.computeTrend(user);

        double latestEwma = trend.getLatestTrendKg().doubleValue();
        // Raw last weigh-in is 90.0; EWMA on the spike day ≈ 0.067·90 + 0.933·80.67 ≈ 81.3.
        // Smoothing must strongly attenuate the spike: the EWMA is far below the raw value …
        assertThat(90.0 - latestEwma).isGreaterThan(5.0);
        // … and stays anchored near the 80.0 baseline rather than chasing the outlier.
        assertThat(latestEwma).isLessThan(82.0).isGreaterThan(80.0);
    }

    @Test
    void testComputeTrend_shouldBeProvisional_whenSpanUnderFourteenDays() {
        UUID user = databasePopulator.populateUser("provisional@test.local");
        // 10 daily weigh-ins → span 9 days (< 14): provisional even though density is high.
        for (int day = 0; day < 10; day++) {
            weightLogPopulator.createWeightLog(user, START.plusDays(day), new BigDecimal("80.00"));
        }

        WeightTrendResponse trend = service.computeTrend(user);

        assertThat(trend.getDataSufficiency()).isEqualTo(DataSufficiencyEnum.PROVISIONAL);
        assertThat(trend.getEwmaSeries()).hasSize(10);
    }

    @Test
    void testComputeTrend_shouldBeProvisional_whenSpanLongButDensityThin() {
        UUID user = databasePopulator.populateUser("sparse@test.local");
        // 4 weigh-ins spread across a 28-day span → density ≈ 1/week (< 4): provisional.
        weightLogPopulator.createWeightLog(user, START, new BigDecimal("80.00"));
        weightLogPopulator.createWeightLog(user, START.plusDays(9), new BigDecimal("79.50"));
        weightLogPopulator.createWeightLog(user, START.plusDays(18), new BigDecimal("79.00"));
        weightLogPopulator.createWeightLog(user, START.plusDays(28), new BigDecimal("78.50"));

        WeightTrendResponse trend = service.computeTrend(user);

        assertThat(trend.getDataSufficiency()).isEqualTo(DataSufficiencyEnum.PROVISIONAL);
    }

    private static org.assertj.core.data.Offset<Double> within(double tolerance) {
        return org.assertj.core.data.Offset.offset(tolerance);
    }
}
