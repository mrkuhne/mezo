package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Activity-mode quests: never auto-completed by evaluation; completed by a matching activity. */
class QuestActivityCompletionIT extends AbstractIntegrationTest {

    @Autowired private QuestService questService;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private DailyQuestRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testCompleteMatchingActivityQuest_shouldCompleteAndStampSource_whenSkillMatches() {
        UUID owner = userPopulator.createUser("aq-a@test.hu").getId();
        LocalDate today = LocalDate.now();
        DailyQuestEntity quest = questPopulator.activityQuest(owner, today, "learning", 20,
            DailyQuestEntity.STATUS_OFFERED);
        UUID activityId = UUID.randomUUID();

        var completion = questService.completeMatchingActivityQuest(owner, today, "learning", activityId);

        assertThat(completion).isPresent();
        assertThat(completion.get().levelUp()).isNotNull();
        DailyQuestEntity reloaded = repository.findByIdAndCreatedBy(quest.getId(), owner).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(DailyQuestEntity.STATUS_COMPLETED);
        assertThat(reloaded.getSourceActivityId()).isEqualTo(activityId);
    }

    @Test
    void testCompleteMatchingActivityQuest_shouldReturnEmpty_whenSkillDiffers() {
        UUID owner = userPopulator.createUser("aq-b@test.hu").getId();
        LocalDate today = LocalDate.now();
        questPopulator.activityQuest(owner, today, "learning", 20, DailyQuestEntity.STATUS_OFFERED);

        assertThat(questService.completeMatchingActivityQuest(owner, today, "cooking", UUID.randomUUID()))
            .isEmpty();
    }

    @Test
    void testEvaluateAndFinalize_shouldSkipActivityModeQuest_whenOfferedToday() {
        UUID owner = userPopulator.createUser("aq-c@test.hu").getId();
        LocalDate today = LocalDate.now();
        DailyQuestEntity quest = questPopulator.activityQuest(owner, today, "mindset", 15,
            DailyQuestEntity.STATUS_OFFERED);

        questService.evaluateAndFinalize(java.util.List.of(quest), today);

        assertThat(repository.findByIdAndCreatedBy(quest.getId(), owner).orElseThrow().getStatus())
            .isEqualTo(DailyQuestEntity.STATUS_OFFERED); // ACTIVITY mode never auto-completes
    }

    @Test
    void testEvaluateAndFinalize_shouldExpireActivityModeQuest_whenDayPassed() {
        UUID owner = userPopulator.createUser("aq-d@test.hu").getId();
        DailyQuestEntity quest = questPopulator.activityQuest(owner, LocalDate.now().minusDays(1),
            "mindset", 15, DailyQuestEntity.STATUS_OFFERED);

        questService.evaluateAndFinalize(java.util.List.of(quest), LocalDate.now());

        assertThat(repository.findByIdAndCreatedBy(quest.getId(), owner).orElseThrow().getStatus())
            .isEqualTo(DailyQuestEntity.STATUS_EXPIRED);
    }
}
