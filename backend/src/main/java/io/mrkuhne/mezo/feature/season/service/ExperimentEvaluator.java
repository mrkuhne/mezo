package io.mrkuhne.mezo.feature.season.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The verdict of one finished experiment (Boop B6 Évad S4, spec §5.9) — pure, no Spring, no clock. Each watched
 * signal's window days are compared with the same number of baseline days before the start as Cliff's delta (the
 * pairwise wins − losses share, the maths of the companion's {@code EffectLinkCalculator}, copied so the season does
 * not depend on the companion): robust to ties and outliers at the 5–28 point sizes an experiment yields.
 *
 * <p>A signal is {@code clear} with at least {@link #MIN_DAYS} days on each side and |δ| ≥ {@link #CLEAR_DELTA};
 * {@code better} only when clear (resting HR lower, everything else higher). The verdict is {@code insufficient}
 * below {@code ceil(0.7 × lengthDays)} marked days — the signals are still returned so the phone can show the table,
 * but none of them {@code clear} and every {@code better} null, so no client can highlight a column — else {@code clear} when any signal is clear, else {@code none}.
 */
public final class ExperimentEvaluator {

    public static final int MIN_DAYS = 5;
    public static final double CLEAR_DELTA = 0.33;
    public static final double NEED_SHARE = 0.7;

    /** The canonical signal order (the contract's {@code SeasonExperimentSignalKey}). */
    public static final List<String> KEYS = List.of("sleep_min", "deep_min", "hrv_ms", "resting_hr", "energy", "mood",
        "morning_feel");

    public static final String VERDICT_CLEAR = "clear";
    public static final String VERDICT_NONE = "none";
    public static final String VERDICT_INSUFFICIENT = "insufficient";

    /** Another change inside the window: kind mesocycle | deload | kimelo | season, its day and one Hungarian line. */
    public record Overlap(String kind, LocalDate date, String text) {
    }

    public record Signal(String key, Double before, Double after, int nBefore, int nAfter, Double cliffsDelta,
                         boolean clear, Boolean better) {
    }

    public record Result(String verdict, List<Signal> signals, int markedDays, int needDays, List<Overlap> overlaps) {
    }

    private ExperimentEvaluator() {
    }

    /** {@code ceil(0.7 × lengthDays)} — the marked days a verdict needs. */
    public static int needDays(int lengthDays) {
        return (int) Math.ceil(NEED_SHARE * lengthDays - 1e-9);
    }

    public static Result evaluate(Map<String, Map<LocalDate, Double>> baseline, Map<String, Map<LocalDate, Double>> window,
                                  int markedDays, int lengthDays, List<Overlap> overlaps) {
        Set<String> keys = new LinkedHashSet<>();
        KEYS.stream().filter(k -> baseline.containsKey(k) || window.containsKey(k)).forEach(keys::add);
        keys.addAll(baseline.keySet());
        keys.addAll(window.keySet());
        List<Signal> signals = new ArrayList<>();
        for (String key : keys) {
            signals.add(signal(key, values(baseline.get(key)), values(window.get(key))));
        }
        int need = needDays(lengthDays);
        String verdict = markedDays < need ? VERDICT_INSUFFICIENT
            : signals.stream().anyMatch(Signal::clear) ? VERDICT_CLEAR : VERDICT_NONE;
        if (VERDICT_INSUFFICIENT.equals(verdict)) {
            // too few marked days: no signal may read as a finding (means, n and δ stay for the table)
            signals.replaceAll(x -> new Signal(x.key(), x.before(), x.after(), x.nBefore(), x.nAfter(), x.cliffsDelta(),
                false, null));
        }
        return new Result(verdict, List.copyOf(signals), markedDays, need, overlaps == null ? List.of() : List.copyOf(overlaps));
    }

    private static List<Double> values(Map<LocalDate, Double> series) {
        return series == null ? List.of() : series.values().stream().filter(v -> v != null && !v.isNaN()).toList();
    }

    private static Signal signal(String key, List<Double> before, List<Double> after) {
        Double delta = before.size() >= MIN_DAYS && after.size() >= MIN_DAYS ? cliffsDelta(after, before) : null;
        boolean clear = delta != null && Math.abs(delta) >= CLEAR_DELTA;
        Boolean better = clear ? ("resting_hr".equals(key) ? delta < 0 : delta > 0) : null;
        return new Signal(key, mean(before), mean(after), before.size(), after.size(), delta, clear, better);
    }

    /** δ = (#(a > b) − #(a < b)) / (|A|·|B|) over every pair; positive = the window ran higher. */
    static double cliffsDelta(List<Double> window, List<Double> baseline) {
        long wins = 0;
        long losses = 0;
        for (double a : window) {
            for (double b : baseline) {
                if (a > b) {
                    wins++;
                } else if (a < b) {
                    losses++;
                }
            }
        }
        return (double) (wins - losses) / ((long) window.size() * baseline.size());
    }

    private static Double mean(List<Double> xs) {
        return xs.isEmpty() ? null : xs.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
    }
}
