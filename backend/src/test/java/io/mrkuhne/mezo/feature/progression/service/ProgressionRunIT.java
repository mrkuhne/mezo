package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.run.RunSignal;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.List;
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
        RunSignal signal = new RunSignal(logId, "sprint", 6, 32, 8, "200m", null, null);

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
        RunSignal signal = new RunSignal(logId, "steady", null, 45, 6, null, 80, null);

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
        RunSignal signal = new RunSignal(logId, "sprint", 4, 20, 7, null, null, null);

        LevelUpResult first = progressionService.applyRun(user, signal);
        LevelUpResult second = progressionService.applyRun(user, signal);

        assertThat(second.totalXp()).isEqualTo(first.totalXp());
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(100L)); // 4*25 once
    }

    // --- pyramid scoring (mezo-d20.7.3) ------------------------------------------------------
    //
    // The prescribed rungs 15/30/45/60/45/30/15 s = 7 rounds over 240 work seconds. Credit is
    // the round count scaled by the share of those seconds the logged rounds cover.

    /** Work-second rungs of the pyramid fixture used below (7 rounds, 240 s of work). */
    private static final List<Integer> PYRAMID = List.of(15, 30, 45, 60, 45, 30, 15);

    @Test
    void testApplyRun_shouldPayTheFullPrescribedRounds_whenPyramidCompleted() {
        UUID user = databasePopulator.populateUser("pyrfull@test.local");
        UUID logId = UUID.randomUUID();
        // all 7 rungs done → credit 7 → sprint_speed 7*25=175, anaerobic 7*15=105, rpe 8 → 48
        RunSignal signal = new RunSignal(logId, "pyramid", 7, 28, 8, null, null, PYRAMID);

        progressionService.applyRun(user, signal);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(175L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "anaerobic_capacity"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(105L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "explosiveness"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(48L));
    }

    @Test
    void testApplyRun_shouldPayProportionally_whenPyramidPartiallyCompleted() {
        UUID user = databasePopulator.populateUser("pyrpart@test.local");
        UUID logId = UUID.randomUUID();
        // 4 of 7 rungs = 15+30+45+60 = 150 of 240 s → credit 7*150/240 = 4.375
        // sprint_speed round(4.375*25) = 109, anaerobic round(4.375*15) = 66
        RunSignal signal = new RunSignal(logId, "pyramid", 4, 20, 7, null, null, PYRAMID);

        progressionService.applyRun(user, signal);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(109L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "anaerobic_capacity"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(66L));
    }

    @Test
    void testApplyRun_shouldCapAtThePrescription_whenMoreRoundsLoggedThanPrescribed() {
        UUID user = databasePopulator.populateUser("pyrover@test.local");
        UUID logId = UUID.randomUUID();
        RunSignal signal = new RunSignal(logId, "pyramid", 12, 30, 8, null, null, PYRAMID);

        progressionService.applyRun(user, signal);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(175L)); // 7 rounds, not 12
    }

    @Test
    void testApplyRun_shouldGrantNoRoundXp_whenLegacyPyramidLogHasNoCompletedRounds() {
        UUID user = databasePopulator.populateUser("pyrlegacy@test.local");
        UUID logId = UUID.randomUUID();
        // pre-mezo-d20.3.5 log: the sheet never captured rounds for a pyramid → null, no crash
        RunSignal signal = new RunSignal(logId, "pyramid", null, 26, 8, null, null, PYRAMID);

        LevelUpResult result = progressionService.applyRun(user, signal);

        assertThat(result.source()).isEqualTo("RUN");
        // no fabricated round credit; only the RPE that WAS logged pays
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed")).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "anaerobic_capacity")).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "explosiveness"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(48L));
    }

    @Test
    void testApplyRun_shouldFallBackToFlatPerRound_whenPyramidPrescriptionUnavailable() {
        UUID user = databasePopulator.populateUser("pyrnoplan@test.local");
        UUID logId = UUID.randomUUID();
        // block/structure gone → no rungs to weight against; the logged rounds still pay flat
        RunSignal signal = new RunSignal(logId, "pyramid", 5, 22, 7, null, null, null);

        progressionService.applyRun(user, signal);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(125L)); // 5*25
    }
}
