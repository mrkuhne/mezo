package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.nutrition.service.NovaRule;
import io.mrkuhne.mezo.feature.nutrition.service.Sensitivity;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityLevel;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.RecipeCandidate;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.season.service.MenuPlanner;
import io.mrkuhne.mezo.feature.season.service.MenuPlanner.DayBudget;
import io.mrkuhne.mezo.feature.season.service.MenuPlanner.MenuWeek;
import io.mrkuhne.mezo.feature.season.service.MenuPlanner.Pick;
import io.mrkuhne.mezo.feature.season.service.MenuPlanner.Window;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class MenuPlannerTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 11, 23);
    private static final SensitivityProfile NONE = new SensitivityProfile(List.of(), new NovaRule(false, 4));

    private static RecipeCandidate recipe(String name, SlotKey slot, int kcal) {
        return recipe(name, slot, kcal, Map.of(), null);
    }

    private static RecipeCandidate recipe(String name, SlotKey slot, int kcal, Map<String, AllergenState> allergens,
                                          Boolean lactoseFree) {
        return new RecipeCandidate(UUID.nameUUIDFromBytes(name.getBytes()), name, slot,
            new Macros4(kcal, kcal / 20, kcal / 8, kcal / 30), false, 1, allergens, lactoseFree);
    }

    private static Window w(SlotKey slot, int ordinal, String label, int kcal, int atMin) {
        return new Window(slot, ordinal, label, new Macros4(kcal, kcal / 20, kcal / 8, kcal / 30), atMin, false);
    }

    private static DayBudget day(int offset, String kind, int dayKcal) {
        return new DayBudget(MONDAY.plusDays(offset), kind, null, null, List.of(
            w(SlotKey.BREAKFAST, 1, "Reggeli", dayKcal * 25 / 100, 480),
            w(SlotKey.LUNCH, 1, "Ebéd", dayKcal * 35 / 100, 750),
            w(SlotKey.SNACK, 1, "Uzsonna", dayKcal * 10 / 100, 930),
            w(SlotKey.DINNER, 1, "Vacsora", dayKcal * 30 / 100, 1110)));
    }

    private static List<DayBudget> week() {
        List<DayBudget> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            days.add(day(i, i % 2 == 0 ? MenuPlanner.KIND_TRAINING : MenuPlanner.KIND_REST, i % 2 == 0 ? 2440 : 2200));
        }
        return days;
    }

    private static List<RecipeCandidate> library() {
        List<RecipeCandidate> out = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            out.add(recipe("Reggeli " + i, SlotKey.BREAKFAST, 560 + i * 20));
            out.add(recipe("Ebéd " + i, SlotKey.LUNCH, 760 + i * 20));
            out.add(recipe("Uzsonna " + i, SlotKey.SNACK, 230 + i * 10));
        }
        for (int i = 0; i < 6; i++) {
            out.add(recipe("Vacsora " + i, SlotKey.DINNER, 700 + i * 15));
        }
        return out;
    }

    private static int dayKcal(MenuWeek m, LocalDate d) {
        return m.meals().stream().filter(p -> p.date().equals(d)).mapToInt(Pick::kcal).sum();
    }

    @Test
    void trainingDayGetsMoreKcalThanRestDay() {
        MenuWeek m = MenuPlanner.plan(week(), library(), NONE, 4, 0);
        assertThat(m.status()).isEqualTo(MenuWeek.PROPOSED);
        assertThat(dayKcal(m, MONDAY)).isGreaterThan(dayKcal(m, MONDAY.plusDays(1)));
        assertThat(m.meals()).hasSize(28).allSatisfy(p -> assertThat(p.recipeId()).isNotNull());
    }

    @Test
    void portionsAreScaledToTheWindow() {
        MenuWeek m = MenuPlanner.plan(week(), library(), NONE, 4, 0);
        Pick monLunch = m.meals().stream().filter(p -> p.date().equals(MONDAY) && p.slot() == SlotKey.LUNCH)
            .findFirst().orElseThrow();
        assertThat(Math.abs(monLunch.kcal() - 2440 * 35 / 100)).isLessThanOrEqualTo(2440 * 35 / 100 * 15 / 100);
        assertThat(monLunch.servings().doubleValue()).isBetween(0.5, 2.0);
        assertThat(monLunch.servings().doubleValue() * 4 % 1).isZero();
    }

    @Test
    void noSameDinnerWithin3Days() {
        MenuWeek m = MenuPlanner.plan(week(), library(), NONE, 4, 0);
        List<UUID> dinners = m.meals().stream().filter(p -> p.slot() == SlotKey.DINNER).map(Pick::recipeId).toList();
        for (int i = 0; i < dinners.size(); i++) {
            for (int j = i + 1; j < Math.min(dinners.size(), i + 3); j++) {
                assertThat(dinners.get(j)).as("dinner %d vs %d", i, j).isNotEqualTo(dinners.get(i));
            }
        }
        assertThat(m.repeated()).isFalse();
    }

    @Test
    void repeatsWhenFewRecipes() {
        List<RecipeCandidate> two = List.of(recipe("Lazac", SlotKey.DINNER, 720), recipe("Gulyás", SlotKey.DINNER, 760));
        List<DayBudget> dinnersOnly = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            dinnersOnly.add(new DayBudget(MONDAY.plusDays(i), MenuPlanner.KIND_REST, null, null,
                List.of(w(SlotKey.DINNER, 1, "Vacsora", 740, 1110))));
        }
        MenuWeek m = MenuPlanner.plan(dinnersOnly, two, NONE, 4, 0);
        assertThat(m.status()).isEqualTo(MenuWeek.PROPOSED);
        assertThat(m.meals()).hasSize(7).allSatisfy(p -> assertThat(p.recipeId()).isNotNull());
        assertThat(m.repeated()).isTrue();
    }

    @Test
    void noAllowedRecipesGivesSeedingState() {
        MenuWeek m = MenuPlanner.plan(week(), List.of(), NONE, 4, 0);
        assertThat(m.status()).isEqualTo(MenuWeek.SEEDING);
        assertThat(m.meals()).isEmpty();
    }

    @Test
    void aWindowNoRecipeFitsGetsAnIngredientTipNotAnEmptyCard() {
        MenuWeek m = MenuPlanner.plan(week(), List.of(recipe("Lazac", SlotKey.DINNER, 720)), NONE, 4, 0);
        Pick breakfast = m.meals().stream().filter(p -> p.slot() == SlotKey.BREAKFAST).findFirst().orElseThrow();
        assertThat(breakfast.recipeId()).isNull();
        assertThat(breakfast.name()).isNotBlank();
        assertThat(breakfast.kcal()).isPositive();
    }

    @Test
    void respectsLactoseIntolerance() {
        SensitivityProfile lactose = new SensitivityProfile(
            List.of(new Sensitivity("milk", SensitivityLevel.INTOLERANCE, null)), new NovaRule(false, 4));
        RecipeCandidate milky = recipe("Tejbegríz", SlotKey.BREAKFAST, 600, Map.of("milk", AllergenState.CONTAINS), false);
        RecipeCandidate lactoseFree = recipe("Zabkása laktózmentes joghurttal", SlotKey.BREAKFAST, 600,
            Map.of("milk", AllergenState.CONTAINS), true);
        MenuWeek m = MenuPlanner.plan(week(), List.of(milky, lactoseFree), lactose, 4, 0);
        assertThat(m.meals().stream().filter(p -> p.slot() == SlotKey.BREAKFAST).map(Pick::recipeId))
            .containsOnly(lactoseFree.id());
    }

    @Test
    void novaRuleOfTheSeasonFiltersRecipes() {
        RecipeCandidate processed = new RecipeCandidate(UUID.randomUUID(), "Virsli", SlotKey.DINNER,
            new Macros4(700, 30, 40, 40), false, 4, Map.of(), null);
        MenuWeek m = MenuPlanner.plan(week(), List.of(processed), NONE, 2, 0);
        assertThat(m.meals().stream().filter(p -> p.slot() == SlotKey.DINNER)).allSatisfy(p ->
            assertThat(p.recipeId()).isNull());
    }

    @Test
    void sportDayMarksItsPreSessionSnack() {
        DayBudget volleyball = new DayBudget(MONDAY, MenuPlanner.KIND_SPORT, "röplabda", 1080, List.of(
            w(SlotKey.BREAKFAST, 1, "Reggeli", 600, 480),
            w(SlotKey.LUNCH, 1, "Ebéd", 800, 750),
            w(SlotKey.SNACK, 1, "Uzsonna", 300, 960),
            w(SlotKey.DINNER, 1, "Vacsora", 800, 1230)));
        MenuWeek m = MenuPlanner.plan(List.of(volleyball), library(), NONE, 4, 0);
        Pick snack = m.meals().stream().filter(p -> p.slot() == SlotKey.SNACK).findFirst().orElseThrow();
        assertThat(snack.preSession()).isTrue();
        assertThat(snack.label()).isEqualTo("Röplabda előtt");
    }

    @Test
    void sportDayWithNothingBeforeTheSessionGetsASnackAdded() {
        DayBudget early = new DayBudget(MONDAY, MenuPlanner.KIND_SPORT, "röplabda", 420, List.of(
            w(SlotKey.BREAKFAST, 1, "Reggeli", 600, 480),
            w(SlotKey.DINNER, 1, "Vacsora", 800, 1230)));
        MenuWeek m = MenuPlanner.plan(List.of(early), library(), NONE, 4, 0);
        assertThat(m.meals()).hasSize(3);
        assertThat(m.meals().get(0).preSession()).isTrue();
        assertThat(m.meals().get(0).slot()).isEqualTo(SlotKey.SNACK);
    }

    @Test
    void anotherVariantGivesAnotherMenu() {
        MenuWeek a = MenuPlanner.plan(week(), library(), NONE, 4, 0);
        MenuWeek b = MenuPlanner.plan(week(), library(), NONE, 4, 1);
        assertThat(a.meals().stream().map(Pick::recipeId).collect(Collectors.toList()))
            .isNotEqualTo(b.meals().stream().map(Pick::recipeId).collect(Collectors.toList()));
    }

    @Test
    void alternativesFitTheSameWindowAndSkipTheCurrent() {
        DayBudget d = week().get(0);
        Window lunch = d.windows().get(1);
        RecipeCandidate current = library().stream().filter(r -> r.category() == SlotKey.LUNCH).findFirst().orElseThrow();
        List<Pick> alts = MenuPlanner.alternatives(d, lunch, library(), NONE, 4, current.id(), 5);
        assertThat(alts).hasSize(3).allSatisfy(p -> {
            assertThat(p.slot()).isEqualTo(SlotKey.LUNCH);
            assertThat(p.recipeId()).isNotEqualTo(current.id());
        });
    }
}
