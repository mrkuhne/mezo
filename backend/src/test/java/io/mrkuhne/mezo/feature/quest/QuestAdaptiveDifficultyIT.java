package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.service.QuestSelector;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Adaptive difficulty banding (E3, spec §4 ~80% success target): per-slot 28d completion ratio
 * gates the allowed difficulty tiers; difficulty yields to availability; no history = all tiers.
 */
class QuestAdaptiveDifficultyIT extends AbstractIntegrationTest {

    @Autowired private QuestSelector selector;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private UserPopulator userPopulator;

    private static final LocalDate DATE = LocalDate.of(2026, 7, 15);

    /** 6 expired + 0 completed FUELBIO quests → ratio 0 ≤ lowRatio → only difficulty-1 picks. */
    @Test
    void testGenerate_shouldPickOnlyEasyFuelBio_whenSlotRatioLow() {
        UUID owner = userPopulator.createUser("adapt-low@test.hu").getId();
        for (int i = 1; i <= 6; i++) {
            questPopulator.quest(owner, DATE.minusDays(i), DailyQuestEntity.SLOT_FUELBIO,
                "bio_checkin_full", "recovery", "LIFE", "checkin_full", new BigDecimal("4"),
                20, DailyQuestEntity.STATUS_EXPIRED);
        }

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        // difficulty-1 FUELBIO keys are bio_weight_log and bio_water
        assertThat(quests).filteredOn(q -> q.getSlot().equals(DailyQuestEntity.SLOT_FUELBIO))
            .first().extracting(DailyQuestEntity::getCatalogKey)
            .isIn("bio_weight_log", "bio_water");
    }

    /** Low BODY ratio on a GYM-less (REST) day: body_rest_sleep is difficulty 2 — the only
     *  candidate — so difficulty must yield to availability and still fill the slot. */
    @Test
    void testGenerate_shouldStillFillBodySlot_whenLowRatioFiltersWholePool() {
        UUID owner = userPopulator.createUser("adapt-yield@test.hu").getId();
        for (int i = 1; i <= 6; i++) {
            questPopulator.quest(owner, DATE.minusDays(i), DailyQuestEntity.SLOT_BODY,
                "body_rest_sleep", "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"),
                20, DailyQuestEntity.STATUS_EXPIRED);
        }

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        assertThat(quests).filteredOn(q -> q.getSlot().equals(DailyQuestEntity.SLOT_BODY))
            .first().extracting(DailyQuestEntity::getCatalogKey).isEqualTo("body_rest_sleep");
    }

    /** No history (< minSample closed) → all tiers allowed — E2 behavior byte-identical. */
    @Test
    void testGenerate_shouldAllowAllTiers_whenNoHistory() {
        UUID owner = userPopulator.createUser("adapt-none@test.hu").getId();

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        assertThat(quests).hasSize(3); // all three slots fill exactly as before
    }
}
