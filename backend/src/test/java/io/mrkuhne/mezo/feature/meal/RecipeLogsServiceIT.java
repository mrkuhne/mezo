package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealItemResponse;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.RecipeLogResponse;
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
class RecipeLogsServiceIT extends AbstractIntegrationTest {

    @Autowired private MealService service;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID owner;
    private UUID other;

    @BeforeEach
    void setUpOwners() {
        owner = databasePopulator.populateUser("a@test.local");
        other = databasePopulator.populateUser("b@test.local");
    }

    private RecipeEntity recipe(UUID who) {
        PantryItemEntity src = pantryPopulator.createFood(who, "Túró forrás", LocalDate.of(2026, 5, 25));
        return recipePopulator.createRecipe(who, src.getId()); // per serving 149/18/6/6
    }

    private void logRecipe(UUID recipeId, int day) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("recipe");
        i.setRecipeId(recipeId);
        i.setAmount(BigDecimal.ONE);
        i.setUnit("adag");
        MealRequest r = new MealRequest();
        r.setSlot("lunch");
        r.setLoggedAt(OffsetDateTime.of(2026, 6, day, 13, 0, 0, 0, ZoneOffset.UTC));
        r.setItems(List.of(i));
        service.create(owner, r);
    }

    @Test
    void testRecipeLogs_shouldReturnNewestFirstWithContribution_whenLogged() {
        RecipeEntity r = recipe(owner);
        logRecipe(r.getId(), 20);
        logRecipe(r.getId(), 24); // newer

        List<RecipeLogResponse> logs = service.recipeLogs(owner, r.getId());

        assertThat(logs).hasSize(2);
        // newest meal first (Meal_LoggedAtDesc) — typed extractor so reverseOrder() infers
        assertThat(logs).extracting(RecipeLogResponse::getLoggedAt)
            .isSortedAccordingTo(java.util.Comparator.reverseOrder());
        assertThat(logs.get(0).getSlot()).isEqualTo("lunch");
        assertThat(logs.get(0).getKcal()).isEqualByComparingTo(BigDecimal.valueOf(149));
        assertThat(logs.get(0).getP()).isEqualByComparingTo(BigDecimal.valueOf(18));
        assertThat(logs.get(0).getMealId()).isNotNull();
    }

    @Test
    void testRecipeLogs_shouldBeEmpty_whenNeverLoggedOrForeign() {
        RecipeEntity r = recipe(owner);
        logRecipe(r.getId(), 24);

        assertThat(service.recipeLogs(owner, UUID.randomUUID())).isEmpty(); // never logged
        assertThat(service.recipeLogs(other, r.getId())).isEmpty();        // foreign owner
    }

    private MealItemRequest ingredient(UUID pantryItemId, UUID recipeId, int grams) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("pantry");
        i.setPantryItemId(pantryItemId);
        i.setRecipeId(recipeId);
        i.setAmount(BigDecimal.valueOf(grams));
        i.setUnit("g");
        return i;
    }

    private MealResponse logIngredients(List<MealItemRequest> items, int day) {
        MealRequest r = new MealRequest();
        r.setSlot("dinner");
        r.setLoggedAt(OffsetDateTime.of(2026, 6, day, 19, 0, 0, 0, ZoneOffset.UTC));
        r.setItems(items);
        return service.create(owner, r);
    }

    @Test
    void testIngredientLog_shouldMarkEachLineAndReadAsOneRecipeLog_whenRecipeLoggedByIngredient() {
        RecipeEntity r = recipe(owner);
        PantryItemEntity a = pantryPopulator.createFood(owner, "Rizs", LocalDate.of(2026, 5, 25));
        PantryItemEntity b = pantryPopulator.createFood(owner, "Csirke", LocalDate.of(2026, 5, 25));

        MealResponse meal = logIngredients(List.of(ingredient(a.getId(), r.getId(), 80),
            ingredient(b.getId(), r.getId(), 150)), 22);

        assertThat(meal.getItems()).hasSize(2).allSatisfy(item -> {
            assertThat(item.getSource()).isEqualTo("pantry");
            assertThat(item.getRecipeId()).isEqualTo(r.getId());
            assertThat(item.getRecipeName()).isEqualTo(r.getName());
        });
        List<RecipeLogResponse> logs = service.recipeLogs(owner, r.getId());
        assertThat(logs).hasSize(1); // two marker lines, ONE meal -> one log row
        BigDecimal kcal = meal.getItems().stream().map(i -> i.getContribution().getKcal())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(logs.get(0).getKcal().subtract(kcal).abs()).isLessThanOrEqualTo(BigDecimal.ONE);
        assertThat(logs.get(0).getMealId()).isEqualTo(meal.getId());
    }

    @Test
    void testIngredientLog_shouldDropTheMarkerNotTheMeal_whenRecipeIsGoneOrForeign() {
        PantryItemEntity a = pantryPopulator.createFood(owner, "Rizs", LocalDate.of(2026, 5, 25));
        RecipeEntity foreign = recipe(other);

        MealResponse meal = logIngredients(List.of(ingredient(a.getId(), UUID.randomUUID(), 80),
            ingredient(a.getId(), foreign.getId(), 20)), 23);

        assertThat(meal.getItems()).hasSize(2).allSatisfy(item -> {
            assertThat(item.getRecipeId()).isNull();
            assertThat(item.getRecipeName()).isNull();
        });
        assertThat(meal.getItems()).extracting(MealItemResponse::getPantryItemId).containsOnly(a.getId());
    }
}
