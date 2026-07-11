package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Cron backstops: morning generation for users who never open Today; nightly quiet finalize. */
class QuestJobIT extends AbstractIntegrationTest {

    @Autowired private QuestJob job;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailyQuestRepository repository;

    @Test
    void testRunGenerate_shouldCreateTodayRows_whenUserHasNone() {
        UUID owner = userPopulator.createUser("job-a@test.hu").getId();
        job.runGenerate();
        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(owner, LocalDate.now()))
            .isNotEmpty();
    }

    @Test
    void testRunFinalize_shouldExpireOfferedPastQuests_whenDayPassed() {
        UUID owner = userPopulator.createUser("job-b@test.hu").getId();
        DailyQuestEntity stale = questPopulator.quest(owner, LocalDate.now().minusDays(2),
            DailyQuestEntity.SLOT_FUELBIO, "bio_weight_log", "recovery", "LIFE",
            "weight_logged", null, 15, DailyQuestEntity.STATUS_OFFERED);

        job.runFinalize();

        assertThat(repository.findByIdAndCreatedBy(stale.getId(), owner).orElseThrow().getStatus())
            .isEqualTo(DailyQuestEntity.STATUS_EXPIRED);
    }
}
