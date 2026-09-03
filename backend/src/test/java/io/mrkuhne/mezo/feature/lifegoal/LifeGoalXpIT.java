package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarDayRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalProgressService;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalXpService;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * XP side of the motor (mezo-iizd.6, spec D-1): every evaluated `hit` pillar-day grants
 * xp-per-hit on the pillar's skill, exactly once — the evaluate window's 3-day rewrite and a
 * second evaluate must not double-award; a non-hit day grants nothing.
 */
class LifeGoalXpIT extends AbstractIntegrationTest {

    private static final int XP_PER_HIT = 5;

    @Autowired private LifeGoalProgressService progressService;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private LevelUpEventRepository levelUpEventRepository;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private LifeGoalPillarRepository pillarRepository;
    @Autowired private LifeGoalPillarDayRepository pillarDayRepository;

    private final LocalDate today = LocalDate.now();

    /** "Fókusz" habit pillar: ≥30 productivity minutes a day → hit, on the recovery skill. */
    private LifeGoalPillarEntity focusPillar(LifeGoalEntity goal) {
        return lifeGoalPopulator.pillar(goal, "Fókusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
    }

    private void activity(UUID owner, LocalDate on, int durationMin) {
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(on);
        e.setText("fókuszblokk");
        e.setSkillKey("productivity");
        e.setExtracted(new ActivityExtract(durationMin, null));
        activityLogRepository.saveAndFlush(e);
    }

    @Test
    void testEvaluate_shouldAwardXpOncePerHitDay_whenRunTwice() {
        UUID owner = userPopulator.createUser("lifegoal-xp-evaluate@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = focusPillar(goal);
        activity(owner, today.minusDays(1), 40);   // hit
        activity(owner, today.minusDays(2), 40);   // hit
        activity(owner, today.minusDays(3), 5);    // miss -> no XP

        progressService.evaluate(owner, goal.getId());
        progressService.evaluate(owner, goal.getId());

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")
            .orElseThrow().getCumulativeXp()).isEqualTo(2L * XP_PER_HIT);
        assertThat(levelUpEventRepository.findByCreatedByAndSourceTypeAndSourceRefId(
            owner, "LIFE_GOAL", LifeGoalXpService.refIdFor(pillar.getId(), today.minusDays(1)))).isPresent();
        assertThat(levelUpEventRepository.findByCreatedByAndSourceTypeAndSourceRefId(
            owner, "LIFE_GOAL", LifeGoalXpService.refIdFor(pillar.getId(), today.minusDays(3)))).isEmpty();
    }

    @Test
    void testEvaluate_shouldStampTheEvaluatedDay_whenAwarding() {
        UUID owner = userPopulator.createUser("lifegoal-xp-date@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        focusPillar(goal);
        activity(owner, today.minusDays(1), 40);

        progressService.evaluate(owner, goal.getId());

        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, today.minusDays(1)))
            .hasSize(1);
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, today)).isEmpty();
    }

    @Test
    void testEvaluate_shouldAwardNothing_whenNoDayIsAHit() {
        UUID owner = userPopulator.createUser("lifegoal-xp-nodata@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        focusPillar(goal);

        progressService.evaluate(owner, goal.getId());

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")).isEmpty();
    }

    @Test
    void testEvaluate_shouldAwardNothing_whenTheDayIsAMiss() {
        UUID owner = userPopulator.createUser("lifegoal-xp-miss@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = focusPillar(goal);
        activity(owner, today.minusDays(1), 5); // below the 30-minute threshold -> miss

        progressService.evaluate(owner, goal.getId());

        assertThat(pillarDayRepository.findByPillarIdAndDayAndDeletedFalse(pillar.getId(), today.minusDays(1)))
            .hasValueSatisfying(r -> assertThat(r.getStatus()).isEqualTo("miss"));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")).isEmpty();
        assertThat(levelUpEventRepository.findByCreatedByAndSourceTypeAndSourceRefId(
            owner, "LIFE_GOAL", LifeGoalXpService.refIdFor(pillar.getId(), today.minusDays(1)))).isEmpty();
    }

    @Test
    void testEvaluate_shouldAwardNothing_whenThePillarIsRobustnessKeyed() {
        UUID owner = userPopulator.createUser("lifegoal-xp-robustness@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = focusPillar(goal);
        pillar.setSkillKey(ProgressionTaxonomy.ROBUSTNESS);
        pillarRepository.saveAndFlush(pillar);
        activity(owner, today.minusDays(1), 40); // hit, but robustness never awards

        progressService.evaluate(owner, goal.getId());

        assertThat(pillarDayRepository.findByPillarIdAndDayAndDeletedFalse(pillar.getId(), today.minusDays(1)))
            .hasValueSatisfying(r -> assertThat(r.getStatus()).isEqualTo("hit"));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, ProgressionTaxonomy.ROBUSTNESS))
            .isEmpty();
        assertThat(levelUpEventRepository.findByCreatedByAndSourceTypeAndSourceRefId(
            owner, "LIFE_GOAL", LifeGoalXpService.refIdFor(pillar.getId(), today.minusDays(1)))).isEmpty();
    }
}
