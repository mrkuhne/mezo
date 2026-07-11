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

    /**
     * Pins the difficulty band itself (the finding: the other tests stay green with the band filter
     * deleted). Low FUELBIO ratio → band {1}. Both difficulty-1 keys (bio_weight_log@DATE-1,
     * bio_water@DATE-2) sit inside their 2-day cooldown windows; the four DATE-3..DATE-6 rows only
     * pad the ratio. bio_sleep (difficulty 2) is metric-excluded by the REST-day BODY sleep_target
     * pick, bio_protein needs a goal prescription — so bio_checkin_full (difficulty 2, OFF-cooldown)
     * is the ONLY key that survives once the band is removed. WITH the band: banded = {1}, both keys
     * cooled → cooldown yields to availability → the slot re-admits the two difficulty-1 keys and
     * picks one of them. WITHOUT the band: banded = all tiers, cooldown strips the two difficulty-1
     * keys, leaving bio_checkin_full alone → the pick becomes difficulty 2. The pick therefore lands
     * on difficulty 2 iff the band filter is gone, so this test fails deterministically if it is
     * deleted (regardless of the random-UUID hash, since the surviving pool is a singleton).
     */
    @Test
    void testGenerate_shouldExcludeHigherTiers_whenLowRatioAndNoOtherExclusions() {
        UUID owner = userPopulator.createUser("adapt-band@test.hu").getId();
        questPopulator.quest(owner, DATE.minusDays(1), DailyQuestEntity.SLOT_FUELBIO, "bio_weight_log",
            "recovery", "LIFE", "weight_logged", null, 15, DailyQuestEntity.STATUS_EXPIRED);
        questPopulator.quest(owner, DATE.minusDays(2), DailyQuestEntity.SLOT_FUELBIO, "bio_water",
            "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_EXPIRED);
        for (int i = 3; i <= 6; i++) {
            questPopulator.quest(owner, DATE.minusDays(i), DailyQuestEntity.SLOT_FUELBIO, "bio_weight_log",
                "recovery", "LIFE", "weight_logged", null, 15, DailyQuestEntity.STATUS_EXPIRED);
        }

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        // difficulty-1 FUELBIO keys are bio_weight_log and bio_water; a difficulty-2 pick
        // (bio_checkin_full / bio_sleep) would prove the band filter is not doing its job.
        assertThat(quests).filteredOn(q -> q.getSlot().equals(DailyQuestEntity.SLOT_FUELBIO))
            .first().extracting(DailyQuestEntity::getCatalogKey)
            .isIn("bio_weight_log", "bio_water");
    }

    /** No history (< minSample closed) → all tiers allowed — E2 behavior byte-identical. */
    @Test
    void testGenerate_shouldAllowAllTiers_whenNoHistory() {
        UUID owner = userPopulator.createUser("adapt-none@test.hu").getId();

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        assertThat(quests).hasSize(3); // all three slots fill exactly as before
    }
}
