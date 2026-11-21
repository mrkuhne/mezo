package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.SeasonMenuAlternative;
import io.mrkuhne.mezo.api.dto.SeasonMenuDay;
import io.mrkuhne.mezo.api.dto.SeasonMenuMeal;
import io.mrkuhne.mezo.api.dto.SeasonMenuWeek;
import io.mrkuhne.mezo.api.dto.ShoppingItem;
import io.mrkuhne.mezo.api.dto.ShoppingListResponse;
import io.mrkuhne.mezo.feature.meal.service.dayplan.DayPlanService;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlanWindow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Suggestion;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonMenuWeekRepository;
import io.mrkuhne.mezo.feature.season.service.MenuService;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.feature.season.service.ShoppingListService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad S3 (mezo-r36n9.16): the weekly menu, approval → the day plan, the re-fit and the shopping list. */
@Transactional
@Import(SeasonFixture.class)
class MenuServiceIT extends AbstractIntegrationTest {

    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonService seasonService;
    @Autowired private MenuService menuService;
    @Autowired private ShoppingListService shoppingListService;
    @Autowired private DayPlanService dayPlanService;
    @Autowired private SeasonMenuWeekRepository weekRepository;
    @Autowired private RecipeRepository recipeRepository;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private EntityManager em;
    @Autowired private io.mrkuhne.mezo.feature.season.repository.SeasonRepository seasonRepository;

