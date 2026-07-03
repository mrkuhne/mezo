package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the Meal aggregate — persists via {@code saveAndFlush} so the DB CHECKs
 * (incl. the polymorphic {@code ck_meal_item_arm} exactly-one-of) + the cascade fire. Two builders,
 * one per polymorphic arm. The line's {@code setMeal} back-reference is set explicitly (the child
 * owns the FK + @NotNull on {@code meal} fires at flush) — same requirement as {@code RecipePopulator}.
 */
@TestComponent
@RequiredArgsConstructor
public class MealPopulator {

    private final MealRepository repository;

    /** A lunch meal with one recipe-arm line referencing the given (real, persisted) recipe. */
    public MealEntity createRecipeMeal(UUID owner, RecipeEntity recipe) {
        MealEntity meal = newMeal(owner, "lunch", "Ebéd");
        MealItemEntity line = baseLine(meal, owner, 0, new BigDecimal("2"), "adag");
        line.setSource("recipe");
        line.setRecipeId(recipe.getId());
        line.setSnapshotName(recipe.getName());
        line.setSnapshotPer(BigDecimal.ONE);
        line.setSnapshotBasisUnit("adag");
        line.setSnapshotKcal(new BigDecimal("520"));
        line.setSnapshotProteinG(new BigDecimal("38.0"));
        line.setSnapshotCarbsG(new BigDecimal("45.0"));
        line.setSnapshotFatG(new BigDecimal("18.0"));
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        return repository.saveAndFlush(meal);
    }

    /** A breakfast meal with one pantry-arm line referencing the given (real, persisted) pantry item. */
    public MealEntity createPantryMeal(UUID owner, PantryItemEntity pantryItem) {
        MealEntity meal = newMeal(owner, "breakfast", "Reggeli");
        MealItemEntity line = baseLine(meal, owner, 0, new BigDecimal("150"), "g");
        line.setSource("pantry");
        line.setPantryItemId(pantryItem.getId());
        line.setSnapshotName(pantryItem.getName());
        line.setSnapshotPer(new BigDecimal("100"));
        line.setSnapshotBasisUnit("g");
        line.setSnapshotKcal(new BigDecimal("110"));
        line.setSnapshotProteinG(new BigDecimal("23.0"));
        line.setSnapshotCarbsG(BigDecimal.ZERO);
        line.setSnapshotFatG(new BigDecimal("1.5"));
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        return repository.saveAndFlush(meal);
    }

    /** Same breakfast pantry meal, logged on an explicit date — day-rollup/snapshot tests. */
    public MealEntity createPantryMeal(UUID owner, PantryItemEntity pantryItem, LocalDate mealDate) {
        MealEntity meal = createPantryMeal(owner, pantryItem);
        meal.setMealDate(mealDate);
        return repository.saveAndFlush(meal);
    }

    private MealEntity newMeal(UUID owner, String slot, String title) {
        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        Instant loggedAt = Instant.parse("2026-06-24T11:30:00Z");
        meal.setLoggedAt(loggedAt);
        meal.setMealDate(LocalDate.ofInstant(loggedAt, ZoneOffset.UTC));
        meal.setSlot(slot);
        meal.setTitle(title);
        return meal;
    }

    // Bidirectional @OneToMany(mappedBy="meal"): the child owns the FK, so the back-reference must
    // be set explicitly (adding to meal.getItems() does not populate it, and @NotNull on `meal`
    // fires at flush before Hibernate would link the cascade) — same as RecipePopulator.
    private MealItemEntity baseLine(
        MealEntity meal, UUID owner, int order, BigDecimal amount, String unit) {
        MealItemEntity line = new MealItemEntity();
        line.setMeal(meal);
        line.setCreatedBy(owner);
        line.setLineOrder(order);
        line.setAmount(amount);
        line.setUnit(unit);
        return line;
    }
}
