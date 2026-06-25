package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.gym.GymSignal;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionServiceIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private SkillProgressPopulator skillProgressPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testApplyGym_shouldGrantMuscleAndStrengthXpAndLevelUp_whenFirstApplied() {
        UUID user = databasePopulator.populateUser("apply@test.local");
        UUID instance = UUID.randomUUID();
        // chest volume 1640 → 1640/100*10 = 160 XP (integer math); bestE1rm 133 → 133*2 = 266 + 40 PR
        // bonus (no prior max_strength row) = 306; 2 work sets → strength_endurance 16.
        // With base=100 exp=1.6: max_strength 306 → Lv3 (xpThreshold(3)=303 ≤ 306 < 580).
        GymSignal signal = new GymSignal(instance, Map.of("chest", 1640L), new BigDecimal("133.3333"), 2, 0);

        LevelUpResult result = progressionService.applyGym(user, signal);

        assertThat(result.source()).isEqualTo("GYM");
        assertThat(result.totalXp()).isEqualTo(160L + 306L + 16L + result.robustness().xpGained());
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "chest"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(160L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "max_strength"))
            .get().satisfies(s -> {
                assertThat(s.getCumulativeXp()).isEqualTo(306L);
                assertThat(s.getCurrentLevel()).isEqualTo(3); // 306 >= xpThreshold(3)=303
            });
        assertThat(result.levelUps()).contains("max_strength");
        assertThat(result.gains()).anySatisfy(g -> {
            assertThat(g.skillKey()).isEqualTo("max_strength");
            assertThat(g.levelBefore()).isEqualTo(1);
            assertThat(g.levelAfter()).isEqualTo(3);
        });
    }

    @Test
    void testApplyGym_shouldBeIdempotent_whenSameInstanceAppliedTwice() {
        UUID user = databasePopulator.populateUser("idem@test.local");
        UUID instance = UUID.randomUUID();
        GymSignal signal = new GymSignal(instance, Map.of("quad", 500L), new BigDecimal("100.0000"), 1, 0);

        LevelUpResult first = progressionService.applyGym(user, signal);
        LevelUpResult second = progressionService.applyGym(user, signal);

        assertThat(second.totalXp()).isEqualTo(first.totalXp()); // stored payload, not re-awarded
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "quad"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(50L)); // 500/100*10, once
    }

    @Test
    void testApplyGym_shouldGrantMaxStrengthXp_whenPriorMaxStrengthExists() {
        UUID user = databasePopulator.populateUser("pr@test.local");
        skillProgressPopulator.createSkill(user, "max_strength", "ATHLETIC", 200L, 2);
        UUID instance = UUID.randomUUID();
        // bestE1rm 100 → 200 XP; a prior max_strength row exists, so the v1 PR rule (bonus only on the
        // first-ever weighted session) does NOT add the bonus — assert the max_strength gain exists.
        GymSignal signal = new GymSignal(instance, Map.of(), new BigDecimal("100.0000"), 1, 0);

        LevelUpResult result = progressionService.applyGym(user, signal);

        assertThat(result.gains()).anySatisfy(g -> assertThat(g.skillKey()).isEqualTo("max_strength"));
    }
}
