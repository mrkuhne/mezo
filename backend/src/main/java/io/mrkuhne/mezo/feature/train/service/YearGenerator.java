package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.YearPlanProperties;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/**
 * The Éves terv rotation (mezo-r36n9.113): lays out a year of alternating upper/lower loading blocks with 1–2 focus
 * groups each, then one consolidation block. Pure and deterministic — every order comes from configuration.
 *
 * <p>Demand per group is 2 when emphasised, else 1 (an adopted block's focus counts as supplied). Too much demand
 * relaxes emphasis (last entry first → {@code emphasis_once}), then drops groups ({@code no_focus}); spare slots go
 * to second appearances in mav-descending order, then to single-focus blocks. Assignment is a backtracking search:
 * hard rules (no group twice in a block or in two consecutive blocks) always hold; soft rules (pair from the table,
 * no repeat in adjacent same-kind blocks) are dropped in that order when unsatisfiable ({@code pair_relaxed}).
 */
public final class YearGenerator {

    public static final String UPPER = "upper";
    public static final String LOWER = "lower";
    public static final String CONSOLIDATION = "consolidation";

    public static final String EMPHASIS_ONCE = "emphasis_once";
    public static final String NO_FOCUS = "no_focus";
    public static final String PAIR_RELAXED = "pair_relaxed";

    static final String INVALID = "VALIDATION_INVALID_VALUE";

    private static final int NODE_BUDGET = 500_000;

    private YearGenerator() {}

    public record Input(LocalDate start, List<String> emphasis, int blockWeeks, int consolidationWeeks,
                        Adopted adopted) {}

    public record Adopted(UUID mesocycleId, LocalDate mesoStart, int weeks, List<String> focus) {}

    public record Result(LocalDate start, List<Block> blocks, List<Note> relaxed) {}

    public record Block(int ordinal, String kind, List<String> focus, int weeks, boolean adopted, UUID mesocycleId) {}

    /** A relaxation: {@code group} set for emphasis_once / no_focus, {@code ordinal} for pair_relaxed. */
    public record Note(String code, String group, Integer ordinal) {}

