package io.mrkuhne.mezo.feature.meal.service.dayplan;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelPlanResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.RecipeMacros;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.fuel.config.FuelSettingsProperties;
import io.mrkuhne.mezo.feature.fuel.entity.FuelSettingsEntity;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotJson;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotTemplateEntity;
import io.mrkuhne.mezo.feature.fuel.repository.FuelSettingsRepository;
import io.mrkuhne.mezo.feature.fuel.repository.MealSlotTemplateRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityService;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.BudgetSplitter;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlan;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlanWindow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.LoggedMeal;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.MealSlots;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.PlannedWindow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.RecipeCandidate;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Suggestion;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SuggestionPicker;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.TemplateRow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Tip;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.TrainingBlock;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.UsualMeal;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.UsualMealRanker;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.WindowPlacer;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.WindowState;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The day plan the phone, the morning brief and later the live re-planning all read (Boop B4,
 * mezo-r36n9.14, spec §7.2) — the server-side port of the web planner
 * ({@code frontend/src/features/fuel/logic/buildDayPlan.ts} and friends). Deterministic: every
 * number and every sentence here is computed, never asked of a model. The web app's own copies
 * are untouched in B4.
 *
 * <p><b>Placement.</b> Lives in {@code meal} rather than the plan's {@code nutrition}: it consumes
 * {@link FuelDayService} (meal), the recipes (recipe) and the fuel settings (fuel), and
 * {@code nutrition} is DOWNSTREAM of all three — putting the orchestrator there would create the
 * cycles {@code ArchitectureTest.feature_slices_are_cycle_free} forbids. The pure rules it drives
 * (placement, split, suggestion, usual meals) do live in {@code nutrition.service.dayplan} as the
 * plan says, because they depend on nothing but that slice's own sensitivity model.
 *
 * <p><b>Time.</b> Everything here is wall-clock in the OWNER's zone ({@code mezo.wearable.zone}),
 * the same zone the Boop brief already uses: the wake/bed anchor, the workout windows, the window
 * times, a logged meal's local time and "now". {@link FuelDayService} and {@code MealService} keep
 * resolving a meal's local time with {@code ZoneId.systemDefault()} — that pre-existing split is
 * left exactly as it is, and never widened here.
 */
@Service
@RequiredArgsConstructor
public class DayPlanService {

    /** After this hour a next-meal tip would be nagging, not helping (the brief's own cutoff too). */
    static final LocalTime LAST_TIP_AT = LocalTime.of(20, 0);
    /** How far back the "szokásosak" look for a recognisable habit. */
    static final int USUAL_HISTORY_DAYS = 28;
    private static final int USUAL_LIMIT = 6;

    private final FuelDayService fuelDays;
    private final MealRepository meals;
    private final SleepAnchorPort sleepAnchor;
    private final WorkoutWindowQueryService workoutWindows;
    private final PlannedSkipService plannedSkips;
    private final FuelSettingsRepository fuelSettings;
    private final FuelSettingsProperties fuelSettingsDefaults;
    private final MealSlotTemplateRepository slotTemplates;
    private final RecipeRepository recipes;
    private final RecipeMapper recipeMapper;
    private final SensitivityService sensitivities;
    private final WearableProperties wearableProperties;

    /** The plan on the wire, as of the owner's current wall clock. */
    @Transactional(readOnly = true)
    public FuelPlanResponse response(UUID userId, LocalDate date) {
        return FuelPlanMapper.toResponse(plan(userId, date));
    }

    /** The plan as of the owner's current wall clock. */
    @Transactional(readOnly = true)
    public DayPlan plan(UUID userId, LocalDate date) {
        return plan(userId, date, LocalTime.now(zone()).truncatedTo(ChronoUnit.MINUTES));
    }

