package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.feature.proactive.service.HeartbeatJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class HeartbeatJobIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired
    private HeartbeatJob job;

    @Autowired
    private HeartbeatNoteRepository repository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private DailySummaryPopulator dailySummaryPopulator;

    @Test
    void testRunMidday_shouldGenerateNudge_whenUserHasMemory() {
        UUID user = userPopulator.createUser("hbj-mid@test.local").getId();
        dailySummaryPopulator.summary(user, TODAY.minusDays(1));
        job.runMidday();
        assertThat(repository.findByCreatedByAndNoteDateAndWindowKey(
                user, TODAY, HeartbeatNoteEntity.WINDOW_MIDDAY))
                .hasValueSatisfying(n ->
                        assertThat(n.getKind()).isEqualTo(HeartbeatNoteEntity.KIND_NUDGE));
    }

    @Test
    void testRunEvening_shouldBeIdempotent_whenNoteAlreadyExists() {
        UUID user = userPopulator.createUser("hbj-idem@test.local").getId();
        dailySummaryPopulator.summary(user, TODAY.minusDays(1));
        job.runEvening();
        UUID firstId = repository.findByCreatedByAndNoteDateAndWindowKey(
                user, TODAY, HeartbeatNoteEntity.WINDOW_EVENING).orElseThrow().getId();
        job.runEvening();
        assertThat(repository.findByCreatedByAndNoteDateAndWindowKey(
                user, TODAY, HeartbeatNoteEntity.WINDOW_EVENING).orElseThrow().getId())
                .isEqualTo(firstId);
    }
}
