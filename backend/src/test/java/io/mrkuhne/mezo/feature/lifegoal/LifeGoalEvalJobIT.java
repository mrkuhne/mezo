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
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalEvalJob;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Nightly life-goal evaluation cron (mezo-iizd.6): every active goal of every user gets its last
 * 3 closed days rewritten and its hit-days awarded. Two runs must leave exactly the same rows and
 * the same XP (the Habitica double-cron lesson, spec §2); a closed/archived goal is skipped.
 */
class LifeGoalEvalJobIT extends AbstractIntegrationTest {

    private static final int XP_PER_HIT = 5;

    @Autowired private LifeGoalEvalJob job;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private LifeGoalPillarDayRepository dayRepository;
    @Autowired private SkillProgressRepository skillProgressRepository;

    private final LocalDate today = LocalDate.now();

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
    void testRunEval_shouldWriteTheSameRowsAndXp_whenRunTwice() {
        UUID owner = userPopulator.createUser("lifegoal-job@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = focusPillar(goal);
        activity(owner, today.minusDays(1), 40);

        job.runEval();
        job.runEval();

        var rows = dayRepository.findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(
            List.of(pillar.getId()), today.minusDays(3), today.minusDays(1));
        assertThat(rows).hasSize(3);
        assertThat(rows).filteredOn(r -> "hit".equals(r.getStatus())).hasSize(1);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")
            .orElseThrow().getCumulativeXp()).isEqualTo(XP_PER_HIT);
    }

    @Test
    void testRunEval_shouldSkipTheGoal_whenItIsNotActive() {
        UUID owner = userPopulator.createUser("lifegoal-job-draft@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "archived");
        LifeGoalPillarEntity pillar = focusPillar(goal);
        activity(owner, today.minusDays(1), 40);

        job.runEval();

        assertThat(dayRepository.findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(
            List.of(pillar.getId()), today.minusDays(3), today.minusDays(1))).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")).isEmpty();
    }
}