    /**
     * The plan as of {@code now} (owner-zone wall clock). {@code now} is injected so the caller
     * owns the clock and the result is reproducible — the brief, the room and the tests all pass
     * their own.
     */
    @Transactional(readOnly = true)
    public DayPlan plan(UUID userId, LocalDate date, LocalTime now) {
        ZoneId zone = zone();
        FuelDayResponse day = fuelDays.getDay(userId, date);
        boolean budgeted = day.getFuelMode() != FuelDayResponse.FuelModeEnum.GUIDANCE;

        SleepAnchorPort.SleepAnchor anchor = sleepAnchor.resolve(userId);
        List<TrainingBlock> blocks = blocks(userId, date);
        List<PlannedWindow> placed = placeWindows(userId, anchor, blocks);
        List<Macros4> budgets = BudgetSplitter.split(dayBudget(day), placed, budgeted);

        List<String> skipKeys = skipKeys(placed);
        Set<String> skipped = plannedSkips.mealSkipsOn(userId, date).stream()
            .map(PlannedSkipPolicy.Row::sessionKey)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        List<List<UUID>> assigned = assign(placed, loggedMeals(day, zone));
        List<WindowState> states = classify(placed, assigned, skipKeys, skipped, now, minuteOf(anchor.bed()));

        // The profile and the recipe library are read only when some window can actually be
        // offered something — a done-out or kímélő day pays neither query.
        boolean anyOffer = false;
        for (int i = 0; i < placed.size(); i++) {
            anyOffer |= isOpen(states.get(i)) && budgets.get(i) != null;
        }
        SensitivityProfile profile = anyOffer ? sensitivities.profile(userId) : null;
        List<RecipeCandidate> candidates = anyOffer ? candidates(userId) : List.of();
        List<DayPlanWindow> windows = new ArrayList<>(placed.size());
        for (int i = 0; i < placed.size(); i++) {
            PlannedWindow w = placed.get(i);
            Macros4 budget = budgets.get(i);
            boolean offer = isOpen(states.get(i)) && budget != null;
            windows.add(new DayPlanWindow(w.slotKey(), w.kind(), w.label(),
                time(w.fromMin()), time(w.toMin()), budget, states.get(i), assigned.get(i),
                offer ? SuggestionPicker.pick(w.slotKey(), budget, candidates, profile) : null));
        }

        return new DayPlan(date, List.copyOf(windows), remaining(day, budgeted),
            tip(userId, date, zone, windows, states, now));
    }

    /** A window still waiting for the owner — the only kind that carries an offer. */
    private static boolean isOpen(WindowState state) {
        return state != WindowState.DONE && state != WindowState.SKIPPED;
    }

    // --- inputs ----------------------------------------------------------------------------------

    private ZoneId zone() {
        return ZoneId.of(wearableProperties.zone());
    }

    private List<TrainingBlock> blocks(UUID userId, LocalDate date) {
        return workoutWindows.windowsFor(userId, date).stream()
            .filter(w -> w.start() != null && w.end() != null)
            .map(w -> TrainingBlock.of(w.start(), w.end(), w.label()))
            .sorted(Comparator.comparingInt(TrainingBlock::startMin))
            .toList();
    }

    /** A saved template for the day's type wins; otherwise the owner's rhythm (decision 21). */
    private List<PlannedWindow> placeWindows(
            UUID userId, SleepAnchorPort.SleepAnchor anchor, List<TrainingBlock> blocks) {
        String wake = WindowPlacer.hhmm(minuteOf(anchor.wake()));
        String bed = WindowPlacer.hhmm(minuteOf(anchor.bed()));
        MealSlotTemplateEntity template = slotTemplates
            .findByCreatedByAndDayTypeAndDeletedFalse(userId, WindowPlacer.dayType(blocks))
            .orElse(null);
        if (template != null && template.getSlots() != null && !template.getSlots().isEmpty()) {
            List<TemplateRow> rows = template.getSlots().stream().map(DayPlanService::templateRow).toList();
            List<PlannedWindow> fromTemplate = WindowPlacer.fromTemplate(rows, wake, bed, blocks);
            if (!fromTemplate.isEmpty()) {
                return fromTemplate;
            }
        }
        return WindowPlacer.place(wake, bed, mealsPerDay(userId), blocks);
    }

