package io.mrkuhne.mezo.feature.biometrics.weight.service;

import io.mrkuhne.mezo.api.dto.WeightTrendPoint;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The engine's weight-trend "spine": computes the EWMA-smoothed weight series and its
 * slope (kg/week and %BW/week) from the user's raw weigh-ins. Spec §4 — "the real rate is
 * the slope of the EWMA weight trend, never a fixed deficit projected forward."
 *
 * <p>Stateless, pure-deterministic, config-driven (half-life from {@link GoalEngineProperties});
 * no hardcoded smoothing constant. Read-only — no {@code @Transactional} (a single repository
 * read needs no transaction boundary). Consumed by the projection (Task 6) and rate-cap guard
 * (Task 7), and exposed verbatim via {@code GET /api/biometrics/weight/trend} (Task 10).
 *
 * <h2>Algorithm (all thresholds documented, none hardcoded beyond the rules below)</h2>
 * <ol>
 *   <li><b>Daily collapse:</b> multiple weigh-ins on the same calendar date are averaged into
 *       one observation, so the EWMA advances exactly one step per day (the filter assumes one
 *       observation per time step).</li>
 *   <li><b>EWMA:</b> {@code α = 1 − 0.5^(1/halfLifeDays)} (half-life from
 *       {@code props.ewma().halfLifeDays()}; default 10 → α ≈ 0.0670). Seeded with the first
 *       observation: {@code ewma[0] = w[0]}; {@code ewma[i] = α·w[i] + (1−α)·ewma[i−1]}.</li>
 *   <li><b>Weekly rate:</b> ordinary-least-squares slope of {@code trendKg} over time-in-days
 *       (a robust whole-window measure that resists single-point noise), expressed per week
 *       (slope × 7). {@code last4wRateKgPerWeek} is the same OLS slope over only the points
 *       within the last 28 days. {@code weeklyRatePctPerWeek = weeklyRateKgPerWeek /
 *       latestTrendKg × 100}.</li>
 *   <li><b>dataSufficiency:</b> {@code none} when &lt; 2 distinct days; {@code full} when the
 *       span is ≥ 21 days AND density ≥ 4 weigh-ins/week; otherwise {@code provisional}
 *       (&lt; 14-day span or thin density, per the research thresholds).</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class WeightTrendService {

    /** A weigh-in is "dense" when there are at least this many per week (research threshold). */
    private static final double DENSITY_LOGS_PER_WEEK_FULL = 4.0;

    /** Minimum span (days) for a {@code full} trend; below this the trend stays provisional. */
    private static final int FULL_SPAN_DAYS = 21;

    /** Trailing window (days) for {@code last4wRateKgPerWeek}. */
    private static final int LAST_4W_DAYS = 28;

    private static final int DAYS_PER_WEEK = 7;

    /** Output precision: kg trends/rates to 3 dp, percent to 3 dp. */
    private static final int SCALE = 3;

    private final WeightLogRepository repository;
    private final GoalEngineProperties props;

    /**
     * Compute the EWMA weight trend for one user. Always returns a non-null response; an empty
     * or single-day history yields {@code dataSufficiency=none} with zero rates and a (possibly
     * empty) series rather than throwing.
     */
    public WeightTrendResponse computeTrend(UUID userId) {
        // 1. Collapse to one observation per calendar day (averaging same-day weigh-ins), date-asc.
        Map<LocalDate, BigDecimal> dailyMean = collapseToDailyMean(repository.findAllOwned(userId));

        if (dailyMean.isEmpty()) {
            return empty();
        }

        List<LocalDate> dates = new ArrayList<>(dailyMean.keySet());
        int n = dates.size();

        // 2. EWMA over the daily series, in date order.
        double alpha = 1.0 - Math.pow(0.5, 1.0 / props.ewma().halfLifeDays());
        double[] ewma = new double[n];
        List<WeightTrendPoint> series = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            double w = dailyMean.get(dates.get(i)).doubleValue();
            ewma[i] = (i == 0) ? w : alpha * w + (1 - alpha) * ewma[i - 1];
            series.add(new WeightTrendPoint(dates.get(i), scaled(ewma[i])));
        }

        double latestTrend = ewma[n - 1];

        // 3. Single distinct day → no slope is defined yet: none, zero rates.
        if (n < 2) {
            return new WeightTrendResponse(
                series, scaled(latestTrend), scaled(0), scaled(0), scaled(0), DataSufficiencyEnum.NONE);
        }

        LocalDate firstDate = dates.get(0);
        long spanDays = ChronoUnit.DAYS.between(firstDate, dates.get(n - 1));

        // OLS slope (kg/day) of the EWMA over time, ×7 → kg/week.
        double weeklyRateKg = weeklyRate(dates, ewma, firstDate, 0, n);

        // last-4w slope: only the points within the trailing 28-day window.
        LocalDate cutoff = dates.get(n - 1).minusDays(LAST_4W_DAYS);
        int from4w = 0;
        while (from4w < n && dates.get(from4w).isBefore(cutoff)) {
            from4w++;
        }
        double last4wRateKg = (n - from4w >= 2)
            ? weeklyRate(dates, ewma, dates.get(from4w), from4w, n)
            : weeklyRateKg; // not enough points in window → fall back to full-window slope

        double weeklyRatePct = latestTrend != 0 ? weeklyRateKg / latestTrend * 100.0 : 0.0;

        // 4. dataSufficiency from span + density.
        double logsPerWeek = spanDays > 0 ? (double) n / spanDays * DAYS_PER_WEEK : n;
        DataSufficiencyEnum sufficiency;
        if (spanDays >= FULL_SPAN_DAYS && logsPerWeek >= DENSITY_LOGS_PER_WEEK_FULL) {
            sufficiency = DataSufficiencyEnum.FULL;
        } else {
            sufficiency = DataSufficiencyEnum.PROVISIONAL;
        }

        return new WeightTrendResponse(
            series,
            scaled(latestTrend),
            scaled(weeklyRateKg),
            scaled(weeklyRatePct),
            scaled(last4wRateKg),
            sufficiency);
    }

    /**
     * OLS slope (kg/day) of {@code ewma[from..to)} against day-offset from {@code origin},
     * returned ×7 as kg/week. Caller guarantees {@code to - from >= 2}.
     */
    private double weeklyRate(List<LocalDate> dates, double[] ewma, LocalDate origin, int from, int to) {
        int m = to - from;
        double sumX = 0;
        double sumY = 0;
        double sumXY = 0;
        double sumXX = 0;
        for (int i = from; i < to; i++) {
            double x = ChronoUnit.DAYS.between(origin, dates.get(i));
            double y = ewma[i];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumXX += x * x;
        }
        double denom = m * sumXX - sumX * sumX;
        if (denom == 0) {
            return 0; // all points on the same day-offset — no slope defined
        }
        double slopePerDay = (m * sumXY - sumX * sumY) / denom;
        return slopePerDay * DAYS_PER_WEEK;
    }

    /** Average same-day weigh-ins; TreeMap keeps the result date-ascending. */
    private Map<LocalDate, BigDecimal> collapseToDailyMean(List<WeightLogEntity> rows) {
        Map<LocalDate, List<BigDecimal>> byDate = new TreeMap<>();
        for (WeightLogEntity row : rows) {
            byDate.computeIfAbsent(row.getDate(), d -> new ArrayList<>()).add(row.getWeightKg());
        }
        Map<LocalDate, BigDecimal> mean = new TreeMap<>();
        for (Map.Entry<LocalDate, List<BigDecimal>> e : byDate.entrySet()) {
            BigDecimal sum = e.getValue().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            mean.put(e.getKey(), sum.divide(BigDecimal.valueOf(e.getValue().size()), SCALE + 2, RoundingMode.HALF_UP));
        }
        return mean;
    }

    private WeightTrendResponse empty() {
        return new WeightTrendResponse(
            new ArrayList<>(), scaled(0), scaled(0), scaled(0), scaled(0), DataSufficiencyEnum.NONE);
    }

    private static BigDecimal scaled(double value) {
        return BigDecimal.valueOf(value).setScale(SCALE, RoundingMode.HALF_UP);
    }
}
