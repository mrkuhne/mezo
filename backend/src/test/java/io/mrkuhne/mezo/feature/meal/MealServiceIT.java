package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class MealServiceIT extends AbstractIntegrationTest {

    @Autowired private MealService service;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.meal.repository.MealItemRepository mealItemRepository;

    private UUID owner;
    private UUID other;

    @BeforeEach
    void setUpOwners() {
        owner = databasePopulator.populateUser("a@test.local");
        other = databasePopulator.populateUser("b@test.local");
    }

    // 110 kcal / 23 P / 0 C / 1.5 F per 100 g serving (cf. PantryItemPopulator.createFood).
    private PantryItemEntity food(UUID who, String name) {
        return pantryPopulator.createFood(who, name, LocalDate.of(2026, 5, 25));
    }

    // RecipePopulator: 2 servings, two lines snapshot-per 100 g (110/13/4/4.5), amounts 250 + 20.
    // Túró 250 g -> factor 2.5 -> 275/32.5/10/11.25 -> round 275/33/10/11
    // Méz   20 g -> factor 0.2 ->  22/2.6/0.8/0.9   -> round  22/3/1/1
    // whole rollup = 297 / 36 / 11 / 12 ; per serving (÷2, HALF_UP) = 149 / 18 / 6 / 6
    private RecipeEntity recipe(UUID who) {
        PantryItemEntity src = food(who, "Túró forrás");
        return recipePopulator.createRecipe(who, src.getId());
    }

    private MealItemRequest recipeItem(UUID recipeId, String adag) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("recipe");
        i.setRecipeId(recipeId);
        i.setAmount(new BigDecimal(adag));
        i.setUnit("adag");
        return i;
    }

    private MealItemRequest pantryItem(UUID pantryItemId, String grams) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("pantry");
        i.setPantryItemId(pantryItemId);
        i.setAmount(new BigDecimal(grams));
        i.setUnit("g");
        return i;
    }

    private MealRequest req(String slot, MealItemRequest... items) {
        MealRequest r = new MealRequest();
        r.setSlot(slot);
        r.setLoggedAt(OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC));
        r.setTitle("Ebéd");
        r.setItems(List.of(items));
        return r;
    }

    @Test
    void testCreate_shouldSnapshotRecipeArm_whenSourceIsRecipe() {
        RecipeEntity r = recipe(owner);

        MealResponse meal = service.create(owner, req("lunch", recipeItem(r.getId(), "1")));

        assertThat(meal.getId()).isNotNull();
        assertThat(meal.getSlot()).isEqualTo("lunch");
        assertThat(meal.getMealDate()).isEqualTo(LocalDate.of(2026, 6, 24));
        assertThat(meal.getItems()).singleElement().satisfies(i -> {
            assertThat(i.getSource()).isEqualTo("recipe");
            assertThat(i.getRecipeId()).isEqualTo(r.getId());
            assertThat(i.getPantryItemId()).isNull();
            assertThat(i.getName()).isEqualTo("Túrós tál"); // recipe name snapshot
            assertThat(i.getLineOrder()).isEqualTo(0);
            assertThat(i.getNova()).isEqualTo(1); // snapshot nova (Integer on the DTO)
            // per serving = whole rollup (297/36/11/12) ÷ 2 servings -> 149/18/6/6 ; amount 1 adag -> identity
            assertThat(i.getContribution().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(149));
            assertThat(i.getContribution().getP()).isEqualByComparingTo(BigDecimal.valueOf(18));
        });
        // meal rollup = the single item contribution
        assertThat(meal.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(149));
        // score is pending (NULL breakdown)
        assertThat(meal.getScore().getValue()).isNull();
    }

    @Test
    void testCreate_shouldSnapshotPantryArm_whenSourcePantry() {
        PantryItemEntity p = food(owner, "Csirkemell"); // 110/23/0/1.5 per 100 g

        MealResponse meal = service.create(owner, req("lunch", pantryItem(p.getId(), "200")));

        assertThat(meal.getItems()).singleElement().satisfies(i -> {
            assertThat(i.getSource()).isEqualTo("pantry");
            assertThat(i.getPantryItemId()).isEqualTo(p.getId());
            assertThat(i.getRecipeId()).isNull();
            assertThat(i.getName()).isEqualTo("Csirkemell");
            // factor = 200 / 100 = 2 -> 220/46/0/3
            assertThat(i.getContribution().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(220));
            assertThat(i.getContribution().getP()).isEqualByComparingTo(BigDecimal.valueOf(46));
            assertThat(i.getContribution().getF()).isEqualByComparingTo(BigDecimal.valueOf(3));
        });
        assertThat(meal.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(220));
    }

    @Test
    void testCreate_shouldOrderItemsByRequestIndex_whenMixedArms() {
        RecipeEntity r = recipe(owner);
        PantryItemEntity p = food(owner, "Csirkemell");

        MealResponse meal = service.create(owner, req("lunch",
            pantryItem(p.getId(), "100"), recipeItem(r.getId(), "1")));

        assertThat(meal.getItems()).extracting("lineOrder").containsExactly(0, 1);
        assertThat(meal.getItems()).extracting("source").containsExactly("pantry", "recipe");
    }

    @Test
    void testCreate_shouldReject_whenRecipeMissingOrForeign() {
        RecipeEntity foreign = recipe(other);

        assertThatThrownBy(() -> service.create(owner, req("lunch", recipeItem(UUID.randomUUID(), "1"))))
            .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> service.create(owner, req("lunch", recipeItem(foreign.getId(), "1"))))
            .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
    }

    @Test
    void testCreate_shouldReject_whenPantryMissingOrForeign() {
        PantryItemEntity foreign = food(other, "Idegen");

        assertThatThrownBy(() -> service.create(owner, req("lunch", pantryItem(UUID.randomUUID(), "100"))))
            .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> service.create(owner, req("lunch", pantryItem(foreign.getId(), "100"))))
            .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
    }

    @Test
    void testCreate_shouldDefaultMealDateToNow_whenLoggedAtNull() {
        PantryItemEntity p = food(owner, "Csirkemell");
        MealRequest r = req("snack", pantryItem(p.getId(), "100"));
        r.setLoggedAt(null);

        MealResponse meal = service.create(owner, r);

        assertThat(meal.getLoggedAt()).isNotNull();
        assertThat(meal.getMealDate()).isEqualTo(LocalDate.now(ZoneOffset.UTC));
    }
}
