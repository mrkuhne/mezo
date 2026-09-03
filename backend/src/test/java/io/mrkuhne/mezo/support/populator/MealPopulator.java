package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
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
    private final PantryItemRepository pantryItemRepository;

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

    /** Breakfast pantry meal with an explicit loggedAt instant (kitchen-close tests). */
    public MealEntity createPantryMeal(UUID owner, PantryItemEntity pantryItem, LocalDate mealDate,
        Instant loggedAt) {
        MealEntity meal = createPantryMeal(owner, pantryItem, mealDate);
        meal.setLoggedAt(loggedAt);
        return repository.saveAndFlush(meal);
    }

    /**
     * Pantry-backed meal that ALREADY carries a deterministic score envelope — the meal-coach
     * fixture (mezo-mr4n). The coach only narrates already-scored meals, and its prose sockets
     * (summary/tagline/improve) start empty exactly as the scorer leaves them. {@code title} is
     * also where an IT plants the {@code [fake-meal-coach:…]} sentinel, since the name reaches
     * the prompt.
     */
    public MealEntity createScoredMeal(UUID owner, PantryItemEntity pantryItem, LocalDate mealDate,
        String title, Instant loggedAt) {
        MealEntity meal = createPantryMeal(owner, pantryItem, mealDate, loggedAt);
        meal.setTitle(title);
        meal.setScore(new BigDecimal("0.62"));
        meal.setBreakdown(new MealBreakdownJson(new BigDecimal("0.62"), new BigDecimal("0.80"),
            null, null,
            List.of(new MealBreakdownJson.Dimension("macro", "Kcal & makró", new BigDecimal("0.22"),
                new BigDecimal("0.50"), "P/C/F 17/71/11 vs 27/47/26", null, null, null, null, null)),
            List.of(), List.of(new MealBreakdownJson.ToolRow("compute", "score(deterministic)"))));
        return repository.saveAndFlush(meal);
    }

    /**
     * A meal on an explicit date with N pantry-arm lines, each carrying its own macro/NOVA
     * snapshot — the Karakter round-2 read-layer fixture (mezo-1gim.15) needs multi-line days with
     * distinct NOVA classes, which the single-line {@code createPantryMeal} builders can't express.
     * Each line gets its own throwaway {@code PantryItemEntity} persisted first — {@code
     * pantry_item_id} carries an {@code ON DELETE RESTRICT} FK, so (unlike {@code recipeId} on the
     * other arm in this populator) a random UUID is rejected at flush.
     */
    public MealEntity createMealWithItems(UUID owner, LocalDate mealDate, String slot, List<Line> lines) {
        MealEntity meal = newMeal(owner, slot, slot);
        meal.setMealDate(mealDate);
        int order = 0;
        for (Line line : lines) {
            PantryItemEntity pantryItem = new PantryItemEntity();
            pantryItem.setCreatedBy(owner);
            pantryItem.setKind("food");
            pantryItem.setName(line.name());
            pantryItem.setSource("manual");
            pantryItem.setCategory("meat");
            pantryItem.setServingAmount(BigDecimal.ONE);
            pantryItem.setServingUnit("adag");
            pantryItem.setKcal(new BigDecimal(line.kcal()));
            pantryItem.setProteinG(new BigDecimal(line.proteinG()));
            pantryItem.setCarbsG(new BigDecimal(line.carbsG()));
            pantryItem.setFatG(new BigDecimal(line.fatG()));
            pantryItem.setNova(line.nova());
            pantryItem = pantryItemRepository.saveAndFlush(pantryItem);

            MealItemEntity item = baseLine(meal, owner, order++, BigDecimal.ONE, "adag");
            item.setSource("pantry");
            item.setPantryItemId(pantryItem.getId());
            item.setSnapshotName(line.name());
            item.setSnapshotPer(BigDecimal.ONE);
            item.setSnapshotBasisUnit("adag");
            item.setSnapshotKcal(new BigDecimal(line.kcal()));
            item.setSnapshotProteinG(new BigDecimal(line.proteinG()));
            item.setSnapshotCarbsG(new BigDecimal(line.carbsG()));
            item.setSnapshotFatG(new BigDecimal(line.fatG()));
            item.setSnapshotNova(line.nova());
            meal.getItems().add(item);
        }
        return repository.saveAndFlush(meal);
    }

    /** One item line for {@link #createMealWithItems}: name + macro strings + NOVA class. */
    public record Line(String name, String kcal, String proteinG, String carbsG, String fatG, short nova) {
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
