package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestJob;
import io.mrkuhne.mezo.feature.quest.service.QuestSelector;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** Cron backstops: morning generation for users who never open Today; nightly quiet finalize. */
@ActiveProfiles("companion-fake")
class QuestJobIT extends AbstractIntegrationTest {

    @Autowired private QuestJob job;
    @Autowired private QuestSelector selector;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailyQuestRepository repository;

    @Test
    void testRunGenerate_shouldCreateTodayRows_whenUserHasNone() {
        UUID owner = userPopulator.createUser("job-a@test.hu").getId();
        // Presence guard (S6, mezo-qw37.6): the cron only backstops users with a recent quest —
        // seed one dated yesterday so this user is inside the presence window.
        selector.generate(owner, LocalDate.now().minusDays(1));
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

    @Test
    void testRunGenerate_shouldSkipUsersWithoutRecentQuests_andServeRecentOnes() {
        LocalDate today = LocalDate.now();
        AppUserEntity dormant = userPopulator.createUser("quest-dormant@test.local");
        AppUserEntity recent = userPopulator.createUser("quest-recent@test.local");
        // QuestService#getDay only lazily generates for date == LocalDate.now() (confirmed by
        // reading the service — the brief's `dayQuests(userId, pastDate)` snippet does not match
        // that behavior), so presence within the window is proven the way it actually happens in
        // production: a quest row already exists for an earlier day (e.g. from that day's own
        // lazy generation or the morning cron).
        selector.generate(recent.getId(), today.minusDays(1));
        AppUserEntity disabled = userPopulator.createUser("quest-disabled@test.local");
        disabled.setStatus(AppUserEntity.UserStatus.DISABLED);
        userPopulator.save(disabled);

        job.runGenerate();

        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(recent.getId(), today)).isNotEmpty();
        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(dormant.getId(), today)).isEmpty();
        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(disabled.getId(), today)).isEmpty();
    }
}
