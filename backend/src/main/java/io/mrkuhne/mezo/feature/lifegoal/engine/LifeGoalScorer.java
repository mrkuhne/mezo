package io.mrkuhne.mezo.feature.lifegoal.engine;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Pure, side-effect-free lifegoal pillar scorer (spec §5 + D-2). No Spring context; consumed by
 * the Task 4-7 assembly services.
 */
public final class LifeGoalScorer {

    public static final double ARROW_THRESHOLD = 0.10;
    public static final int ARROW_SHORT_DAYS = 7;
    public static final int ARROW_LONG_DAYS = 21;
    public static final int ARROW_MIN_DATA_DAYS = 5;

    private static final int DEFAULT_AVERAGE_WINDOW_DAYS = 7;
    private static final int DEFAULT_BASELINE_WINDOW_DAYS = 28;
    private static final int DEFAULT_BASELINE_MIN_DATA_DAYS = 14;
    private static final BigDecimal LINKED_TOLERANCE = new BigDecimal("0.3");
    private static final double PARTIAL_BAND = 0.10;
    private static final int SCALE = 3;

    private LifeGoalScorer() {}

    /** Napi státusz fajtánként (alap-spec §5 + D-2). kind ∈ habit|average|target|baseline|linked. */
    public static PillarDayScore scoreDay(String kind, PillarRuleJson rule, LocalDate day, SignalWindow window) {
        return switch (kind) {
            case "habit" -> scoreHabit(rule, day, window);
            case "average" -> scoreAverage(rule, day, window);
            case "target" -> scoreTarget(rule, day, window);
            case "baseline" -> scoreBaseline(rule, day, window);
            case "linked" -> scoreLinked(day, window);
            default -> noData(null, null, null);
        };
    }

    private static PillarDayScore scoreHabit(PillarRuleJson rule, LocalDate day, SignalWindow window) {
        BigDecimal value = window.values().get(day);
        if (value == null) {
            return noData(null, round(rule.threshold()), null);
        }
        boolean good = isGoodSide(value, rule.threshold(), rule.comparator());
        return new PillarDayScore(good ? "hit" : "miss", round(value), round(rule.threshold()), null);
    }

    private static PillarDayScore scoreAverage(PillarRuleJson rule, LocalDate day, SignalWindow window) {
        int windowDays = rule.windowDays() != null ? rule.windowDays() : DEFAULT_AVERAGE_WINDOW_DAYS;
        List<BigDecimal> collected = new ArrayList<>();
        for (int i = 0; i < windowDays; i++) {
            BigDecimal v = window.values().get(day.minusDays(i));
            if (v != null) {
                collected.add(v);
            }
        }
        if (collected.isEmpty()) {
            return noData(null, round(rule.threshold()), null);
        }
        double avg = collected.stream().mapToDouble(BigDecimal::doubleValue).average().orElseThrow();
        boolean good = isGoodSide(avg, rule.threshold().doubleValue(), rule.comparator());
        String status;
        if (good) {
            status = "hit";
        } else {
            double threshold = rule.threshold().doubleValue();
            boolean withinBand = threshold != 0 && Math.abs(avg - threshold) / Math.abs(threshold) <= PARTIAL_BAND;
            status = withinBand ? "partial" : "miss";
        }
        return new PillarDayScore(status, round(avg), round(rule.threshold()), null);
    }

    private static PillarDayScore scoreTarget(PillarRuleJson rule, LocalDate day, SignalWindow window) {
        long total = ChronoUnit.DAYS.between(rule.startDate(), rule.targetDate());
        if (total <= 0) {
            return noData(null, null, null);
        }
        BigDecimal value = window.values().get(day);
        long elapsed = ChronoUnit.DAYS.between(rule.startDate(), day);
        double expected = rule.startValue().doubleValue()
            + (rule.targetValue().doubleValue() - rule.startValue().doubleValue()) * elapsed / (double) total;
        if (value == null) {
            return noData(null, round(expected), null);
        }
        boolean good = "down".equals(rule.direction())
            ? value.doubleValue() <= expected
            : value.doubleValue() >= expected;
        return new PillarDayScore(good ? "hit" : "miss", round(value), round(expected), null);
    }

    private static PillarDayScore scoreBaseline(PillarRuleJson rule, LocalDate day, SignalWindow window) {
        int windowDays = rule.windowDays() != null ? rule.windowDays() : DEFAULT_BASELINE_WINDOW_DAYS;
        int minDataDays = rule.minDataDays() != null ? rule.minDataDays() : DEFAULT_BASELINE_MIN_DATA_DAYS;
        List<BigDecimal> preceding = new ArrayList<>();
        for (int i = 1; i <= windowDays; i++) {
            BigDecimal v = window.values().get(day.minusDays(i));
            if (v != null) {
                preceding.add(v);
            }
        }
        BigDecimal value = window.values().get(day);
        if (preceding.size() < minDataDays || value == null) {
            return noData(value == null ? null : round(value), null, null);
        }
        double median = median(preceding);
        boolean good = "down".equals(rule.direction())
            ? value.doubleValue() < median
            : value.doubleValue() > median;
        return new PillarDayScore(good ? "hit" : "miss", round(value), null, round(median));
    }

