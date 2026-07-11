package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.GrowthDigestBlock;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** The NÖVEKEDÉS digest block: growth facts for the proactive weekly prose; "" when empty. */
@ActiveProfiles("companion-fake")
class GrowthDigestBlockIT extends AbstractIntegrationTest {

    @Autowired private GrowthDigestBlock growthDigestBlock;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRender_shouldListQuestActivityAndSavings_whenWeekHasData() {
        UUID owner = userPopulator.createUser("digest-a@test.hu").getId();
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
        questPopulator.quest(owner, monday, DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery",
            "LIFE", "water_target", new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, monday.plusDays(1), DailyQuestEntity.SLOT_BODY, "body_rest_sleep",
            "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"), 20, DailyQuestEntity.STATUS_EXPIRED);
        activityPopulator.financialActivity(owner, monday, "Spórolás", 50000L);

        String block = growthDigestBlock.render(owner, monday);

        assertThat(block).contains("NÖVEKEDÉS");
        assertThat(block).contains("1/2");
        assertThat(block).contains("50 000 Ft");
    }

    @Test
    void testRender_shouldReturnEmpty_whenWeekHasNoGrowthData() {
        UUID owner = userPopulator.createUser("digest-b@test.hu").getId();

        assertThat(growthDigestBlock.render(owner, LocalDate.now().with(DayOfWeek.MONDAY))).isEmpty();
    }
}
