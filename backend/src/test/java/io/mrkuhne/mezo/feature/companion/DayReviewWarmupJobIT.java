package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.companion.service.DayReviewWarmupJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * A napom S1's wiring: the job runs the finished-day catch-up window without throwing, for every
 * active user. {@link io.mrkuhne.mezo.feature.companion.service.DayReviewWarmupJobTest} pins the
 * date loop itself; this IT only pins that the beans are wired and the run completes.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.techcore.cron.day-review-warmup-job.enabled=true")
class DayReviewWarmupJobIT extends AbstractIntegrationTest {

    @Autowired private DayReviewWarmupJob job;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    @Test
    void testRun_shouldCompleteWithoutThrowing_whenUsersHaveFinishedDays() {
        UUID user = userPopulator.createUser().getId();
        // one real signal so the day is not empty; mirrors DayEvaluationApiIT's seeding helpers
        sleepLogPopulator.createSleepLog(user, LocalDate.now().minusDays(1), new BigDecimal("7.5"), 7);

        assertThatCode(job::run).doesNotThrowAnyException();
    }
}
