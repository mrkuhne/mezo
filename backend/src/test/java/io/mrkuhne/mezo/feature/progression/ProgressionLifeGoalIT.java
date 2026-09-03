package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.lifegoal.LifeGoalSignal;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Life-goal pillar-hit XP rides the shared idempotent award tail (source LIFE_GOAL, mezo-iizd.6):
 * one award per (pillar, day) key, the business date is the evaluated day, never the run date.
 */
class ProgressionLifeGoalIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private LevelUpEventRepository levelUpEventRepository;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testApplyLifeGoal_shouldAwardOnce_whenTheSameKeyIsAppliedTwice() {
        UUID owner = userPopulator.createUser("lifegoal-xp@test.hu").getId();
        LocalDate day = LocalDate.now().minusDays(1);
        UUID refId = UUID.randomUUID();
        LifeGoalSignal signal =
            new LifeGoalSignal(refId, "recovery", "LIFE", 5, "Életcél · Alvás", day);

        LevelUpResult first = progressionService.applyLifeGoal(owner, signal);
        assertThat(first.source()).isEqualTo("LIFE_GOAL");
        assertThat(first.totalXp()).isEqualTo(5);

        progressionService.applyLifeGoal(owner, signal);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")
            .orElseThrow().getCumulativeXp()).isEqualTo(5);
        assertThat(levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(owner, "LIFE_GOAL", refId)).isPresent();
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, day)).hasSize(1);
    }

    @Test
    void testApplyLifeGoal_shouldAwardOnTheAthleticSkill_whenThePillarPointsAtOne() {
        UUID owner = userPopulator.createUser("lifegoal-xp-athletic@test.hu").getId();
        progressionService.applyLifeGoal(owner, new LifeGoalSignal(UUID.randomUUID(),
            "mobility", "ATHLETIC", 5, "Életcél · Mobilitás", LocalDate.now().minusDays(1)));

        var row = skillProgressRepository.findByCreatedByAndSkillKey(owner, "mobility").orElseThrow();
        assertThat(row.getCumulativeXp()).isEqualTo(5);
        assertThat(row.getSkillKind()).isEqualTo("ATHLETIC");
    }
}
