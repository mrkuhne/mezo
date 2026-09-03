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
import java.time.Instant;
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

    /** Renamed (fix round 1): this seeds a fresh last_seen_at, not a quest row — say what it tests. */
    @Test
    void testRunGenerate_shouldServeUser_whenSeenWithinWindow() {
        AppUserEntity owner = userPopulator.createUser("job-a@test.hu");
        markSeen(owner, Instant.now());

        job.runGenerate();

        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(owner.getId(), LocalDate.now()))
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
    void testRunGenerate_shouldSkipDormantAndDisabledUsers_butServeRecentlySeenOnes() {
        LocalDate today = LocalDate.now();
        AppUserEntity dormant = userPopulator.createUser("quest-dormant@test.local"); // last_seen_at stays null
        AppUserEntity recent = userPopulator.createUser("quest-recent@test.local");
        markSeen(recent, Instant.now());
        AppUserEntity disabled = userPopulator.createUser("quest-disabled@test.local");
        markSeen(disabled, Instant.now());
        disabled.setStatus(AppUserEntity.UserStatus.DISABLED);
        userPopulator.save(disabled);

        job.runGenerate();

        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(recent.getId(), today)).isNotEmpty();
        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(dormant.getId(), today)).isEmpty();
        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(disabled.getId(), today)).isEmpty();
    }

    /**
     * The latch-proof case (S6 fix round 1, Finding 3): a user with EXISTING cron-generated quest
     * rows inside the old exists()-based window, but a stale (here: null) {@code last_seen_at},
     * must still be skipped. Under the old (reverted) quest-existence guard this user would have
     * been served forever once the cron itself created a single row — that self-feeding latch is
     * exactly what moving to {@code last_seen_at} closes.
     */
    @Test
    void testRunGenerate_shouldSkipUser_whenLastSeenIsStale_evenWithPriorCronGeneratedQuests() {
        LocalDate today = LocalDate.now();
        AppUserEntity ghost = userPopulator.createUser("quest-ghost@test.local"); // last_seen_at stays null
        // Simulate rows the cron itself generated on an earlier day — old guard would read this
        // as "presence" and keep serving; the last_seen_at guard must not.
        selector.generate(ghost.getId(), today.minusDays(1));

        job.runGenerate();

        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(ghost.getId(), today)).isEmpty();
    }

    private void markSeen(AppUserEntity user, Instant at) {
        user.setLastSeenAt(at);
        userPopulator.save(user);
    }
}
