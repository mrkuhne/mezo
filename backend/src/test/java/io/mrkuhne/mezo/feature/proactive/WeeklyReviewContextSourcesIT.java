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
 * ALREADY-COMPUTED trend, rendered as facts for the model to explain.
 *
 * <p>No mocks (house rule): the goal, its pillar and the activity row are real entities, so the
 * arrow and hit-day numbers asserted here are the ones the real engine derives.
 *
 * <p><b>The window shape is the CRON's, not a convenient one.</b> {@code WeeklyReviewCron} fires
 * Monday 06:50 with {@code weekStart = previousOrSame(MONDAY).minusWeeks(1)} and
 * {@code weekEnd = weekStart.plusDays(6)} — the week that ENDED yesterday. Rendering with
 * {@code weekEnd = today} instead would be the one shape in which the block's trailing-7-day
 * window happens to coincide with the reviewed week, hiding exactly the mismatch the header now
 * has to be honest about. Every test therefore renders {@code [today-7, today-1]}.
 *
 * <p>All dates are computed INSIDE each test method, and the fixture day is {@code today-1}: a run
 * that crosses midnight between the fixture write and the render still leaves that day inside the
 * engine's {@code [now-6, now]} window, so the tally assertion cannot flake.
 */
class WeeklyReviewContextSourcesIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private WeeklyReviewContextSources contextSources;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /** The Monday-06:50 cron's own window: the week that ended yesterday. */
    private String renderReviewedWeek(UUID owner) {
        LocalDate today = LocalDate.now();
        LocalDate weekEnd = today.minusDays(1);
        LocalDate weekStart = today.minusDays(7);
        return contextSources.render(owner, weekStart, weekEnd,
            Instant.now().minus(8, ChronoUnit.DAYS), Instant.now());
    }

    private LifeGoalEntity activeGoalWithOneHitDay(UUID owner) {
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.pillar(goal, "Fokusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(LocalDate.now().minusDays(1));
        e.setText("test entry");
        e.setSkillKey("productivity");
        e.setExtracted(new ActivityExtract(40, null));
        activityLogRepository.saveAndFlush(e);
        return goal;
    }

    @Test
    void renders_the_life_goal_block_for_an_active_goal() {
        UUID owner = ownerId();
        LifeGoalEntity goal = activeGoalWithOneHitDay(owner);

        String payload = renderReviewedWeek(owner);

        assertThat(payload).contains("ÉLETCÉLOK · AZ ELMÚLT 7 NAP");
        assertThat(payload).contains(goal.getTitle());
        // the dimension tag and the engine's 7-day hit tally
        assertThat(payload).contains("[" + goal.getDimension() + "]");
        assertThat(payload).contains("1 találat-nap a 7-ből");
    }

    /**
     * The header must NOT claim to describe the reviewed week, and no today-snapshot may ride
     * along: the block's window is the trailing 7 days as of render time, which is one day off the
     * cron's window (see {@code appendLifeGoals}).
     */
    @Test
    void the_header_does_not_claim_the_reviewed_week_and_carries_no_today_snapshot() {
        UUID owner = ownerId();
        activeGoalWithOneHitDay(owner);

        String payload = renderReviewedWeek(owner);

        assertThat(payload).doesNotContain("ÉLETCÉLOK · A HÉT IRÁNYA");
        assertThat(payload).doesNotContain("pillér");
    }

    /**
     * A goal with NO activity at all: every {@code days7} slot is {@code NO_DATA}. The block must
     * say so explicitly instead of tallying "0 találat-nap a 7-ből" — a zero there would read as a
     * measured miss and invite the model to explain a week nobody measured. This is the frontend's
     * rule mirrored ({@code goalWeekSentence.ts} refuses the same sentence), so one week can never
     * read as a miss in the prompt and as silence on the Heti hub.
     */
    @Test
    void a_goal_with_no_data_day_says_so_instead_of_tallying_zero_hits() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.pillar(goal, "Fokusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
        // deliberately NO activity row — nothing was measured in the window

        String payload = renderReviewedWeek(owner);

        assertThat(payload).contains("ÉLETCÉLOK · AZ ELMÚLT 7 NAP");
        assertThat(payload).contains(goal.getTitle());
        assertThat(payload).contains("ezen a héten még nincs adata");
        assertThat(payload).doesNotContain("0 találat-nap");
    }

    @Test
    void renders_no_scaffolding_when_the_user_has_no_active_goal() {
        assertThat(renderReviewedWeek(ownerId())).doesNotContain("ÉLETCÉLOK");
    }

    @Test
    void a_parked_goal_never_leaks_into_the_payload() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "parked");
        lifeGoalPopulator.pillar(goal, "Fokusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));

        assertThat(renderReviewedWeek(owner)).doesNotContain("ÉLETCÉLOK");
    }
}
