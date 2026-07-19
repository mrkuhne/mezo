package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.habit.service.HabitJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Nightly close cron (bd mezo-d1jb): the job iterates every user and delegates to
 * {@link io.mrkuhne.mezo.feature.habit.service.HabitService#closePast} — the closure honesty pass
 * (end-of-day metrics evaluate, the rest quietly miss) is exercised in depth by HabitServiceIT; here
 * we assert the cron entry point wires the per-user loop end-to-end against a real user + rows.
 */
class HabitJobIT extends AbstractIntegrationTest {

    @Autowired private HabitJob job;
    @Autowired private HabitDayRepository repository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private HabitPopulator habitPopulator;

    @Test
    void testRunClose_shouldCloseYesterdaysPendingRows_whenJobRuns() {
        UUID owner = userPopulator.createUser("habit-job@test.hu").getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_PENDING);
        habitPopulator.row(owner, yesterday, "caffeine_cutoff", HabitDayEntity.STATUS_PENDING);

        job.runClose();

        var rows = repository.findByCreatedByAndHabitDate(owner, yesterday);
        assertThat(rows).extracting(HabitDayEntity::getStatus)
            .containsExactlyInAnyOrder("missed", "done"); // sunlight missed, cutoff honestly done
    }
}
