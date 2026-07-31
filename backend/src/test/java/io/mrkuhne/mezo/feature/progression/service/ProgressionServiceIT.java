package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
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
    @Autowired private ProgressionProperties progressionProperties;

    @Test
    void testApplyGym_shouldGrantMuscleAndStrengthXpAndLevelUp_whenFirstApplied() {
        UUID user = databasePopulator.populateUser("apply@test.local");
        UUID instance = UUID.randomUUID();
        // chest volume 1640 → 1640/100*10 = 160 XP (integer math); bestE1rm 133 → 133*2 = 266 XP.
        // Zero medals (this GymSignal is synthetic, not derived from real set history — mezo-wp6n
        // retired the old "first-ever weighted session" bonus in favour of per-RECORD-medal pay,
        // so a signal carrying no medals must NOT add any prBonusXp) → no bonus; 2 work sets →
        // strength_endurance 16. With base=100 exp=1.6: max_strength 266 → Lv2 (xpThreshold(2)=100
        // ≤ 266 < xpThreshold(3)=303).
        GymSignal signal = new GymSignal(
            instance, Map.of("chest", 1640L), new BigDecimal("133.3333"), 2, 0, 0, 0);

        LevelUpResult result = progressionService.applyGym(user, signal);

        assertThat(result.source()).isEqualTo("GYM");
        assertThat(result.totalXp()).isEqualTo(160L + 266L + 16L + result.robustness().xpGained());
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "chest"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(160L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "max_strength"))
            .get().satisfies(s -> {
                assertThat(s.getCumulativeXp()).isEqualTo(266L);
                assertThat(s.getCurrentLevel()).isEqualTo(2); // 266 >= xpThreshold(2)=100, < xpThreshold(3)=303
            });
        assertThat(result.levelUps()).contains("max_strength");
        assertThat(result.gains()).anySatisfy(g -> {
            assertThat(g.skillKey()).isEqualTo("max_strength");
            assertThat(g.levelBefore()).isEqualTo(1);
            assertThat(g.levelAfter()).isEqualTo(2);
        });
    }

    @Test
    void testApplyGym_shouldBeIdempotent_whenSameInstanceAppliedTwice() {
        UUID user = databasePopulator.populateUser("idem@test.local");
        UUID instance = UUID.randomUUID();
        GymSignal signal =
            new GymSignal(instance, Map.of("quad", 500L), new BigDecimal("100.0000"), 1, 0, 0, 0);

        LevelUpResult first = progressionService.applyGym(user, signal);
        LevelUpResult second = progressionService.applyGym(user, signal);

        assertThat(second.totalXp()).isEqualTo(first.totalXp()); // stored payload, not re-awarded
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "quad"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(50L)); // 500/100*10, once
    }

    @Test
    void testApplyGym_shouldIgnorePriorMaxStrengthProgress_whenPayingThePrBonus() {
        UUID user = databasePopulator.populateUser("pr@test.local");
        // A pre-existing max_strength row is exactly what the RETIRED v1 rule keyed off ("bonus on
        // the first-ever weighted session only" ⇒ this row suppressed it). Post-mezo-wp6n the bonus
        // keys off recordMedalCount alone, so this row must be irrelevant: with zero medals the
        // delta is purely e1RM-derived, no prBonusXp either way. Asserting the EXACT delta is what
        // makes this a regression guard against a firstEver-style branch creeping back in.
        skillProgressPopulator.createSkill(user, "max_strength", "ATHLETIC", 200L, 2);
        UUID instance = UUID.randomUUID();
        GymSignal signal = new GymSignal(instance, Map.of(), new BigDecimal("100.0000"), 1, 0, 0, 0);

        LevelUpResult result = progressionService.applyGym(user, signal);

        ProgressionProperties.Gym gym = progressionProperties.gym();
        long expected = 100L * gym.e1rmXpPerKg(); // bestE1rm 100, NO prBonusXp
        assertThat(result.gains()).anySatisfy(g -> {
            assertThat(g.skillKey()).isEqualTo("max_strength");
            assertThat(g.xpGained()).isEqualTo(expected)
                .isNotEqualTo(expected + gym.prBonusXp()); // the bonus must NOT have been paid
        });
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "max_strength"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(200L + expected));
    }
}
