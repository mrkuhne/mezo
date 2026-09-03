package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * S1 coaching-metric extractors (spec 2026-09-03 §3.1): SHOULDER_STRAIN napi csúcs,
 * WEIGHT_TREND_PCT_WK 7 napos regressziós lejtő %/hét, COMBINED_LOAD_MIN naptári terhelés-sor.
 */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesCoachingIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 15);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;

    @Test
    void testSeries_shouldReturnDayPeak_whenShoulderStrainRequested() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSessionWithShoulderStrain(owner, MONDAY, 120, 3);
        trainPopulator.createSportSessionWithShoulderStrain(owner, MONDAY, 60, 8);
        trainPopulator.createSportSessionWithShoulderStrain(owner, MONDAY.plusDays(1), 90, null);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.SHOULDER_STRAIN, MONDAY, MONDAY.plusDays(2));

        assertThat(series.get(MONDAY)).isEqualTo(8.0); // peak, not mean
        assertThat(series).doesNotContainKey(MONDAY.plusDays(1)); // null strain ⇒ no datapoint
        assertThat(series).doesNotContainKey(MONDAY.plusDays(2)); // no session ⇒ missing stays missing
    }

    @Test
    void testSeries_shouldReturnRegressionSlopePctPerWeek_whenWeightTrendRequested() {
        UUID owner = userPopulator.createUser().getId();
        // Perfectly linear fall: 84.0, 83.8, ... -0.2 kg/day over 7 days ⇒ -1.4 kg/week.
        // Mean of the window = 83.4 kg ⇒ -1.4/83.4*100 = -1.679 %/week.
        for (int i = 0; i < 7; i++) {
            weightLogPopulator.createWeightLog(owner, MONDAY.plusDays(i),
                    BigDecimal.valueOf(84.0 - 0.2 * i));
        }

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.WEIGHT_TREND_PCT_WK, MONDAY.plusDays(6), MONDAY.plusDays(6));

        assertThat(series.get(MONDAY.plusDays(6))).isCloseTo(-1.679, within(0.01));
    }

    @Test
    void testSeries_shouldStaySilent_whenFewerThanFourWeighIns() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, MONDAY, BigDecimal.valueOf(84.0));
        weightLogPopulator.createWeightLog(owner, MONDAY.plusDays(3), BigDecimal.valueOf(83.0));
        weightLogPopulator.createWeightLog(owner, MONDAY.plusDays(6), BigDecimal.valueOf(82.0));

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.WEIGHT_TREND_PCT_WK, MONDAY.plusDays(6), MONDAY.plusDays(6));

        assertThat(series).isEmpty(); // 3 weigh-ins < 4 ⇒ unknown, not zero
    }
}
