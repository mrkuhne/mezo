package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.QuestResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/quest/history — inclusive range, rerolled excluded, newest date first, owner-scoped. */
class QuestHistoryApiIT extends ApiIntegrationTest {

    @Autowired private QuestPopulator questPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetQuestHistory_shouldListRangeNewestFirstWithoutRerolled_whenMixedRows() {
        UUID owner = ownerId();
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(29);
        questPopulator.quest(owner, to.minusDays(1), DailyQuestEntity.SLOT_FUELBIO, "bio_water",
            "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, to.minusDays(2), DailyQuestEntity.SLOT_BODY, "body_rest_sleep",
            "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"), 20, DailyQuestEntity.STATUS_EXPIRED);
        questPopulator.quest(owner, to.minusDays(2), DailyQuestEntity.SLOT_GROWTH, "growth_read",
            "learning", "LIFE", "activity_match", null, 20, DailyQuestEntity.STATUS_REROLLED);
        questPopulator.quest(owner, to.minusDays(30), DailyQuestEntity.SLOT_FUELBIO, "bio_sleep",
            "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"), 25, DailyQuestEntity.STATUS_COMPLETED);

        QuestResponse[] list = getForBody("/api/quest/history?from=" + from + "&to=" + to,
            ownerAuthHeaders(), HttpStatus.OK, QuestResponse[].class);

        assertThat(list).hasSize(2); // rerolled + out-of-range excluded
        assertThat(list[0].getQuestDate()).isEqualTo(to.minusDays(1)); // newest first
        assertThat(list).extracting(QuestResponse::getStatus).doesNotContain("rerolled");
    }

    @Test
    void testGetQuestHistory_shouldReject_whenFromAfterTo() {
        LocalDate d = LocalDate.now();
        String body = getForBody("/api/quest/history?from=" + d + "&to=" + d.minusDays(1),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "QUEST_INVALID_DATE_RANGE");
    }
}
