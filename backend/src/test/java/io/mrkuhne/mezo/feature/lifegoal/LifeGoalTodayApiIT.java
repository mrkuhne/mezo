package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LifeGoalTodayResponse;
import io.mrkuhne.mezo.api.dto.PillarDayStatus;
import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** HTTP-level IT for GET /api/life-goals/today (Task 7, mezo-iizd.5). */
class LifeGoalTodayApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;

    private final LocalDate today = LocalDate.now();

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

    @Test
    void today_lists_active_goals_with_dots_and_tally() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        activityPillar(goal);
        activity(owner, today, 40);

        LifeGoalTodayResponse res = getForBody(
            "/api/life-goals/today", ownerAuthHeaders(), HttpStatus.OK, LifeGoalTodayResponse.class);

        assertThat(res.getGoals()).hasSize(1);
        assertThat(res.getGoals().get(0).getGoalId()).isEqualTo(goal.getId());
        assertThat(res.getGoals().get(0).getDays7()).hasSize(7);
        assertThat(res.getGoals().get(0).getDays7().get(6)).isEqualTo(PillarDayStatus.HIT);
        assertThat(res.getGoals().get(0).getPillarsHitToday()).isEqualTo(1);
        assertThat(res.getGoals().get(0).getPillarsTotal()).isEqualTo(1); // one seeded active pillar
    }

    @Test
    void parked_goal_is_absent() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "parked");
        activityPillar(goal);
        activity(owner, today, 40);

        LifeGoalTodayResponse res = getForBody(
            "/api/life-goals/today", ownerAuthHeaders(), HttpStatus.OK, LifeGoalTodayResponse.class);

        assertThat(res.getGoals()).isEmpty();
    }
}
