package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.port.DailyIntakePort;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.IntakeDayMarkEntity;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.IntakeDayMarkRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.techcore.query.WeightTrendQuery;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly learned-expenditure run (mezo-zz91i, spec §5): gathers the window, classifies the
 * intake days, runs {@link ExpenditureFilter}, decides the step ({@link ExpenditureStepPolicy}),
 * upserts the week's {@code expenditure_estimate} row and recomputes the active goal so the new
 * base is served. Empty = the user is not (yet) a learning user — the caller falls back to the
 * weight-only weekly_correction suggestion (owner decision L4: never both). Once a row exists the
 * user stays a learner: a week the filter cannot anchor (no weigh-in) is written as HOLDING (§7).
 * The owner's day marks (mezo-3n2so) override the classifier; the learning switch never stops the
 * run — it only gates serving ({@link LearnedBaseResolver}) and the weight-only suggestion's retirement.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenditureLearningService {

    private static final String WEEKLY_CORRECTION = GoalSuggestionService.KIND_WEEKLY_CORRECTION;
    private static final String STATUS_ACTIVE = "active";

    private final GoalEngineProperties props;
    private final GoalRepository goalRepository;
    private final WeightTrendQuery weightQuery; // techcore seam: no goal → biometrics edge (frozen cycle)
    private final DailyIntakePort dailyIntake;
    private final WorkoutWindowQueryService workoutWindows;
    private final ExpenditureEstimateRepository estimates;
    private final GoalEngineService goalEngineService;
    private final GoalSuggestionService suggestionService;
    private final IntakeDayMarkRepository marks;
    private final DietPreferencesPort dietPreferences;

    @Transactional
    public Optional<ExpenditureEstimateEntity> reviewWeek(UUID userId, LocalDate weekStart) {
        GoalEngineProperties.Expenditure e = props.expenditure();
        if (!Boolean.TRUE.equals(e.enabled())) {
            return Optional.empty();
        }
        Optional<Replay> replayed = replay(userId, weekStart);
        if (replayed.isEmpty()) {
            return Optional.empty();
        }
        Replay rp = replayed.get();
        boolean existing = rp.prev().isPresent() || rp.thisWeek().isPresent();
        long recentUsable = rp.status().entrySet().stream()
            .filter(en -> !en.getKey().isBefore(rp.weekEnd().minusDays(27)))
            .filter(en -> en.getValue() == IntakeDayClassifier.Status.USABLE).count();
        if (!existing && recentUsable < e.minUsableDays()) {
            return Optional.empty();
        }
        Optional<ExpenditureFilter.Estimate> filtered = rp.traced().map(ExpenditureFilter.Traced::estimate);
        if (filtered.isEmpty() && !existing) {
            return Optional.empty();
        }
        return Optional.of(decideAndPersist(userId, weekStart, rp, filtered, e));
    }

    /**
     * Explain-only backfill (mezo-y72o3) for a row written before the "Hogy tanultam?" explainer:
     * replays the week and sets ONLY {@code explanation} on the stored row — status, posterior, applied
     * base, step, direction and confidence stay exactly as served, no goal recompute, no suggestion
     * change. The backfilled explanation reflects the data as of the backfill (a meal or weigh-in edited
     * since the original run shows in it), not necessarily the data the stored decision was made on.
     *
     * @return the updated row; empty when learning is off, the week has no row, or there is no active
     *         goal with a bootstrap to replay against
     */
    @Transactional
    public Optional<ExpenditureEstimateEntity> backfillExplanation(UUID userId, LocalDate weekStart) {
        GoalEngineProperties.Expenditure e = props.expenditure();
        if (!Boolean.TRUE.equals(e.enabled())) {
            return Optional.empty();
        }
        Optional<Replay> replayed = replay(userId, weekStart);
        if (replayed.isEmpty() || replayed.get().thisWeek().isEmpty()) {
            return Optional.empty();
        }
        Replay rp = replayed.get();
        ExpenditureEstimateEntity row = rp.thisWeek().get();
        row.setExplanation(explain(rp, e));
        return Optional.of(estimates.save(row));
    }

    /** Everything one week's run reads and replays, before any decision. */
    private record Replay(GoalEntity goal, TdeeBootstrapJson boot, int formulaBase, LocalDate windowStart,
                          LocalDate weekEnd, Map<LocalDate, Integer> kcal,
                          Map<LocalDate, IntakeDayClassifier.Status> status, Map<LocalDate, BigDecimal> weights,
                          List<ExpenditureFilter.Day> days, Optional<ExpenditureFilter.Traced> traced,
                          Optional<ExpenditureEstimateEntity> prev, Optional<ExpenditureEstimateEntity> thisWeek,
                          int prevApplied) {
    }

    /** Gathers the window, classifies the days and runs the filter; empty when there is no active goal with a bootstrap. */
    private Optional<Replay> replay(UUID userId, LocalDate weekStart) {
        GoalEngineProperties.Expenditure e = props.expenditure();
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE)
            .stream().findFirst().orElse(null);
        TdeeBootstrapJson boot = goal == null ? null : goal.getTdeeBootstrap();
        if (boot == null || boot.bmr() == null || boot.neatBaselineKcal() == null) {
            return Optional.empty();
        }
        int formulaBase = round(boot.formulaNeatBaselineKcal() != null
            ? boot.formulaNeatBaselineKcal() : boot.neatBaselineKcal());
        int planEat = round(boot.weeklyEatKcalPerDay() == null ? BigDecimal.ZERO : boot.weeklyEatKcalPerDay());
        int adjustment = goal.getBalanceAdjustmentKcal() == null ? 0 : goal.getBalanceAdjustmentKcal();
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate windowStart = weekEnd.minusDays(e.windowDays() - 1L);

        Map<LocalDate, Integer> kcal = new HashMap<>();
        Map<LocalDate, Integer> carbs = new HashMap<>();
        for (DailyIntakePort.DayIntake d : dailyIntake.between(userId, windowStart.minusDays(e.referenceDays()), weekEnd)) {
            kcal.put(d.date(), d.kcal());
            carbs.put(d.date(), d.carbsG());
        }
        Optional<ExpenditureEstimateEntity> prev =
            estimates.findFirstByCreatedByAndWeekStartBeforeAndDeletedFalseOrderByWeekStartDesc(userId, weekStart);
        Optional<ExpenditureEstimateEntity> thisWeek = estimates.findByCreatedByAndWeekStartAndDeletedFalse(userId, weekStart);
        // The served base for a day with a prior row is that row's applied base (adjustment already
        // folded in there) — not formulaBase + adjustment again, which double-counts a moved base.
        int prevApplied = prev.map(ExpenditureEstimateEntity::getAppliedBaseKcal).orElse(formulaBase + adjustment);

        // Too little own history → a day is judged against its SERVED target (spec §5.3), not maintenance.
        Map<LocalDate, IntakeDayClassifier.Status> status = IntakeDayClassifier.classify(windowStart, weekEnd, kcal,
            marksBetween(userId, windowStart.minusDays(e.referenceDays()), weekEnd), d -> prevApplied + planEat + balanceOn(goal, d),
            e.suspiciousRatio(), e.referenceDays(), e.minReferenceDays());

        Map<LocalDate, BigDecimal> weights = weightQuery.dailyMeanWeightKg(userId, windowStart, weekEnd);
        Map<LocalDate, WorkoutWindowQueryService.DayMovement> movement =
            workoutWindows.movementBetween(userId, windowStart, weekEnd);
        List<ExpenditureFilter.Day> days = new ArrayList<>();
        for (LocalDate d = windowStart; !d.isAfter(weekEnd); d = d.plusDays(1)) {
            boolean usable = status.get(d) == IntakeDayClassifier.Status.USABLE;
            var m = movement.getOrDefault(d, WorkoutWindowQueryService.DayMovement.NONE);
            days.add(new ExpenditureFilter.Day(d, usable ? kcal.get(d) : null, usable ? carbs.get(d) : null,
                planEat + m.extraKcal(), balanceOn(goal, d), weights.containsKey(d) ? weights.get(d).doubleValue() : null));
        }
        Optional<ExpenditureFilter.Traced> traced =
            ExpenditureFilter.runWithTrace(days, formulaBase, ExpenditureFilter.Params.of(props));
        return Optional.of(new Replay(goal, boot, formulaBase, windowStart, weekEnd, kcal, status, weights, days,
            traced, prev, thisWeek, prevApplied));
    }

    /**
     * The owner's day marks in [from, to] (mezo-3n2so): {@code true} = COMPLETE (the day counts even if
     * it looks suspicious), {@code false} = INCOMPLETE (excluded as "marked"); an unmarked day is absent.
     */
    Map<LocalDate, Boolean> marksBetween(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Boolean> out = new HashMap<>();
        for (IntakeDayMarkEntity m : marks.findByCreatedByAndDayBetweenAndDeletedFalse(userId, from, to)) {
            out.put(m.getDay(), "COMPLETE".equals(m.getStatus()));
        }
        return out;
    }

    private ExpenditureExplanationJson explain(Replay rp, GoalEngineProperties.Expenditure e) {
        return ExpenditureExplainer.explain(new ExpenditureExplainer.Input(rp.windowStart(), rp.weekEnd(), rp.days(),
            rp.status(), rp.kcal(), rp.traced().map(ExpenditureFilter.Traced::days).orElse(List.of()),
            rp.prevApplied(), props.kcalPerKg(), e.waterEventKg()));
    }

    /** Decides the step, upserts the week's row (explanation included) and serves it. */
    private ExpenditureEstimateEntity decideAndPersist(UUID userId, LocalDate weekStart, Replay rp,
                                                       Optional<ExpenditureFilter.Estimate> filtered,
                                                       GoalEngineProperties.Expenditure e) {
        LocalDate weekEnd = rp.weekEnd();
        int prevApplied = rp.prevApplied();
        int formulaBase = rp.formulaBase();
        int prevDirection = rp.prev().map(ExpenditureEstimateEntity::getDirection).orElse(0);
        int usableWeek = ExpenditureExplainer.count(rp.status(), weekStart, weekEnd, IntakeDayClassifier.Status.USABLE);
        int weighInWeek = (int) rp.weights().keySet().stream().filter(d -> !d.isBefore(weekStart)).count();
        ExpenditureFilter.Estimate est;
        ExpenditureStepPolicy.Result r;
        if (filtered.isPresent()) {
            est = filtered.get();
            r = ExpenditureStepPolicy.decide(new ExpenditureStepPolicy.Input(
                prevApplied, prevDirection, est.baseKcal(), est.sdKcal(), formulaBase,
                rp.boot().bmr().doubleValue(), usableWeek, weighInWeek), e);
        } else {
            // Spec §7: an existing learner is never handed back to the weight-only fallback — nothing to
            // anchor on (no weigh-in in the window) means HOLDING: the previous belief and base carried over.
            est = rp.prev().map(p -> new ExpenditureFilter.Estimate(p.getPosteriorBaseKcal(), p.getPosteriorSdKcal()))
                .orElse(new ExpenditureFilter.Estimate(formulaBase, props.bootstrapUncertaintyKcal()));
            r = new ExpenditureStepPolicy.Result(prevApplied, 0, prevDirection, ExpenditureStepPolicy.Status.HOLDING,
                ExpenditureStepPolicy.confidence(est.sdKcal(), e));
        }

        ExpenditureEstimateEntity row = rp.thisWeek().orElseGet(ExpenditureEstimateEntity::new);
        row.setCreatedBy(userId);
        row.setWeekStart(weekStart);
        row.setStatus(r.status().name());
        row.setFormulaBaseKcal(formulaBase);
        row.setPosteriorBaseKcal((int) Math.round(est.baseKcal()));
        row.setPosteriorSdKcal((int) Math.round(est.sdKcal()));
        row.setAppliedBaseKcal(r.appliedBase());
        row.setStepKcal(r.step());
        row.setDirection(r.direction());
        row.setConfidence(r.confidence().name());
        row.setUsableDays(usableWeek);
        row.setWeighInDays(weighInWeek);
        row.setExcludedDays(ExpenditureExplainer.excluded(rp.status(), rp.kcal(), weekStart, weekEnd));
        // The explainer is presentation on top of an already-decided week (spec §5): a bug in it must
        // never roll back the weekly decision itself. Store null and log rather than let it propagate.
        ExpenditureExplanationJson explanation = null;
        try {
            explanation = explain(rp, e);
        } catch (RuntimeException ex) {
            log.warn("expenditure explainer failed for user {} week {} — decision persisted without it",
                userId, weekStart, ex);
        }
        row.setExplanation(explanation);
        ExpenditureEstimateEntity saved = estimates.save(row);

        // Owner decision L4: a learning user never also gets the weight-only correction — unless the
        // learning switch is off (P3): then the learned base is not served and the correction stays.
        if (dietPreferences.resolve(userId).learningEnabled()) {
            suggestionService.supersedeOpen(rp.goal().getId(), WEEKLY_CORRECTION);
        }
        goalEngineService.recomputeActiveGoal(userId);
        return saved;
    }

    private static int round(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

    /**
     * The goal's daily energy balance on {@code date} — the drift the filter assumes on an unknown
     * day: the prescription segment covering its goal-week, else 0 (also before the goal started).
     */
    private static int balanceOn(GoalEntity goal, LocalDate date) {
        if (goal.getStartDate() == null || goal.getPrescription() == null || date.isBefore(goal.getStartDate())) {
            return 0;
        }
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
        GoalPrescriptionJson.Segment seg = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        return seg == null || seg.dailyEnergyBalanceKcal() == null ? 0 : seg.dailyEnergyBalanceKcal();
    }
}
