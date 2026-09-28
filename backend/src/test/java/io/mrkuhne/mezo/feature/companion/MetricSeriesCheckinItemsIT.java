package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiConsumer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Check-in 2.0 (mezo-ck2, spec §3.8): the ten new check-in series — each a day mean over the
 * answered slots (NULL = not answered, never counted), except {@code CHECKIN_PAIN}, which is the
 * day's peak intensity with an explicit "Nem" read as 0.
 */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesCheckinItemsIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    private Map<LocalDate, Double> series(UUID owner, MetricKey key) {
        return metricSeriesService.series(owner, key, DAY.minusDays(7), DAY);
    }

    /** Two answered slots (4, 8) + one slot that skipped the item — the mean is 6, not 4. */
    private void assertDayMeanIgnoresNull(MetricKey key, BiConsumer<CheckInEntity, Integer> setter) {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "06:30", c -> setter.accept(c, 4));
        checkInPopulator.createCheckIn(owner, DAY, "14:00", c -> setter.accept(c, 8));
        checkInPopulator.createCheckIn(owner, DAY, "20:00", c -> setter.accept(c, null));
        checkInPopulator.createCheckIn(owner, DAY.minusDays(1), "20:00", c -> setter.accept(c, null));

        Map<LocalDate, Double> series = series(owner, key);

        assertThat(series).as(key.name()).containsOnlyKeys(DAY);
        assertThat(series.get(DAY)).as(key.name()).isCloseTo(6.0, within(1e-9));
    }

    @Test
    void testSeries_shouldAverageAnsweredSlotsOnly_whenNewCheckinItemsQueried() {
        assertDayMeanIgnoresNull(MetricKey.CHECKIN_MOOD, CheckInEntity::setMood);
        assertDayMeanIgnoresNull(MetricKey.CHECKIN_RESTED, CheckInEntity::setRested);
        assertDayMeanIgnoresNull(MetricKey.CHECKIN_SORENESS, CheckInEntity::setSoreness);
        assertDayMeanIgnoresNull(MetricKey.CHECKIN_MOTIVATION, CheckInEntity::setMotivation);
        assertDayMeanIgnoresNull(MetricKey.CHECKIN_HUNGER, CheckInEntity::setHunger);
        assertDayMeanIgnoresNull(MetricKey.CHECKIN_CRAVING, CheckInEntity::setCraving);
        assertDayMeanIgnoresNull(MetricKey.CHECKIN_DIGESTION, CheckInEntity::setDigestion);
        assertDayMeanIgnoresNull(MetricKey.CHECKIN_CONNECTION, CheckInEntity::setConnection);
        assertDayMeanIgnoresNull(MetricKey.CHECKIN_DAY, CheckInEntity::setDayRating);
    }

    @Test
    void testSeries_shouldTakeDayPeakPainAndReadNoAsZero_whenPainAnswered() {
        UUID owner = userPopulator.createUser().getId();
        // DAY: morning "Igen" 3, evening "Igen" 7, a noon "Nem" -> the peak, 7
        checkInPopulator.createCheckIn(owner, DAY, "06:30", c -> { c.setPain(true); c.setPainIntensity(3); });
        checkInPopulator.createCheckIn(owner, DAY, "14:00", c -> c.setPain(false));
        checkInPopulator.createCheckIn(owner, DAY, "20:00", c -> { c.setPain(true); c.setPainIntensity(7); });
        // DAY-1: only "Nem" -> 0 (an answered pain-free day, not a missing one)
        checkInPopulator.createCheckIn(owner, DAY.minusDays(1), "06:30", c -> c.setPain(false));
        // DAY-2: the item was never asked / skipped -> no value at all
        checkInPopulator.createCheckIn(owner, DAY.minusDays(2), "06:30", c -> c.setEnergy(5));

        Map<LocalDate, Double> series = series(owner, MetricKey.CHECKIN_PAIN);

        assertThat(series).containsOnlyKeys(DAY, DAY.minusDays(1));
        assertThat(series.get(DAY)).isEqualTo(7.0);
        assertThat(series.get(DAY.minusDays(1))).isEqualTo(0.0);
    }
}
