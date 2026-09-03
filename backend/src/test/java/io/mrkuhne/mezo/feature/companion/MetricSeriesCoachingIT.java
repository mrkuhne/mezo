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
}
