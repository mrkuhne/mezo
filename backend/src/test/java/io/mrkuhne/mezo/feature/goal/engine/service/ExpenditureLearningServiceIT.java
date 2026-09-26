package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GoalSuggestionResponse;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.GoalSuggestionPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly learned-expenditure orchestrator (mezo-zz91i, spec §5): window gathering, the
 * suspicious-day exclusion, eligibility, idempotent upsert of the week's row, folding the accepted
 * correction into the first row, and retiring an open weight-only weekly_correction. Every date is
 * anchored to the fixed Monday {@link #WEEK_START} — never {@code now()} (midnight trap).
 */
@Transactional
class ExpenditureLearningServiceIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 9, 14);
    private static final LocalDate WEEK_END = LocalDate.of(2026, 9, 20);
    private static final int HISTORY_DAYS = 35;
    /**
     * Daily intake the fixture logs. Tuned from the brief's ~2600: with a 0.05 kg/day loss, 2600 kcal
     * implies a base ≈ 2985 — ABOVE this profile's formula base (≈ 2590), i.e. a positive step. 2000
     * implies ≈ 2385, below the formula, which is the downward step scenario 1 asserts.
     */
    private static final String DAILY_KCAL = "2000";

    @Autowired private ExpenditureLearningService service;
    @Autowired private ExpenditureEstimateRepository estimates;
    @Autowired private GoalEngineService goalEngineService;
    @Autowired private GoalSuggestionService suggestionService;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalSuggestionPopulator suggestionPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID userId;
    private UUID goalId;

    @Test
    void learnsAndServesTheBase() {
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        assertThat(row.getStatus()).isEqualTo("UPDATED");
        assertThat(row.getStepKcal()).isBetween(-150, -1);
        assertThat(row.getAppliedBaseKcal()).isEqualTo(row.getFormulaBaseKcal() + 0 + row.getStepKcal());
        assertThat(row.getWeekStart()).isEqualTo(WEEK_START);
        assertThat(row.getUsableDays()).isEqualTo(7);
        assertThat(row.getWeighInDays()).isEqualTo(7);
        assertThat(row.getExcludedDays()).isEmpty();
    }

    @Test
    @Disabled("enabled by Task 7 — serving")
    void learnsAndServesTheBase_goalServesTheLearnedBase() {
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        // Task 7
        TdeeBootstrapJson boot = goalRepository.findById(goalId).orElseThrow().getTdeeBootstrap();
        assertThat(boot.baseSource()).isEqualTo("learned");
        assertThat(boot.neatBaselineKcal()).isEqualByComparingTo(BigDecimal.valueOf(row.getAppliedBaseKcal()));
    }

    @Test
    void suspiciousDaysAreExcludedAndListed() {
        LocalDate suspicious = LocalDate.of(2026, 9, 16);
        seedUserAndGoal(null);
        seedMealsAndWeighIns(suspicious);
        evaluate();

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        assertThat(row.getExcludedDays()).containsExactly(new ExcludedIntakeDayJson(suspicious, 604, "suspicious"));
        assertThat(row.getUsableDays()).isEqualTo(6);
    }

    @Test
    void aUserWhoNeverLogsFoodIsNotEligible() {
        seedUserAndGoal(null);
        seedWeighIns();
        evaluate();

        Optional<ExpenditureEstimateEntity> result = service.reviewWeek(userId, WEEK_START);

        assertThat(result).isEmpty();
        assertThat(estimates.existsByCreatedByAndDeletedFalse(userId)).isFalse();
    }

    @Test
    void reRunningTheSameWeekIsIdempotent() {
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();

        ExpenditureEstimateEntity first = service.reviewWeek(userId, WEEK_START).orElseThrow();
        Snapshot a = Snapshot.of(first);
        ExpenditureEstimateEntity second = service.reviewWeek(userId, WEEK_START).orElseThrow();

        assertThat(Snapshot.of(second)).isEqualTo(a);
        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(estimates.findAll().stream().filter(e -> userId.equals(e.getCreatedBy())).count()).isEqualTo(1);
    }

    @Test
    void theFirstRowFoldsInTheAcceptedAdjustment() {
        seedUserAndGoal(-120);
        seedMealsAndWeighIns(null);
        evaluate();

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        // The step starts from formulaBase − 120 (the accepted weight-only correction), not the bare formula.
        assertThat(row.getAppliedBaseKcal() - row.getStepKcal()).isEqualTo(row.getFormulaBaseKcal() - 120);
    }

    @Test
    void learningDismissesAnOpenWeeklyCorrection() {
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();
        suggestionPopulator.createOpen(userId, goalId, "weekly_correction", "weekly:2026-09-14",
            new GoalSuggestionPayloadJson(
                "A mért trend lassabb a célnál — heti korrekció.", null, null, null, null, null, null, null,
                "2026-09-14", -120, new BigDecimal("-0.20"), new BigDecimal("-0.50"), false,
                5, 1800, 2000, OffsetDateTime.parse("2026-09-14T06:40:00Z"), new BigDecimal("0.70"), 0));
        assertThat(openWeeklyCorrections()).hasSize(1);

        service.reviewWeek(userId, WEEK_START).orElseThrow();

        assertThat(openWeeklyCorrections()).isEmpty();
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private List<GoalSuggestionResponse> openWeeklyCorrections() {
        return suggestionService.listOpen(userId, goalId).stream()
            .filter(s -> s.getKind() == GoalSuggestionResponse.KindEnum.WEEKLY_CORRECTION)
            .toList();
    }

    /** Active cut goal whose segment covers the fixture window (start 2026-08-17, a Monday). */
    private void seedUserAndGoal(Integer balanceAdjustmentKcal) {
        userId = databasePopulator.populateUser("learned-exp-" + UUID.randomUUID() + "@test.local");
        profilePopulator.create(userId);
        GoalEntity goal = goalPopulator.createGoal(userId, "cut", "active");
        goal.setStartDate(LocalDate.of(2026, 8, 17));
        goal.setTargetDate(LocalDate.of(2026, 12, 28));
        goal.setBalanceAdjustmentKcal(balanceAdjustmentKcal);
        goalRepository.saveAndFlush(goal);
        goalId = goal.getId();
    }

    private void evaluate() {
        goalEngineService.evaluate(userId, goalId);
    }

    /** 35 days up to {@link #WEEK_END}: one meal a day + a daily weigh-in trending down 0.05 kg/day. */
    private void seedMealsAndWeighIns(LocalDate suspiciousDay) {
        LocalDate first = WEEK_END.minusDays(HISTORY_DAYS - 1L);
        for (int i = 0; i < HISTORY_DAYS; i++) {
            LocalDate d = first.plusDays(i);
            String kcal = d.equals(suspiciousDay) ? "604" : DAILY_KCAL;
            mealPopulator.createMealWithItems(userId, d, "lunch",
                List.of(new MealPopulator.Line("Learned exp day", kcal, "150", "200", "70", (short) 1)));
        }
        seedWeighIns();
    }

    private void seedWeighIns() {
        LocalDate first = WEEK_END.minusDays(HISTORY_DAYS - 1L);
        BigDecimal weight = new BigDecimal("84.20");
        for (int i = 0; i < HISTORY_DAYS; i++) {
            weightLogPopulator.createWeightLog(userId, first.plusDays(i), weight.setScale(2, RoundingMode.HALF_UP));
            weight = weight.subtract(new BigDecimal("0.05"));
        }
    }

    private record Snapshot(String status, int formula, int posterior, int sd, int applied, int step, int direction,
                            String confidence, int usable, int weighIns, List<ExcludedIntakeDayJson> excluded) {
        static Snapshot of(ExpenditureEstimateEntity e) {
            return new Snapshot(e.getStatus(), e.getFormulaBaseKcal(), e.getPosteriorBaseKcal(), e.getPosteriorSdKcal(),
                e.getAppliedBaseKcal(), e.getStepKcal(), e.getDirection(), e.getConfidence(), e.getUsableDays(),
                e.getWeighInDays(), List.copyOf(e.getExcludedDays()));
        }
    }
}
