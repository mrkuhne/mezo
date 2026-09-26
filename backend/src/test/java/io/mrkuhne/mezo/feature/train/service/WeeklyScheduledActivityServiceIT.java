package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class WeeklyScheduledActivityServiceIT extends AbstractIntegrationTest {

    @Autowired private WeeklyScheduledActivityService service;
    @Autowired private TrainProperties props;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator trainPopulator;

    /** Rest energy (kcal/hour) fixture for the net model — mezo-32m82 Task 3. */
    private static final BigDecimal REST = new BigDecimal("80");

    @Test
    void testScheduledWeeklyEat_shouldBeZero_whenNoSchedule() {
        UUID user = databasePopulator.populateUser("wsa-empty@test.local");
        assertThat(service.scheduledWeeklyEatKcalPerDay(user, REST).doubleValue()).isZero();
    }

    @Test
    void testScheduledWeeklyEat_shouldSumGymAndSport_whenScheduled() {
        UUID user = databasePopulator.populateUser("wsa-full@test.local");
        trainPopulator.createGymSlot(user, 0, "18:00"); // Mon
        trainPopulator.createGymSlot(user, 2, "18:00"); // Wed
        trainPopulator.createGymSlot(user, 4, "18:00"); // Fri  → 3 gym × 60min
        trainPopulator.createScheduleSlot(user, 1, "18:00", 120, "training"); // Tue volleyball
        trainPopulator.createScheduleSlot(user, 3, "18:00", 120, "training"); // Thu volleyball → 2 × 120min
        // Net model, moderate band, rest=80: gym MET 3.5, volleyball MET 4.0 (global-constraints MET table).
        double gymExpected = (3.5 - 1) * 80 * (60 / 60.0) * 3;
        double volleyballExpected = (4.0 - 1) * 80 * 2 * 2;
        double expected = (gymExpected + volleyballExpected) / 7.0;
        assertThat(service.scheduledWeeklyEatKcalPerDay(user, REST).doubleValue()).isCloseTo(expected, within(0.5));
    }

    @Test
    void testRunWeeklyEat_shouldScaleWithSessions() {
        // Net model, moderate band, rest=80: run MET 9.3 (global-constraints MET table).
        double expected = (9.3 - 1) * 80 * (props.runDefaultMinutes() / 60.0) * 3 / 7.0;
        assertThat(service.runWeeklyEatKcalPerDay(3, REST).doubleValue()).isCloseTo(expected, within(0.5));
        assertThat(service.runWeeklyEatKcalPerDay(0, REST).doubleValue()).isZero();
    }
}
