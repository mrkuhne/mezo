package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the Goal aggregate — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB CHECKs fire.
 */
@TestComponent
@RequiredArgsConstructor
public class GoalPopulator {

    private final GoalRepository goalRepository;

    /** Full-control factory: persists a goal for {@code owner} and flushes so DB CHECKs fire. */
    public GoalEntity createGoal(UUID owner, String trajectory, String status) {
        GoalEntity g = new GoalEntity();
        g.setCreatedBy(owner);
        g.setTitle("Nyári cut");
        g.setTrajectory(trajectory);
        g.setGuards(List.of("strength", "muscle"));
        g.setStatus(status);
        g.setStartDate(LocalDate.of(2026, 6, 1));
        g.setTargetDate(LocalDate.of(2026, 7, 27));
        g.setStartWeightKg(new BigDecimal("84.20"));
        g.setTargetWeightKg(new BigDecimal("80.00"));
        g.setRateTargetPctPerWeek(new BigDecimal("0.70"));
        g.setIdentityFrame("Erő megtartva a cut alatt.");
        return goalRepository.saveAndFlush(g);
    }

    /** Active cut goal with explicit dates, prescription and day-planner fields — snapshot tests. */
    public GoalEntity createGoalFull(UUID owner, LocalDate startDate, LocalDate targetDate,
        GoalPrescriptionJson prescription, Integer mealsPerDay, String wakeTime, String bedTime) {
        GoalEntity g = new GoalEntity();
        g.setCreatedBy(owner);
        g.setTitle("Nyári cut");
        g.setTrajectory("cut");
        g.setGuards(List.of("strength", "muscle"));
        g.setStatus("active");
        g.setStartDate(startDate);
        g.setTargetDate(targetDate);
        g.setStartWeightKg(new BigDecimal("84.20"));
        g.setTargetWeightKg(new BigDecimal("80.00"));
        g.setRateTargetPctPerWeek(new BigDecimal("0.70"));
        g.setPrescription(prescription);
        g.setMealsPerDay(mealsPerDay);
        g.setWakeTime(wakeTime);
        g.setBedTime(bedTime);
        return goalRepository.saveAndFlush(g);
    }
}
