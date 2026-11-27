package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityService;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.RecipeCandidate;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Suggestion;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SuggestionPicker;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The weekly menu, pure and deterministic (Boop B6 Évad S3, spec §5.7): per day the Étel day plan's own windows and
 * budgets (training vs rest day come from the engine's day targets), recipes only from the season's allowed set
 * filtered by his sensitivity profile and the season's NOVA rule, each portion scaled to its window
 * ({@value #MIN_SERVINGS}–{@value #MAX_SERVINGS} servings in steps of 0.25), the variety rules, and a sport day's
 * pre-session snack.
 *
 * <p><b>Choice.</b> Among a window's candidates: one that fits (scaled kcal within {@value #FIT_PCT}% of the window)
 * beats one that does not, then the one used least this week, then the {@code variant} rotation („Kérek másikat"
 * gives another menu), then the closest fit. A dinner is never repeated within {@value #DINNER_GAP_DAYS} days unless
 * the allowed recipes leave no other choice — then the week is marked {@code repeated}, as it is when one recipe
 * fills {@value #REPEAT_COUNT} or more windows.
 *
 * <p><b>Never an empty card.</b> A window no allowed recipe can fill gets the day plan's own ingredient tip
 * ({@link SuggestionPicker}), no recipe. With no allowed recipe at all the week is {@code seeding} and has no meals.
 */
public final class MenuPlanner {

    static final double MIN_SERVINGS = 0.5;
    static final double MAX_SERVINGS = 2.0;
    static final int FIT_PCT = 15;
    static final int DINNER_GAP_DAYS = 3;
    static final int REPEAT_COUNT = 3;
    /** A snack this far before a sport session (minutes) is its pre-session snack. */
    static final int PRE_SESSION_REACH_MIN = 180;
    static final int PRE_SESSION_LEAD_MIN = 75;

    public static final String KIND_TRAINING = "edzesnap";
    public static final String KIND_SPORT = "sport";
    public static final String KIND_TRAINING_SPORT = "edzes_sport";
    public static final String KIND_REST = "pihenonap";

    private MenuPlanner() {
    }

    /** One meal window of a planned day (owner-zone minutes since midnight). */
    public record Window(SlotKey slot, int ordinal, String label, Macros4 budget, int atMin, boolean preSession) {
        Window pre(String newLabel) {
            return new Window(slot, ordinal, newLabel, budget, atMin, true);
        }
    }

    /** One sport occurrence of a day: its name and its start in owner-zone minutes (Boop Sport S1). */
    public record SportStart(String name, int startMin) {
    }

    /**
     * One day to plan: its kind, the first sport session's name and start (null without sport), every sport session
     * in clock order (each gets a pre-session snack — Boop Sport S1, mezo-r36n9.201) and its windows in clock order
     * (only windows with a budget — a kímélő day has none and is planned empty).
     */
    public record DayBudget(LocalDate date, String kind, String sportName, Integer sportStartMin,
                            List<SportStart> sports, List<Window> windows) {

        public DayBudget {
            sports = sports == null ? List.of() : List.copyOf(sports);
        }

        /** The single-sport shape. */
        public DayBudget(LocalDate date, String kind, String sportName, Integer sportStartMin, List<Window> windows) {
            this(date, kind, sportName, sportStartMin,
                sportStartMin == null ? List.of() : List.of(new SportStart(sportName, sportStartMin)), windows);
        }

        /** Every sport of the day; the first one is the day's {@code sportName} / {@code sportStartMin}. */
        public DayBudget(LocalDate date, String kind, List<SportStart> sports, List<Window> windows) {
            this(date, kind, sports.isEmpty() ? null : sports.get(0).name(),
                sports.isEmpty() ? null : sports.get(0).startMin(), sports, windows);
        }
    }

    /** One planned meal. {@code recipeId} null = an ingredient tip ({@code name} is the tip text). */
    public record Pick(LocalDate date, String kind, String sportName, SlotKey slot, int ordinal, String label,
                       boolean preSession, int atMin, UUID recipeId, String name, BigDecimal servings, int kcal,
                       Integer proteinG) {
    }

    /** {@code status} seeding (no allowed recipe, no meals) | proposed. */
    public record MenuWeek(String status, boolean repeated, List<Pick> meals) {
        public static final String SEEDING = "seeding";
        public static final String PROPOSED = "proposed";
    }

    public static MenuWeek plan(List<DayBudget> days, List<RecipeCandidate> allowed, SensitivityProfile profile,
                                int novaMax, int variant) {
        if (allowed.isEmpty()) {
            return new MenuWeek(MenuWeek.SEEDING, false, List.of());
        }
        List<RecipeCandidate> usable = usable(allowed, profile, novaMax);
        Map<UUID, Integer> used = new HashMap<>();
        Map<LocalDate, UUID> dinners = new HashMap<>();
        boolean repeated = false;
        List<Pick> out = new ArrayList<>();
        int dayIndex = 0;
        for (DayBudget day : days) {
            for (Window w : withPreSession(day)) {
                List<RecipeCandidate> pool = pool(usable, w);
                if (pool.isEmpty()) {
                    out.add(tip(day, w, profile));
                    continue;
                }
                List<RecipeCandidate> varied = w.slot() == SlotKey.DINNER ? withoutRecentDinners(pool, day.date(), dinners)
                    : pool;
                if (varied.isEmpty()) {
                    varied = pool; // too few dinners for the 3-day rule: repeat, and say so
                    repeated = true;
                }
                RecipeCandidate best = choose(varied, w, used, variant + dayIndex);
                used.merge(best.id(), 1, Integer::sum);
                if (w.slot() == SlotKey.DINNER) {
                    dinners.put(day.date(), best.id());
                }
                out.add(scale(best, day, w));
            }
            dayIndex++;
        }
        repeated |= used.values().stream().anyMatch(n -> n >= REPEAT_COUNT);
        return new MenuWeek(MenuWeek.PROPOSED, repeated, List.copyOf(out));
    }

    /** What else fits this window (a swap): fitting first, then the closest; never {@code exclude}. */
    public static List<Pick> alternatives(DayBudget day, Window w, List<RecipeCandidate> allowed,
                                          SensitivityProfile profile, int novaMax, UUID exclude, int limit) {
        return pool(usable(allowed, profile, novaMax), w).stream()
            .filter(r -> !r.id().equals(exclude))
            .sorted(Comparator.comparingInt((RecipeCandidate r) -> fits(r, w) ? 0 : 1)
                .thenComparingDouble(r -> fitError(r, w))
                .thenComparing(r -> r.starred() ? 0 : 1)
                .thenComparing(r -> r.id().toString()))
            .limit(limit)
            .map(r -> scale(r, day, w))
            .toList();
    }

    /** The recipe scaled to the window — or empty when it cannot be eaten there (category, rules, no kcal). */
    public static Optional<Pick> fit(RecipeCandidate r, DayBudget day, Window w, SensitivityProfile profile,
                                     int novaMax) {
        return pool(usable(List.of(r), profile, novaMax), w).isEmpty() ? Optional.empty()
            : Optional.of(scale(r, day, w));
    }

    /** Whether the scaled recipe lands within {@value #FIT_PCT}% of the window's budget. */
    public static boolean fits(RecipeCandidate r, Window w) {
        return fitError(r, w) <= FIT_PCT / 100.0;
    }

    /**
     * The day's windows with a pre-session snack per sport session marked (or added when the day has none there).
     * Sessions are handled in clock order; a window already marked for an earlier session is not reused, so two
     * sessions get two snacks (Boop Sport S1, mezo-r36n9.201).
     */
    public static List<Window> withPreSession(DayBudget day) {
        List<Window> ws = new ArrayList<>(day.windows());
        if (ws.isEmpty()) {
            return ws;
        }
        List<SportStart> sports = day.sports().stream().sorted(Comparator.comparingInt(SportStart::startMin)).toList();
        for (SportStart s : sports) {
            ws = withPreSession(ws, s.startMin(), s.name());
        }
        return ws;
    }

    private static List<Window> withPreSession(List<Window> in, int start, String sportName) {
        List<Window> ws = new ArrayList<>(in);
        String label = capitalize(sportName == null ? "Sport" : sportName) + " előtt";
        int pre = -1;
        boolean anyBefore = false;
        for (int i = 0; i < ws.size(); i++) {
            Window w = ws.get(i);
            boolean before = !w.preSession() && w.atMin() < start && w.atMin() >= start - PRE_SESSION_REACH_MIN;
            anyBefore |= before;
            if (before && w.slot() == SlotKey.SNACK) {
                pre = i; // the latest snack before the session
            }
        }
        if (pre >= 0) {
            ws.set(pre, ws.get(pre).pre(label));
            return ws;
        }
        if (anyBefore) {
            return ws; // a main meal is already the pre-fuel; no extra snack squeezed in
        }
        // Nothing before the session: a light snack, taken proportionally from the other windows.
        int total = ws.stream().mapToInt(w -> w.budget().kcal()).sum();
        int snack = Math.max(150, Math.min(350, (int) Math.round(total * 0.10)));
        double keep = total <= 0 ? 1 : (double) (total - snack) / total;
        List<Window> scaled = new ArrayList<>();
        for (Window w : ws) {
            Macros4 b = w.budget();
            scaled.add(new Window(w.slot(), w.ordinal(), w.label(), new Macros4((int) Math.round(b.kcal() * keep),
                (int) Math.round(b.p() * keep), (int) Math.round(b.c() * keep), (int) Math.round(b.f() * keep)),
                w.atMin(), w.preSession()));
        }
        int ordinal = 1 + (int) ws.stream().filter(w -> w.slot() == SlotKey.SNACK).count();
        Window added = new Window(SlotKey.SNACK, ordinal, label,
            new Macros4(snack, Math.round(snack * 0.1f / 4), Math.round(snack * 0.7f / 4), Math.round(snack * 0.2f / 9)),
            Math.max(0, start - PRE_SESSION_LEAD_MIN), true);
        scaled.add(added);
        scaled.sort(Comparator.comparingInt(Window::atMin));
        return scaled;
    }

    // --- internals ---------------------------------------------------------------------------------------------

    private static List<RecipeCandidate> usable(List<RecipeCandidate> allowed, SensitivityProfile profile, int novaMax) {
        return allowed.stream()
            .filter(r -> r.perServing() != null && r.perServing().kcal() > 0)
            .filter(r -> r.nova() == null || r.nova() <= novaMax)
            .filter(r -> !SensitivityService.verdict(profile, r.allergens(), r.nova(), r.lactoseFree()).blocksSuggestion())
            .sorted(Comparator.comparing(r -> r.id().toString()))
            .toList();
    }

    private static List<RecipeCandidate> pool(List<RecipeCandidate> usable, Window w) {
        if (w.budget() == null || w.budget().kcal() <= 0) {
            return List.of();
        }
        return usable.stream().filter(r -> r.category() == w.slot()).toList();
    }

    private static List<RecipeCandidate> withoutRecentDinners(List<RecipeCandidate> pool, LocalDate date,
                                                              Map<LocalDate, UUID> dinners) {
        Set<UUID> recent = new java.util.HashSet<>();
        for (int back = 1; back < DINNER_GAP_DAYS; back++) {
            UUID id = dinners.get(date.minusDays(back));
            if (id != null) {
                recent.add(id);
            }
        }
        return pool.stream().filter(r -> !recent.contains(r.id())).toList();
    }

    private static RecipeCandidate choose(List<RecipeCandidate> pool, Window w, Map<UUID, Integer> used, int rotation) {
        int n = pool.size();
        Map<UUID, Integer> rank = new HashMap<>();
        for (int i = 0; i < n; i++) {
            rank.put(pool.get(i).id(), Math.floorMod(i - rotation, n));
        }
        Comparator<RecipeCandidate> order = Comparator
            .comparingInt((RecipeCandidate r) -> fits(r, w) ? 0 : 1)
            .thenComparingInt(r -> used.getOrDefault(r.id(), 0))
            .thenComparingInt(r -> w.preSession() ? -carbShare(r) : 0)
            .thenComparingInt(r -> rank.get(r.id()))
            .thenComparingDouble(r -> fitError(r, w));
        return pool.stream().min(order).orElseThrow();
    }

    /** Per mille of a serving's energy from carbohydrate — a pre-session snack prefers the carb-rich one. */
    private static int carbShare(RecipeCandidate r) {
        Macros4 m = r.perServing();
        return m.kcal() <= 0 ? 0 : (int) Math.round(m.c() * 4000.0 / m.kcal());
    }

    static double servings(RecipeCandidate r, Window w) {
        double raw = (double) w.budget().kcal() / r.perServing().kcal();
        double quarter = Math.round(raw * 4) / 4.0;
        return Math.max(MIN_SERVINGS, Math.min(MAX_SERVINGS, quarter));
    }

    private static double fitError(RecipeCandidate r, Window w) {
        double kcal = r.perServing().kcal() * servings(r, w);
        return Math.abs(kcal - w.budget().kcal()) / Math.max(1, w.budget().kcal());
    }

    private static Pick scale(RecipeCandidate r, DayBudget day, Window w) {
        double s = servings(r, w);
        return new Pick(day.date(), day.kind(), day.sportName(), w.slot(), w.ordinal(), w.label(), w.preSession(),
            w.atMin(), r.id(), r.name(), BigDecimal.valueOf(s).setScale(2, RoundingMode.HALF_UP),
            (int) Math.round(r.perServing().kcal() * s), (int) Math.round(r.perServing().p() * s));
    }

    /** The day plan's own ingredient tip for a window no allowed recipe can fill. */
    public static Pick tip(DayBudget day, Window w, SensitivityProfile profile) {
        Suggestion s = SuggestionPicker.pick(w.slot(), w.budget(), List.of(), profile);
        return new Pick(day.date(), day.kind(), day.sportName(), w.slot(), w.ordinal(), w.label(), w.preSession(),
            w.atMin(), null, s.text(), null, w.budget().kcal(), w.budget().p());
    }

    private static String capitalize(String s) {
        String t = s.strip();
        return t.isEmpty() ? t : t.substring(0, 1).toUpperCase(Locale.ROOT) + t.substring(1);
    }
}
