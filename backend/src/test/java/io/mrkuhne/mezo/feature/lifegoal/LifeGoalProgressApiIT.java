package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LifeGoalProgressResponse;
import io.mrkuhne.mezo.api.dto.PillarDayEntry;
import io.mrkuhne.mezo.api.dto.PillarDayStatus;
import io.mrkuhne.mezo.api.dto.TrendArrow;
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

/** HTTP-level IT for GET /api/life-goals/{id}/progress (Task 5, mezo-iizd.5). */
class LifeGoalProgressApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;

    private final LocalDate today = LocalDate.now();
    private final LocalDate d0 = today;
    private final LocalDate d1 = today.minusDays(1);
    private final LocalDate d2 = today.minusDays(2);
    private final LocalDate d3 = today.minusDays(3);

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

    private PillarDayEntry dayEntry(LifeGoalProgressResponse res, LocalDate day) {
        return res.getPillars().get(0).getDays().stream()
            .filter(d -> d.getDay().equals(day)).findFirst()
            .orElseThrow(() -> new IllegalStateException("no day entry for " + day));
    }

    @Test
    void progress_scores_days_and_serves_arrow_gate() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        activityPillar(goal);
        activity(owner, d1, 40);
        activity(owner, d2, 20);
        activity(owner, d3, 45);

        LifeGoalProgressResponse res = getForBody(
            "/api/life-goals/" + goal.getId() + "/progress?from=" + today.minusDays(6) + "&to=" + today,
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProgressResponse.class);

        assertThat(dayEntry(res, d1).getStatus()).isEqualTo(PillarDayStatus.HIT);   // 40 perc
        assertThat(dayEntry(res, d2).getStatus()).isEqualTo(PillarDayStatus.MISS);  // 20 perc
        assertThat(dayEntry(res, d0).getStatus()).isEqualTo(PillarDayStatus.NO_DATA); // nincs sor
        assertThat(res.getPillars().get(0).getArrow()).isEqualTo(TrendArrow.INSUFFICIENT); // < 5 adat-nap
        assertThat(res.getConflicts()).isNotNull();
    }

    @Test
    void foreign_goal_is_404() {
        RegisteredUser other = registerUser("Idegen");
        LifeGoalEntity goal = lifeGoalPopulator.goal(other.id(), "active");
        getForBody("/api/life-goals/" + goal.getId() + "/progress?from=" + today.minusDays(6) + "&to=" + today,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
