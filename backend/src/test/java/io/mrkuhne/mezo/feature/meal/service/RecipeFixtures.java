package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Hand-built {@link RecipeEntity} shapes for the composite-expansion rounds (mezo-tm3sb) — no
 * Spring, no database, so the scaling arithmetic can be pinned on its own.
 *
 * <p>The pantry map is deliberately built from the SAME ids the recipe lines point at, because the
 * expansion's NOVA/category read is a live pantry lookup: a fixture whose ids do not line up would
 * silently exercise the missing-row degrade path instead of the happy one.
 */
final class RecipeFixtures {

    /** Zabpehely — the NOVA-1 line, id pinned so {@link #pantry()} can key on it. */
    static final UUID OAT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    /** Túró — the NOVA-3 line. */
    static final UUID CURD_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    /** Tojás — the discrete-unit line (unit "db" ⇒ honest-null mass). */
    static final UUID EGG_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    private RecipeFixtures() {
    }

    /**
     * „Túrós zabkása", 2 adag: zab 70 g @ 371 kcal/100 g (NOVA 1, grains) + túró 200 g @
     * 130 kcal/100 g (NOVA 3, dairy). Two servings so every per-serving factor is a clean ½.
     */
    static RecipeEntity twoServingOatmeal() {
        RecipeEntity recipe = new RecipeEntity();
        recipe.setName("Túrós zabkása");
        recipe.setServings(2);
        recipe.getLines().add(line(recipe, 0, OAT_ID, "Zabpehely", "70", "g", "100",
            "371", "13.5", "59.8", "7.0", "10.1", "1.0", "0.01", "1.2"));
        recipe.getLines().add(line(recipe, 1, CURD_ID, "Túró", "200", "g", "100",
            "130", "18.0", "3.5", "4.5", "0", "3.5", "0.1", "2.9"));
        return recipe;
    }

    /** „Tükörtojás", 1 adag, 2 db tojás @ 78 kcal/db — a discrete unit carries no gram mass. */
    static RecipeEntity eggRecipe() {
        RecipeEntity recipe = new RecipeEntity();
        recipe.setName("Tükörtojás");
        recipe.setServings(1);
        recipe.getLines().add(line(recipe, 0, EGG_ID, "Tojás", "2", "db", "1",
            "78", "6.3", "0.6", "5.3", "0", "0.6", "0.2", "1.6"));
        return recipe;
    }

    /** Live pantry rows for all three fixture ingredients: NOVA + category, nothing else. */
    static Map<UUID, PantryItemEntity> pantry() {
        Map<UUID, PantryItemEntity> byId = new LinkedHashMap<>();
        byId.put(OAT_ID, pantryItem(OAT_ID, (short) 1, "grains"));
        byId.put(CURD_ID, pantryItem(CURD_ID, (short) 3, "dairy"));
        byId.put(EGG_ID, pantryItem(EGG_ID, (short) 1, "eggs"));
        return byId;
    }

    private static PantryItemEntity pantryItem(UUID id, Short nova, String category) {
        PantryCatalogEntity catalog = new PantryCatalogEntity();
        catalog.setNova(nova);
        catalog.setCategory(category);
        PantryItemEntity item = new PantryItemEntity();
        item.setId(id);
        item.setCatalog(catalog);
        return item;
    }

    @SuppressWarnings("java:S107") // a frozen snapshot IS this many fields; a builder would hide them
    private static RecipeIngredientEntity line(RecipeEntity recipe, int order, UUID pantryItemId,
            String name, String amount, String unit, String per, String kcal, String protein,
            String carbs, String fat, String fiber, String sugar, String salt, String satFat) {
        RecipeIngredientEntity line = new RecipeIngredientEntity();
        line.setRecipe(recipe);
        line.setLineOrder(order);
        line.setPantryItemId(pantryItemId);
        line.setAmount(new BigDecimal(amount));
        line.setUnit(unit);
        line.setSnapshotName(name);
        line.setSnapshotPer(new BigDecimal(per));
        line.setSnapshotBasisUnit(unit);
        line.setSnapshotKcal(new BigDecimal(kcal));
        line.setSnapshotProteinG(new BigDecimal(protein));
        line.setSnapshotCarbsG(new BigDecimal(carbs));
        line.setSnapshotFatG(new BigDecimal(fat));
        line.setSnapshotFiberG(new BigDecimal(fiber));
        line.setSnapshotSugarG(new BigDecimal(sugar));
        line.setSnapshotSaltG(new BigDecimal(salt));
        line.setSnapshotSaturatedFatG(new BigDecimal(satFat));
        return line;
    }
}
