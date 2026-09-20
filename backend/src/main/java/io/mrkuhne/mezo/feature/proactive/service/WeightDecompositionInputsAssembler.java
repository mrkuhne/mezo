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
 * side for the covering segment ({@code segment.kcal() - segment.dailyEnergyBalanceKcal()},
 * scaled to the window's day count) — missing either side (no logged kcal, no active goal, no
 * covering segment, or a pre-slice-1 segment without {@code dailyEnergyBalanceKcal}) yields a
 * {@code null} surplus, which {@link WeightDecomposition} renders as an omitted ceiling row.
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

        Double trendDeltaKgPerWeek = null;
        try {
            var trend = weightTrendQuery.computeTrend(userId);
            if (trend != null && trend.getWeeklyRateKgPerWeek() != null) {
                trendDeltaKgPerWeek = trend.getWeeklyRateKgPerWeek().doubleValue();
            }
        } catch (RuntimeException e) {
            // Insufficient weight history for a trend read (e.g. not enough EWMA points) — the
            // row simply omits the trend segment rather than failing the whole diagnosis.
            trendDeltaKgPerWeek = null;
        }

        Double bodyweightKg = weekAvgKg;

        GoalEntity activeGoal = goalRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(userId, "active")
                .stream().findFirst().orElse(null);

        String goalTrajectory = activeGoal != null ? activeGoal.getTrajectory() : null;
        Double goalRatePctPerWeek = activeGoal != null && activeGoal.getRateTargetPctPerWeek() != null
                ? activeGoal.getRateTargetPctPerWeek().doubleValue() : null;

        Double weekKcalSurplus = kcalSurplus(userId, activeGoal, windowFrom, windowTo);

        Double e1rmTopDeltaPct = e1rmTopDeltaPct(userId);

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

    private Double kcalSurplus(UUID userId, GoalEntity activeGoal, LocalDate windowFrom, LocalDate windowTo) {
        Map<LocalDate, Double> kcalSeries =
                metricSeriesService.series(userId, MetricKey.DAILY_KCAL, windowFrom, windowTo);
        if (kcalSeries.isEmpty() || activeGoal == null || activeGoal.getStartDate() == null) {
            return null;
        }
        long week = ChronoUnit.DAYS.between(activeGoal.getStartDate(), windowFrom) / 7 + 1;
        GoalPrescriptionJson.Segment segment =
                GoalPrescriptionJson.currentSegment(activeGoal.getPrescription(), week);
        if (segment == null || segment.kcal() == null || segment.dailyEnergyBalanceKcal() == null) {
            return null;
        }
        double tdeePerDay = segment.kcal() - segment.dailyEnergyBalanceKcal();
        long windowDays = ChronoUnit.DAYS.between(windowFrom, windowTo) + 1;
        double loggedSum = kcalSeries.values().stream().mapToDouble(Double::doubleValue).sum();
        return loggedSum - (tdeePerDay * windowDays);
    }

    /**
     * The top-tracked exercise's e1RM story-curve delta (mezo-85x5r §2.4): the most recent
     * eligible point vs the one a week earlier, on whichever exercise has the most sessions
     * (the list is already sorted that way by {@link ExerciseRecordService#list}). {@code null}
     * when there is no such record or fewer than two points in its curve.
     */
    private Double e1rmTopDeltaPct(UUID userId) {
        List<io.mrkuhne.mezo.api.dto.ExerciseRecordResponse> records = exerciseRecordService.list(userId);
        if (records.isEmpty()) {
            return null;
        }
        var series = records.get(0).getE1rmSeries();
        if (series == null || series.size() < 2) {
            return null;
        }
        var sorted = series.stream()
                .sorted(Comparator.comparing(io.mrkuhne.mezo.api.dto.E1rmPoint::getDate))
                .toList();
        var latest = sorted.get(sorted.size() - 1);
        var previous = sorted.get(sorted.size() - 2);
        if (latest.getE1rm() == null || previous.getE1rm() == null
                || previous.getE1rm().doubleValue() == 0) {
            return null;
        }
        return (latest.getE1rm().doubleValue() - previous.getE1rm().doubleValue())
                / previous.getE1rm().doubleValue() * 100.0;
    }
}
