package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealProvenanceJson;
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
import java.math.BigDecimal;
import java.time.Instant;
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

    // mezo-78rn: AI-estimated line (source='estimate', both FKs NULL) + typed-jsonb provenance envelope.
    @Test
    void testSave_shouldRoundTripProvenanceAndEstimateLine_whenAiOrigin() {
        UUID owner = databasePopulator.populateUser("ai-owner@test.local");

        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        meal.setLoggedAt(Instant.parse("2026-07-18T12:00:00Z"));
        meal.setMealDate(LocalDate.of(2026, 7, 18));
        meal.setSlot("lunch");
        meal.setProvenance(new MealProvenanceJson("ai-text", null, new BigDecimal("0.80"), "csirkés wrap"));

        MealItemEntity line = new MealItemEntity();
        line.setCreatedBy(owner);
        line.setMeal(meal);
        line.setLineOrder(0);
        line.setSource("estimate");
        line.setAmount(new BigDecimal("1"));
        line.setUnit("db");
        line.setSnapshotName("Csirkés wrap");
        line.setSnapshotPer(new BigDecimal("1"));
        line.setSnapshotBasisUnit("db");
        line.setSnapshotKcal(new BigDecimal("450"));
        line.setSnapshotProteinG(new BigDecimal("28"));
        line.setSnapshotCarbsG(new BigDecimal("40"));
        line.setSnapshotFatG(new BigDecimal("18"));
        meal.getItems().add(line);

        MealEntity saved = repository.saveAndFlush(meal);
        entityManager.clear();

        MealEntity found = repository.findById(saved.getId()).orElseThrow();
        assertThat(found.getProvenance().origin()).isEqualTo("ai-text");
        assertThat(found.getProvenance().rawText()).isEqualTo("csirkés wrap");
        assertThat(found.getItems().getFirst().getSource()).isEqualTo("estimate");
        assertThat(found.getItems().getFirst().getRecipeId()).isNull();
        assertThat(found.getItems().getFirst().getPantryItemId()).isNull();
    }
}
