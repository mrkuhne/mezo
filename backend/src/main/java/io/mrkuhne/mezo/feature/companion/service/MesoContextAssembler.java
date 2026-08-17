package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.train.entity.json.MesoContextJson;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalDouble;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The lifestyle/wellbeing half of a closed mesocycle's report (mezo-meyc.3, S3): the run's window
 * bucketed into its meso-weeks, composed READ-ONLY from the owning features through
 * {@link MetricSeriesService} — the same companion→others direction the snapshot/digest use, never
 * back. The result is the TRAIN-owned {@link MesoContextJson}, persisted verbatim into
 * {@code mesocycle_report.context} by {@link MesoReviewGenerator}: the companion computes it, train
 * owns and freezes it (companion→train is the sanctioned dependency, see {@code MesoReviewGate}).
 *
 * <p><b>Honest absence, never a fabricated zero.</b> Every average and every measurement sum is
 * {@code null} when the bucket carries no datapoint at all — a week with no weigh-in must not read
 * as "0 kg change", and a week with no sport must not read as "0 minutes trained". The three ROW
 * COUNTS ({@code sportSessions}, {@code runSessions}, {@code mealCoverageDays}) are the exception:
 * their denominator (the bucket's calendar days) is known, so a 0 there is a fact, and it is what
 * makes the neighbouring averages readable ("7.5 h average — over 2 of 7 days").
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MesoContextAssembler {

    /** Every metric is a per-day scalar series; the buckets only ever average/sum/count them. */
    private static final List<MetricKey> METRICS = List.of(
        MetricKey.SLEEP_DURATION_H, MetricKey.SLEEP_QUALITY, MetricKey.DAILY_KCAL,
        MetricKey.DAILY_WATER_ML, MetricKey.CHECKIN_ENERGY, MetricKey.CHECKIN_STRESS,
        MetricKey.WEIGHT_DELTA_KG, MetricKey.SPORT_LOAD_MIN, MetricKey.TRAINING_RPE);

    private static final int SCALE = 2;

    private final MetricSeriesService metricSeriesService;
    private final FuelDayService fuelDayService;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;

    /**
     * Buckets {@code [startDate, endDate]} into meso-weeks W1..Wn and rolls every context source up
     * per bucket plus once over the whole window.
     *
     * <p>{@code n} is the week containing {@code endDate}, NOT {@code weeks}: a run closed early
     * genuinely has no week 5, and emitting an all-null bucket for it would be exactly the fabricated
     * shape this class refuses. All reads share one read-only transaction — the gym series traverse
     * LAZY associations ({@link MetricSeriesService#series}) and the fuel rollups are per-day.
     *
     * @param weeks the run's PLANNED length — only the clamp of the last bucket, never its count
     */
    @Transactional(readOnly = true)
    public MesoContextJson assemble(UUID userId, LocalDate startDate, LocalDate endDate, int weeks) {
        LocalDate to = endDate.isBefore(startDate) ? startDate : endDate;
        Sources sources = new Sources(
            seriesByMetric(userId, startDate, to),
            kcalTargets(userId, startDate, to),
            sessionsByDay(sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, startDate)
                .stream().map(s -> s.getDate()).toList(), to),
            sessionsByDay(runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, startDate)
                .stream().map(r -> r.getDate()).toList(), to));

        // TreeMap: the emitted weeks must be W1, W2, … in order — the FE renders them as a curve.
        Map<Integer, List<LocalDate>> daysByWeek = new TreeMap<>();
        List<LocalDate> windowDays = new ArrayList<>();
        for (LocalDate day = startDate; !day.isAfter(to); day = day.plusDays(1)) {
            daysByWeek.computeIfAbsent(weekOf(startDate, day, weeks), w -> new ArrayList<>()).add(day);
            windowDays.add(day);
        }

        List<MesoContextJson.Week> weekRows = daysByWeek.entrySet().stream()
            .map(entry -> week(entry.getKey(), entry.getValue(), sources))
            .toList();
        return new MesoContextJson(weekRows, totals(windowDays, sources));
    }

    /** Every source series a bucket can be rolled up from, keyed per day. */
    private record Sources(
        Map<MetricKey, Map<LocalDate, Double>> series,
        Map<LocalDate, Double> kcalTarget,
        Map<LocalDate, Double> sportSessions,
        Map<LocalDate, Double> runSessions) {

        Map<LocalDate, Double> of(MetricKey metric) {
            return series.get(metric);
        }
    }

    private MesoContextJson.Week week(int week, List<LocalDate> days, Sources s) {
        return new MesoContextJson.Week(
            week,
            avg(s.of(MetricKey.SLEEP_DURATION_H), days),
            avg(s.of(MetricKey.SLEEP_QUALITY), days),
            avg(s.of(MetricKey.DAILY_KCAL), days),
            avg(s.kcalTarget(), days),
            coverage(s.of(MetricKey.DAILY_KCAL), days),
            avg(s.of(MetricKey.DAILY_WATER_ML), days),
            avg(s.of(MetricKey.CHECKIN_ENERGY), days),
            avg(s.of(MetricKey.CHECKIN_STRESS), days),
            sum(s.of(MetricKey.WEIGHT_DELTA_KG), days),
            sum(s.of(MetricKey.SPORT_LOAD_MIN), days),
            count(s.sportSessions(), days),
            count(s.runSessions(), days),
            avg(s.of(MetricKey.TRAINING_RPE), days));
    }

    /**
     * The same rollups over the whole window — recomputed from the per-day series, never averaged
     * from the week buckets (an average of averages would silently re-weight a short last week).
     */
    private MesoContextJson.Totals totals(List<LocalDate> days, Sources s) {
        return new MesoContextJson.Totals(
            days.size(),
            avg(s.of(MetricKey.SLEEP_DURATION_H), days),
            avg(s.of(MetricKey.DAILY_KCAL), days),
            avg(s.of(MetricKey.CHECKIN_ENERGY), days),
            avg(s.of(MetricKey.CHECKIN_STRESS), days),
            sum(s.of(MetricKey.WEIGHT_DELTA_KG), days),
            sum(s.of(MetricKey.SPORT_LOAD_MIN), days),
            count(s.sportSessions(), days),
            count(s.runSessions(), days),
            coverage(s.of(MetricKey.DAILY_KCAL), days));
    }

    // ── sources ─────────────────────────────────────────────────────────────────

    private Map<MetricKey, Map<LocalDate, Double>> seriesByMetric(
            UUID userId, LocalDate from, LocalDate to) {
        Map<MetricKey, Map<LocalDate, Double>> byMetric = new EnumMap<>(MetricKey.class);
        for (MetricKey metric : METRICS) {
            byMetric.put(metric, metricSeriesService.series(userId, metric, from, to));
        }
        return byMetric;
    }

    /**
     * The kcal TARGET per day, from the one accessor that already resolves it (goal recept segment,
     * else the configured fallback — {@code ContextSnapshotAssembler#fuelBlock}'s source). Read
     * through {@link FuelDayService#getWeek}, the designated 7-day server aggregate, so a 6-week run
     * costs 6 calls instead of 42; days past {@code to} are dropped (the blocks are startDate-aligned,
     * so nothing lands before {@code from}).
     */
    private Map<LocalDate, Double> kcalTargets(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> targets = new HashMap<>();
        for (LocalDate block = from; !block.isAfter(to); block = block.plusDays(7)) {
            for (FuelDayRollup day : fuelDayService.getWeek(userId, block).getDays()) {
                MacroSet set = day.getTargets();
                if (!day.getDate().isAfter(to) && set != null && set.getKcal() != null) {
                    targets.put(day.getDate(), set.getKcal().doubleValue());
                }
            }
        }
        return targets;
    }

    /**
     * Session ROWS per day (several sessions can share a date). The repositories only expose the
     * open-ended {@code date >= from} finder, so the upper bound is applied in memory — the
     * {@link MetricSeriesService} idiom.
     */
    private static Map<LocalDate, Double> sessionsByDay(List<LocalDate> dates, LocalDate to) {
        Map<LocalDate, Double> counts = new HashMap<>();
        for (LocalDate date : dates) {
            if (date != null && !date.isAfter(to)) {
                counts.merge(date, 1.0, Double::sum);
            }
        }
        return counts;
    }

    // ── rollups ─────────────────────────────────────────────────────────────────

    /** Mean over the bucket's days that HAVE a value; null when none does. */
    private static Double avg(Map<LocalDate, Double> series, List<LocalDate> days) {
        OptionalDouble mean = days.stream().map(series::get).filter(Objects::nonNull)
            .mapToDouble(Double::doubleValue).average();
        return mean.isEmpty() ? null : round(mean.getAsDouble());
    }

    /** Σ over the bucket's days that HAVE a value; null when none does (never a fabricated 0). */
    private static Double sum(Map<LocalDate, Double> series, List<LocalDate> days) {
        List<Double> present = days.stream().map(series::get).filter(Objects::nonNull).toList();
        return present.isEmpty() ? null
            : round(present.stream().mapToDouble(Double::doubleValue).sum());
    }

    /** Σ of a per-day ROW COUNT — 0 means "no rows", a fact over a known day range. */
    private static double count(Map<LocalDate, Double> counts, List<LocalDate> days) {
        return days.stream().mapToDouble(day -> counts.getOrDefault(day, 0.0)).sum();
    }

    /** How many of the bucket's days carry a datapoint at all — the average's denominator. */
    private static double coverage(Map<LocalDate, Double> series, List<LocalDate> days) {
        return days.stream().filter(series::containsKey).count();
    }

    private static Double round(double value) {
        return BigDecimal.valueOf(value).setScale(SCALE, RoundingMode.HALF_UP).doubleValue();
    }

    /**
     * Inlined twin of train's package-private {@code MesoWeeks.weekOf} (spec DA1): 1-based,
     * {@code startDate}-anchored 7-day buckets, clamped to {@code [1, weeks]}. Deliberately NOT
     * imported — {@code MesoWeeks} is package-private in {@code feature.train.service} and widening
     * it for one caller would be the wrong trade; the two-line formula is pinned by
     * {@code MesoReviewGeneratorIT}'s week-boundary assertions.
     */
    private static int weekOf(LocalDate startDate, LocalDate date, int weeks) {
        long week = ChronoUnit.DAYS.between(startDate, date) / 7 + 1;
        return (int) Math.max(1, Math.min(weeks, week));
    }
}
