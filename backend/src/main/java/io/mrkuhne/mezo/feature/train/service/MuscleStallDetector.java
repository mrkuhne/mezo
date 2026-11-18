package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Per-muscle stall rule (mezo-r36n9.79, spec §6.7.4): an exercise "moved" in a week when its LOGGED top
 * set (heaviest, then most reps) beat the previous week's in weight, or equal weight with more reps; a
 * lighter or equal top set is a hold. A muscle is stalled when no exercise moved over the last
 * {@code weeks} week-on-week comparisons and at least one exercise has all of them (so {@code weeks + 1}
 * consecutive weeks of data). A missing week is no data, never a hold. Pure, no Spring/DB.
 */
public final class MuscleStallDetector {
    private MuscleStallDetector() {}

    /** The top working set of one exercise identity in one run week; null weight = bodyweight (0). */
    public record TopSet(int week, BigDecimal weightKg, int reps) {
        BigDecimal kg() {
            return weightKg == null ? BigDecimal.ZERO : weightKg;
        }
    }

    /** The window ends at the newest week of data. */
    public static boolean stalled(Map<String, List<TopSet>> seriesByExercise, int weeks) {
        int latest = seriesByExercise.values().stream().flatMap(List::stream)
            .mapToInt(TopSet::week).max().orElse(0);
        return stalled(seriesByExercise, weeks, latest);
    }

    /** The window ends at {@code latestWeek} (the last week that can have been trained). */
    public static boolean stalled(Map<String, List<TopSet>> seriesByExercise, int weeks, int latestWeek) {
        boolean someFull = false;
        for (List<TopSet> series : seriesByExercise.values()) {
            Map<Integer, TopSet> byWeek = new java.util.HashMap<>();
            series.stream().sorted(Comparator.comparingInt(TopSet::week)).forEach(x -> byWeek.put(x.week(), x));
            int compared = 0;
            for (int w = latestWeek; w > latestWeek - weeks; w--) {
                TopSet now = byWeek.get(w);
                TopSet before = byWeek.get(w - 1);
                if (now == null || before == null) {
                    continue; // a missing week is no comparison
                }
                if (moved(before, now)) {
                    return false;
                }
                compared++;
            }
            someFull |= compared == weeks;
        }
        return someFull;
    }

    private static boolean moved(TopSet before, TopSet now) {
        int c = now.kg().compareTo(before.kg());
        return c > 0 || (c == 0 && now.reps() > before.reps());
    }
}
