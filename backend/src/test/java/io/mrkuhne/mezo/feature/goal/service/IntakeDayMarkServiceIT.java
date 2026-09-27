package io.mrkuhne.mezo.feature.goal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureLearningService;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.IntakeDayMarkRepository;
import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Owner day marks (mezo-3n2so, spec §7): a mark on a day in an already-reviewed week re-chains that
 * week and every later one in the same transaction and recomputes the goal once. The reviewed weeks
 * W1 &lt; W2 &lt; W3 are the three Mondays before the current week — anchored to {@code now()}'s
 * Monday because the re-chain only touches weeks before the current one.
 */
@Transactional
class IntakeDayMarkServiceIT extends AbstractIntegrationTest {

    private static final int HISTORY_DAYS = 49;
    private static final String DAILY_KCAL = "2000";

    @Autowired private IntakeDayMarkService service;
    @Autowired private ExpenditureLearningService learning;
    @MockitoSpyBean private GoalEngineService goalEngineService;
    @Autowired private ExpenditureEstimateRepository estimates;
    @Autowired private IntakeDayMarkRepository marks;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private DietSettingsRepository dietSettings;

    private LocalDate today;
    private LocalDate w1;
    private LocalDate w2;
    private LocalDate w3;
    private LocalDate suspicious;
    private UUID userId;
    private UUID goalId;

    @BeforeEach
    void anchor() {
        today = LocalDate.now();
        LocalDate current = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        w3 = current.minusWeeks(1);
        w2 = current.minusWeeks(2);
        w1 = current.minusWeeks(3);
        suspicious = w1.plusDays(2);
    }

    @Test
    void markInOlderWeekRechainsLaterWeeks() {
        seedLearner(true);
        int w1UsableBefore = row(w1).getUsableDays();
        int w3AppliedBefore = row(w3).getAppliedBaseKcal();

        IntakeDayMarkService.MarkResult result = service.mark(userId, suspicious, "COMPLETE");

        assertThat(row(w1).getUsableDays()).isEqualTo(w1UsableBefore + 1);
        assertThat(row(w1).getExcludedDays()).extracting(ExcludedIntakeDayJson::date).doesNotContain(suspicious);
        // The chain is consistent: each row steps from the previous row's (rewritten) applied base.
        assertThat(row(w2).getAppliedBaseKcal() - row(w2).getStepKcal()).isEqualTo(row(w1).getAppliedBaseKcal());
        assertThat(row(w3).getAppliedBaseKcal() - row(w3).getStepKcal()).isEqualTo(row(w2).getAppliedBaseKcal());
        assertThat(result.day()).isEqualTo(suspicious);
        assertThat(result.appliedBaseBeforeKcal()).isEqualTo(w3AppliedBefore);
        assertThat(result.appliedBaseAfterKcal()).isEqualTo(row(w3).getAppliedBaseKcal());
        assertThat(result.recomputed()).isTrue();

        // Equals a fresh weekly chain over the same data (the Monday run is idempotent on it).
        List<Integer> rechained = List.of(row(w1).getAppliedBaseKcal(), row(w2).getAppliedBaseKcal(),
            row(w3).getAppliedBaseKcal());
        learning.reviewWeek(userId, w1);
        learning.reviewWeek(userId, w2);
        learning.reviewWeek(userId, w3);
        assertThat(List.of(row(w1).getAppliedBaseKcal(), row(w2).getAppliedBaseKcal(), row(w3).getAppliedBaseKcal()))
            .isEqualTo(rechained);
    }

    @Test
    void rechainRecomputesGoalOnce() {
        seedLearner(true);
        clearInvocations(goalEngineService);

        IntakeDayMarkService.MarkResult result = service.mark(userId, suspicious, "COMPLETE");

        assertThat(result.recomputed()).isTrue();
        verify(goalEngineService, times(1)).recomputeActiveGoal(userId);
    }

    @Test
    void markInCurrentWeekSavesOnly() {
        seedLearner(true);
        List<Snapshot> before = snapshots();
        clearInvocations(goalEngineService);

        IntakeDayMarkService.MarkResult result = service.mark(userId, today, "INCOMPLETE");

        assertThat(snapshots()).isEqualTo(before);
        assertThat(result.recomputed()).isFalse();
        assertThat(result.appliedBaseAfterKcal()).isEqualTo(result.appliedBaseBeforeKcal());
        assertThat(marks.findByCreatedByAndDayAndDeletedFalse(userId, today)).get()
            .extracting(m -> m.getStatus()).isEqualTo("INCOMPLETE");
        verify(goalEngineService, times(0)).recomputeActiveGoal(userId);
    }

    @Test
    void dismissalSurvivesRechain() {
        seedLearner(true);
        OffsetDateTime dismissed = OffsetDateTime.parse("2026-09-20T08:00:00Z");
        ExpenditureEstimateEntity latest = row(w3);
        latest.setDismissedAt(dismissed);
        estimates.saveAndFlush(latest);

        service.mark(userId, suspicious, "COMPLETE");

        assertThat(row(w3).getDismissedAt()).isEqualTo(dismissed);
    }

