package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureLearningService;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Transactional;

/**
 * The mezo-32m82 one-shot rollout runner: re-estimates null-kcal sport/run sessions (Task 2's
 * {@code reestimateMissing}, uncovered until this IT) and re-evaluates every goal whose
 * {@code tdeeBootstrap.activityModel} predates {@link
 * io.mrkuhne.mezo.feature.train.service.ActivityEnergyModel#VERSION}. v3 (mezo-tb3s2): before that
 * re-evaluate, the goal's learned-expenditure history is re-chained ({@link
 * ExpenditureLearningService#rechainFrom}) from its earliest stored week. Idempotent: a second
 * {@code run()} touches nothing already migrated.
 */
@Transactional
class ActivityModelMigrationRunnerIT extends AbstractIntegrationTest {

    /** Both Mondays, spanning the learner's two stored weeks — safely in the past regardless of when this runs. */
    private static final LocalDate WEEK1_START = LocalDate.of(2026, 8, 10);
    private static final LocalDate WEEK2_START = LocalDate.of(2026, 8, 17);
    private static final LocalDate WEEK2_END = WEEK2_START.plusDays(6);
    private static final int HISTORY_DAYS = 42;
    private static final String DAILY_KCAL = "2000";

    @Autowired private ActivityModelMigrationRunner runner;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private SportSessionRepository sportSessionRepository;
    @Autowired private RunSessionLogRepository runSessionLogRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private EntityManager entityManager;
    @MockitoSpyBean private ExpenditureLearningService expenditureLearning;
    @Autowired private ExpenditureEstimateRepository estimates;
    @Autowired private GoalEngineService goalEngineService;

