package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.quest.QuestSignal;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Quest XP rides the idempotent award tail with source QUEST and may create LIFE skill rows. */
class ProgressionQuestIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testApplyQuest_shouldCreateLifeSkillRowAndBeIdempotent_whenAppliedTwice() {
        UUID owner = userPopulator.createUser("quest-xp@test.hu").getId();
        UUID questId = UUID.randomUUID();
        QuestSignal signal = new QuestSignal(questId, "recovery", "LIFE", 20, "Teszt küldetés");

        LevelUpResult first = progressionService.applyQuest(owner, signal);
        LevelUpResult second = progressionService.applyQuest(owner, signal);

        assertThat(first.source()).isEqualTo("QUEST");
        assertThat(first.gains()).hasSize(1);
        assertThat(first.gains().getFirst().skillKey()).isEqualTo("recovery");
        assertThat(first.gains().getFirst().kind()).isEqualTo("LIFE");
        assertThat(second.totalXp()).isEqualTo(first.totalXp()); // stored payload returned, no double award

        var row = skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery").orElseThrow();
        assertThat(row.getCumulativeXp()).isEqualTo(20);
        assertThat(row.getSkillKind()).isEqualTo("LIFE");
    }
}