    @Test
    void unloggedDayConflict() {
        seedLearner(true);
        LocalDate unlogged = today.minusYears(1);

        assertThatThrownBy(() -> service.mark(userId, unlogged, "COMPLETE"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(marks.findByCreatedByAndDayAndDeletedFalse(userId, unlogged)).isEmpty();
    }

    @Test
    void futureDayBadRequest() {
        seedLearner(true);

        assertThatThrownBy(() -> service.mark(userId, today.plusDays(1), "COMPLETE"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void clearRestoresRule() {
        seedLearner(true);
        service.mark(userId, suspicious, "COMPLETE");
        assertThat(row(w1).getExcludedDays()).extracting(ExcludedIntakeDayJson::date).doesNotContain(suspicious);

        IntakeDayMarkService.MarkResult result = service.clear(userId, suspicious);

        assertThat(row(w1).getExcludedDays()).extracting(ExcludedIntakeDayJson::date).contains(suspicious);
        assertThat(marks.findByCreatedByAndDayAndDeletedFalse(userId, suspicious)).isEmpty();
        assertThat(result.recomputed()).isTrue();
    }

    @Test
    void clearWithoutMarkIsANoOp() {
        seedLearner(true);
        List<Snapshot> before = snapshots();

        IntakeDayMarkService.MarkResult result = service.clear(userId, suspicious);

        assertThat(snapshots()).isEqualTo(before);
        assertThat(result.recomputed()).isFalse();
        assertThat(result.appliedBaseAfterKcal()).isEqualTo(result.appliedBaseBeforeKcal());
    }

    @Test
    void switchOffRechainStillRuns() {
        seedLearner(false);
        int w1UsableBefore = row(w1).getUsableDays();
        int w3AppliedBefore = row(w3).getAppliedBaseKcal();

        IntakeDayMarkService.MarkResult result = service.mark(userId, suspicious, "COMPLETE");

        assertThat(row(w1).getUsableDays()).isEqualTo(w1UsableBefore + 1);
        assertThat(result.recomputed()).isEqualTo(w3AppliedBefore != row(w3).getAppliedBaseKcal());
        assertThat(goalRepository.findById(goalId).orElseThrow().getTdeeBootstrap().baseSource())
            .isNotEqualTo("learned");
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private ExpenditureEstimateEntity row(LocalDate weekStart) {
        return estimates.findByCreatedByAndWeekStartAndDeletedFalse(userId, weekStart).orElseThrow();
    }

    private List<Snapshot> snapshots() {
        return estimates.findByCreatedByAndWeekStartGreaterThanEqualAndDeletedFalseOrderByWeekStartAsc(userId, w1)
            .stream().map(Snapshot::of).toList();
    }

    /** An active cut goal, 49 days of meals + falling weigh-ins up to W3's Sunday, today logged, W1→W3 reviewed. */
    private void seedLearner(boolean learningEnabled) {
        userId = databasePopulator.populateUser("day-mark-" + UUID.randomUUID() + "@test.local");
        profilePopulator.create(userId);
        GoalEntity goal = goalPopulator.createGoal(userId, "cut", "active");
        goal.setStartDate(w1.minusWeeks(4));
        goal.setTargetDate(w1.plusWeeks(16));
        goalRepository.saveAndFlush(goal);
        goalId = goal.getId();
        if (!learningEnabled) {
            setLearning(false);
        }
        goalEngineService.evaluate(userId, goalId);

        LocalDate last = w3.plusDays(6);
        LocalDate first = last.minusDays(HISTORY_DAYS - 1L);
        BigDecimal weight = new BigDecimal("84.20");
        for (int i = 0; i < HISTORY_DAYS; i++) {
            LocalDate d = first.plusDays(i);
            String kcal = d.equals(suspicious) ? "604" : DAILY_KCAL;
            mealPopulator.createMealWithItems(userId, d, "lunch",
                List.of(new MealPopulator.Line("Day mark day", kcal, "150", "200", "70", (short) 1)));
            weightLogPopulator.createWeightLog(userId, d, weight.setScale(2, RoundingMode.HALF_UP));
            weight = weight.subtract(new BigDecimal("0.05"));
        }
        mealPopulator.createMealWithItems(userId, today, "lunch",
            List.of(new MealPopulator.Line("Day mark today", DAILY_KCAL, "150", "200", "70", (short) 1)));

        learning.reviewWeek(userId, w1).orElseThrow();
        learning.reviewWeek(userId, w2).orElseThrow();
        learning.reviewWeek(userId, w3).orElseThrow();
        assertThat(row(w1).getExcludedDays()).extracting(ExcludedIntakeDayJson::date).contains(suspicious);
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

    private record Snapshot(LocalDate week, String status, int posterior, int applied, int step, int usable,
                            List<ExcludedIntakeDayJson> excluded) {
        static Snapshot of(ExpenditureEstimateEntity e) {
            return new Snapshot(e.getWeekStart(), e.getStatus(), e.getPosteriorBaseKcal(), e.getAppliedBaseKcal(),
                e.getStepKcal(), e.getUsableDays(), List.copyOf(e.getExcludedDays()));
        }
    }
}
