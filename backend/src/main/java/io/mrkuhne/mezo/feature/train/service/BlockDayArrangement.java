package io.mrkuhne.mezo.feature.train.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.function.ToIntFunction;

/**
 * Re-arranges a running block's template days onto a new set of gym weekdays (mezo-r36n9.122, Évad spec §5.12-1) —
 * pure. The days keep their rotation order (sorted by weekday, a label that is not a weekday after them in list
 * order) and are laid onto the new weekdays in that order:
 * <ul>
 *   <li>same count — each day moves to the weekday at its place;</li>
 *   <li>more days — one copy at a time, the (day, place) pair the score likes best is inserted (a repeat of an
 *       existing day, its exercises included); ties repeat the first day at the end of the week;</li>
 *   <li>fewer days — of every way to keep the right number of days (order kept) the one the score likes best wins;
 *       ties drop the last days.</li>
 * </ul>
 * The score (lower is better) is the caller's — in production the plan evaluator's verdict on the laid-out week.
 */
public final class BlockDayArrangement {

    private BlockDayArrangement() {
    }

    public enum Change { KEEP, MOVE, ADD }

    /** A template day: {@code weekday} 0 = hétfő … 6 = vasárnap, −1 = a label that is not a weekday. */
    public record Day(UUID id, int weekday, String title) {
    }

    /** The re-arranged week, weekday order; {@code dropped} = days that leave the block. */
    public record Plan(List<Slot> slots, List<Day> dropped) {

        /** One gym day of the new week: which day's exercises it carries, and where they came from (null = no weekday). */
        public record Slot(int weekday, UUID sourceId, String title, Change change, Integer fromWeekday) {
        }

        public boolean changed() {
            return !dropped.isEmpty() || slots.stream().anyMatch(s -> s.change() != Change.KEEP);
        }
    }

    public static Plan arrange(List<Day> days, List<Integer> targetWeekdays, ToIntFunction<List<Plan.Slot>> score) {
        List<Day> ordered = new ArrayList<>(days);
        ordered.sort(Comparator.comparingInt(d -> d.weekday() < 0 ? Integer.MAX_VALUE : d.weekday()));
        List<Integer> targets = targetWeekdays.stream().distinct().sorted().toList();
        int n = ordered.size();
        int m = targets.size();
        if (m >= n) {
            List<Entry> week = new ArrayList<>(ordered.stream().map(d -> new Entry(d, false)).toList());
            for (int step = n; step < m && n > 0; step++) {
                week = bestInsertion(week, ordered, targets, score);
            }
            return new Plan(slots(week, targets), List.of());
        }
        List<Day> kept = bestSubset(ordered, m, targets, score);
        List<Day> dropped = ordered.stream().filter(d -> !kept.contains(d)).toList();
        return new Plan(slots(kept.stream().map(d -> new Entry(d, false)).toList(), targets), dropped);
    }

    private record Entry(Day day, boolean copy) {
    }

    private static List<Entry> bestInsertion(List<Entry> week, List<Day> sources, List<Integer> targets,
                                             ToIntFunction<List<Plan.Slot>> score) {
        List<Entry> best = null;
        int bestScore = Integer.MAX_VALUE;
        for (Day source : sources) {
            for (int at = week.size(); at >= 0; at--) {
                List<Entry> candidate = new ArrayList<>(week);
                candidate.add(at, new Entry(source, true));
                int s = score.applyAsInt(slots(candidate, targets));
                if (s < bestScore) {
                    best = candidate;
                    bestScore = s;
                }
            }
        }
        return best;
    }

    private static List<Day> bestSubset(List<Day> ordered, int m, List<Integer> targets,
                                        ToIntFunction<List<Plan.Slot>> score) {
        List<Day> best = List.of();
        int bestScore = Integer.MAX_VALUE;
        for (int[] pick : combinations(ordered.size(), m)) {
            List<Day> kept = new ArrayList<>(m);
            for (int i : pick) {
                kept.add(ordered.get(i));
            }
            int s = score.applyAsInt(slots(kept.stream().map(d -> new Entry(d, false)).toList(), targets));
            if (s < bestScore) {
                best = kept;
                bestScore = s;
            }
        }
        return best;
    }

    /** Every ascending {@code k}-subset of {@code 0..n-1}, lexicographic (so the first keeps the earliest days). */
    private static List<int[]> combinations(int n, int k) {
        List<int[]> out = new ArrayList<>();
        int[] c = new int[k];
        for (int i = 0; i < k; i++) {
            c[i] = i;
        }
        while (true) {
            out.add(c.clone());
            int i = k - 1;
            while (i >= 0 && c[i] == n - k + i) {
                i--;
            }
            if (i < 0) {
                return out;
            }
            c[i]++;
            for (int j = i + 1; j < k; j++) {
                c[j] = c[j - 1] + 1;
            }
        }
    }

    /** Lays the entries onto the first weekdays of {@code targets}, in order. */
    private static List<Plan.Slot> slots(List<Entry> week, List<Integer> targets) {
        List<Plan.Slot> out = new ArrayList<>(week.size());
        for (int i = 0; i < week.size() && i < targets.size(); i++) {
            Entry e = week.get(i);
            int to = targets.get(i);
            Integer from = e.day().weekday() < 0 ? null : e.day().weekday();
            Change change = e.copy() ? Change.ADD : (from != null && from == to ? Change.KEEP : Change.MOVE);
            out.add(new Plan.Slot(to, e.day().id(), e.day().title(), change, from));
        }
        return out;
    }
}
