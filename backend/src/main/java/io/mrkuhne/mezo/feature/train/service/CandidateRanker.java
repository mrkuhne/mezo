package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties.Split;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Filters and ranks split candidates (mezo-r36n9.113, spec §5 S1.2). Pure, no Spring/DB. Only flawless candidates
 * are offered: every trained group ≥ 2×/week, every day within the session-minutes target (skipped without one),
 * no group with a heavy load on two consecutive calendar days (the evaluator's {@code consecutiveHeavy}, which
 * already exempts core/mobility). Survivors are ranked by (1) fewest muscles outside their band, (2) shortest
 * longest day, (3) catalogue order (= input order); at most {@link #MAX_OFFERED}. When none passes, the closest one
 * (among structurally sound splits if any: smallest overrun of the target, then the same order) comes back with the fixes the ranker can name on its own
 * ({@code more_minutes}, {@code more_days}); {@code fewer_emphasis} needs a re-generation, so the caller adds it.
 */
public final class CandidateRanker {
    private CandidateRanker() {}

    static final int MAX_OFFERED = 3;
    static final int MIN_FREQUENCY = 2;
    static final int MAX_DAYS = 6;
    static final int MINUTES_STEP = 15;

    public static final String FIX_MORE_MINUTES = "more_minutes";
    public static final String FIX_FEWER_EMPHASIS = "fewer_emphasis";
    public static final String FIX_MORE_DAYS = "more_days";

    /**
     * One evaluated candidate: its catalogue split, the evaluator's result, the session-minutes target (null = no
     * time filter) and its weekly warm-up sets (for the {@code more_warmups} reason).
     */
    public record Scored(Split split, PlanEvaluator.Result eval, Integer target, int warmupsPerWeek) {
        public Scored(Split split, PlanEvaluator.Result eval, Integer target) {
            this(split, eval, target, 0);
        }
    }

    /**
     * A wire fix code ({@code more_minutes|fewer_emphasis|more_days}) with its optional value and, for
     * {@code fewer_emphasis}, the Hangsúly muscle to lower.
     */
    public record Fix(String code, Integer value, String muscle) {
        public Fix(String code, Integer value) {
            this(code, value, null);
        }
    }

    /** A wire reason code ({@code fits_time|freq_2x|freq_high|more_warmups}) with its optional value. */
    public record Reason(String code, Integer value) {}

    /** {@code offered}: best first, max 3; when {@code nothingFits}, exactly the closest candidate. */
    public record Ranked(List<Scored> offered, boolean nothingFits, List<Fix> fixes) {}

    public static Ranked rank(List<Scored> all) {
        List<Scored> passing = all.stream().filter(CandidateRanker::passes).sorted(order(all)).toList();
        if (!passing.isEmpty()) {
            return new Ranked(passing.subList(0, Math.min(MAX_OFFERED, passing.size())), false, List.of());
        }
        if (all.isEmpty()) {
            return new Ranked(List.of(), true, List.of());
        }
        // closest = a structurally sound split (2×/week, no heavy back-to-back) with the smallest overrun; only when
        // none is sound does any candidate qualify
        List<Scored> sound = all.stream().filter(CandidateRanker::structurallySound).toList();
        Scored closest = (sound.isEmpty() ? all : sound).stream()
            .sorted(Comparator.comparingInt(CandidateRanker::overrun).thenComparing(order(all))).findFirst()
            .orElseThrow();
        List<Fix> fixes = new ArrayList<>();
        // more minutes help only a split that fails on time alone; at 6 days with no sound split the list stays empty
        if (structurallySound(closest) && !fitsTime(closest)) {
            fixes.add(new Fix(FIX_MORE_MINUTES, roundUpToFifteen(longestDay(closest))));
        }
        if (closest.split().types().size() < MAX_DAYS) {
            fixes.add(new Fix(FIX_MORE_DAYS, null));
        }
        return new Ranked(List.of(closest), true, List.copyOf(fixes));
    }

    public static boolean passes(Scored s) {
        return fitsTime(s) && structurallySound(s);
    }

    private static boolean structurallySound(Scored s) {
        return everyGroupTwice(s) && noHeavyConsecutive(s);
    }

    /**
     * Neutral or positive facts about {@code s} (only those that hold): {@code fits_time {longest day}} with a target,
     * {@code freq_high {perWeek}} when every trained group is hit ≥ 3×/week (full body) else {@code freq_2x} when
     * ≥ 2×, {@code more_warmups {extra}} when it has more weekly warm-up sets than {@code recommended}.
     */
    public static List<Reason> reasons(Scored s, Scored recommended) {
        List<Reason> out = new ArrayList<>();
        if (s.target() != null && fitsTime(s)) {
            out.add(new Reason("fits_time", longestDay(s)));
        }
        int freq = minFrequency(s);
        if (freq > MIN_FREQUENCY) {
            out.add(new Reason("freq_high", freq));
        } else if (freq == MIN_FREQUENCY) {
            out.add(new Reason("freq_2x", null));
        }
        int extra = s.warmupsPerWeek() - recommended.warmupsPerWeek();
        if (s != recommended && extra > 0) {
            out.add(new Reason("more_warmups", extra));
        }
        return List.copyOf(out);
    }

    public static int longestDay(Scored s) {
        return s.eval().days().stream().mapToInt(PlanEvaluator.DayResult::minutesEstimate).max().orElse(0);
    }

    static int roundUpToFifteen(int minutes) {
        return (minutes + MINUTES_STEP - 1) / MINUTES_STEP * MINUTES_STEP;
    }

    private static Comparator<Scored> order(List<Scored> catalogue) {
        return Comparator.comparingLong(CandidateRanker::outsideBand)
            .thenComparingInt(CandidateRanker::longestDay)
            .thenComparingInt(catalogue::indexOf);
    }

    private static long outsideBand(Scored s) {
        return s.eval().muscles().stream().filter(m -> m.fit() != PlanEvaluator.Fit.INSIDE).count();
    }

    private static int overrun(Scored s) {
        return s.target() == null ? 0 : Math.max(0, longestDay(s) - s.target());
    }

    private static boolean fitsTime(Scored s) {
        return s.target() == null || longestDay(s) <= s.target();
    }

    /** Distinct days carrying each trained group (≥ 1 counting set); the least of them, or 0 with none trained. */
    private static int minFrequency(Scored s) {
        return s.eval().muscles().stream().filter(m -> m.weeklySets() > 0)
            .mapToInt(m -> m.spread().size()).min().orElse(0);
    }

    private static boolean everyGroupTwice(Scored s) {
        return s.eval().muscles().stream().filter(m -> m.weeklySets() > 0)
            .allMatch(m -> m.spread().size() >= MIN_FREQUENCY);
    }

    private static boolean noHeavyConsecutive(Scored s) {
        return s.eval().muscles().stream().allMatch(m -> m.consecutiveHeavy().isEmpty());
    }
}
