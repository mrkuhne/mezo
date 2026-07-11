package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.activity.ActivitySignal;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Activity XP rides the idempotent award tail (source ACTIVITY); overrides move XP between rows. */
class ProgressionActivityIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testApplyActivity_shouldCreateLifeRowAndBeIdempotent_whenAppliedTwice() {
        UUID owner = userPopulator.createUser("act-xp@test.hu").getId();
        ActivitySignal signal = new ActivitySignal(UUID.randomUUID(), "learning", 15, "Olvastam 30 percet");

        LevelUpResult first = progressionService.applyActivity(owner, signal);
        LevelUpResult second = progressionService.applyActivity(owner, signal);

        assertThat(first.source()).isEqualTo("ACTIVITY");
        assertThat(first.gains()).singleElement().satisfies(g -> {
            assertThat(g.skillKey()).isEqualTo("learning");
            assertThat(g.kind()).isEqualTo("LIFE");
        });
        assertThat(second.totalXp()).isEqualTo(first.totalXp()); // stored payload, no double award

        var row = skillProgressRepository.findByCreatedByAndSkillKey(owner, "learning").orElseThrow();
        assertThat(row.getCumulativeXp()).isEqualTo(15);
        assertThat(row.getSkillKind()).isEqualTo("LIFE");
    }

    @Test
    void testMoveActivityXp_shouldShiftCumulativeXp_whenOverridingCategory() {
        UUID owner = userPopulator.createUser("act-move@test.hu").getId();
        progressionService.applyActivity(owner,
            new ActivitySignal(UUID.randomUUID(), "learning", 20, "Teszt"));

        progressionService.moveActivityXp(owner, "learning", "mindset", 20);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "learning").orElseThrow()
            .getCumulativeXp()).isZero();
        var target = skillProgressRepository.findByCreatedByAndSkillKey(owner, "mindset").orElseThrow();
        assertThat(target.getCumulativeXp()).isEqualTo(20);
        assertThat(target.getSkillKind()).isEqualTo("LIFE");
    }
}
