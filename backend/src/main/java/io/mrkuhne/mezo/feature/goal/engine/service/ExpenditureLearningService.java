package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.port.DailyIntakePort;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly learned-expenditure run (mezo-zz91i, spec §5): gathers the window, classifies the
 * intake days, runs {@link ExpenditureFilter}, decides the step ({@link ExpenditureStepPolicy}),
 * upserts the week's {@code expenditure_estimate} row and recomputes the active goal so the new
 * base is served. Empty = the user is not (yet) a learning user — the caller falls back to the
 * weight-only weekly_correction suggestion (owner decision L4: never both). Once a row exists the
 * user stays a learner: a week the filter cannot anchor (no weigh-in) is written as HOLDING (§7).
 */
@Service
@RequiredArgsConstructor
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

    @Transactional
    public Optional<ExpenditureEstimateEntity> reviewWeek(UUID userId, LocalDate weekStart) {
        GoalEngineProperties.Expenditure e = props.expenditure();
        if (!Boolean.TRUE.equals(e.enabled())) {
            return Optional.empty();
        }
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
        // Too little own history → a day is judged against its SERVED target (spec §5.3), not maintenance.
        Map<LocalDate, IntakeDayClassifier.Status> status = IntakeDayClassifier.classify(windowStart, weekEnd, kcal,
            Map.of(), d -> formulaBase + adjustment + planEat + balanceOn(goal, d),
            e.suspiciousRatio(), e.referenceDays(), e.minReferenceDays());

        Optional<ExpenditureEstimateEntity> prev =
            estimates.findFirstByCreatedByAndWeekStartBeforeAndDeletedFalseOrderByWeekStartDesc(userId, weekStart);
        Optional<ExpenditureEstimateEntity> thisWeek = estimates.findByCreatedByAndWeekStartAndDeletedFalse(userId, weekStart);
        boolean existing = prev.isPresent() || thisWeek.isPresent();
        long recentUsable = status.entrySet().stream()
            .filter(en -> !en.getKey().isBefore(weekEnd.minusDays(27)))
            .filter(en -> en.getValue() == IntakeDayClassifier.Status.USABLE).count();
        if (!existing && recentUsable < e.minUsableDays()) {
            return Optional.empty();
        }

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
        Optional<ExpenditureFilter.Estimate> filtered =
            ExpenditureFilter.run(days, formulaBase, ExpenditureFilter.Params.of(props));
        if (filtered.isEmpty() && !existing) {
            return Optional.empty();
        }

        int prevApplied = prev.map(ExpenditureEstimateEntity::getAppliedBaseKcal).orElse(formulaBase + adjustment);
        int prevDirection = prev.map(ExpenditureEstimateEntity::getDirection).orElse(0);
        int usableWeek = count(status, weekStart, weekEnd, IntakeDayClassifier.Status.USABLE);
        int weighInWeek = (int) weights.keySet().stream().filter(d -> !d.isBefore(weekStart)).count();
        ExpenditureFilter.Estimate est;
        ExpenditureStepPolicy.Result r;
        if (filtered.isPresent()) {
            est = filtered.get();
            r = ExpenditureStepPolicy.decide(new ExpenditureStepPolicy.Input(
                prevApplied, prevDirection, est.baseKcal(), est.sdKcal(), formulaBase,
                boot.bmr().doubleValue(), usableWeek, weighInWeek), e);
        } else {
            // Spec §7: an existing learner is never handed back to the weight-only fallback — nothing to
            // anchor on (no weigh-in in the window) means HOLDING: the previous belief and base carried over.
            est = prev.map(p -> new ExpenditureFilter.Estimate(p.getPosteriorBaseKcal(), p.getPosteriorSdKcal()))
                .orElse(new ExpenditureFilter.Estimate(formulaBase, props.bootstrapUncertaintyKcal()));
            r = new ExpenditureStepPolicy.Result(prevApplied, 0, prevDirection, ExpenditureStepPolicy.Status.HOLDING,
                ExpenditureStepPolicy.confidence(est.sdKcal(), e));
        }

        ExpenditureEstimateEntity row = thisWeek.orElseGet(ExpenditureEstimateEntity::new);
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
        row.setExcludedDays(excluded(status, kcal, weekStart, weekEnd));
        ExpenditureEstimateEntity saved = estimates.save(row);

        // Owner decision L4: a learning user never also gets the weight-only correction.
        suggestionService.supersedeOpen(goal.getId(), WEEKLY_CORRECTION);
        goalEngineService.recomputeActiveGoal(userId);
        return Optional.of(saved);
    }

    private static int round(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

    private static int count(Map<LocalDate, IntakeDayClassifier.Status> status, LocalDate from, LocalDate to,
                             IntakeDayClassifier.Status want) {
        return (int) status.entrySet().stream()
            .filter(en -> !en.getKey().isBefore(from) && !en.getKey().isAfter(to))
            .filter(en -> en.getValue() == want).count();
    }

    /** The week's excluded logged days (SUSPICIOUS → "suspicious", MARKED_INCOMPLETE → "marked"), date-ascending. */
    private static List<ExcludedIntakeDayJson> excluded(Map<LocalDate, IntakeDayClassifier.Status> status,
                                                        Map<LocalDate, Integer> kcal, LocalDate from, LocalDate to) {
        List<ExcludedIntakeDayJson> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            IntakeDayClassifier.Status s = status.get(d);
            if (s == IntakeDayClassifier.Status.SUSPICIOUS) {
                out.add(new ExcludedIntakeDayJson(d, kcal.get(d), "suspicious"));
            } else if (s == IntakeDayClassifier.Status.MARKED_INCOMPLETE) {
                out.add(new ExcludedIntakeDayJson(d, kcal.get(d), "marked"));
            }
        }
        return out;
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