    private static PillarDayScore scoreLinked(LocalDate day, SignalWindow window) {
        BigDecimal trend = window.values().get(day);
        Map<LocalDate, BigDecimal> targets = window.targets();
        BigDecimal expected = targets == null ? null : targets.get(day);
        if (trend == null || expected == null) {
            return noData(trend == null ? null : round(trend), expected == null ? null : round(expected), null);
        }
        boolean hit;
        if (targets.size() == 1) {
            hit = trend.subtract(expected).abs().compareTo(LINKED_TOLERANCE) <= 0;
        } else {
            LocalDate earliestDay = targets.keySet().stream().min(LocalDate::compareTo).orElseThrow();
            LocalDate latestDay = targets.keySet().stream().max(LocalDate::compareTo).orElseThrow();
            BigDecimal earliestVal = targets.get(earliestDay);
            BigDecimal latestVal = targets.get(latestDay);
            boolean losing = latestVal.compareTo(earliestVal) < 0;
            hit = losing
                ? trend.compareTo(expected.add(LINKED_TOLERANCE)) <= 0
                : trend.compareTo(expected.subtract(LINKED_TOLERANCE)) >= 0;
        }
        return new PillarDayScore(hit ? "hit" : "partial", round(trend), round(expected), null);
    }

    private static PillarDayScore noData(BigDecimal value, BigDecimal target, BigDecimal baseline) {
        return new PillarDayScore("no_data", value, target, baseline);
    }

    private static boolean isGoodSide(BigDecimal value, BigDecimal threshold, String comparator) {
        return "lte".equals(comparator) ? value.compareTo(threshold) <= 0 : value.compareTo(threshold) >= 0;
    }

    private static boolean isGoodSide(double value, double threshold, String comparator) {
        return "lte".equals(comparator) ? value <= threshold : value >= threshold;
    }

    private static double median(List<BigDecimal> values) {
        List<Double> sorted = values.stream().map(BigDecimal::doubleValue).sorted().toList();
        int n = sorted.size();
        int mid = n / 2;
        return n % 2 == 0 ? (sorted.get(mid - 1) + sorted.get(mid)) / 2.0 : sorted.get(mid);
    }

    private static BigDecimal round(double d) {
        return BigDecimal.valueOf(d).setScale(SCALE, RoundingMode.HALF_UP);
    }

    private static BigDecimal round(BigDecimal bd) {
        return bd == null ? null : bd.setScale(SCALE, RoundingMode.HALF_UP);
    }

    /** Súlyozott napi cél-pont: hit=1, partial=0.5, miss=0, no_data kimarad; mind no_data → null. */
    public static Double dailyPoint(List<WeightedStatus> statuses) {
        double weightedSum = 0;
        long totalWeight = 0;
        boolean anyData = false;
        for (WeightedStatus ws : statuses) {
            Double point = switch (ws.status()) {
                case "hit" -> 1.0;
                case "partial" -> 0.5;
                case "miss" -> 0.0;
                default -> null;
            };
            if (point == null) {
                continue;
            }
            anyData = true;
            weightedSum += ws.weight() * point;
            totalWeight += ws.weight();
        }
        if (!anyData || totalWeight == 0) {
            return null;
        }
        return weightedSum / totalWeight;
    }

    public record WeightedStatus(int weight, String status) {}

    /**
     * 7 vs 21 napos nyíl. series: nap → pont (0..1, null-mentes map — a no_data nap NINCS benne).
     * Return: up|flat|down|insufficient.
     */
    public static String arrow(Map<LocalDate, Double> series, LocalDate today) {
        List<Double> shortWindow = new ArrayList<>();
        for (int i = 0; i < ARROW_SHORT_DAYS; i++) {
            Double v = series.get(today.minusDays(i));
            if (v != null) {
                shortWindow.add(v);
            }
        }
        List<Double> longWindow = new ArrayList<>();
        for (int i = ARROW_SHORT_DAYS; i < ARROW_LONG_DAYS + ARROW_SHORT_DAYS; i++) {
            Double v = series.get(today.minusDays(i));
            if (v != null) {
                longWindow.add(v);
            }
        }
        if (shortWindow.size() < ARROW_MIN_DATA_DAYS || longWindow.size() < ARROW_MIN_DATA_DAYS) {
            return "insufficient";
        }
        double shortMean = shortWindow.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
        double longMean = longWindow.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
        double diff = shortMean - longMean;
        double epsilon = 1e-9;
        if (diff >= ARROW_THRESHOLD - epsilon) {
            return "up";
        }
        if (diff <= -ARROW_THRESHOLD + epsilon) {
            return "down";
        }
        return "flat";
    }
}
