package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** daily_quest DDL + jsonb envelope + partial-unique reroll identity (mezo-df7q). */
class DailyQuestEntityIT extends AbstractIntegrationTest {

    @Autowired private QuestPopulator questPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailyQuestRepository repository;

    @Test
    void testSave_shouldRoundTripJsonbTarget_whenPersisted() {
        UUID owner = userPopulator.createUser("quest-a@test.hu").getId();
        DailyQuestEntity saved = questPopulator.quest(owner, LocalDate.of(2026, 7, 11),
            DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery", "LIFE",
            "water_target", new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_OFFERED);

        DailyQuestEntity found = repository.findByIdAndCreatedBy(saved.getId(), owner).orElseThrow();
        assertThat(found.getTarget().metric()).isEqualTo("water_target");
        assertThat(found.getTarget().threshold()).isEqualByComparingTo("2500");
        assertThat(found.getCoins()).isZero();
    }

    @Test
    void testSave_shouldAllowSecondRowInSlot_whenFirstIsRerolled() {
        UUID owner = userPopulator.createUser("quest-b@test.hu").getId();
        LocalDate d = LocalDate.of(2026, 7, 11);
        questPopulator.quest(owner, d, DailyQuestEntity.SLOT_BODY, "body_gym_done",
            "strength_endurance", "ATHLETIC", "gym_session_done", null, 25,
            DailyQuestEntity.STATUS_REROLLED);
        questPopulator.quest(owner, d, DailyQuestEntity.SLOT_BODY, "body_rest_sleep",
            "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"), 20,
            DailyQuestEntity.STATUS_OFFERED);

        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(owner, d)).hasSize(2);
    }
}