    private static TemplateRow templateRow(MealSlotJson row) {
        SlotKey slot = SlotKey.fromWire(row.slotKind());
        return new TemplateRow(row.label(), slot == null ? SlotKey.SNACK : slot, row.role(),
            row.anchorType(), row.time(), row.offsetMin(), row.budgetPct() == null ? 0 : row.budgetPct());
    }

    private int mealsPerDay(UUID userId) {
        return fuelSettings.findByCreatedByAndDeletedFalse(userId)
            .map(FuelSettingsEntity::getMealsPerDay)
            .orElseGet(fuelSettingsDefaults::defaultMealsPerDay);
    }

    /** The owner's recipes, per serving, with the facts the sensitivity rules need. */
    private List<RecipeCandidate> candidates(UUID userId) {
        List<RecipeCandidate> out = new ArrayList<>();
        for (RecipeEntity e : recipes.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)) {
            SlotKey category = SlotKey.fromWire(e.getCategory());
            if (category == null) {
                continue; // an unknown category is never placed in a guessed window
            }
            int servings = e.getServings() == null || e.getServings() < 1 ? 1 : e.getServings();
            RecipeMacros total = recipeMapper.rollupWithOverrides(e, Map.of());
            Map<String, AllergenState> allergens = e.getAllergens() == null ? Map.of() : e.getAllergens();
            out.add(new RecipeCandidate(e.getId(), e.getName(), category,
                perServing(total, servings), e.isStarred(),
                e.getNovaDominant() == null ? null : (int) e.getNovaDominant(), allergens));
        }
        return List.copyOf(out);
    }

    private static Macros4 perServing(RecipeMacros total, int servings) {
        return new Macros4(divide(total.getKcal(), servings), divide(total.getP(), servings),
            divide(total.getC(), servings), divide(total.getF(), servings));
    }

    private static int divide(BigDecimal value, int servings) {
        return value == null ? 0
            : value.divide(BigDecimal.valueOf(servings), 0, RoundingMode.HALF_UP).intValue();
    }

    private static Macros4 dayBudget(FuelDayResponse day) {
        MacroSet t = day.getTargets();
        return t == null ? Macros4.ZERO
            : new Macros4(toInt(t.getKcal()), toInt(t.getP()), toInt(t.getC()), toInt(t.getF()));
    }

    /** Target − consumed − the skipped windows' kcal; negative over budget, null when unjudged. */
    private static Macros4 remaining(FuelDayResponse day, boolean budgeted) {
        if (!budgeted) {
            return null;
        }
        MacroSet consumed = day.getConsumed();
        Macros4 eaten = consumed == null ? Macros4.ZERO : new Macros4(
            toInt(consumed.getKcal()), toInt(consumed.getP()), toInt(consumed.getC()), toInt(consumed.getF()));
        int skipped = day.getSkippedKcal() == null ? 0 : day.getSkippedKcal();
        return dayBudget(day).minus(eaten).minusKcal(skipped);
    }

    private static List<LoggedMeal> loggedMeals(FuelDayResponse day, ZoneId zone) {
        if (day.getMeals() == null) {
            return List.of();
        }
        List<LoggedMeal> out = new ArrayList<>();
        for (MealResponse m : day.getMeals()) {
            if (m.getLoggedAt() == null) {
                continue;
            }
            LocalTime at = m.getLoggedAt().atZoneSameInstant(zone).toLocalTime().truncatedTo(ChronoUnit.MINUTES);
            out.add(new LoggedMeal(m.getId(), m.getSlot(), m.getTitle(),
                m.getMacros() == null ? null : toInt(m.getMacros().getKcal()), m.getLoggedAt().toInstant(), at));
        }
        out.sort(Comparator.comparing(LoggedMeal::loggedAt));
        return out;
    }

    // --- assignment + state ----------------------------------------------------------------------

    /**
     * Each logged meal claims a window of its own slot — in logged order, the still-free window
     * nearest its local time. A meal beyond that slot's window count stays with the LAST window of
     * its slot rather than disappearing from the plan.
     */
    private static List<List<UUID>> assign(List<PlannedWindow> windows, List<LoggedMeal> meals) {
        List<List<UUID>> out = new ArrayList<>(windows.size());
        for (int i = 0; i < windows.size(); i++) {
            out.add(new ArrayList<>());
        }
        Map<SlotKey, List<Integer>> bySlot = new EnumMap<>(SlotKey.class);
        for (int i = 0; i < windows.size(); i++) {
            bySlot.computeIfAbsent(windows.get(i).slotKey(), k -> new ArrayList<>()).add(i);
        }
        Set<Integer> taken = new HashSet<>();
        for (LoggedMeal meal : meals) {
            SlotKey slot = MealSlots.of(meal.slot());
            List<Integer> candidates = slot == null ? List.of() : bySlot.getOrDefault(slot, List.of());
            if (candidates.isEmpty()) {
                continue; // no window of that kind today — the meal still counts in `consumed`
            }
            int minute = minuteOf(meal.at());
            Integer free = candidates.stream()
                .filter(i -> !taken.contains(i))
                .min(Comparator.comparingInt(i -> Math.abs(windows.get(i).timeMin() - minute)))
                .orElse(candidates.get(candidates.size() - 1));
            taken.add(free);
            out.get(free).add(meal.id());
        }
        return out.stream().map(List::copyOf).toList();
    }

    /** {@code <slot>#<n>} per window, n 1-based among same-slot windows in clock order (Kihagyás S3). */
    private static List<String> skipKeys(List<PlannedWindow> windows) {
        Map<SlotKey, Integer> seen = new EnumMap<>(SlotKey.class);
        List<String> keys = new ArrayList<>(windows.size());
        for (PlannedWindow w : windows) {
            int n = seen.merge(w.slotKey(), 1, Integer::sum);
            keys.add(w.slotKey().wire() + "#" + n);
        }
        return keys;
    }

    /**
     * Fixed-plan state (mezo-1oy5) — the port of {@code buildDayPlan.ts} step 6 (:673-696). Windows
     * stay where they were placed; {@code now} only labels them.
     *
     * <p>The focus ("now") is the LAST still-UNLOGGED window at or before {@code now} — skipped
     * ones included in the scan, because the owner's day moved past them too. If {@code now}
     * precedes every window the first one takes the focus. If the focus lands on a SKIPPED window
     * it moves FORWARD to the next non-skipped one (never backward onto a window the day has
     * already passed), and if there is none the day has no focus at all. Past bedtime the eating
     * day is over: nothing is "now" and every unlogged window is missed. A logged meal beats a
     * skip; a skipped window is never re-labelled and never carries an offer.
     */
    private static List<WindowState> classify(List<PlannedWindow> windows, List<List<UUID>> assigned,
            List<String> skipKeys, Set<String> skipped, LocalTime now, int bedMin) {
        int nowMin = minuteOf(now);
        List<WindowState> states = new ArrayList<>(windows.size());
        List<Integer> unlogged = new ArrayList<>();
        for (int i = 0; i < windows.size(); i++) {
            if (!assigned.get(i).isEmpty()) {
                states.add(WindowState.DONE);
                continue;
            }
            states.add(skipped.contains(skipKeys.get(i)) ? WindowState.SKIPPED : WindowState.PENDING);
            unlogged.add(i);
        }

        int focus = -1;
        if (nowMin <= bedMin && !unlogged.isEmpty()) {
            for (int i : unlogged) {
                if (windows.get(i).timeMin() <= nowMin) {
                    focus = i;
                }
            }
            if (focus == -1) {
                focus = unlogged.get(0); // now precedes every window — the first one is current
            }
            if (states.get(focus) == WindowState.SKIPPED) {
                int next = -1;
                for (int i : unlogged) {
                    if (i > focus && states.get(i) != WindowState.SKIPPED) {
                        next = i;
                        break;
                    }
                }
                focus = next;
            }
        }

        // With no focus (past bedtime, or only skipped windows left) `now` itself is the frontier,
        // so every unlogged window behind it is missed.
        int frontier = focus >= 0 ? windows.get(focus).timeMin() : nowMin;
        for (int i : unlogged) {
            if (states.get(i) == WindowState.SKIPPED) {
                continue;
            }
            if (i == focus) {
                states.set(i, WindowState.NOW);
            } else {
                states.set(i, windows.get(i).timeMin() < frontier ? WindowState.MISSED : WindowState.PENDING);
            }
        }
        return List.copyOf(states);
    }

    // --- the tip ---------------------------------------------------------------------------------

    /**
     * One offer for the window in focus. Omitted (null) late in the day, when the focused window
     * was skipped, and when nothing is open any more. It names the window, its clock and what fits
     * — and when the owner has a habit for that window, that habit by name instead of a recipe.
     */
    private Tip tip(UUID userId, LocalDate date, ZoneId zone, List<DayPlanWindow> windows,
            List<WindowState> states, LocalTime now) {
        if (!now.isBefore(LAST_TIP_AT)) {
            return null;
        }
        int focus = states.indexOf(WindowState.NOW);
        if (focus < 0) {
            return null;
        }
        DayPlanWindow window = windows.get(focus);
        if (window.suggestion() == null) {
            return null;
        }
        String head = "Következik: " + window.label() + ", " + window.from() + "–" + window.to() + ".";
        UsualMeal usual = window.suggestion().kind() == Suggestion.Kind.INGREDIENTS
            ? usualFor(userId, date, zone, window.slot()) : null;
        if (usual != null) {
            return new Tip(head + " Ilyenkor általában " + usual.title() + " szokott lenni.",
                "ezt eszed a leggyakrabban ebben az ablakban");
        }
        return new Tip(head + " " + window.suggestion().text(), window.suggestion().reason());
    }

    /**
     * The owner's most usual meal for that window over the last {@value #USUAL_HISTORY_DAYS} days.
     * Read straight off {@code meal} in ONE query — the ranker needs the window, the name and the
     * time, none of which needs the items, so the rows carry no kcal rather than an N+1 rollup or
     * a fabricated number.
     */
    private UsualMeal usualFor(UUID userId, LocalDate date, ZoneId zone, SlotKey slot) {
        List<LoggedMeal> history = meals
            .findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(
                userId, date.minusDays(USUAL_HISTORY_DAYS), date.minusDays(1))
            .stream()
            .filter(m -> m.getLoggedAt() != null)
            .map(m -> new LoggedMeal(m.getId(), m.getSlot(), m.getTitle(), null, m.getLoggedAt(),
                m.getLoggedAt().atZone(zone).toLocalTime().truncatedTo(ChronoUnit.MINUTES)))
            .toList();
        return UsualMealRanker.rank(history, slot, USUAL_LIMIT).stream()
            .filter(u -> u.slot() == slot)
            .findFirst()
            .orElse(null);
    }

    // --- small helpers ---------------------------------------------------------------------------

    private static int minuteOf(LocalTime time) {
        return time.getHour() * 60 + time.getMinute();
    }

    private static LocalTime time(int minutes) {
        int clamped = Math.max(0, Math.min(1439, minutes));
        return LocalTime.of(clamped / 60, clamped % 60);
    }

    private static int toInt(BigDecimal value) {
        return value == null ? 0 : value.setScale(0, RoundingMode.HALF_UP).intValue();
    }
}
