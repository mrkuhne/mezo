package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import io.mrkuhne.mezo.feature.train.service.RecoveryPeriodService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link RecoveryPeriodService#fuelDays} (Kihagyás S3, mezo-q4xt2.3): the dates a recovery period
 * puts into a Fuel mode — {@code startDate … endedOn−1}, open-ended while open, day releases IGNORED.
 */
@Transactional
class RecoveryFuelDaysIT extends AbstractIntegrationTest {

    @Autowired private UserPopulator userPopulator;
    @Autowired private RecoveryPeriodPopulator periods;
    @Autowired private RecoveryPeriodService service;

    private final LocalDate today = LocalDate.now();

    private UUID user() {
        return userPopulator.createUser().getId();
    }

    @Test
    void testFuelDays_shouldCoverStartThroughToday_whenPeriodIsOpen() {
        UUID user = user();
        periods.open(user, Reason.ILLNESS, today.minusDays(3), Estimate.FEW_DAYS);

        Map<LocalDate, RecoveryPeriodEntity> days = service.fuelDays(user, today.minusDays(10), today);

        assertThat(days).containsOnlyKeys(today.minusDays(3), today.minusDays(2), today.minusDays(1), today);
    }

    @Test
    void testFuelDays_shouldKeepAReleasedDate_whenTheDayWasReleased() {
        UUID user = user();
        RecoveryPeriodEntity p = periods.open(user, Reason.ILLNESS, today.minusDays(2), Estimate.FEW_DAYS);
        periods.release(p, today, false);

        assertThat(service.protectedDates(user, today, today)).isEmpty();
        assertThat(service.fuelDays(user, today, today)).containsOnlyKeys(today);
    }

    @Test
    void testFuelDays_shouldExcludeEndedOn_whenPeriodEnded() {
        UUID user = user();
        periods.ended(user, Reason.INJURY, today.minusDays(3), today);

        Map<LocalDate, RecoveryPeriodEntity> days = service.fuelDays(user, today.minusDays(5), today.plusDays(2));

        assertThat(days).containsOnlyKeys(today.minusDays(3), today.minusDays(2), today.minusDays(1));
    }

    @Test
    void testFuelDays_shouldServeNothing_whenPeriodIsSoftDeleted() {
        UUID user = user();
        periods.softDelete(periods.open(user, Reason.TRAVEL, today.minusDays(1), Estimate.WEEK));

        assertThat(service.fuelDays(user, today.minusDays(5), today)).isEmpty();
    }

    @Test
    void testFuelDays_shouldLetTheLaterStartedPeriodWin_whenTwoPeriodsTouchADate() {
        UUID user = user();
        periods.ended(user, Reason.INJURY, today.minusDays(5), today.minusDays(1));
        RecoveryPeriodEntity later = periods.ended(user, Reason.TRAVEL, today.minusDays(3), today.plusDays(1));

        Map<LocalDate, RecoveryPeriodEntity> days = service.fuelDays(user, today.minusDays(5), today);

        assertThat(days.get(today.minusDays(4)).getCategory()).isEqualTo(Reason.INJURY);
        assertThat(days.get(today.minusDays(2)).getId()).isEqualTo(later.getId());
    }
}
