package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.LifeGoalProgressResponse;
import io.mrkuhne.mezo.api.dto.PillarDayEntry;
import io.mrkuhne.mezo.api.dto.PillarDayStatus;
import io.mrkuhne.mezo.api.dto.TrendArrow;
import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** HTTP-level IT for GET /api/life-goals/{id}/progress (Task 5, mezo-iizd.5). */
class LifeGoalProgressApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private WeightLogRepository weightLogRepository;

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

    private void activeWeightGoal(UUID owner) {
        GoalEntity g = new GoalEntity();
        g.setCreatedBy(owner);
        g.setTitle("Nyári cut");
        g.setTrajectory("cut");
        g.setGuards(List.of("strength", "muscle"));
        g.setStatus("active");
        g.setStartDate(today.minusDays(20));
        g.setTargetDate(today.plusDays(50));
        g.setStartWeightKg(new BigDecimal("92.00"));
        g.setTargetWeightKg(new BigDecimal("85.00"));
        g.setRateTargetPctPerWeek(new BigDecimal("0.70"));
        goalRepository.saveAndFlush(g);
    }

    private void weighIn(UUID owner, LocalDate on, double kg) {
        WeightLogEntity e = new WeightLogEntity();
        e.setCreatedBy(owner);
        e.setDate(on);
        e.setWeightKg(BigDecimal.valueOf(kg));
        weightLogRepository.saveAndFlush(e);
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

    /**
     * Code-review follow-up (mezo-iizd.5): a {@code linked} pillar's {@code referenceValue} must
     * reuse the scorer's {@code target} (the weight-goal ütemvonal's expected(to)) — same
     * semantics as the {@code target} kind — instead of staying null.
     */
    @Test
    void progress_linked_pillar_referenceValue_is_expected_trend() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.pillar(goal, "Súlycél", "linked",
            new PillarSourceJson("weight_goal", null, null, null, null, null),
            new PillarRuleJson(null, null, null, null, null, null, null, null, null, null));
        activeWeightGoal(owner);
        for (int i = 14; i >= 0; i--) {
            double kg = 92.0 - (14 - i) * (1.0 / 14.0);
            weighIn(owner, today.minusDays(i), kg);
        }

        LifeGoalProgressResponse res = getForBody(
            "/api/life-goals/" + goal.getId() + "/progress?from=" + today.minusDays(6) + "&to=" + today,
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProgressResponse.class);

        BigDecimal referenceValue = res.getPillars().get(0).getReferenceValue();
        assertThat(referenceValue).isNotNull();
        // expected(today) = 92 + (85-92) * 20/70 = 90.0
        assertThat(referenceValue.doubleValue()).isCloseTo(90.0, within(0.05));
    }

    @Test
    void foreign_goal_is_404() {
        RegisteredUser other = registerUser("Idegen");
        LifeGoalEntity goal = lifeGoalPopulator.goal(other.id(), "active");
        getForBody("/api/life-goals/" + goal.getId() + "/progress?from=" + today.minusDays(6) + "&to=" + today,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