    /**
     * @param mav the baseline mav per group ({@code mezo.volume.baselines}); orders second appearances
     *            (descending, ties in config group order). Must cover every configured kind group (400 otherwise).
     */
    public static Result generate(Input in, YearPlanProperties p, Map<String, Integer> mav) {
        List<String> upper = p.kindGroups().getOrDefault(UPPER, List.of());
        List<String> lower = p.kindGroups().getOrDefault(LOWER, List.of());
        List<String> allGroups = new ArrayList<>(upper);
        allGroups.addAll(lower);
        if (mav == null || !mav.keySet().containsAll(allGroups)) throw invalid();
        if (in.blockWeeks() < 1) throw invalid();
        if (in.consolidationWeeks() < 1) throw invalid();
        List<String> emphasis = new ArrayList<>(new LinkedHashSet<>(in.emphasis() == null ? List.of() : in.emphasis()));
        for (String g : emphasis) {
            if (!allGroups.contains(g)) throw invalid();
        }

        Adopted adopted = in.adopted();
        if (adopted != null && (adopted.weeks() < 1 || adopted.mesoStart() == null)) throw invalid();
        LocalDate start = adopted == null ? in.start()
            : adopted.mesoStart().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<String> adoptedFocus = List.of();
        String firstKind = UPPER;
        int adoptedWeeks = 0;
        if (adopted != null) {
            adoptedFocus = (adopted.focus() == null ? List.<String>of() : adopted.focus()).stream()
                .filter(allGroups::contains).distinct().limit(2).toList();
            if (!adoptedFocus.isEmpty() && lower.containsAll(adoptedFocus)) firstKind = LOWER;
            adoptedWeeks = adopted.weeks();
        }

        int generated = Math.max(0,
            Math.floorDiv(p.yearWeeks() - in.consolidationWeeks() - adoptedWeeks, in.blockWeeks()));
        int loading = generated + (adopted != null ? 1 : 0);
        List<String> kinds = new ArrayList<>();
        for (int i = 0; i < loading; i++) {
            kinds.add(i % 2 == 0 ? firstKind : (firstKind.equals(UPPER) ? LOWER : UPPER));
        }

        // Demand per group (remaining after the adopted block), relaxations, single-focus allowance per kind.
        List<Note> notes = new ArrayList<>();
        Map<String, Integer> remaining = new LinkedHashMap<>();
        Map<String, Integer> singles = new HashMap<>();
        for (String kind : List.of(UPPER, LOWER)) {
            List<String> groups = kind.equals(UPPER) ? upper : lower;
            int open = 0;
            for (int i = adopted != null ? 1 : 0; i < loading; i++) if (kinds.get(i).equals(kind)) open++;
            int slots = 2 * open;
            Map<String, Integer> demand = new LinkedHashMap<>();
            Map<String, Integer> supplied = new HashMap<>();
            for (String g : groups) {
                demand.put(g, emphasis.contains(g) ? 2 : 1);
                supplied.put(g, adoptedFocus.contains(g) ? 1 : 0);
            }
            Map<String, Integer> r = new LinkedHashMap<>();
            for (String g : groups) r.put(g, Math.max(0, demand.get(g) - supplied.get(g)));

            // Over: emphasis last-first → once.
            for (int k = emphasis.size() - 1; k >= 0 && sum(r) > slots; k--) {
                String g = emphasis.get(k);
                if (!groups.contains(g)) continue;
                int relaxed = Math.max(0, 1 - supplied.get(g));
                if (relaxed < r.get(g)) {
                    r.put(g, relaxed);
                    notes.add(new Note(EMPHASIS_ONCE, g, null));
                }
            }
            // Still over: leftover groups, config order last-first → no focus.
            for (int k = groups.size() - 1; k >= 0 && sum(r) > slots; k--) {
                String g = groups.get(k);
                if (r.get(g) > 0) {
                    r.put(g, 0);
                    notes.add(new Note(NO_FOCUS, g, null));
                }
            }
            // A group can appear at most once per open block of its kind.
            for (String g : groups) {
                if (r.get(g) > open && emphasis.contains(g) && r.get(g) == 2) {
                    r.put(g, 1);
                    notes.add(new Note(EMPHASIS_ONCE, g, null));
                }
                if (r.get(g) > open) {
                    r.put(g, 0);
                    notes.add(new Note(NO_FOCUS, g, null));
                }
            }
            // Under: second appearances in mav-descending order, at most 2 per group in total.
            List<String> byMav = new ArrayList<>(groups);
            byMav.sort(Comparator.comparingInt((String g) -> mav.getOrDefault(g, 0)).reversed());
            for (String g : byMav) {
                if (sum(r) >= slots) break;
                if (r.get(g) + supplied.get(g) < 2 && r.get(g) < open) r.put(g, r.get(g) + 1);
            }
            singles.put(kind, slots - sum(r));
            remaining.putAll(r);
        }

        Set<Set<String>> pairs = new HashSet<>();
        for (List<String> pr : p.pairs()) pairs.add(Set.copyOf(pr));

        List<List<String>> focus = null;
        int usedLevel = -1;
        for (int level = 2; level >= 0 && focus == null; level--) {
            Search s = new Search(kinds, adopted != null ? adoptedFocus : null, upper, lower, pairs, level,
                new LinkedHashMap<>(remaining), new HashMap<>(singles));
            focus = s.run();
            usedLevel = level;
        }
        if (focus == null) throw invalid();

        List<Block> blocks = new ArrayList<>();
        for (int i = 0; i < loading; i++) {
            boolean isAdopted = adopted != null && i == 0;
            List<String> f = List.copyOf(focus.get(i));
            if (usedLevel == 0 && !isAdopted && f.size() == 2 && !pairs.contains(Set.copyOf(f))) {
                notes.add(new Note(PAIR_RELAXED, null, i + 1));
            }
            blocks.add(new Block(i + 1, kinds.get(i), f, isAdopted ? adoptedWeeks : in.blockWeeks(), isAdopted,
                isAdopted ? adopted.mesocycleId() : null));
        }
        blocks.add(new Block(loading + 1, CONSOLIDATION, List.of(), in.consolidationWeeks(), false, null));
        return new Result(start, List.copyOf(blocks), List.copyOf(notes));
    }

