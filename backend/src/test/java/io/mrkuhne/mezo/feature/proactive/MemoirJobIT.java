package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.service.MemoirJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** W2 Sunday cron: generates the memoir for the week ending this Sunday per user; idempotent. */
@ActiveProfiles("companion-fake")
class MemoirJobIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START =
            LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Autowired private MemoirJob job;
    @Autowired private MemoirRepository repository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRun_shouldGenerateMemoirForWeekEndingNow_whenMemoryExists() {
        UUID user = userPopulator.createUser("mjob-gen@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START, "Heti nap.");

        job.run();

        assertThat(repository.findByCreatedByAndWeekStart(user, WEEK_START)).isPresent();
    }

    @Test
    void testRun_shouldBeIdempotent_whenMemoirExists() {
        UUID user = userPopulator.createUser("mjob-idem@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START, "Heti nap.");

        job.run();
        var first = repository.findByCreatedByAndWeekStart(user, WEEK_START).orElseThrow();
        job.run();

        assertThat(repository.findByCreatedByAndWeekStart(user, WEEK_START))
                .hasValueSatisfying(m -> assertThat(m.getId()).isEqualTo(first.getId()));
    }
}
