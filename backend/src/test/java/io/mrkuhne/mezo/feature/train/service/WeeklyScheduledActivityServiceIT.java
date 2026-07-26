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

    private static final BigDecimal W = new BigDecimal("80.0");

    @Test
    void testScheduledWeeklyEat_shouldBeZero_whenNoSchedule() {
        UUID user = databasePopulator.populateUser("wsa-empty@test.local");
        assertThat(service.scheduledWeeklyEatKcalPerDay(user, W).doubleValue()).isZero();
    }

    @Test
    void testScheduledWeeklyEat_shouldSumGymAndSport_whenScheduled() {
        UUID user = databasePopulator.populateUser("wsa-full@test.local");
        trainPopulator.createGymSlot(user, 0, "18:00"); // Mon
        trainPopulator.createGymSlot(user, 2, "18:00"); // Wed
        trainPopulator.createGymSlot(user, 4, "18:00"); // Fri  → 3 gym × 60min
        trainPopulator.createScheduleSlot(user, 1, "18:00", 120, "training"); // Tue volleyball
        trainPopulator.createScheduleSlot(user, 3, "18:00", 120, "training"); // Thu volleyball → 2 × 120min
        // gym:  6.0 × 80 × (60/60) × 3 = 1440 ; sport: 4.5 × 80 × (120/60) × 2 = 1440 ; total 2880 ÷ 7
        double expected = (6.0 * 80 * 1.0 * 3 + 4.5 * 80 * 2.0 * 2) / 7.0;
        assertThat(service.scheduledWeeklyEatKcalPerDay(user, W).doubleValue()).isCloseTo(expected, within(0.5));
    }

    @Test
    void testRunWeeklyEat_shouldScaleWithSessions() {
        // 9.5 × 80 × (45/60) × 3 ÷ 7
        double expected = props.met().run() * 80 * (props.runDefaultMinutes() / 60.0) * 3 / 7.0;
        assertThat(service.runWeeklyEatKcalPerDay(3, W).doubleValue()).isCloseTo(expected, within(0.5));
        assertThat(service.runWeeklyEatKcalPerDay(0, W).doubleValue()).isZero();
    }
}
