package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.techcore.query.WeightTrendQuery;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Assembles {@link WeightDecomposition.Inputs} for the anchored weight window (mezo-85x5r §2,
 * Task 4 Step 4) — one small package-private read-orchestration seam next to the pure decomposer
 * it feeds, so {@link WeightDecomposition} itself stays Spring-free and independently testable.
 *
 * <p>Reads: weekly weight averages fold multiple same-day weigh-ins to the day's LATEST entry
 * before averaging — the {@code FuelDayService#weekAvgWeightKg} idiom (mezo-d20.7.2) applied to
 * the anchor window and its immediately preceding week. Trend comes from the {@link
 * WeightTrendQuery} PORT (not {@code WeightTrendService} directly — Preflight, mezo-85x5r Task 4
 * brief). The active goal via {@link GoalRepository}. The kcal surplus is
 * {@code Σ DAILY_KCAL} (via {@link MetricSeriesService}) minus the active prescription's TDEE
 * side for the covering segment, scaled to the number of days ACTUALLY logged in the window
 * (never the window's calendar length — a partial week must not be compared against a full
 * week's TDEE) — missing either side (fewer than 4 logged days, no active goal, no covering
 * segment, or a pre-slice-1 segment without {@code dailyEnergyBalanceKcal}) yields a {@code null}
 * surplus, which {@link WeightDecomposition} renders as an omitted ceiling row.
 *
 * <p>{@code trendDeltaKgPerWeek} and {@code e1rmTopDeltaPct} are honest-omission fields (mezo-85x5r
 * final-review wave): both narrate what happened DURING the anchored window, so they are only
 * populated when that window is still current (its clamped end has reached today, i.e. the
 * running or just-closing week) — for a fully-past week they stay {@code null} rather than
 * silently reporting today's trend/e1RM as if it belonged to that week.
 */
@Service
@RequiredArgsConstructor
class WeightDecompositionInputsAssembler {

    private final WeightLogRepository weightLogRepository;
    private final WeightTrendQuery weightTrendQuery;
    private final GoalRepository goalRepository;
    private final MetricSeriesService metricSeriesService;
    private final ExerciseRecordService exerciseRecordService;

    WeightDecomposition.Inputs assemble(UUID userId, LocalDate windowFrom, LocalDate windowTo) {
        Map<LocalDate, BigDecimal> latestPerDay = latestPerDay(userId, windowFrom, windowTo);
        Double weekAvgKg = mean(latestPerDay.values());
        Integer weighInCount = latestPerDay.isEmpty() ? null : latestPerDay.size();
        Double rawMinKg = latestPerDay.values().stream().mapToDouble(BigDecimal::doubleValue).min().stream()
                .boxed().findFirst().orElse(null);
        Double rawMaxKg = latestPerDay.values().stream().mapToDouble(BigDecimal::doubleValue).max().stream()
                .boxed().findFirst().orElse(null);

        LocalDate prevTo = windowFrom.minusDays(1);
        LocalDate prevFrom = prevTo.minusDays(ChronoUnit.DAYS.between(windowFrom, windowTo));
        Double prevWeekAvgKg = mean(latestPerDay(userId, prevFrom, prevTo).values());

        // The window is CURRENT (running or just-closing) when its clamped end has reached
        // today — windowTo is never after today (callers clamp it), so this is really "has the
        // week fully elapsed yet". Only then do trend/e1RM narrate THIS window; a past week gets
        // null rather than today's numbers passed off as its own (mezo-85x5r final-review wave).
        boolean windowIsCurrent = !windowTo.isBefore(LocalDate.now());

        // WeightTrendQuery#computeTrend is documented to always return a non-null response (an
        // empty/single-day history yields dataSufficiency=none with zero rates) rather than
        // throwing, so no defensive catch is needed here (mezo-85x5r final-review wave).
        Double trendDeltaKgPerWeek = null;
        if (windowIsCurrent) {
            var trend = weightTrendQuery.computeTrend(userId);
            if (trend != null && trend.getWeeklyRateKgPerWeek() != null) {
                trendDeltaKgPerWeek = trend.getWeeklyRateKgPerWeek().doubleValue();
            }
        }

        Double bodyweightKg = weekAvgKg;

        GoalEntity activeGoal = goalRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(userId, "active")
                .stream().findFirst().orElse(null);

        String goalTrajectory = activeGoal != null ? activeGoal.getTrajectory() : null;
        Double goalRatePctPerWeek = activeGoal != null && activeGoal.getRateTargetPctPerWeek() != null
                ? activeGoal.getRateTargetPctPerWeek().doubleValue() : null;

        Double weekKcalSurplus = kcalSurplus(userId, activeGoal, windowFrom, windowTo);

        Double e1rmTopDeltaPct = windowIsCurrent ? e1rmTopDeltaPct(userId, windowFrom, windowTo) : null;

        return new WeightDecomposition.Inputs(
                weekAvgKg, prevWeekAvgKg, weighInCount,
                rawMinKg, rawMaxKg,
                trendDeltaKgPerWeek,
                weekKcalSurplus,
                bodyweightKg,
                goalTrajectory, goalRatePctPerWeek,
                e1rmTopDeltaPct);
    }

    /** Same-date weigh-ins folded to the day's LATEST entry (rows arrive date-asc, created-at-asc,
     *  so the last write for a date wins) — the {@code FuelDayService} weekly-average idiom. */
    private Map<LocalDate, BigDecimal> latestPerDay(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, BigDecimal> latestPerDay = new TreeMap<>();
        for (WeightLogEntity log : weightLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(userId, from, to)) {
            latestPerDay.put(log.getDate(), log.getWeightKg());
        }
        return latestPerDay;
    }

    private static Double mean(java.util.Collection<BigDecimal> values) {
        if (values.isEmpty()) {
            return null;
        }
        return values.stream().mapToDouble(BigDecimal::doubleValue).average().orElse(0.0);
    }

    /** Below this many logged days the week is too thin to compare against a full week's TDEE —
     *  the ceiling row is omitted (returns {@code null}) rather than scaled off a sparse sample. */
    private static final int MIN_LOGGED_DAYS_FOR_SURPLUS = 4;

    private Double kcalSurplus(UUID userId, GoalEntity activeGoal, LocalDate windowFrom, LocalDate windowTo) {
        Map<LocalDate, Double> kcalSeries =
                metricSeriesService.series(userId, MetricKey.DAILY_KCAL, windowFrom, windowTo);
        int loggedDayCount = kcalSeries.size();
        if (loggedDayCount < MIN_LOGGED_DAYS_FOR_SURPLUS
                || activeGoal == null || activeGoal.getStartDate() == null) {
            return null;
        }
        long week = ChronoUnit.DAYS.between(activeGoal.getStartDate(), windowFrom) / 7 + 1;
        GoalPrescriptionJson.Segment segment =
                GoalPrescriptionJson.currentSegment(activeGoal.getPrescription(), week);
        if (segment == null || segment.kcal() == null || segment.dailyEnergyBalanceKcal() == null) {
            return null;
        }
        double tdeePerDay = segment.kcal() - segment.dailyEnergyBalanceKcal();
        // Scale the TDEE side to the days ACTUALLY logged, not the window's calendar length — a
        // partial week (e.g. 3 of 7 days logged) must not be compared against a full week's TDEE,
        // which fabricates a phantom deficit/surplus for the unlogged days (mezo-85x5r wave).
        double loggedSum = kcalSeries.values().stream().mapToDouble(Double::doubleValue).sum();
        return loggedSum - (tdeePerDay * loggedDayCount);
    }

    /**
     * The TOP-tracked exercise's e1RM story-curve delta for the anchored window (mezo-85x5r §2.4,
     * final-review wave, ledger T4): "top" means the exercise with the HIGHEST recorded e1RM
     * value — picked explicitly by {@code max(bestE1rm)}, never by list order ({@link
     * ExerciseRecordService#list} sorts by session count, which is a different axis). The delta
     * compares that exercise's last point IN the window against its last point BEFORE the
     * window, both DATE-CHECKED against {@code [windowFrom, windowTo]} rather than blindly taking
     * "the last two points" of the curve. {@code null} when there is no e1RM record at all, or
     * either side of the comparison is missing.
     */
    private Double e1rmTopDeltaPct(UUID userId, LocalDate windowFrom, LocalDate windowTo) {
        List<io.mrkuhne.mezo.api.dto.ExerciseRecordResponse> records = exerciseRecordService.list(userId);
        io.mrkuhne.mezo.api.dto.ExerciseRecordResponse top = records.stream()
                .filter(r -> r.getBestE1rm() != null && r.getBestE1rm().getValue() != null)
                .max(Comparator.comparing(r -> r.getBestE1rm().getValue()))
                .orElse(null);
        if (top == null || top.getE1rmSeries() == null) {
            return null;
        }
        io.mrkuhne.mezo.api.dto.E1rmPoint inWindow = top.getE1rmSeries().stream()
                .filter(p -> p.getE1rm() != null && p.getDate() != null
                        && !p.getDate().isBefore(windowFrom) && !p.getDate().isAfter(windowTo))
                .max(Comparator.comparing(io.mrkuhne.mezo.api.dto.E1rmPoint::getDate))
                .orElse(null);
        io.mrkuhne.mezo.api.dto.E1rmPoint beforeWindow = top.getE1rmSeries().stream()
                .filter(p -> p.getE1rm() != null && p.getDate() != null && p.getDate().isBefore(windowFrom))
                .max(Comparator.comparing(io.mrkuhne.mezo.api.dto.E1rmPoint::getDate))
                .orElse(null);
        if (inWindow == null || beforeWindow == null || beforeWindow.getE1rm().doubleValue() == 0) {
            return null;
        }
        return (inWindow.getE1rm().doubleValue() - beforeWindow.getE1rm().doubleValue())
                / beforeWindow.getE1rm().doubleValue() * 100.0;
    }
}
