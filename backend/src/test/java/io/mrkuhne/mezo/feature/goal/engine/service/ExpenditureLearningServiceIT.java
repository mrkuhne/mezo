package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.GoalSuggestionResponse;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.entity.IntakeDayMarkEntity;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.feature.goal.repository.IntakeDayMarkRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.GoalSuggestionPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
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
    /** One unlogged day inside the replay window (not in the reviewed week) — exercises the goal-balance drift. */
    private static final LocalDate UNLOGGED_DAY = LocalDate.of(2026, 9, 1);

    @Autowired private ExpenditureLearningService service;
    @Autowired private ExpenditureEstimateRepository estimates;
    @Autowired private GoalEngineService goalEngineService;
    @Autowired private GoalSuggestionService suggestionService;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalSuggestionRepository suggestionRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalSuggestionPopulator suggestionPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private EntityManager entityManager;
    @Autowired private IntakeDayMarkRepository marks;
    @Autowired private DietSettingsRepository dietSettings;

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
        assertThat(row.getAppliedBaseKcal()).isEqualTo(row.getFormulaBaseKcal() + row.getStepKcal());
        assertThat(row.getWeekStart()).isEqualTo(WEEK_START);
        assertThat(row.getUsableDays()).isEqualTo(7);
        assertThat(row.getWeighInDays()).isEqualTo(7);
        assertThat(row.getExcludedDays()).isEmpty();
    }

    @Test
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
    void theRunPersistsHowItLearned() {
        LocalDate suspicious = LocalDate.of(2026, 9, 16);
        seedUserAndGoal(null);
        seedMealsAndWeighIns(suspicious);
        evaluate();
        int planEat = goalRepository.findById(goalId).orElseThrow().getTdeeBootstrap().weeklyEatKcalPerDay()
            .setScale(0, RoundingMode.HALF_UP).intValueExact();

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();
        entityManager.flush();
        entityManager.clear();
        ExpenditureEstimateEntity reloaded = estimates.findById(row.getId()).orElseThrow();
        ExpenditureExplanationJson x = reloaded.getExplanation();

        assertThat(x).isNotNull();
        assertThat(x.windowEnd()).isEqualTo(WEEK_END);
        assertThat(x.windowStart()).isEqualTo(WEEK_END.minusDays(119));
        // 35 fixture days: one unlogged, one suspicious; the 85 empty days before them are not "unlogged".
        assertThat(x.dataStart()).isEqualTo(WEEK_END.minusDays(HISTORY_DAYS - 1L));
        assertThat(x.usableDays()).isEqualTo(33);
        assertThat(x.weighInDays()).isEqualTo(35);
        assertThat(x.unloggedDays()).isEqualTo(1);
        assertThat(x.historyWeeks()).isEqualTo(5);
        assertThat(x.avgIntakeKcal()).isEqualTo(2000);
        assertThat(x.avgMovementKcal()).isEqualTo(planEat); // no workouts: the plan's movement average on every usable day
        assertThat(x.startBaseKcal()).isEqualTo(row.getFormulaBaseKcal()); // no prior row, no adjustment
        assertThat(x.excludedDays()).containsExactly(new ExcludedIntakeDayJson(suspicious, 604, "suspicious"));
        // The scale falls 0.05 kg/day → ≈ −0.35 kg/week of tissue.
        assertThat(x.tissueRateKgPerWeek().doubleValue()).isCloseTo(-0.35, within(0.1));
        assertThat(x.simpleBaseKcal())
            .isEqualTo(x.avgIntakeKcal() - x.tissueKcalPerDay() - x.avgMovementKcal())
            .isCloseTo(row.getPosteriorBaseKcal(), within(250));
        assertThat(x.waterEvents()).isEmpty(); // constant carbs
        assertThat(x.series()).hasSize(56);
        assertThat(x.series().get(55).date()).isEqualTo(WEEK_END);
        ExpenditureExplanationJson.SeriesPoint flagged =
            x.series().stream().filter(p -> p.date().equals(suspicious)).findFirst().orElseThrow();
        assertThat(flagged.status()).isEqualTo("suspicious");
        assertThat(flagged.intakeKcal()).isEqualTo(604);
        assertThat(flagged.weightKg()).isNotNull();
        assertThat(flagged.trendKg()).isNotNull();
        assertThat(flagged.tissueKg()).isNotNull();
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
        UUID suggestionId = suggestionPopulator.createOpen(userId, goalId, "weekly_correction", "weekly:2026-09-14",
            new GoalSuggestionPayloadJson(
                "A mért trend lassabb a célnál — heti korrekció.", null, null, null, null, null, null, null,
                "2026-09-14", -120, new BigDecimal("-0.20"), new BigDecimal("-0.50"), false,
                5, 1800, 2000, OffsetDateTime.parse("2026-09-14T06:40:00Z"), new BigDecimal("0.70"), 0)).getId();
        assertThat(openWeeklyCorrections()).hasSize(1);

        service.reviewWeek(userId, WEEK_START).orElseThrow();

        assertThat(openWeeklyCorrections()).isEmpty();
        // A system retirement, not an owner decision: superseded, never dismissed.
        assertThat(suggestionRepository.findById(suggestionId).orElseThrow().getStatus()).isEqualTo("superseded");
    }

    @Test
    void aCutUsersCompliantDayIsJudgedAgainstTheServedTarget() {
        seedUserAndGoal(null);
        seedWeighIns();
        evaluate();
        // An existing learner: eligibility skipped, AND the fallback reference must use THIS row's
        // appliedBaseKcal (2500) — not formulaBase again — else a moved base is double-counted (§5).
        int priorApplied = 2500;
        seedPriorRow(WEEK_START.minusWeeks(1), priorApplied, -1, 2450, 150);
        GoalEntity goal = goalRepository.findById(goalId).orElseThrow();
        TdeeBootstrapJson boot = goal.getTdeeBootstrap();
        int planEat = boot.weeklyEatKcalPerDay().intValue();
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), WEEK_START) / 7 + 1;
        int balance = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week).dailyEnergyBalanceKcal();
        int servedTarget = priorApplied + planEat + balance;
        int maintenance = priorApplied + planEat;
        int compliant = 1400;
        // Fixture sanity: below 0.6 × the prior-applied-based maintenance, at/above 0.6 × the served
        // (cut) target computed off the SAME prior-applied base.
        assertThat(compliant).isLessThan((int) (0.6 * maintenance));
        assertThat(compliant).isGreaterThanOrEqualTo((int) Math.ceil(0.6 * servedTarget));
        // Only 4 logged days in total → every day has < 5 reference days → the fallback reference decides.
        for (int i = 0; i < 4; i++) {
            mealPopulator.createMealWithItems(userId, WEEK_START.plusDays(i), "lunch",
                List.of(new MealPopulator.Line("Learned exp day", String.valueOf(compliant), "150", "120", "50", (short) 1)));
        }

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        assertThat(row.getExcludedDays()).isEmpty();
        assertThat(row.getUsableDays()).isEqualTo(4);
    }

    @Test
    void anExistingLearnerWithoutWeighInsHoldsInsteadOfFallingBack() {
        seedUserAndGoal(null);
        seedMeals(null); // intake, but no weigh-in anywhere in the window → the filter has nothing to anchor on
        evaluate();
        seedPriorRow(WEEK_START.minusWeeks(1), 2500, -1, 2450, 150);

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        assertThat(row.getStatus()).isEqualTo("HOLDING");
        assertThat(row.getStepKcal()).isZero();
        assertThat(row.getAppliedBaseKcal()).isEqualTo(2500);
        assertThat(row.getDirection()).isEqualTo(-1);
        assertThat(row.getPosteriorBaseKcal()).isEqualTo(2450);
        assertThat(row.getPosteriorSdKcal()).isEqualTo(150);
        assertThat(row.getConfidence()).isEqualTo("MEDIUM");
        assertThat(row.getWeighInDays()).isZero();
        // Nothing to anchor on → the explanation still says what was seen, without a tissue line.
        ExpenditureExplanationJson x = row.getExplanation();
        assertThat(x.weighInDays()).isZero();
        assertThat(x.historyWeeks()).isZero();
        assertThat(x.startBaseKcal()).isEqualTo(2500);
        assertThat(x.tissueRateKgPerWeek()).isNull();
        assertThat(x.simpleBaseKcal()).isNull();
        assertThat(x.series()).hasSize(56).allSatisfy(p -> assertThat(p.trendKg()).isNull());
    }

    @Test
    void holdingWithoutAPreviousRowCarriesThePrior() {
        seedUserAndGoal(null);
        seedMeals(null);
        evaluate();
        seedPriorRow(WEEK_START, 2400, 1, 2400, 90); // only THIS week's earlier run exists — no previous week

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        int formula = row.getFormulaBaseKcal();
        assertThat(row.getStatus()).isEqualTo("HOLDING");
        assertThat(row.getStepKcal()).isZero();
        assertThat(row.getAppliedBaseKcal()).isEqualTo(formula);
        assertThat(row.getDirection()).isZero();
        assertThat(row.getPosteriorBaseKcal()).isEqualTo(formula);
        assertThat(row.getPosteriorSdKcal()).isEqualTo(300); // bootstrap-uncertainty-kcal
        assertThat(row.getConfidence()).isEqualTo("LOW");
    }

    @Test
    void aSecondWeekStepsFromThePriorAppliedBaseWithTheFullStep() {
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();
        int priorApplied = goalRepository.findById(goalId).orElseThrow().getTdeeBootstrap().neatBaselineKcal().intValue();
        seedPriorRow(WEEK_START.minusWeeks(1), priorApplied, -1, priorApplied, 150);

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        int delta = row.getPosteriorBaseKcal() - priorApplied;
        assertThat(delta).isLessThanOrEqualTo(-60); // a half step would visibly differ
        assertThat(row.getAppliedBaseKcal() - row.getStepKcal()).isEqualTo(priorApplied);
        assertThat(row.getDirection()).isEqualTo(-1);
        assertThat(row.getStepKcal()).isCloseTo(Math.max(-150, delta), within(1)); // confirmed direction: full step
    }

    @Test
    void anExplainerFailureNeverRollsBackTheWeeklyDecision() {
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();

        // The explainer is presentation on top of an already-decided week (mezo-y72o3): a bug in it
        // must never roll back the decision itself. Force it to blow up and assert the row still
        // lands with the normal decision, just without an explanation.
        try (MockedStatic<ExpenditureExplainer> explainer =
                 Mockito.mockStatic(ExpenditureExplainer.class, Mockito.CALLS_REAL_METHODS)) {
            explainer.when(() -> ExpenditureExplainer.explain(Mockito.any()))
                .thenThrow(new RuntimeException("boom"));

            ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

            assertThat(row.getStatus()).isEqualTo("UPDATED");
            assertThat(row.getStepKcal()).isBetween(-150, -1);
            assertThat(row.getAppliedBaseKcal()).isEqualTo(row.getFormulaBaseKcal() + row.getStepKcal());
            assertThat(row.getExplanation()).isNull();
        }
    }

    // ── Part 2 (mezo-3n2so): day marks + the learning switch ───────────────

    @Test
    void completeMarkMakesSuspiciousDayUsable() {
        LocalDate suspicious = LocalDate.of(2026, 9, 16);
        seedUserAndGoal(null);
        seedMealsAndWeighIns(suspicious);
        evaluate();
        mark(suspicious, "COMPLETE");

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        assertThat(row.getUsableDays()).isEqualTo(7); // 6 without the mark (suspiciousDaysAreExcludedAndListed)
        assertThat(row.getExcludedDays()).extracting(ExcludedIntakeDayJson::date).doesNotContain(suspicious);
    }

    @Test
    void incompleteMarkExcludesUsableDay() {
        LocalDate marked = LocalDate.of(2026, 9, 17);
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();
        mark(marked, "INCOMPLETE");

        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        assertThat(row.getExcludedDays()).containsExactly(new ExcludedIntakeDayJson(marked, 2000, "marked"));
        assertThat(row.getUsableDays()).isEqualTo(6);
    }

    @Test
    void switchOffStillLearnsButKeepsCorrectionOpen() {
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();
        setLearning(false);
        UUID suggestionId = openWeeklyCorrection();

        Optional<ExpenditureEstimateEntity> row = service.reviewWeek(userId, WEEK_START);

        assertThat(row).isPresent(); // learning continues silently
        assertThat(openWeeklyCorrections()).hasSize(1);
        assertThat(suggestionRepository.findById(suggestionId).orElseThrow().getStatus()).isEqualTo("proposed");
    }

    @Test
    void switchOffServesFormulaPlusAdjustment() {
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();
        setLearning(false);
        ExpenditureEstimateEntity row = service.reviewWeek(userId, WEEK_START).orElseThrow();

        goalEngineService.recomputeActiveGoal(userId);
        TdeeBootstrapJson off = goalRepository.findById(goalId).orElseThrow().getTdeeBootstrap();

        assertThat(off.baseSource()).isNotEqualTo("learned");
        assertThat(off.formulaNeatBaselineKcal()).isNull(); // no learned base served next to it
        assertThat(off.neatBaselineKcal().setScale(0, RoundingMode.HALF_UP).intValueExact())
            .isEqualTo(row.getFormulaBaseKcal());

        setLearning(true);
        goalEngineService.recomputeActiveGoal(userId);
        TdeeBootstrapJson on = goalRepository.findById(goalId).orElseThrow().getTdeeBootstrap();

        assertThat(on.baseSource()).isEqualTo("learned");
        assertThat(on.neatBaselineKcal()).isEqualByComparingTo(BigDecimal.valueOf(row.getAppliedBaseKcal()));
    }

    @Test
    void basisIsLearnedForLearner() {
        seedUserAndGoal(-120);
        seedMealsAndWeighIns(null);
        evaluate();

        service.reviewWeek(userId, WEEK_START).orElseThrow();

        GoalEntity goal = goalRepository.findById(goalId).orElseThrow();
        assertThat(goal.getBalanceAdjustmentKcal()).isNotZero();
        assertThat(goal.getPrescription().basis()).isEqualTo("learned");
    }

    // ── Task 4 (mezo-3n2so): live day statuses ─────────────────────────────

    @Test
    void dayStatusesReflectsAutoAndOwnerMarks() {
        LocalDate suspicious = LocalDate.of(2026, 9, 16);
        LocalDate confirmedComplete = LocalDate.of(2026, 9, 17);
        LocalDate markedIncomplete = LocalDate.of(2026, 9, 18);
        seedUserAndGoal(null);
        seedWeighIns();
        LocalDate first = WEEK_END.minusDays(HISTORY_DAYS - 1L);
        for (int i = 0; i < HISTORY_DAYS; i++) {
            LocalDate d = first.plusDays(i);
            if (d.equals(UNLOGGED_DAY)) {
                continue;
            }
            String kcal = (d.equals(suspicious) || d.equals(confirmedComplete)) ? "604" : DAILY_KCAL;
            mealPopulator.createMealWithItems(userId, d, "lunch",
                List.of(new MealPopulator.Line("Day status day", kcal, "150", "200", "70", (short) 1)));
        }
        evaluate();
        mark(confirmedComplete, "COMPLETE");
        mark(markedIncomplete, "INCOMPLETE");

        List<ExpenditureLearningService.DayStatus> days = service.dayStatuses(userId, WEEK_START, WEEK_END);

        assertThat(byDate(days, suspicious).status()).isEqualTo("suspicious");
        assertThat(byDate(days, suspicious).mark()).isNull();
        assertThat(byDate(days, confirmedComplete).status()).isEqualTo("confirmed_complete");
        assertThat(byDate(days, confirmedComplete).mark()).isEqualTo("complete");
        assertThat(byDate(days, markedIncomplete).status()).isEqualTo("marked_incomplete");
        assertThat(byDate(days, markedIncomplete).mark()).isEqualTo("incomplete");
        assertThat(byDate(days, WEEK_START).status()).isEqualTo("usable");
        assertThat(byDate(days, WEEK_START).mark()).isNull();
        assertThat(days).hasSize(7);
    }

    @Test
    void dayStatusesMarksAnUnloggedDayWithNoKcalAndNoMark() {
        seedUserAndGoal(null);
        seedMealsAndWeighIns(null);
        evaluate();

        List<ExpenditureLearningService.DayStatus> days = service.dayStatuses(userId, UNLOGGED_DAY, UNLOGGED_DAY);

        assertThat(days).hasSize(1);
        assertThat(days.get(0).status()).isEqualTo("unlogged");
        assertThat(days.get(0).kcal()).isNull();
        assertThat(days.get(0).mark()).isNull();
    }

    private static ExpenditureLearningService.DayStatus byDate(List<ExpenditureLearningService.DayStatus> days, LocalDate d) {
        return days.stream().filter(x -> x.date().equals(d)).findFirst()
            .orElseThrow(() -> new AssertionError("no day-status for " + d));
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private void mark(LocalDate day, String status) {
        IntakeDayMarkEntity m = new IntakeDayMarkEntity();
        m.setCreatedBy(userId);
        m.setDay(day);
        m.setStatus(status);
        marks.saveAndFlush(m);
    }

    private void setLearning(boolean enabled) {
        DietSettingsEntity row = dietSettings.findByCreatedByAndDeletedFalse(userId).orElseGet(() -> {
            DietSettingsEntity r = new DietSettingsEntity();
            r.setCreatedBy(userId);
            r.setSplitPreset("balanced");
            r.setProteinTier("moderate");
            r.setWaterMl(3000);
            r.setFiberG(30);
            r.setDayTypeShiftKcal(0);
            return r;
        });
        row.setLearningEnabled(enabled);
        dietSettings.saveAndFlush(row);
    }

    private UUID openWeeklyCorrection() {
        return suggestionPopulator.createOpen(userId, goalId, "weekly_correction", "weekly:2026-09-14",
            new GoalSuggestionPayloadJson(
                "A mért trend lassabb a célnál — heti korrekció.", null, null, null, null, null, null, null,
                "2026-09-14", -120, new BigDecimal("-0.20"), new BigDecimal("-0.50"), false,
                5, 1800, 2000, OffsetDateTime.parse("2026-09-14T06:40:00Z"), new BigDecimal("0.70"), 0)).getId();
    }

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
        seedMeals(suspiciousDay);
        seedWeighIns();
    }

    /** 35 days of one meal a day up to {@link #WEEK_END}, except {@link #UNLOGGED_DAY}. */
    private void seedMeals(LocalDate suspiciousDay) {
        LocalDate first = WEEK_END.minusDays(HISTORY_DAYS - 1L);
        for (int i = 0; i < HISTORY_DAYS; i++) {
            LocalDate d = first.plusDays(i);
            if (d.equals(UNLOGGED_DAY)) {
                continue;
            }
            String kcal = d.equals(suspiciousDay) ? "604" : DAILY_KCAL;
            mealPopulator.createMealWithItems(userId, d, "lunch",
                List.of(new MealPopulator.Line("Learned exp day", kcal, "150", "200", "70", (short) 1)));
        }
    }

    private void seedPriorRow(LocalDate week, int applied, int direction, int posterior, int sd) {
        ExpenditureEstimateEntity e = new ExpenditureEstimateEntity();
        e.setCreatedBy(userId);
        e.setWeekStart(week);
        e.setStatus("UPDATED");
        e.setFormulaBaseKcal(applied);
        e.setPosteriorBaseKcal(posterior);
        e.setPosteriorSdKcal(sd);
        e.setAppliedBaseKcal(applied);
        e.setStepKcal(0);
        e.setDirection(direction);
        e.setConfidence("MEDIUM");
        e.setUsableDays(7);
        e.setWeighInDays(7);
        e.setExcludedDays(List.of());
        estimates.saveAndFlush(e);
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
