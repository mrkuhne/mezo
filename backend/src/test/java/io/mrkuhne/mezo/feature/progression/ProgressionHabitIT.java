package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.habit.HabitSignal;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Habit XP rides the idempotent award tail (source HABIT); a same-day un-check reverts cleanly. */
class ProgressionHabitIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private LevelUpEventRepository levelUpEventRepository;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testApplyHabit_shouldAwardOnceAndRevertCleanly_whenCalledTwiceThenReverted() {
        UUID owner = userPopulator.createUser("habit-xp@test.hu").getId();
        UUID habitDayId = UUID.randomUUID();
        HabitSignal signal = new HabitSignal(habitDayId, "recovery", 10, "Reggeli napfény");

        LevelUpResult first = progressionService.applyHabit(owner, signal);
        assertThat(first.source()).isEqualTo("HABIT");
        assertThat(first.totalXp()).isEqualTo(10);

        // idempotent re-apply returns the stored payload, no double XP
        progressionService.applyHabit(owner, signal);
        var row = skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery").orElseThrow();
        assertThat(row.getCumulativeXp()).isEqualTo(10);

        // revert: event deleted + XP decremented -> a re-apply awards again
        progressionService.revertHabit(owner, habitDayId, "recovery", 10);
        assertThat(levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(owner, "HABIT", habitDayId)).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")
            .orElseThrow().getCumulativeXp()).isZero();

        LevelUpResult again = progressionService.applyHabit(owner, signal);
        assertThat(again.totalXp()).isEqualTo(10);
    }
}