    /** Impossible input → 400 (only impossible input is rejected; rule breaks relax instead). */
    private static SystemRuntimeErrorException invalid() {
        return new SystemRuntimeErrorException(SystemMessage.error(INVALID).build(), HttpStatus.BAD_REQUEST);
    }

    private static int sum(Map<String, Integer> m) {
        return m.values().stream().mapToInt(Integer::intValue).sum();
    }

    /** Backtracking assignment at one strictness level (2 = hard + both soft rules, 1 = hard + pairs, 0 = hard). */
    private static final class Search {
        private final List<String> kinds;
        private final List<String> upper;
        private final List<String> lower;
        private final Set<Set<String>> pairs;
        private final int level;
        private final Map<String, Integer> remaining;
        private final Map<String, Integer> singles;
        private final List<List<String>> focus = new ArrayList<>();
        private final boolean hasAdopted;
        private int nodes;

        Search(List<String> kinds, List<String> adoptedFocus, List<String> upper, List<String> lower,
               Set<Set<String>> pairs, int level, Map<String, Integer> remaining, Map<String, Integer> singles) {
            this.kinds = kinds;
            this.upper = upper;
            this.lower = lower;
            this.pairs = pairs;
            this.level = level;
            this.remaining = remaining;
            this.singles = singles;
            this.hasAdopted = adoptedFocus != null;
            for (int i = 0; i < kinds.size(); i++) focus.add(List.of());
            if (hasAdopted && !kinds.isEmpty()) focus.set(0, adoptedFocus);
        }

        List<List<String>> run() {
            return solve(hasAdopted ? 1 : 0) ? focus : null;
        }

        private boolean solve(int i) {
            if (++nodes > NODE_BUDGET) return false;
            if (i == kinds.size()) return remaining.values().stream().allMatch(v -> v == 0);
            String kind = kinds.get(i);
            List<String> groups = kind.equals(UPPER) ? upper : lower;
            int openLeft = 0;
            for (int j = i; j < kinds.size(); j++) if (kinds.get(j).equals(kind)) openLeft++;
            for (String g : groups) if (remaining.get(g) > openLeft) return false;
            // Every open block needs at least one focus group.
            int kindDemand = groups.stream().mapToInt(remaining::get).sum();
            if (kindDemand < openLeft) return false;

            List<String> live = groups.stream().filter(g -> remaining.get(g) > 0).toList();
            // Table pairs first, then other pairs (only reachable at level 0), then singles.
            List<List<String>> candidates = new ArrayList<>();
            List<List<String>> offTable = new ArrayList<>();
            for (int a = 0; a < live.size(); a++) {
                for (int b = a + 1; b < live.size(); b++) {
                    List<String> pair = List.of(live.get(a), live.get(b));
                    (pairs.contains(Set.copyOf(pair)) ? candidates : offTable).add(pair);
                }
            }
            candidates.addAll(offTable);
            if (singles.get(kind) > 0) for (String g : live) candidates.add(List.of(g));

            for (List<String> c : candidates) {
                if (!allowed(i, kind, c)) continue;
                for (String g : c) remaining.merge(g, -1, Integer::sum);
                if (c.size() == 1) singles.merge(kind, -1, Integer::sum);
                focus.set(i, c);
                if (solve(i + 1)) return true;
                focus.set(i, List.of());
                for (String g : c) remaining.merge(g, 1, Integer::sum);
                if (c.size() == 1) singles.merge(kind, 1, Integer::sum);
            }
            return false;
        }

        private boolean allowed(int i, String kind, List<String> c) {
            if (i > 0) {
                for (String g : c) if (focus.get(i - 1).contains(g)) return false;
            }
            if (level >= 1 && c.size() == 2 && !pairs.contains(Set.copyOf(c))) return false;
            if (level >= 2) {
                for (int j = i - 1; j >= 0; j--) {
                    if (!kinds.get(j).equals(kind)) continue;
                    for (String g : c) if (focus.get(j).contains(g)) return false;
                    break;
                }
            }
            return true;
        }
    }
}
