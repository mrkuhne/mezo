package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * The mezo-zz91i deploy rollout (Task 8): reviews the week that just ended for every active-goal
 * owner not yet a learner, so the feature reaches existing users on boot rather than only new
 * weeks going forward. Every date is anchored to {@code LocalDate.now()} minus whole weeks — the
 * same formula the runner itself uses — so this IT keeps working on whichever day it runs
 * (midnight-safe: the reviewed week always ends at least a day before today).
 */
@Transactional
class ExpenditureRolloutRunnerIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();
    private static final LocalDate WEEK_START =
        TODAY.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
    private static final LocalDate WEEK_END = WEEK_START.plusDays(6);
    private static final int HISTORY_DAYS = 35;

    @Autowired private ExpenditureRolloutRunner runner;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalEngineService goalEngineService;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private ExpenditureEstimateRepository estimates;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private EntityManager entityManager;

    @Test
    void reviewsEligibleUsersOnceAndSkipsNonLoggingUsers() {
        UUID eligible = seedEligibleUser();
        UUID nonLogging = seedNonLoggingUser();

        runner.run();
        entityManager.flush();
        entityManager.clear();

        assertThat(estimates.findByCreatedByAndWeekStartAndDeletedFalse(eligible, WEEK_START)).isPresent();
        assertThat(estimates.existsByCreatedByAndDeletedFalse(nonLogging)).isFalse();

        runner.run(); // idempotent: re-running adds nothing
        entityManager.flush();
        entityManager.clear();

        long rowsForEligible = estimates.findAll().stream().filter(e -> eligible.equals(e.getCreatedBy())).count();
        assertThat(rowsForEligible).isEqualTo(1);
        assertThat(estimates.existsByCreatedByAndDeletedFalse(nonLogging)).isFalse();
    }

    @Test
    void backfillsTheExplanationOfALearnersLatestRow() {
        UUID owner = seedEligibleUser();
        runner.run();
        entityManager.flush();
        entityManager.clear();
        ExpenditureEstimateEntity first = estimates.findByCreatedByAndWeekStartAndDeletedFalse(owner, WEEK_START).orElseThrow();
        assertThat(first.getExplanation()).isNotNull();
        // A row written before the explainer existed (mezo-y72o3): no explanation yet.
        first.setExplanation(null);
        estimates.saveAndFlush(first);
        entityManager.clear();

        runner.run();
        entityManager.flush();
        entityManager.clear();

        ExpenditureEstimateEntity backfilled = estimates.findByCreatedByAndWeekStartAndDeletedFalse(owner, WEEK_START).orElseThrow();
        assertThat(backfilled.getId()).isEqualTo(first.getId()); // the same week re-reviewed in place
        assertThat(backfilled.getExplanation()).isNotNull();
        assertThat(backfilled.getExplanation().windowEnd()).isEqualTo(WEEK_END);
        assertThat(backfilled.getAppliedBaseKcal()).isEqualTo(first.getAppliedBaseKcal());
        assertThat(estimates.findAll().stream().filter(e -> owner.equals(e.getCreatedBy())).count()).isEqualTo(1);
    }

    /** Active, evaluated cut goal + a biometric profile + 35 days of meals and daily weigh-ins up
     *  to the reviewed week's end — mirrors {@code ExpenditureLearningServiceIT}'s fixture. */
    private UUID seedEligibleUser() {
        UUID owner = seedGoal("expenditure-rollout-");
        LocalDate first = WEEK_END.minusDays(HISTORY_DAYS - 1L);
        BigDecimal weight = new BigDecimal("84.20");
        for (int i = 0; i < HISTORY_DAYS; i++) {
            LocalDate d = first.plusDays(i);
            mealPopulator.createMealWithItems(owner, d, "lunch",
                List.of(new MealPopulator.Line("Rollout day", "2000", "150", "200", "70", (short) 1)));
            weightLogPopulator.createWeightLog(owner, d, weight.setScale(2, RoundingMode.HALF_UP));
            weight = weight.subtract(new BigDecimal("0.05"));
        }
        evaluate(owner);
        return owner;
    }

    /** Active, evaluated cut goal with weigh-ins but never a logged meal — not eligible to learn
     *  (mirrors {@code ExpenditureLearningServiceIT#aUserWhoNeverLogsFoodIsNotEligible}). */
    private UUID seedNonLoggingUser() {
        UUID owner = seedGoal("expenditure-rollout-nolog-");
        LocalDate first = WEEK_END.minusDays(HISTORY_DAYS - 1L);
        BigDecimal weight = new BigDecimal("84.20");
        for (int i = 0; i < HISTORY_DAYS; i++) {
            weightLogPopulator.createWeightLog(owner, first.plusDays(i), weight.setScale(2, RoundingMode.HALF_UP));
            weight = weight.subtract(new BigDecimal("0.05"));
        }
        evaluate(owner);
        return owner;
    }

    private UUID seedGoal(String emailPrefix) {
        UUID owner = databasePopulator.populateUser(emailPrefix + UUID.randomUUID() + "@test.local");
        profilePopulator.create(owner);
        GoalEntity goal = goalPopulator.createGoal(owner, "cut", "active");
        goal.setStartDate(WEEK_START.minusYears(1));
        goal.setTargetDate(WEEK_START.plusYears(1));
        goalRepository.saveAndFlush(goal);
        return owner;
    }

    private void evaluate(UUID owner) {
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active").get(0);
        goalEngineService.evaluate(owner, goal.getId());
    }
}
