package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.QuestDayResponse;
import io.mrkuhne.mezo.api.dto.QuestResponse;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** HTTP flow: lazy generation, derived completion → XP + levelUps, quiet expiry, reroll guards. */
class QuestApiIT extends ApiIntegrationTest {

    @Autowired private QuestPopulator questPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetQuestDay_shouldLazilyGenerateTwoSlots_whenTodayAndNoRows() {
        QuestDayResponse day = getForBody("/api/quest/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);

        assertThat(day.getQuests()).hasSize(2);
        assertThat(day.getQuests()).extracting(QuestResponse::getSlot)
            .containsExactlyInAnyOrder("BODY", "FUELBIO");
        assertThat(day.getRerollsLeft()).isEqualTo(1);
        assertThat(day.getLevelUps()).isEmpty();
    }

    @Test
    void testGetQuestDay_shouldCompleteAndAwardOnce_whenDerivedTargetMet() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        questPopulator.quest(owner, today, DailyQuestEntity.SLOT_FUELBIO, "bio_checkin_full",
            "recovery", "LIFE", "checkin_full", new BigDecimal("1"), 20,
            DailyQuestEntity.STATUS_OFFERED);
        checkInPopulator.createCheckIn(owner, today, "06:30", 4, 3, null);

        QuestDayResponse first = getForBody("/api/quest/day/" + today,
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(first.getQuests()).anySatisfy(q -> {
            assertThat(q.getStatus()).isEqualTo("completed");
            assertThat(q.getCompletedAt()).isNotNull();
        });
        assertThat(first.getLevelUps()).hasSize(1);
        assertThat(first.getLevelUps().getFirst().getSource().getValue()).isEqualTo("QUEST");

        // idempotent: the second read reports the completed quest but produces no new levelUps
        QuestDayResponse second = getForBody("/api/quest/day/" + today,
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(second.getLevelUps()).isEmpty();
    }

    @Test
    void testGetQuestDay_shouldReturnEmpty_whenPastDayWithoutRows() {
        QuestDayResponse day = getForBody("/api/quest/day/" + LocalDate.now().minusDays(3),
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(day.getQuests()).isEmpty(); // honest empty — no retro-generation
    }

    @Test
    void testGetQuestDay_shouldExpireOfferedQuest_whenDayHasPassed() {
        UUID owner = ownerId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        questPopulator.quest(owner, yesterday, DailyQuestEntity.SLOT_FUELBIO, "bio_weight_log",
            "recovery", "LIFE", "weight_logged", null, 15, DailyQuestEntity.STATUS_OFFERED);

        QuestDayResponse day = getForBody("/api/quest/day/" + yesterday,
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(day.getQuests()).singleElement()
            .extracting(QuestResponse::getStatus).isEqualTo("expired");
    }

    @Test
    void testReroll_shouldReplaceQuestInSlot_whenOfferedToday() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        DailyQuestEntity offered = questPopulator.quest(owner, today, DailyQuestEntity.SLOT_FUELBIO,
            "bio_weight_log", "recovery", "LIFE", "weight_logged", null, 15,
            DailyQuestEntity.STATUS_OFFERED);

        QuestResponse replacement = postForBody("/api/quest/" + offered.getId() + "/reroll",
            null, ownerAuthHeaders(), HttpStatus.OK, QuestResponse.class);

        assertThat(replacement.getSlot()).isEqualTo("FUELBIO");
        assertThat(replacement.getStatus()).isEqualTo("offered");
        assertThat(replacement.getId()).isNotEqualTo(offered.getId());

        // the old row is rerolled → excluded from the day read; cap of 1 → rerollsLeft 0
        QuestDayResponse day = getForBody("/api/quest/day/" + today,
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(day.getQuests()).extracting(QuestResponse::getId).doesNotContain(offered.getId());
        assertThat(day.getRerollsLeft()).isZero();
    }

    @Test
    void testReroll_shouldConflict_whenDailyCapReached() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // an already-rerolled row consumes the daily cap of 1
        questPopulator.quest(owner, today, DailyQuestEntity.SLOT_BODY, "body_gym_done",
            "strength_endurance", "ATHLETIC", "gym_session_done", null, 25,
            DailyQuestEntity.STATUS_REROLLED);
        DailyQuestEntity offered = questPopulator.quest(owner, today, DailyQuestEntity.SLOT_FUELBIO,
            "bio_weight_log", "recovery", "LIFE", "weight_logged", null, 15,
            DailyQuestEntity.STATUS_OFFERED);

        String body = postForBody("/api/quest/" + offered.getId() + "/reroll",
            null, ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "QUEST_REROLL_EXHAUSTED");
    }

    @Test
    void testReroll_shouldConflict_whenQuestNotOffered() {
        UUID owner = ownerId();
        DailyQuestEntity done = questPopulator.quest(owner, LocalDate.now(),
            DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery", "LIFE", "water_target",
            new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);

        String body = postForBody("/api/quest/" + done.getId() + "/reroll",
            null, ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "QUEST_NOT_OFFERED");
    }
}
