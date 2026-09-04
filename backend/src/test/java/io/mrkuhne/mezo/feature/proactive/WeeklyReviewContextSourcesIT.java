package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyReviewContextSources;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The weekly review gather payload's ÉLETCÉLOK block (mezo-iizd.9) — the life-goal engine's
 * ALREADY-COMPUTED weekly arrows, rendered as facts for the model to explain.
 *
 * <p>No mocks (house rule): the goal, its pillar and the day's activity row are real entities, so
 * the arrow/hit-day numbers asserted here are the ones the real engine derives.
 */
class WeeklyReviewContextSourcesIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private WeeklyReviewContextSources contextSources;

    private final LocalDate today = LocalDate.now();
    private final LocalDate weekStart = today.minusDays(6);

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private String render(UUID owner) {
        return contextSources.render(owner, weekStart, today,
            Instant.now().minus(7, ChronoUnit.DAYS), Instant.now());
    }

    private LifeGoalEntity activeGoalWithTodaysHit(UUID owner) {
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.pillar(goal, "Fokusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(today);
        e.setText("test entry");
        e.setSkillKey("productivity");
        e.setExtracted(new ActivityExtract(40, null));
        activityLogRepository.saveAndFlush(e);
        return goal;
    }

    @Test
    void renders_the_life_goal_block_for_an_active_goal() {
        UUID owner = ownerId();
        LifeGoalEntity goal = activeGoalWithTodaysHit(owner);

        String payload = render(owner);

        assertThat(payload).contains("ÉLETCÉLOK · A HÉT IRÁNYA");
        assertThat(payload).contains(goal.getTitle());
        // the dimension tag, the arrow WORD (never the glyph) and the engine's 7-day hit tally
        assertThat(payload).contains("[" + goal.getDimension() + "]");
        assertThat(payload).contains("1 találat-nap a 7-ből");
        assertThat(payload).contains("ma 1 / 1 pillér");
    }

    @Test
    void renders_no_scaffolding_when_the_user_has_no_active_goal() {
        assertThat(render(ownerId())).doesNotContain("ÉLETCÉLOK");
    }

    @Test
    void a_parked_goal_never_leaks_into_the_payload() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "parked");
        lifeGoalPopulator.pillar(goal, "Fokusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));

        assertThat(render(owner)).doesNotContain("ÉLETCÉLOK");
    }
}