    /** The prototype-default profile (M, born 1991-03-01, 15% body fat) — mirrors
     *  {@code SportServiceIT#seedBody}/{@code bmrFor} (Katch-McArdle, matching {@code TdeeBootstrapService#bmr}). */
    private static BigDecimal bmrFor(String weightKg) {
        BigDecimal leanFraction = BigDecimal.ONE.subtract(
            new BigDecimal("15.0").divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        return new BigDecimal("370")
            .add(new BigDecimal("21.6").multiply(new BigDecimal(weightKg).multiply(leanFraction)));
    }

    /** {@code ActivityEnergyModel#netKcal} — {@code (met − 1) × bmr/24 × minutes/60}, HALF_UP. */
    private static int netKcal(BigDecimal bmrKcal, double met, int minutes) {
        BigDecimal rest = bmrKcal.divide(BigDecimal.valueOf(24), MathContext.DECIMAL64);
        BigDecimal kcal = BigDecimal.valueOf(met - 1).multiply(rest)
            .multiply(BigDecimal.valueOf(minutes)).divide(BigDecimal.valueOf(60), MathContext.DECIMAL64);
        return kcal.setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

    @Test
    void testRun_shouldReestimateSessionsAndRecomputeStaleGoals() {
        UUID owner = databasePopulator.populateUser("activity-model-rollout@test.local");
        profilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, LocalDate.of(2026, 6, 1), new BigDecimal("84.00"));

        GoalEntity goal = goalPopulator.createGoal(owner, "cut", "active");
        assertThat(goal.getTdeeBootstrap()).as("bootstrap null before evaluate").isNull();

        SportSessionEntity nullKcal = trainPopulator.createSportSession(owner, LocalDate.of(2026, 6, 2), 60);
        assertThat(nullKcal.getKcal()).isNull();

        SportSessionEntity typed = trainPopulator.createSportSession(owner, LocalDate.of(2026, 6, 3), 45);
        typed = trainPopulator.withKcal(typed, 350);

        RunningBlockEntity block = runningPopulator.createBlock(owner, "Alapozás blokk", "active");
        RunSessionLogEntity nullKcalRun = runningPopulator.createRunLog(
            owner, block.getId(), 3, "tue-sprint", LocalDate.of(2026, 6, 4), null, null, null, null, 40);
        assertThat(nullKcalRun.getKcal()).isNull();

        RunSessionLogEntity typedRun = runningPopulator.createRunLog(
            owner, block.getId(), 3, "thu-easy", LocalDate.of(2026, 6, 5), null, null, null, null, 30);
        typedRun.setKcal(280);
        typedRun.setKcalIsEstimate(false);
        typedRun = runSessionLogRepository.saveAndFlush(typedRun);

        runner.run();

        entityManager.flush();
        entityManager.clear();

        GoalEntity reloadedGoal = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloadedGoal.getTdeeBootstrap()).isNotNull();
        assertThat(reloadedGoal.getTdeeBootstrap().activityModel())
            .isEqualTo(io.mrkuhne.mezo.feature.train.service.ActivityEnergyModel.VERSION);
        assertThat(reloadedGoal.getPrescription()).as("prescription rewritten").isNotNull();
        assertThat(reloadedGoal.getPrescription().segments()).isNotEmpty();

        SportSessionEntity reloadedNullKcal = sportSessionRepository.findById(nullKcal.getId()).orElseThrow();
        assertThat(reloadedNullKcal.getKcal()).isNotNull();
        assertThat(reloadedNullKcal.getKcalIsEstimate()).isTrue();

        SportSessionEntity reloadedTyped = sportSessionRepository.findById(typed.getId()).orElseThrow();
        assertThat(reloadedTyped.getKcal()).isEqualTo(350);
        assertThat(reloadedTyped.getKcalIsEstimate()).isFalse();

        // rpeActual null -> moderate band -> run MET 9.3; net = (9.3 − 1) × bmr/24 × 40/60.
        int expectedRunKcal = netKcal(bmrFor("84.00"), 9.3, 40);
        RunSessionLogEntity reloadedNullKcalRun = runSessionLogRepository.findById(nullKcalRun.getId()).orElseThrow();
        assertThat(reloadedNullKcalRun.getKcal()).isEqualTo(expectedRunKcal);
        assertThat(reloadedNullKcalRun.getKcalIsEstimate()).isTrue();

        RunSessionLogEntity reloadedTypedRun = runSessionLogRepository.findById(typedRun.getId()).orElseThrow();
        assertThat(reloadedTypedRun.getKcal()).isEqualTo(280);
        assertThat(reloadedTypedRun.getKcalIsEstimate()).isFalse();

        var computedAtAfterFirstRun = reloadedGoal.getTdeeBootstrap().computedAt();

        runner.run();

        entityManager.flush();
        entityManager.clear();
        GoalEntity reloadedAgain = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloadedAgain.getTdeeBootstrap().computedAt())
            .as("second run is a no-op — the goal is no longer stale")
            .isEqualTo(computedAtAfterFirstRun);
    }

    @Test
    void testRun_v3_reChainsLearningHistoryAndReevaluatesTheStaleGoal() {
        UUID owner = seedLearner("activity-model-rollout-rechain@test.local");
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active").stream().findFirst()
            .orElseThrow();

        ExpenditureEstimateEntity row1Before = estimates.findByCreatedByAndWeekStartAndDeletedFalse(owner, WEEK1_START)
            .orElseThrow();
        ExpenditureEstimateEntity row2Before = estimates.findByCreatedByAndWeekStartAndDeletedFalse(owner, WEEK2_START)
            .orElseThrow();
        int appliedBefore1 = row1Before.getAppliedBaseKcal();
        int appliedBefore2 = row2Before.getAppliedBaseKcal();

        downgradeToV2AndInjectSplit(goal.getId());

        runner.run();

        entityManager.flush();
        entityManager.clear();

        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getTdeeBootstrap().activityModel())
            .as("v3 rollout re-evaluated the stale goal")
            .isEqualTo(3);
        assertThat(reloaded.getPrescription().segments())
            .as("segments are split-free after a v3 re-evaluate")
            .allSatisfy(seg -> {
                assertThat(seg.trainingDayKcal()).isNull();
                assertThat(seg.restDayKcal()).isNull();
            });

        ExpenditureEstimateEntity row1After = estimates.findByCreatedByAndWeekStartAndDeletedFalse(owner, WEEK1_START)
            .orElseThrow();
        ExpenditureEstimateEntity row2After = estimates.findByCreatedByAndWeekStartAndDeletedFalse(owner, WEEK2_START)
            .orElseThrow();

        // Both stored weeks were replayed by the rollout's rechain — a fresh replay of the same,
        // unchanged inputs is idempotent and reproduces exactly what got persisted (no updatedAt
        // column exists on this row to assert against instead).
        ExpenditureEstimateEntity freshWeek1 = expenditureLearning.reviewWeek(owner, WEEK1_START).orElseThrow();
        ExpenditureEstimateEntity freshWeek2 = expenditureLearning.reviewWeek(owner, WEEK2_START).orElseThrow();
        assertThat(row1After.getAppliedBaseKcal()).isEqualTo(freshWeek1.getAppliedBaseKcal());
        assertThat(row2After.getAppliedBaseKcal()).isEqualTo(freshWeek2.getAppliedBaseKcal());
        // Sanity: the rows were genuinely re-fitted (persisted again), not skipped — both still
        // carry a real applied base consistent with the earlier, pre-migration run.
        assertThat(row1After.getAppliedBaseKcal()).isEqualTo(appliedBefore1);
        assertThat(row2After.getAppliedBaseKcal()).isEqualTo(appliedBefore2);

        var computedAtAfterFirstRun = reloaded.getTdeeBootstrap().computedAt();

        runner.run();

        entityManager.flush();
        entityManager.clear();
        GoalEntity reloadedAgain = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloadedAgain.getTdeeBootstrap().computedAt())
            .as("second run is a no-op — the goal is no longer stale")
            .isEqualTo(computedAtAfterFirstRun);
    }

    @Test
    void testRun_reChainThrows_skipsThatGoalButStillMigratesTheOther() {
        UUID throwingOwner = seedLearner("activity-model-rollout-throws@test.local");
        UUID okOwner = seedLearner("activity-model-rollout-ok@test.local");
        GoalEntity throwingGoal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(throwingOwner, "active")
            .stream().findFirst().orElseThrow();
        GoalEntity okGoal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(okOwner, "active")
            .stream().findFirst().orElseThrow();

        downgradeToV2AndInjectSplit(throwingGoal.getId());
        downgradeToV2AndInjectSplit(okGoal.getId());

        doThrow(new RuntimeException("boom")).when(expenditureLearning).rechainFrom(eq(throwingOwner), any());

        runner.run();

        entityManager.flush();
        entityManager.clear();

        GoalEntity reloadedThrowing = goalRepository.findById(throwingGoal.getId()).orElseThrow();
        assertThat(reloadedThrowing.getTdeeBootstrap().activityModel())
            .as("the throwing owner's goal is skipped, not migrated")
            .isEqualTo(2);

        GoalEntity reloadedOk = goalRepository.findById(okGoal.getId()).orElseThrow();
        assertThat(reloadedOk.getTdeeBootstrap().activityModel())
            .as("the other goal is still migrated")
            .isEqualTo(3);
    }

    /** A learner with a v3 bootstrap and two stored, reviewed weeks (WEEK1_START, WEEK2_START). */
    private UUID seedLearner(String email) {
        UUID owner = databasePopulator.populateUser(email);
        profilePopulator.create(owner);

        GoalEntity goal = goalPopulator.createGoal(owner, "cut", "active");
        goal.setTargetDate(LocalDate.of(2026, 12, 28));
        goalRepository.saveAndFlush(goal);

        LocalDate first = WEEK2_END.minusDays(HISTORY_DAYS - 1L);
        BigDecimal weight = new BigDecimal("84.20");
        for (int i = 0; i < HISTORY_DAYS; i++) {
            LocalDate d = first.plusDays(i);
            mealPopulator.createMealWithItems(owner, d, "lunch",
                List.of(new MealPopulator.Line("Rollout day", DAILY_KCAL, "150", "200", "70", (short) 1)));
            weightLogPopulator.createWeightLog(owner, d, weight.setScale(2, RoundingMode.HALF_UP));
            weight = weight.subtract(new BigDecimal("0.05"));
        }

        goalEngineService.evaluate(owner, goal.getId());
        expenditureLearning.reviewWeek(owner, WEEK1_START);
        expenditureLearning.reviewWeek(owner, WEEK2_START);
        return owner;
    }

    /** Rewrites the goal to look like a pre-v3 record: {@code activityModel = 2} and a day-type
     *  kcal split on every segment — exactly what a real pre-rollout row still carries. */
    private void downgradeToV2AndInjectSplit(UUID goalId) {
        GoalEntity goal = goalRepository.findById(goalId).orElseThrow();
        TdeeBootstrapJson boot = goal.getTdeeBootstrap();
        goal.setTdeeBootstrap(new TdeeBootstrapJson(boot.bmr(), boot.neat(), boot.neatBaselineKcal(),
            boot.weeklyEatKcalPerDay(), boot.tdee(), boot.formula(), boot.computedAt(), 2, boot.baseSource(),
            boot.formulaNeatBaselineKcal(), boot.learnedSdKcal(), boot.learnedConfidence()));

        GoalPrescriptionJson p = goal.getPrescription();
        List<GoalPrescriptionJson.Segment> split = new ArrayList<>();
        for (GoalPrescriptionJson.Segment s : p.segments()) {
            split.add(new GoalPrescriptionJson.Segment(s.fromWeek(), s.toWeek(), s.label(), s.kcal(), s.proteinG(),
                s.carbsG(), s.fatG(), s.sleepTargetH(), s.restDays(), s.projectedRateKgPerWk(),
                s.dailyEnergyBalanceKcal(), s.kcal() + 100, s.kcal() - 100, s.rationale()));
        }
        goal.setPrescription(new GoalPrescriptionJson(p.generatedAt(), p.basis(), split, p.guardStatus(), p.feasibility()));
        goalRepository.saveAndFlush(goal);
    }
}
