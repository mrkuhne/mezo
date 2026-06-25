package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.run.RunSignal;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionRunIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testApplyRun_shouldGrantSprintSkills_whenSprintSession() {
        UUID user = databasePopulator.populateUser("sprint@test.local");
        UUID logId = UUID.randomUUID();
        // sprint: 6 rounds → sprint_speed 6*25=150, anaerobic 6*15=90; rpe 8 → explosiveness 8*6=48
        RunSignal signal = new RunSignal(logId, "sprint", 6, 32, 8, "200m", null);

        LevelUpResult result = progressionService.applyRun(user, signal);

        assertThat(result.source()).isEqualTo("RUN");
        assertThat(result.durationMin()).isEqualTo(32);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(150L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "anaerobic_capacity"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(90L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "explosiveness"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(48L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "aerobic_capacity")).isEmpty();
    }

    @Test
    void testApplyRun_shouldGrantSteadySkills_whenSteadySession() {
        UUID user = databasePopulator.populateUser("steady2@test.local");
        UUID logId = UUID.randomUUID();
        // steady: 45 min → strength_endurance 45*4=180, aerobic 45*5=225 + HR bonus 30 = 255
        RunSignal signal = new RunSignal(logId, "steady", null, 45, 6, null, 80);

        LevelUpResult result = progressionService.applyRun(user, signal);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "strength_endurance"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(180L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "aerobic_capacity"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(255L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed")).isEmpty();
    }

    @Test
    void testApplyRun_shouldBeIdempotent_whenSameLogAppliedTwice() {
        UUID user = databasePopulator.populateUser("runidem@test.local");
        UUID logId = UUID.randomUUID();
        RunSignal signal = new RunSignal(logId, "sprint", 4, 20, 7, null, null);

        LevelUpResult first = progressionService.applyRun(user, signal);
        LevelUpResult second = progressionService.applyRun(user, signal);

        assertThat(second.totalXp()).isEqualTo(first.totalXp());
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(100L)); // 4*25 once
    }
}
