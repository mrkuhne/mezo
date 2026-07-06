package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.feature.proactive.service.WeeklySuggestionJob;
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

/** W1 Monday cron: generates the CURRENT week's suggestion per user; idempotent; isolated. */
@ActiveProfiles("companion-fake")
class WeeklySuggestionJobIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START =
            LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Autowired private WeeklySuggestionJob job;
    @Autowired private WeeklySuggestionRepository repository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRun_shouldGenerateCurrentWeekSuggestion_whenPriorWeekHasMemory() {
        UUID user = userPopulator.createUser("wsjob-gen@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(3), "Előző heti nap.");

        job.run();

        assertThat(repository.findByCreatedByAndWeekStart(user, WEEK_START)).isPresent();
    }

    @Test
    void testRun_shouldBeIdempotent_whenSuggestionExists() {
        UUID user = userPopulator.createUser("wsjob-idem@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(3), "Előző heti nap.");

        job.run();
        var first = repository.findByCreatedByAndWeekStart(user, WEEK_START).orElseThrow();
        job.run();

        assertThat(repository.findByCreatedByAndWeekStart(user, WEEK_START))
                .hasValueSatisfying(s -> assertThat(s.getId()).isEqualTo(first.getId()));
    }
}
