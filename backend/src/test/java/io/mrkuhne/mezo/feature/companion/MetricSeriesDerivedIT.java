package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * V3.4 derivált sport-tudományi metrikák: naptári hétvége-sorozat, ACWR belső ablak-kiterjesztéssel
 * (az ablak ELŐTTI 28 nap beszámít), Foster-monotónia (szórás=0 → nincs adatpont),
 * lefekvés-szórás (min. 3 nap a gördülő ablakban).
 */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesDerivedIT extends AbstractIntegrationTest {

    // fix hétfő, hogy a hétvége-asszertek determinisztikusak legyenek
    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 15);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    @Test
    void testSeries_shouldMarkSaturdaySunday_whenWeekendRequested() {
        UUID owner = userPopulator.createUser().getId();

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.WEEKEND, MONDAY, MONDAY.plusDays(6));

        assertThat(series).hasSize(7); // tiszta naptári sorozat — minden napra létezik
        assertThat(series.get(MONDAY)).isEqualTo(0.0);
        assertThat(series.get(MONDAY.plusDays(5))).isEqualTo(1.0); // szombat
        assertThat(series.get(MONDAY.plusDays(6))).isEqualTo(1.0); // vasárnap
    }

    @Test
    void testSeries_shouldUsePreWindowLoadInChronic_whenAcwrRequested() {
        UUID owner = userPopulator.createUser().getId();
        // 28 nap egyenletes 60 perc/nap a kért ablak ELŐTT — csak a krónikus nevezőben él
        for (int i = 1; i <= 27; i++) {
            trainPopulator.createSportSession(owner, MONDAY.minusDays(i), 60);
        }
        trainPopulator.createSportSession(owner, MONDAY, 120);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.ACWR, MONDAY, MONDAY);

        // akut = (6*60 + 120)/7; krónikus = (27*60 + 120)/28 — az ablak ELŐTTI napok nélkül
        // a krónikus 120/28 lenne és az arány 4.0 — a kiterjesztés pont ezt előzi meg
        double acute = (6 * 60.0 + 120) / 7;
        double chronic = (27 * 60.0 + 120) / 28;
        assertThat(series.get(MONDAY)).isCloseTo(acute / chronic, within(1e-9));
    }

    @Test
    void testSeries_shouldOmitDay_whenMonotonyStdDevZero() {
        UUID owner = userPopulator.createUser().getId();
        // 7 azonos terhelésű nap → szórás=0 → definiálatlan monotónia, nincs adatpont (nem ∞)
        for (int i = 0; i < 7; i++) {
            trainPopulator.createSportSession(owner, MONDAY.minusDays(i), 60);
        }

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.TRAINING_MONOTONY, MONDAY, MONDAY);

        assertThat(series).doesNotContainKey(MONDAY);
    }

    @Test
    void testSeries_shouldComputeMonotony_whenLoadVaries() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSession(owner, MONDAY, 90);
        trainPopulator.createSportSession(owner, MONDAY.minusDays(2), 30);
        // többi 5 nap 0 terhelés → átlag/szórás jól definiált

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.TRAINING_MONOTONY, MONDAY, MONDAY);

        // a képlet helyességét a szórás=0 eset védi; itt a jól definiált pozitív érték a lényeg
        assertThat(series.get(MONDAY)).isPositive();
    }

    @Test
    void testSeries_shouldRequireThreeBedtimes_whenVariabilityRequested() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, MONDAY, "22:00", "06:00", new BigDecimal("7.5"), 4, 0, null);
        sleepLogPopulator.createSleepLog(owner, MONDAY.minusDays(1), "23:00", "06:00", new BigDecimal("6.5"), 3, 0, null);

        Map<LocalDate, Double> two = metricSeriesService.series(
                owner, MetricKey.BEDTIME_VARIABILITY, MONDAY, MONDAY);
        assertThat(two).doesNotContainKey(MONDAY); // csak 2 nap adat a 7 napos ablakban

        sleepLogPopulator.createSleepLog(owner, MONDAY.minusDays(2), "0:00", "07:00", new BigDecimal("6.0"), 3, 0, null);
        Map<LocalDate, Double> three = metricSeriesService.series(
                owner, MetricKey.BEDTIME_VARIABILITY, MONDAY, MONDAY);
        // órák: 22, 23, 24 → átlag 23, populációs szórás sqrt(2/3)
        assertThat(three.get(MONDAY)).isCloseTo(Math.sqrt(2.0 / 3), within(1e-9));
    }
}
