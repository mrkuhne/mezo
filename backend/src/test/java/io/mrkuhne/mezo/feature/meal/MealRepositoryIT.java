package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class MealRepositoryIT extends AbstractIntegrationTest {

    @Autowired private MealRepository repository;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext private EntityManager entityManager;

    // The day the MealPopulator stamps onto its meals (logged_at 2026-06-24T11:30Z, UTC date).
    private static final LocalDate MEAL_DAY = LocalDate.of(2026, 6, 24);

    // created_by + the source FKs (recipe / pantry_item) must all be real (populated first).
    @Test
    void testFindByOwnerAndDay_shouldPersistAggregateAndOrderLines_whenSaved() {
        UUID owner = databasePopulator.populateUser("owner@test.local");
        PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
        RecipeEntity recipe = recipePopulator.createRecipe(owner, food.getId());
        mealPopulator.createRecipeMeal(owner, recipe);
        mealPopulator.createPantryMeal(owner, food);
        // Drop the populator's managed instances so the finder loads the aggregate fresh from the DB,
        // where @OrderBy("lineOrder") actually applies (an already-initialized collection keeps order).
        entityManager.clear();

        var meals = repository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, MEAL_DAY);

        // Both meals are stamped the same instant; assert the set of slots + their polymorphic arms.
        assertThat(meals).hasSize(2);
        assertThat(meals).extracting(MealEntity::getSlot)
            .containsExactlyInAnyOrder("lunch", "breakfast");

        MealEntity recipeMeal = meals.stream().filter(m -> m.getSlot().equals("lunch")).findFirst().orElseThrow();
        assertThat(recipeMeal.getMealDate()).isEqualTo(MEAL_DAY);
        assertThat(recipeMeal.getBreakdown()).isNull(); // v1: score deferred
        assertThat(recipeMeal.getItems()).hasSize(1);
        MealItemEntity recipeLine = recipeMeal.getItems().get(0);
        assertThat(recipeLine.getSource()).isEqualTo("recipe");
        assertThat(recipeLine.getRecipeId()).isEqualTo(recipe.getId());
        assertThat(recipeLine.getPantryItemId()).isNull();
        assertThat(recipeLine.getSnapshotNova()).isEqualTo((short) 1);

        MealEntity pantryMeal = meals.stream().filter(m -> m.getSlot().equals("breakfast")).findFirst().orElseThrow();
        MealItemEntity pantryLine = pantryMeal.getItems().get(0);
        assertThat(pantryLine.getSource()).isEqualTo("pantry");
        assertThat(pantryLine.getPantryItemId()).isEqualTo(food.getId());
        assertThat(pantryLine.getRecipeId()).isNull();
    }

    @Test
    void testFindByOwnerAndDay_shouldHideRow_whenSoftDeleted() {
        UUID owner = databasePopulator.populateUser("owner@test.local");
        PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
        MealEntity meal = mealPopulator.createPantryMeal(owner, food);

        repository.delete(meal); // @SQLDelete soft-deletes the meal row

        assertThat(repository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, MEAL_DAY)).isEmpty();
        assertThat(repository.findByIdAndCreatedByAndDeletedFalse(meal.getId(), owner)).isEmpty();
    }

    @Test
    void testFindByOwnerAndDay_shouldScopeToOwner_whenAnotherUserHasMeals() {
        UUID owner = databasePopulator.populateUser("owner@test.local");
        UUID stranger = databasePopulator.populateUser("stranger@test.local");
        PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
        mealPopulator.createPantryMeal(stranger, food);

        assertThat(repository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, MEAL_DAY)).isEmpty();
    }
}