    private static final LocalDate NEXT_MONDAY = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY));

    private record Library(List<RecipeEntity> all, RecipeEntity firstDinner, PantryItemEntity chicken) {
    }

    /** Two recipes per window kind (snapshot 110 kcal / 100 g): breakfast ~600, lunch ~770, snack ~250, dinner ~700. */
    private Library library(UUID owner) {
        PantryItemEntity chicken = pantryItemPopulator.createPricedFood(owner, "Csirkemell", "meat", null, null, (short) 1);
        PantryItemEntity oats = pantryItemPopulator.createPricedFood(owner, "Zabpehely", "grains", null, null, (short) 1);
        List<RecipeEntity> all = new ArrayList<>();
        all.add(recipe(owner, "Zabkása", "breakfast", oats, 545));
        all.add(recipe(owner, "Rántotta", "breakfast", oats, 520));
        all.add(recipe(owner, "Csirkés rizstál", "lunch", chicken, 700));
        all.add(recipe(owner, "Pulykás wok", "lunch", chicken, 680));
        all.add(recipe(owner, "Túró, alma", "snack", oats, 230));
        all.add(recipe(owner, "Joghurt dióval", "snack", oats, 210));
        RecipeEntity dinner = recipe(owner, "Lazac", "dinner", chicken, 640);
        all.add(dinner);
        all.add(recipe(owner, "Gulyás", "dinner", chicken, 660));
        all.add(recipe(owner, "Lencsefőzelék", "dinner", oats, 620));
        return new Library(all, dinner, chicken);
    }

    private RecipeEntity recipe(UUID owner, String name, String category, PantryItemEntity item, int grams) {
        RecipeEntity r = new RecipeEntity();
        r.setCreatedBy(owner);
        r.setName(name);
        r.setCategory(category);
        r.setServings(1);
        r.setPrepMins(10);
        r.setTags(List.of());
        r.setNovaDominant((short) 1);
        RecipeIngredientEntity l = new RecipeIngredientEntity();
        l.setRecipe(r);
        l.setCreatedBy(owner);
        l.setPantryItemId(item.getId());
        l.setAmount(BigDecimal.valueOf(grams));
        l.setUnit("g");
        l.setLineOrder(0);
        l.setSnapshotName(item.getCatalog().getName());
        l.setSnapshotPer(new BigDecimal("100"));
        l.setSnapshotBasisUnit("g");
        l.setSnapshotKcal(new BigDecimal("110"));
        l.setSnapshotProteinG(new BigDecimal("10"));
        l.setSnapshotCarbsG(new BigDecimal("10"));
        l.setSnapshotFatG(new BigDecimal("3"));
        r.getLines().add(l);
        return recipeRepository.saveAndFlush(r);
    }

    private SeasonEntity season(UUID owner, List<RecipeEntity> allowed) {
        SeasonEntity s = seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        seasonService.putRecipes(owner, s.getId(), allowed.stream().map(RecipeEntity::getId).toList(),
            allowed.stream().map(RecipeEntity::getId).collect(Collectors.toSet()));
        em.flush();
        return s;
    }

    private UUID seasonId(UUID owner) {
        return seasonRepository.findActive(owner).orElseThrow().getId();
    }

    private static List<SeasonMenuMeal> meals(SeasonMenuWeek w) {
        return w.getDays().stream().flatMap(d -> d.getMeals().stream()).toList();
    }

    @Test
    void noAllowedRecipesGivesSeedingStateAndSavesNothing() {
        UUID owner = fixture.owner("menu-seeding@test.local");
        library(owner);
        season(owner, List.of());

        SeasonMenuWeek w = menuService.generate(owner, NEXT_MONDAY);

        assertThat(w.getStatus()).isEqualTo(SeasonMenuWeek.StatusEnum.SEEDING);
        assertThat(w.getDays()).isEmpty();
        assertThat(w.getRecipeCount()).isEqualTo(9);
        assertThat(weekRepository.findByCreatedByAndWeekStart(owner, NEXT_MONDAY)).isEmpty();
    }

    @Test
    void generatedWeekFollowsTheDayBudgets() {
        UUID owner = fixture.owner("menu-generate@test.local");
        Library lib = library(owner);
        season(owner, lib.all());

        SeasonMenuWeek w = menuService.generate(owner, NEXT_MONDAY);

        assertThat(w.getStatus()).isEqualTo(SeasonMenuWeek.StatusEnum.PROPOSED);
        assertThat(w.getDays()).hasSize(7);
        Map<LocalDate, SeasonMenuDay> byDate = w.getDays().stream()
            .collect(Collectors.toMap(SeasonMenuDay::getDate, Function.identity()));
        SeasonMenuDay monday = byDate.get(NEXT_MONDAY);              // gym
        SeasonMenuDay tuesday = byDate.get(NEXT_MONDAY.plusDays(1)); // gym + volleyball
        SeasonMenuDay wednesday = byDate.get(NEXT_MONDAY.plusDays(2)); // rest
        assertThat(monday.getKind()).isEqualTo(SeasonMenuDay.KindEnum.EDZESNAP);
        assertThat(tuesday.getKind()).isEqualTo(SeasonMenuDay.KindEnum.EDZES_SPORT);
        assertThat(wednesday.getKind()).isEqualTo(SeasonMenuDay.KindEnum.PIHENONAP);
        assertThat(monday.getKcal()).isGreaterThan(wednesday.getKcal());
        assertThat(meals(w)).allSatisfy(m -> assertThat(m.getRecipeId()).isNotNull());
        // the 3-day dinner rule holds across the week
        List<UUID> dinners = w.getDays().stream().flatMap(d -> d.getMeals().stream())
            .filter(m -> m.getSlot() == SeasonMenuMeal.SlotEnum.DINNER).map(SeasonMenuMeal::getRecipeId).toList();
        for (int i = 0; i + 1 < dinners.size(); i++) {
            assertThat(dinners.get(i + 1)).isNotEqualTo(dinners.get(i));
        }
    }

    @Test
    void anotherMenuIsAnotherVariantAndAnApprovedWeekIsNotReplanned() {
        UUID owner = fixture.owner("menu-variant@test.local");
        Library lib = library(owner);
        season(owner, lib.all());
        SeasonMenuWeek first = menuService.generate(owner, NEXT_MONDAY);
        SeasonMenuWeek second = menuService.generate(owner, NEXT_MONDAY);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(meals(second).stream().map(SeasonMenuMeal::getRecipeId).toList())
            .isNotEqualTo(meals(first).stream().map(SeasonMenuMeal::getRecipeId).toList());

        menuService.approve(owner, second.getId());
        assertThatThrownBy(() -> menuService.generate(owner, NEXT_MONDAY))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                assertThat(e.getMessage()).isEqualTo("MENU_NOT_PROPOSED");
                assertThat(e.getStatus().value()).isEqualTo(409);
            });
    }

    @Test
    void swapPutsAnAlternativeInTheSameWindow() {
        UUID owner = fixture.owner("menu-swap@test.local");
        Library lib = library(owner);
        season(owner, lib.all());
        SeasonMenuWeek w = menuService.generate(owner, NEXT_MONDAY);
        SeasonMenuMeal lunch = meals(w).stream().filter(m -> m.getSlot() == SeasonMenuMeal.SlotEnum.LUNCH)
            .findFirst().orElseThrow();

        List<SeasonMenuAlternative> alts = menuService.alternatives(owner, lunch.getId());
        assertThat(alts).isNotEmpty().allSatisfy(a -> assertThat(a.getRecipeId()).isNotEqualTo(lunch.getRecipeId()));

        SeasonMenuWeek after = menuService.swap(owner, lunch.getId(), alts.get(0).getRecipeId());
        SeasonMenuMeal swapped = meals(after).stream().filter(m -> m.getId().equals(lunch.getId())).findFirst().orElseThrow();
        assertThat(swapped.getRecipeId()).isEqualTo(alts.get(0).getRecipeId());
        assertThat(swapped.getLocked()).isTrue();
    }

    @Test
    void approvedMealIsTheDaySuggestion() {
        UUID owner = fixture.owner("menu-dayplan@test.local");
        Library lib = library(owner);
        season(owner, lib.all());
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        SeasonMenuWeek w = menuService.approve(owner, menuService.generate(owner, monday).getId());
        em.flush();
        LocalDate today = LocalDate.now();
        Set<String> todaysMenu = w.getDays().stream().filter(d -> d.getDate().equals(today))
            .flatMap(d -> d.getMeals().stream()).map(SeasonMenuMeal::getName).collect(Collectors.toSet());

        List<DayPlanWindow> windows = dayPlanService.plan(owner, today, LocalTime.of(0, 1)).windows();

        List<Suggestion> offers = windows.stream().map(DayPlanWindow::suggestion).filter(s -> s != null).toList();
        assertThat(offers).isNotEmpty().allSatisfy(s -> {
            assertThat(s.kind()).isEqualTo(Suggestion.Kind.RECIPE);
            assertThat(s.reason()).isEqualTo("ez szerepel a jóváhagyott heti menüdben");
            assertThat(todaysMenu).anyMatch(name -> s.text().startsWith(name + " — "));
        });
    }

    @Test
    void onlyAllowedRecipesSuggested() {
        UUID owner = fixture.owner("menu-allowed@test.local");
        Library lib = library(owner);
        RecipeEntity onlyDinner = lib.firstDinner();
        season(owner, List.of(onlyDinner));

        List<DayPlanWindow> windows = dayPlanService.plan(owner, LocalDate.now(), LocalTime.of(0, 1)).windows();

        assertThat(windows.stream().map(DayPlanWindow::suggestion).filter(s -> s != null && s.recipeId() != null))
            .allSatisfy(s -> assertThat(s.recipeId()).isEqualTo(onlyDinner.getId()));
    }

    @Test
    void approvalMakesTheShoppingListWithStaplesOnlyOnTap() {
        UUID owner = fixture.owner("menu-list@test.local");
        Library lib = library(owner);
        season(owner, lib.all());
        menuService.approve(owner, menuService.generate(owner, NEXT_MONDAY).getId());
        em.flush();

        ShoppingListResponse list = shoppingListService.get(owner, NEXT_MONDAY);
        assertThat(list.getItems()).extracting(ShoppingItem::getName).containsExactlyInAnyOrder("Csirkemell", "Zabpehely");
        ShoppingItem chicken = list.getItems().stream().filter(i -> i.getName().equals("Csirkemell")).findFirst().orElseThrow();
        assertThat(chicken.getShelf()).isEqualTo(ShoppingItem.ShelfEnum.HUS);
        assertThat(chicken.getAmountText()).endsWith(" kg");
        assertThat(chicken.getForRecipes()).isNotEmpty();
        assertThat(list.getItems()).noneMatch(ShoppingItem::getStaple);
        assertThat(list.getStaples()).extracting(c -> c.getName()).contains("Olívaolaj", "Kávé");

        ShoppingListResponse withOil = shoppingListService.toggleStaple(owner, list.getId(), "Olívaolaj", true);
        assertThat(withOil.getItems()).anyMatch(i -> i.getStaple() && i.getName().equals("Olívaolaj"));
        assertThat(withOil.getStaples()).anyMatch(c -> c.getName().equals("Olívaolaj") && c.getOnList());

        shoppingListService.check(owner, chicken.getId(), true);
        em.flush();
        em.clear();
        assertThat(shoppingListService.get(owner, NEXT_MONDAY).getItems())
            .anyMatch(i -> i.getId().equals(chicken.getId()) && i.getChecked());
        assertThat(shoppingListService.lists(owner)).hasSize(1);
    }

    @Test
    void refitTouchesOnlyFutureDaysAndMarksTheList() {
        UUID owner = fixture.owner("menu-refit@test.local");
        Library lib = library(owner);
        season(owner, lib.all());
        SeasonMenuWeek approved = menuService.approve(owner, menuService.generate(owner, NEXT_MONDAY).getId());
        em.flush();
        Map<UUID, SeasonMenuMeal> before = meals(approved).stream()
            .collect(Collectors.toMap(SeasonMenuMeal::getId, Function.identity()));

        // Saturday (dow 5) becomes a training day, and only one dinner stays allowed: from Thursday on every dinner
        // must become it, while Monday–Wednesday keep their (now disallowed) meals untouched.
        trainPopulator.createGymSlot(owner, 5, "09:00");
        RecipeEntity lentils = lib.all().stream().filter(r -> r.getName().equals("Lencsefőzelék")).findFirst().orElseThrow();
        List<UUID> kept = lib.all().stream().filter(r -> !"dinner".equals(r.getCategory()) || r == lentils)
            .map(RecipeEntity::getId).toList();
        seasonService.putRecipes(owner, seasonId(owner), kept, Set.copyOf(kept));
        em.flush();
        LocalDate from = NEXT_MONDAY.plusDays(3);
        menuService.refit(owner, from);
        em.flush();
        em.clear();

        SeasonMenuWeek after = menuService.get(owner, NEXT_MONDAY);
        for (SeasonMenuDay d : after.getDays()) {
            if (d.getDate().isBefore(from)) {
                assertThat(d.getMeals()).allSatisfy(m -> {
                    SeasonMenuMeal was = before.get(m.getId());
                    assertThat(was).isNotNull();
                    assertThat(m.getRecipeId()).isEqualTo(was.getRecipeId());
                    assertThat(m.getKcal()).isEqualTo(was.getKcal());
                    assertThat(m.getChanged()).isFalse();
                });
            }
        }
        SeasonMenuDay saturday = after.getDays().stream().filter(d -> d.getDate().equals(NEXT_MONDAY.plusDays(5)))
            .findFirst().orElseThrow();
        assertThat(saturday.getKind()).isEqualTo(SeasonMenuDay.KindEnum.EDZESNAP);
        assertThat(after.getDays()).filteredOn(d -> !d.getDate().isBefore(from))
            .flatExtracting(SeasonMenuDay::getMeals)
            .filteredOn(m -> m.getSlot() == SeasonMenuMeal.SlotEnum.DINNER)
            .allSatisfy(m -> assertThat(m.getRecipeId()).isEqualTo(lentils.getId()));
        assertThat(meals(after)).anyMatch(SeasonMenuMeal::getChanged);
        assertThat(shoppingListService.get(owner, NEXT_MONDAY).getChangedCount()).isPositive();
    }

    @Test
    void scheduledGenerationRunsOnceOnTheMenuDay() {
        UUID owner = fixture.owner("menu-job@test.local");
        Library lib = library(owner);
        SeasonEntity s = season(owner, lib.all()); // menu day 6 (vasárnap) 18:00
        LocalDate sunday = LocalDate.now().with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));

        assertThat(menuService.generateIfDue(s, sunday, LocalTime.of(17, 59))).isFalse();
        assertThat(menuService.generateIfDue(s, sunday, LocalTime.of(18, 0))).isTrue();
        assertThat(menuService.generateIfDue(s, sunday, LocalTime.of(18, 1))).isFalse();
        assertThat(weekRepository.findByCreatedByAndWeekStart(owner, sunday.plusDays(1))).isPresent();
    }

    @Test
    void dueWindow() {
        LocalDate sunday = LocalDate.of(2026, 11, 22);
        assertThat(MenuService.due(6, "18:00", sunday, LocalTime.of(18, 0))).isTrue();
        assertThat(MenuService.due(6, "18:00", sunday, LocalTime.of(17, 0))).isFalse();
        assertThat(MenuService.due(6, "18:00", sunday.minusDays(1), LocalTime.of(20, 0))).isFalse();
        assertThat(MenuService.due(2, "09:00", sunday.minusDays(2), LocalTime.of(8, 0))).isTrue(); // catch-up Friday
    }

    @Test
    void anApprovedMealNoLongerAllowedIsNotTheDaySuggestion() {
        UUID owner = fixture.owner("menu-unallowed@test.local");
        Library lib = library(owner);
        season(owner, lib.all());
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        SeasonMenuWeek w = menuService.approve(owner, menuService.generate(owner, monday).getId());
        em.flush();
        Set<UUID> todays = w.getDays().stream().filter(d -> d.getDate().equals(LocalDate.now()))
            .flatMap(d -> d.getMeals().stream()).map(SeasonMenuMeal::getRecipeId).collect(Collectors.toSet());
        // he unselects today's recipes: the room must not keep offering them from the menu
        List<UUID> kept = lib.all().stream().map(RecipeEntity::getId).filter(id -> !todays.contains(id)).toList();
        seasonService.putRecipes(owner, seasonId(owner), kept, Set.copyOf(kept));
        em.flush();

        List<DayPlanWindow> windows = dayPlanService.plan(owner, LocalDate.now(), LocalTime.of(0, 1)).windows();

        assertThat(windows.stream().map(DayPlanWindow::suggestion).filter(s -> s != null && s.recipeId() != null))
            .allSatisfy(s -> assertThat(todays).doesNotContain(s.recipeId()));
    }

    @Test
    void anApprovedMealWhoseWindowChangedIsNotTheDaySuggestion() {
        UUID owner = fixture.owner("menu-window-moved@test.local");
        Library lib = library(owner);
        season(owner, lib.all());
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        menuService.approve(owner, menuService.generate(owner, monday).getId());
        em.flush();
        // every approved meal of today now claims a budget far from its window's (as after a moved workout)
        em.createNativeQuery("update season_menu_meal set budget_kcal = budget_kcal * 3 where meal_date = current_date")
            .executeUpdate();
        em.flush();
        em.clear();

        List<DayPlanWindow> windows = dayPlanService.plan(owner, LocalDate.now(), LocalTime.of(0, 1)).windows();

        assertThat(windows.stream().map(DayPlanWindow::suggestion).filter(s -> s != null))
            .noneMatch(s -> "ez szerepel a jóváhagyott heti menüdben".equals(s.reason()));
    }

    @Test
    void aPastMealCannotBeSwapped() {
        UUID owner = fixture.owner("menu-past@test.local");
        Library lib = library(owner);
        season(owner, lib.all());
        LocalDate lastMonday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        SeasonMenuWeek w = menuService.generate(owner, lastMonday);
        SeasonMenuMeal past = meals(w).get(0);
        UUID other = lib.all().stream().filter(r -> r.getCategory().equals(past.getSlot().getValue()))
            .map(RecipeEntity::getId).filter(id -> !id.equals(past.getRecipeId())).findFirst().orElseThrow();
        assertThatThrownBy(() -> menuService.swap(owner, past.getId(), other))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus().value()).isEqualTo(400));
    }
}
