package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.sport.SportSignal;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionSportIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testApplySport_shouldGrantVolleyballSkills_whenVolleyballSession() {
        UUID user = databasePopulator.populateUser("vb@test.local");
        // volleyball sets=5,rpe=7,min=90 → jump/agility/coord 5*12=60; explosiveness 7*6=42; aerobic 90*4=360
        SportSignal signal = new SportSignal(UUID.randomUUID(), "volleyball", 90, 5, null, 7);

        LevelUpResult result = progressionService.applySport(user, signal);

        assertThat(result.source()).isEqualTo("SPORT");
        assertThat(result.workoutLabel()).isEqualTo("Röplabda");
        assertSkill(user, "vertical_jump", 60L);
        assertSkill(user, "agility", 60L);
        assertSkill(user, "coordination", 60L);
        assertSkill(user, "explosiveness", 42L);
        assertSkill(user, "aerobic_capacity", 360L);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed")).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "max_strength")).isEmpty();
    }

    @Test
    void testApplySport_shouldGrantCrossSkills_whenCrossSession() {
        UUID user = databasePopulator.populateUser("cross@test.local");
        // cross rounds=8,rpe=8 → anaerobic/strength_end 8*14=112; explosiveness/core 8*6=48
        SportSignal signal = new SportSignal(UUID.randomUUID(), "cross", 45, null, 8, 8);

        LevelUpResult result = progressionService.applySport(user, signal);

        assertThat(result.workoutLabel()).isEqualTo("Cross training");
        assertSkill(user, "anaerobic_capacity", 112L);
        assertSkill(user, "strength_endurance", 112L);
        assertSkill(user, "explosiveness", 48L);
        assertSkill(user, "core_stability", 48L);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "vertical_jump")).isEmpty();
    }

    @Test
    void testApplySport_shouldGrantTrxSkills_whenTrxSession() {
        UUID user = databasePopulator.populateUser("trx@test.local");
        // trx rounds=6,rpe=7,min=40 → core/strength_end 6*14=84; anaerobic 7*6=42; mobility 40*4=160
        SportSignal signal = new SportSignal(UUID.randomUUID(), "trx", 40, null, 6, 7);

        LevelUpResult result = progressionService.applySport(user, signal);

        assertThat(result.workoutLabel()).isEqualTo("TRX köredzés");
        assertSkill(user, "core_stability", 84L);
        assertSkill(user, "strength_endurance", 84L);
        assertSkill(user, "anaerobic_capacity", 42L);
        assertSkill(user, "mobility", 160L);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "vertical_jump")).isEmpty();
    }

    @Test
    void testApplySport_shouldGrantNeutralAthleticismUnderItsOwnLabel_whenNewSportId() {
        // Regression for the id switch defaulting every unmatched kind to volleyball: bike (one
        // of the seven new ids) must NOT collapse into "Röplabda"/vertical_jump/agility — it gets
        // the sport's own Hungarian label and the neutral duration+rpe grant.
        // bike min=60,rpe=6 → aerobic_capacity 60*4=240; explosiveness 6*6=36
        UUID user = databasePopulator.populateUser("bike@test.local");
        SportSignal signal = new SportSignal(UUID.randomUUID(), "bike", 60, null, null, 6);

        LevelUpResult result = progressionService.applySport(user, signal);

        assertThat(result.workoutLabel()).isEqualTo("Kerékpár");
        assertSkill(user, "aerobic_capacity", 240L);
        assertSkill(user, "explosiveness", 36L);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "vertical_jump")).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "agility")).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "coordination")).isEmpty();
    }

    @Test
    void testApplySport_shouldBeIdempotent_whenSameSessionAppliedTwice() {
        UUID user = databasePopulator.populateUser("sportidem@test.local");
        UUID sessionId = UUID.randomUUID();
        SportSignal signal = new SportSignal(sessionId, "volleyball", 90, 5, null, 7);

        LevelUpResult first = progressionService.applySport(user, signal);
        LevelUpResult second = progressionService.applySport(user, signal);

        assertThat(second.totalXp()).isEqualTo(first.totalXp());
        assertSkill(user, "vertical_jump", 60L); // counted once
    }

    private void assertSkill(UUID user, String key, long expected) {
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, key))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(expected));
    }
}
