package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.service.QuestEvaluator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Derived-metric truth table: satisfied() flips exactly when the day's logged data crosses the target. */
class QuestEvaluatorIT extends AbstractIntegrationTest {

    @Autowired private QuestEvaluator evaluator;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;

    private static final LocalDate DATE = LocalDate.of(2026, 7, 11);

    @Test
    void testSatisfied_shouldFlipOnFourthCheckin_whenCheckinFullQuest() {
        UUID owner = userPopulator.createUser("eval-a@test.hu").getId();
        DailyQuestEntity quest = questPopulator.quest(owner, DATE, DailyQuestEntity.SLOT_FUELBIO,
            "bio_checkin_full", "recovery", "LIFE", "checkin_full", new BigDecimal("4"), 20,
            DailyQuestEntity.STATUS_OFFERED);

        checkInPopulator.createCheckIn(owner, DATE, "06:30", 4, 3, null);
        checkInPopulator.createCheckIn(owner, DATE, "10:00", 4, 3, null);
        checkInPopulator.createCheckIn(owner, DATE, "14:00", 4, 3, null);
        assertThat(evaluator.satisfied(quest)).isFalse();

        checkInPopulator.createCheckIn(owner, DATE, "20:00", 4, 3, null);
        assertThat(evaluator.satisfied(quest)).isTrue();
    }

    @Test
    void testSatisfied_shouldRequireSameDayRow_whenWeightLoggedQuest() {
        UUID owner = userPopulator.createUser("eval-b@test.hu").getId();
        DailyQuestEntity quest = questPopulator.quest(owner, DATE, DailyQuestEntity.SLOT_FUELBIO,
            "bio_weight_log", "recovery", "LIFE", "weight_logged", null, 15,
            DailyQuestEntity.STATUS_OFFERED);

        weightLogPopulator.createWeightLog(owner, DATE.minusDays(1), new BigDecimal("83.4"));
        assertThat(evaluator.satisfied(quest)).isFalse();

        weightLogPopulator.createWeightLog(owner, DATE, new BigDecimal("83.2"));
        assertThat(evaluator.satisfied(quest)).isTrue();
    }

    @Test
    void testSatisfied_shouldReturnFalse_whenMetricUnknown() {
        UUID owner = userPopulator.createUser("eval-c@test.hu").getId();
        DailyQuestEntity quest = questPopulator.quest(owner, DATE, DailyQuestEntity.SLOT_FUELBIO,
            "bio_future", "recovery", "LIFE", "not_a_metric", null, 15,
            DailyQuestEntity.STATUS_OFFERED);
        assertThat(evaluator.satisfied(quest)).isFalse();
    }
}
