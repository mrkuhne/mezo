package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarDayRepository;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalEvalJob;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Nightly life-goal evaluation cron (mezo-iizd.6): every active goal of every user gets its last
 * 3 closed days rewritten and its hit-days awarded. Two runs must leave exactly the same rows and
 * the same XP (the Habitica double-cron lesson, spec §2); a closed/archived goal is skipped.
 */
@TestPropertySource(properties = {
    // mezo-c9k4: the shared test profile now disables this cron by default (kill-switch
    // completeness) — this IT drives the job directly, so it re-enables it on its own context.
    "mezo.techcore.cron.life-goal-eval-job.enabled=true"
})
class LifeGoalEvalJobIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalEvalJob job;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private LifeGoalPillarDayRepository dayRepository;

    private final LocalDate today = LocalDate.now();

    private LifeGoalPillarEntity focusPillar(LifeGoalEntity goal) {
        return lifeGoalPopulator.pillar(goal, "Fókusz", "habit",
            new PillarSourceJson("metric", "DAILY_WATER_ML", null, null, null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
    }

    /** One day's signal: a water log (the pillar reads DAILY_WATER_ML). Until mezo-r36n9.97.5 this
     *  was an activity-log entry; the activity source left with the XP world. */
    private void activity(UUID owner, LocalDate on, int amount) {
        waterLogPopulator.createWaterLog(owner, on, amount);
    }

    @Test
    void testRunEval_shouldWriteTheSameRows_whenRunTwice() {
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
    }

    @Test
    void testRunEval_shouldIsolatePerUser_whenOneUsersGoalThrowsDuringEvaluation() {
        UUID brokenOwner = userPopulator.createUser("lifegoal-job-broken@test.hu").getId();
        LifeGoalEntity brokenGoal = lifeGoalPopulator.goal(brokenOwner, "active");
        LifeGoalPillarEntity brokenPillar = lifeGoalPopulator.pillar(brokenGoal, "Fókusz", "habit",
            new PillarSourceJson("metric", "BOGUS_METRIC", null, null, null, null), // throws on evaluation
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
        activity(brokenOwner, today.minusDays(1), 40);

        UUID healthyOwner = userPopulator.createUser("lifegoal-job-healthy@test.hu").getId();
        LifeGoalEntity healthyGoal = lifeGoalPopulator.goal(healthyOwner, "active");
        LifeGoalPillarEntity healthyPillar = focusPillar(healthyGoal);
        activity(healthyOwner, today.minusDays(1), 40);

        job.runEval();

        assertThat(dayRepository.findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(
            List.of(brokenPillar.getId()), today.minusDays(3), today.minusDays(1))).isEmpty();

        var healthyRows = dayRepository.findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(
            List.of(healthyPillar.getId()), today.minusDays(3), today.minusDays(1));
        assertThat(healthyRows).hasSize(3);
        assertThat(healthyRows).filteredOn(r -> "hit".equals(r.getStatus())).hasSize(1);
    }
}
