package io.mrkuhne.mezo.feature.goal.engine.service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Which logged days may teach the learned-expenditure filter (mezo-zz91i, spec §5.3, owner
 * decision L2). A day far below the user's OWN recent norm is SUSPICIOUS (probably partly logged)
 * and excluded by default — never read as low intake. A user mark wins in both directions.
 * Pure.
 */
public final class IntakeDayClassifier {

    public enum Status { USABLE, UNLOGGED, SUSPICIOUS, MARKED_INCOMPLETE }

    private IntakeDayClassifier() {
    }

    public static Map<LocalDate, Status> classify(LocalDate from, LocalDate to, Map<LocalDate, Integer> loggedKcal,
            Map<LocalDate, Boolean> marks, int fallbackRefKcal, double ratio, int refDays, int minRef) {
        Map<LocalDate, Status> out = new LinkedHashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Integer kcal = loggedKcal.get(d);
            Boolean mark = marks.get(d);
            if (kcal == null || kcal <= 0) {
                out.put(d, Status.UNLOGGED);
            } else if (Boolean.FALSE.equals(mark)) {
                out.put(d, Status.MARKED_INCOMPLETE);
            } else if (Boolean.TRUE.equals(mark)) {
                out.put(d, Status.USABLE);
            } else {
                double ref = reference(d, loggedKcal, fallbackRefKcal, refDays, minRef);
                out.put(d, kcal < ratio * ref ? Status.SUSPICIOUS : Status.USABLE);
            }
        }
        return out;
    }

    /** Median logged kcal over the {@code refDays} before {@code d}; the fallback with fewer than {@code minRef}. */
    private static double reference(LocalDate d, Map<LocalDate, Integer> loggedKcal, int fallback, int refDays, int minRef) {
        int[] vals = java.util.stream.IntStream.rangeClosed(1, refDays)
            .mapToObj(i -> loggedKcal.get(d.minusDays(i)))
            .filter(v -> v != null && v > 0)
            .mapToInt(Integer::intValue).sorted().toArray();
        if (vals.length < minRef) {
            return fallback;
        }
        int n = vals.length;
        return n % 2 == 1 ? vals[n / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2.0;
    }
}
