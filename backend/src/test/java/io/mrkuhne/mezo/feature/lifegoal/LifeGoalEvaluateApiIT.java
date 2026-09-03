package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LifeGoalProgressResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarDayRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level IT for POST /api/life-goals/{id}/evaluate (Task 6, mezo-iizd.5): the 3-closed-day
 * upsert must be idempotent (re-running never duplicates rows) and re-evaluation must pick up
 * late-logged activity (a stored status can flip on the next run).
 */
class LifeGoalEvaluateApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private LifeGoalPillarDayRepository dayRepository;

    private final LocalDate today = LocalDate.now();
    private final LocalDate yesterday = today.minusDays(1);

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private void activity(UUID owner, LocalDate on, int durationMin) {
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(on);
        e.setText("test entry");
        e.setSkillKey("productivity");
        e.setExtracted(new ActivityExtract(durationMin, null));
        activityLogRepository.saveAndFlush(e);
    }

    private LifeGoalPillarEntity activityPillar(LifeGoalEntity goal) {
        return lifeGoalPopulator.pillar(goal, "Fokusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
    }

    private LifeGoalProgressResponse evaluate(UUID goalId) {
        return postForBody("/api/life-goals/" + goalId + "/evaluate", null,
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProgressResponse.class);
    }

    @Test
    void evaluate_upserts_last_three_closed_days_idempotently() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = activityPillar(goal);
        activity(owner, yesterday, 40);
        activity(owner, today.minusDays(2), 40);
        activity(owner, today.minusDays(3), 40);

        evaluate(goal.getId());
        long after1 = dayRepository.count();
        evaluate(goal.getId());

        assertThat(dayRepository.count()).isEqualTo(after1);   // no duplicated rows
        assertThat(after1).isEqualTo(3);                        // 1 pillar x 3 closed days
        assertThat(dayRepository.findByPillarIdAndDayAndDeletedFalse(pillar.getId(), yesterday))
            .hasValueSatisfying(r -> assertThat(r.getStatus()).isEqualTo("hit"));
    }

    @Test
    void late_logging_flips_a_stored_miss_on_reevaluate() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = activityPillar(goal);

        evaluate(goal.getId()); // yesterday: no data yet -> no_data
        assertThat(dayRepository.findByPillarIdAndDayAndDeletedFalse(pillar.getId(), yesterday))
            .hasValueSatisfying(r -> assertThat(r.getStatus()).isEqualTo("no_data"));

        activity(owner, yesterday, 45); // late logging
        evaluate(goal.getId());

        assertThat(dayRepository.findByPillarIdAndDayAndDeletedFalse(pillar.getId(), yesterday))
            .hasValueSatisfying(r -> assertThat(r.getStatus()).isEqualTo("hit"));
    }

    @Test
    void evaluate_sets_created_by_to_goal_owner() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = activityPillar(goal);
        activity(owner, yesterday, 40);

        evaluate(goal.getId());

        assertThat(dayRepository.findByPillarIdAndDayAndDeletedFalse(pillar.getId(), yesterday))
            .hasValueSatisfying(r -> assertThat(r.getCreatedBy()).isEqualTo(owner));
    }
}
