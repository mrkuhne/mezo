package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.SeasonMenuAlternative;
import io.mrkuhne.mezo.api.dto.SeasonMenuDay;
import io.mrkuhne.mezo.api.dto.SeasonMenuMeal;
import io.mrkuhne.mezo.api.dto.SeasonMenuStatus;
import io.mrkuhne.mezo.api.dto.SeasonMenuWeek;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.RecipeCandidate;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.season.entity.SeasonAllowedRecipeEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonMenuMealEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonMenuWeekEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonMenuSourcePort;
import io.mrkuhne.mezo.feature.season.repository.SeasonAllowedRecipeRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonMenuMealRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonMenuWeekRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly menu of the active season (Boop B6 Évad S3, spec §5.7, §5.12-4): generate (scheduled or „Kérek
 * másikat"), swap one meal, approve (→ the Étel day plan's suggestions + the shopping list), and the mid-week re-fit of
 * the remaining days after an accepted change. The choice itself is {@link MenuPlanner}'s (pure).
 */
@Service
@RequiredArgsConstructor
public class MenuService {

    static final int ALTERNATIVES = 6;

    private final SeasonRepository seasons;
    private final SeasonAllowedRecipeRepository allowedRepository;
    private final SeasonMenuWeekRepository weeks;
    private final SeasonMenuMealRepository meals;
    private final SeasonMenuSourcePort source;
    private final ShoppingListService shopping;

    // --- reads ---------------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public SeasonMenuWeek get(UUID owner, LocalDate weekStart) {
        requireMonday(weekStart);
        SeasonEntity s = requireActive(owner);
        Set<UUID> allowed = allowed(s);
        int recipeCount = source.recipes(owner).size();
        Optional<SeasonMenuWeekEntity> week = weeks.findByCreatedByAndWeekStart(owner, weekStart);
        if (week.isPresent()) {
            return response(week.get(), allowed.size(), recipeCount);
        }
        return empty(weekStart, allowed.isEmpty() ? "seeding" : "none", allowed.size(), recipeCount);
    }

    /** Next week's menu state for the overview (the wall's approval card); null when the season has no menu day. */
    @Transactional(readOnly = true)
    public SeasonMenuStatus status(UUID owner, SeasonEntity s, LocalDate today) {
        if (s.getMenuDay() == null) {
            return null;
        }
        LocalDate next = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        Optional<SeasonMenuWeekEntity> week = weeks.findByCreatedByAndWeekStart(owner, next);
        String status = week.map(SeasonMenuWeekEntity::getStatus)
            .orElse(allowedRepository.countBySeasonId(s.getId()) == 0 ? "seeding" : "none");
        return SeasonMenuStatus.builder()
            .weekStart(next)
            .weekId(week.map(SeasonMenuWeekEntity::getId).orElse(null))
            .status(SeasonMenuStatus.StatusEnum.fromValue(status))
            .menuDay(s.getMenuDay())
            .menuTime(s.getMenuTime())
            .build();
    }

    /**
     * The first weekday (0 = hétfő) of an approved menu week that a change accepted today would re-fit (tomorrow on),
     * or null when no approved week covers tomorrow — the Módosítás page's „A hét hátralévő napjai" line.
     */
    @Transactional(readOnly = true)
    public Integer refitFromDow(UUID owner, LocalDate today) {
        LocalDate tomorrow = today.plusDays(1);
        LocalDate monday = tomorrow.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return weeks.findByCreatedByAndWeekStart(owner, monday)
            .filter(SeasonMenuWeekEntity::approved)
            .map(w -> tomorrow.getDayOfWeek().getValue() - 1)
            .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<SeasonMenuAlternative> alternatives(UUID owner, UUID mealId) {
        SeasonMenuMealEntity meal = requireMeal(owner, mealId);
        SeasonEntity s = requireActive(owner);
        List<RecipeCandidate> allowed = allowedCandidates(owner, s);
        MenuPlanner.DayBudget day = dayOf(meal);
        return MenuPlanner.alternatives(day, windowOf(meal), allowed, source.profile(owner),
                s.getProcessedFoodMaxNova(), meal.getRecipeId(), ALTERNATIVES).stream()
            .map(p -> SeasonMenuAlternative.builder()
                .recipeId(p.recipeId()).name(p.name()).kcal(p.kcal()).servings(p.servings())
                .proteinG(p.proteinG())
                .fits(Math.abs(p.kcal() - meal.getBudgetKcal()) <= meal.getBudgetKcal() * MenuPlanner.FIT_PCT / 100.0)
                .build())
            .toList();
    }

    // --- writes --------------------------------------------------------------------------------------------------

    /**
     * Plans next — or any — week as a proposal: a first plan, or another one („Kérek másikat", the variant rotates).
     * With no allowed recipe nothing is saved and the answer is the seeding state. An approved week is not re-planned
     * (409 {@code MENU_NOT_PROPOSED}).
     */
    @Transactional
    public SeasonMenuWeek generate(UUID owner, LocalDate weekStart) {
        requireMonday(weekStart);
        SeasonEntity s = requireActive(owner);
        List<RecipeCandidate> allowed = allowedCandidates(owner, s);
        int recipeCount = source.recipes(owner).size();
        int allowedCount = allowed(s).size();
        if (allowedCount == 0) {
            return empty(weekStart, "seeding", 0, recipeCount);
        }
        Optional<SeasonMenuWeekEntity> existing = weeks.findByCreatedByAndWeekStart(owner, weekStart);
        if (existing.isPresent() && existing.get().approved()) {
            throw new SystemRuntimeErrorException(SystemMessage.error("MENU_NOT_PROPOSED").build(), HttpStatus.CONFLICT);
        }
        SeasonMenuWeekEntity week = existing.orElseGet(() -> {
            SeasonMenuWeekEntity w = new SeasonMenuWeekEntity();
            w.setCreatedBy(owner);
            w.setSeasonId(s.getId());
            w.setWeekStart(weekStart);
            w.setVariant(-1);
            return w;
        });
        week.setVariant(week.getVariant() + 1);
        List<MenuPlanner.DayBudget> days = days(owner, weekStart, weekStart.plusDays(6));
        MenuPlanner.MenuWeek plan = MenuPlanner.plan(days, allowed, source.profile(owner), s.getProcessedFoodMaxNova(),
            week.getVariant());
        week.setRepeated(plan.repeated());
        week.setStatus(SeasonMenuWeekEntity.STATUS_PROPOSED);
        week.setUpdatedAt(Instant.now());
        SeasonMenuWeekEntity saved = weeks.saveAndFlush(week);
        meals.deleteAll(meals.findByWeekIdOrderByMealDateAscIdAsc(saved.getId()));
        meals.flush();
        Map<String, Integer> budgets = budgets(days);
        for (MenuPlanner.Pick p : plan.meals()) {
            meals.save(entity(owner, saved.getId(), p, budgets.getOrDefault(key(p.date(), p.slot(), p.ordinal()), p.kcal()),
                false));
        }
        return response(saved, allowedCount, recipeCount);
    }

    /** Approves a week: its meals become the day plan's suggestions and its shopping list is made. Idempotent. */
    @Transactional
    public SeasonMenuWeek approve(UUID owner, UUID weekId) {
        SeasonMenuWeekEntity week = weeks.findByIdAndCreatedBy(weekId, owner).orElseThrow(MenuService::notFound);
        if (!week.approved()) {
            week.setStatus(SeasonMenuWeekEntity.STATUS_APPROVED);
            week.setApprovedAt(Instant.now());
            week.setUpdatedAt(Instant.now());
            weeks.save(week);
            shopping.create(owner, week, meals.findByWeekIdOrderByMealDateAscIdAsc(week.getId()));
        }
        return response(week, allowed(owner).size(), source.recipes(owner).size());
    }

    /** Puts another allowed recipe into a meal's window, scaled to it; an approved week's list follows. */
    @Transactional
    public SeasonMenuWeek swap(UUID owner, UUID mealId, UUID recipeId) {
        SeasonMenuMealEntity meal = requireMeal(owner, mealId);
        if (meal.getMealDate().isBefore(LocalDate.now())) {
            // spec §5.12-4: a past day is never touched
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "mealId").build(),
                HttpStatus.BAD_REQUEST);
        }
        SeasonEntity s = requireActive(owner);
        RecipeCandidate r = allowedCandidates(owner, s).stream().filter(c -> c.id().equals(recipeId)).findFirst()
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "recipeId").build(), HttpStatus.BAD_REQUEST));
        MenuPlanner.Pick p = MenuPlanner.fit(r, dayOf(meal), windowOf(meal), source.profile(owner),
                s.getProcessedFoodMaxNova())
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "recipeId").build(), HttpStatus.BAD_REQUEST));
        apply(meal, p);
        meal.setLocked(true);
        meal.setUpdatedAt(Instant.now());
        meals.save(meal);
        SeasonMenuWeekEntity week = weeks.findByIdAndCreatedBy(meal.getWeekId(), owner).orElseThrow(MenuService::notFound);
        if (week.approved()) {
            shopping.rebuild(owner, week, meals.findByWeekIdOrderByMealDateAscIdAsc(week.getId()));
        }
        return response(week, allowed(s).size(), source.recipes(owner).size());
    }

    /**
     * Spec §5.12-4: after an accepted change, the days from {@code from} on of this and next week's menu are re-fitted
     * to the new budgets — a recipe that still fits (or one he chose) is kept and re-scaled, one that does not is
     * swapped; past days are never touched. Moved meals and list lines are marked „változott".
     */
    @Transactional
    public void refit(UUID owner, LocalDate from) {
        SeasonEntity s = seasons.findActive(owner).orElse(null);
        if (s == null) {
            return;
        }
        LocalDate thisMonday = from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<RecipeCandidate> allowed = allowedCandidates(owner, s);
        SensitivityProfile profile = source.profile(owner);
        for (LocalDate monday : List.of(thisMonday, thisMonday.plusWeeks(1))) {
            Optional<SeasonMenuWeekEntity> found = weeks.findByCreatedByAndWeekStart(owner, monday);
            if (found.isEmpty()) {
                continue;
            }
            SeasonMenuWeekEntity week = found.get();
            LocalDate start = from.isAfter(monday) ? from : monday;
            List<SeasonMenuMealEntity> all = meals.findByWeekIdOrderByMealDateAscIdAsc(week.getId());
            all.stream().filter(SeasonMenuMealEntity::isChanged).forEach(m -> m.setChanged(false)); // only the latest

            Map<String, SeasonMenuMealEntity> old = all.stream().filter(m -> !m.getMealDate().isBefore(start))
                .collect(Collectors.toMap(m -> key(m.getMealDate(), SlotKey.fromWire(m.getSlot()), m.getOrdinal()),
                    m -> m, (a, b) -> a, LinkedHashMap::new));
            if (old.isEmpty()) {
                continue;
            }
            boolean moved = false;
            for (MenuPlanner.DayBudget day : days(owner, start, monday.plusDays(6))) {
                for (MenuPlanner.Window w : MenuPlanner.withPreSession(day)) {
                    SeasonMenuMealEntity prev = old.remove(key(day.date(), w.slot(), w.ordinal()));
                    MenuPlanner.Pick next = keepOrPick(prev, day, w, allowed, profile, s.getProcessedFoodMaxNova());
                    if (prev == null) {
                        meals.save(entity(owner, week.getId(), next, budgetOf(w), true));
                        moved = true;
                        continue;
                    }
                    boolean same = Objects.equals(prev.getRecipeId(), next.recipeId())
                        && Objects.equals(scale2(prev.getServings()), scale2(next.servings()))
                        && Objects.equals(prev.getName(), next.name());
                    apply(prev, next);
                    prev.setBudgetKcal(budgetOf(w));
                    prev.setDayKind(next.kind());
                    prev.setSportName(next.sportName());
                    if (!same) {
                        prev.setChanged(true);
                        moved = true;
                    }
                    prev.setUpdatedAt(Instant.now());
                    meals.save(prev);
                }
            }
            if (!old.isEmpty()) {
                meals.deleteAll(old.values()); // a window the new day no longer has
                moved = true;
            }
            meals.flush();
            if (moved && week.approved()) {
                shopping.rebuild(owner, week, meals.findByWeekIdOrderByMealDateAscIdAsc(week.getId()));
            }
        }
    }

    /**
     * {@link #refit} in a transaction of its own — called after a season change committed, so a menu problem can never
     * roll back his accepted change.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void refitInOwnTransaction(UUID owner, LocalDate from) {
        refit(owner, from);
    }

    /** The scheduled generation (spec §5.7): next week's proposal once the season's menu day and time have come. */
    @Transactional
    public boolean generateIfDue(SeasonEntity s, LocalDate today, LocalTime now) {
        if (s.getMenuDay() == null || !due(s.getMenuDay(), s.getMenuTime(), today, now)) {
            return false;
        }
        LocalDate next = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        if (weeks.findByCreatedByAndWeekStart(s.getCreatedBy(), next).isPresent()
            || allowedRepository.countBySeasonId(s.getId()) == 0) {
            return false;
        }
        generate(s.getCreatedBy(), next);
        return true;
    }

    /** From the menu day's menu time until Sunday midnight (a missed run catches up later that week). */
    public static boolean due(int menuDay, String menuTime, LocalDate today, LocalTime now) {
        int dow = today.getDayOfWeek().getValue() - 1;
        if (dow != menuDay) {
            return dow > menuDay;
        }
        LocalTime at;
        try {
            at = LocalTime.parse(menuTime == null ? "18:00" : menuTime);
        } catch (RuntimeException e) {
            at = LocalTime.of(18, 0);
        }
        return !now.isBefore(at);
    }

    // --- internals -----------------------------------------------------------------------------------------------

    private MenuPlanner.Pick keepOrPick(SeasonMenuMealEntity prev, MenuPlanner.DayBudget day, MenuPlanner.Window w,
                                        List<RecipeCandidate> allowed, SensitivityProfile profile, int novaMax) {
        if (prev != null && prev.getRecipeId() != null) {
            Optional<RecipeCandidate> r = allowed.stream().filter(c -> c.id().equals(prev.getRecipeId())).findFirst();
            if (r.isPresent() && (prev.isLocked() || MenuPlanner.fits(r.get(), w))) {
                Optional<MenuPlanner.Pick> kept = MenuPlanner.fit(r.get(), day, w, profile, novaMax);
                if (kept.isPresent()) {
                    return kept.get();
                }
            }
        }
        List<MenuPlanner.Pick> alt = MenuPlanner.alternatives(day, w, allowed, profile, novaMax, null, 1);
        if (!alt.isEmpty()) {
            return alt.get(0);
        }
        return MenuPlanner.tip(day, w, profile);
    }

    private List<MenuPlanner.DayBudget> days(UUID owner, LocalDate from, LocalDate to) {
        return source.frames(owner, from, to).stream().map(MenuService::day).toList();
    }

    static MenuPlanner.DayBudget day(SeasonMenuSourcePort.DayFrame f) {
        String kind = SeasonDayKind.of(f.gym(), f.sport()).key(); // the season's one day-kind vocabulary
        List<MenuPlanner.Window> windows = f.windows().stream()
            .filter(w -> w.budget() != null && w.budget().kcal() > 0)
            .map(w -> new MenuPlanner.Window(w.slot(), w.ordinal(), w.label(), w.budget(), w.atMin(), false))
            .toList();
        List<MenuPlanner.SportStart> sports = f.sports().stream()
            .map(s -> new MenuPlanner.SportStart(s.name(), s.startMin())).toList();
        return new MenuPlanner.DayBudget(f.date(), kind, sports, windows);
    }

    /** The window budgets of the days, keyed date|slot|ordinal, with the pre-session snacks included. */
    private static Map<String, Integer> budgets(List<MenuPlanner.DayBudget> days) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (MenuPlanner.DayBudget d : days) {
            for (MenuPlanner.Window w : MenuPlanner.withPreSession(d)) {
                out.put(key(d.date(), w.slot(), w.ordinal()), budgetOf(w));
            }
        }
        return out;
    }

    private static int budgetOf(MenuPlanner.Window w) {
        return w.budget() == null ? 0 : w.budget().kcal();
    }

    private static String key(LocalDate date, SlotKey slot, int ordinal) {
        return date + "|" + (slot == null ? "?" : slot.wire()) + "|" + ordinal;
    }

    /** A meal's own day and window, from what it stored (no re-computation of the day): enough to scale a swap. */
    private static MenuPlanner.DayBudget dayOf(SeasonMenuMealEntity m) {
        return new MenuPlanner.DayBudget(m.getMealDate(), m.getDayKind(), m.getSportName(), null, List.of(windowOf(m)));
    }

    private static MenuPlanner.Window windowOf(SeasonMenuMealEntity m) {
        int kcal = m.getBudgetKcal() == null ? m.getKcal() : m.getBudgetKcal();
        return new MenuPlanner.Window(SlotKey.fromWire(m.getSlot()), m.getOrdinal(), m.getLabel(),
            new Macros4(kcal, m.getProteinG() == null ? 0 : m.getProteinG(), 0, 0), m.getAtMin(), m.isPreSession());
    }

    private static SeasonMenuMealEntity entity(UUID owner, UUID weekId, MenuPlanner.Pick p, int budgetKcal,
                                               boolean changed) {
        SeasonMenuMealEntity e = new SeasonMenuMealEntity();
        e.setCreatedBy(owner);
        e.setWeekId(weekId);
        e.setMealDate(p.date());
        e.setDayKind(p.kind());
        e.setSportName(p.sportName());
        e.setSlot(p.slot().wire());
        e.setOrdinal(p.ordinal());
        e.setLabel(p.label());
        e.setPreSession(p.preSession());
        e.setBudgetKcal(budgetKcal);
        e.setChanged(changed);
        apply(e, p);
        return e;
    }

    private static void apply(SeasonMenuMealEntity e, MenuPlanner.Pick p) {
        e.setRecipeId(p.recipeId());
        e.setName(p.name().length() > 200 ? p.name().substring(0, 200) : p.name());
        e.setServings(p.servings());
        e.setKcal(p.kcal());
        e.setProteinG(p.proteinG());
        e.setLabel(p.label());
        e.setPreSession(p.preSession());
        e.setAtMin(p.atMin());
    }

    private static BigDecimal scale2(BigDecimal v) {
        return v == null ? null : v.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private List<RecipeCandidate> allowedCandidates(UUID owner, SeasonEntity s) {
        Set<UUID> allowed = allowed(s);
        return source.recipes(owner).stream().filter(r -> allowed.contains(r.id())).toList();
    }

    private Set<UUID> allowed(SeasonEntity s) {
        return allowedRepository.findBySeasonId(s.getId()).stream()
            .map(SeasonAllowedRecipeEntity::getRecipeId).collect(Collectors.toSet());
    }

    private Set<UUID> allowed(UUID owner) {
        return seasons.findActive(owner).map(this::allowed).orElse(Set.of());
    }

    private SeasonEntity requireActive(UUID owner) {
        return seasons.findActive(owner).orElseThrow(MenuService::notFound);
    }

    private SeasonMenuMealEntity requireMeal(UUID owner, UUID mealId) {
        return meals.findByIdAndCreatedBy(mealId, owner).orElseThrow(MenuService::notFound);
    }

    private static void requireMonday(LocalDate weekStart) {
        if (weekStart == null || weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "weekStart").build(),
                HttpStatus.BAD_REQUEST);
        }
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }

    private SeasonMenuWeek response(SeasonMenuWeekEntity w, int allowedCount, int recipeCount) {
        Map<LocalDate, List<SeasonMenuMealEntity>> byDay = new LinkedHashMap<>();
        meals.findByWeekIdOrderByMealDateAscIdAsc(w.getId()).stream()
            .sorted(java.util.Comparator.comparing(SeasonMenuMealEntity::getMealDate)
                .thenComparing(SeasonMenuMealEntity::getAtMin))
            .forEach(m -> byDay.computeIfAbsent(m.getMealDate(), k -> new ArrayList<>()).add(m));
        List<SeasonMenuDay> days = new ArrayList<>();
        byDay.forEach((date, ms) -> days.add(SeasonMenuDay.builder()
            .date(date)
            .kind(SeasonMenuDay.KindEnum.fromValue(ms.get(0).getDayKind()))
            .sportName(ms.get(0).getSportName())
            .kcal(ms.stream().mapToInt(SeasonMenuMealEntity::getKcal).sum())
            .meals(new ArrayList<>(ms.stream().map(MenuService::meal).toList()))
            .build()));
        return SeasonMenuWeek.builder()
            .id(w.getId())
            .weekStart(w.getWeekStart())
            .status(SeasonMenuWeek.StatusEnum.fromValue(w.getStatus()))
            .repeated(w.isRepeated())
            .allowedCount(allowedCount)
            .recipeCount(recipeCount)
            .approvedAt(w.getApprovedAt() == null ? null : w.getApprovedAt().atOffset(ZoneOffset.UTC))
            .days(days)
            .build();
    }

    private static SeasonMenuMeal meal(SeasonMenuMealEntity m) {
        return SeasonMenuMeal.builder()
            .id(m.getId())
            .slot(SeasonMenuMeal.SlotEnum.fromValue(m.getSlot()))
            .label(m.getLabel())
            .recipeId(m.getRecipeId())
            .name(m.getName())
            .servings(m.getServings())
            .kcal(m.getKcal())
            .proteinG(m.getProteinG())
            .preSession(m.isPreSession())
            .locked(m.isLocked())
            .changed(m.isChanged())
            .build();
    }

    private static SeasonMenuWeek empty(LocalDate weekStart, String status, int allowedCount, int recipeCount) {
        return SeasonMenuWeek.builder()
            .weekStart(weekStart)
            .status(SeasonMenuWeek.StatusEnum.fromValue(status))
            .repeated(false)
            .allowedCount(allowedCount)
            .recipeCount(recipeCount)
            .days(new ArrayList<>())
            .build();
    }
}
