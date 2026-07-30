package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemRecipeOverrideJson;
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
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** The typed jsonb envelope survives a flush/clear round-trip, and NULL stays NULL (mezo-ormb). */
@Transactional
class MealItemRecipeOverridesIT extends AbstractIntegrationTest {

    @Autowired private MealRepository repository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private MealPopulator mealPopulator;

    @PersistenceContext private EntityManager entityManager;

    private UUID owner;
    private RecipeEntity recipe;
    private PantryItemEntity food;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("overrides@test.local");
        food = pantryPopulator.createFood(owner, "Túró forrás", LocalDate.of(2026, 12, 31));
        recipe = recipePopulator.createRecipe(owner, food.getId());
    }

    @Test
    void testPersist_shouldRoundTripTheEnvelope_whenOverridesAreSet() {
        MealEntity meal = mealPopulator.createRecipeMeal(owner, recipe);
        meal.getItems().get(0).setRecipeOverrides(List.of(new MealItemRecipeOverrideJson(
            1, food.getId(), "Méz", "g", new BigDecimal("20"), new BigDecimal("0.5"))));
        repository.saveAndFlush(meal);

        entityManager.flush();
        entityManager.clear();

        List<MealItemRecipeOverrideJson> read =
            repository.findById(meal.getId()).orElseThrow().getItems().get(0).getRecipeOverrides();
        assertThat(read).singleElement().satisfies(o -> {
            assertThat(o.lineOrder()).isEqualTo(1);
            assertThat(o.pantryItemId()).isEqualTo(food.getId());
            assertThat(o.name()).isEqualTo("Méz");
            assertThat(o.unit()).isEqualTo("g");
            assertThat(o.originalAmount()).isEqualByComparingTo("20");
            assertThat(o.amount()).isEqualByComparingTo("0.5");
        });
    }

    @Test
    void testPersist_shouldKeepNull_whenNoOverridesAreSet() {
        MealEntity meal = mealPopulator.createRecipeMeal(owner, recipe);

        entityManager.flush();
        entityManager.clear();

        assertThat(repository.findById(meal.getId()).orElseThrow()
            .getItems().get(0).getRecipeOverrides()).isNull();
    }
}
