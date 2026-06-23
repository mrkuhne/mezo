package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the Recipe aggregate — persists via {@code saveAndFlush} so DB CHECKs + cascade fire. */
@TestComponent
@RequiredArgsConstructor
public class RecipePopulator {

    private final RecipeRepository repository;

    /**
     * A breakfast recipe with two lines that both reference {@code pantryItemId} (which MUST be a
     * real, persisted {@code pantry_item.id} — the FK is RESTRICT). The lines are added in reverse
     * {@code lineOrder} ([1] then [0]) so a reload proves {@code @OrderBy("lineOrder")} sorts them.
     */
    public RecipeEntity createRecipe(UUID owner, UUID pantryItemId) {
        RecipeEntity recipe = new RecipeEntity();
        recipe.setCreatedBy(owner);
        recipe.setName("Túrós tál");
        recipe.setCategory("breakfast");
        recipe.setServings(2);
        recipe.setPrepMins(10);
        recipe.setTags(List.of("magas-fehérje", "gyors"));
        recipe.setNovaDominant((short) 1);

        recipe.getLines().add(line(owner, pantryItemId, 1, "Méz", new BigDecimal("20")));
        recipe.getLines().add(line(owner, pantryItemId, 0, "Túró", new BigDecimal("250")));

        return repository.saveAndFlush(recipe);
    }

    private RecipeIngredientEntity line(UUID owner, UUID pantryItemId, int order, String name, BigDecimal amount) {
        RecipeIngredientEntity ing = new RecipeIngredientEntity();
        ing.setCreatedBy(owner);
        ing.setPantryItemId(pantryItemId);
        ing.setAmount(amount);
        ing.setUnit("g");
        ing.setLineOrder(order);
        ing.setSnapshotName(name);
        ing.setSnapshotPer(new BigDecimal("100"));
        ing.setSnapshotBasisUnit("g");
        ing.setSnapshotKcal(new BigDecimal("110"));
        ing.setSnapshotProteinG(new BigDecimal("13.0"));
        ing.setSnapshotCarbsG(new BigDecimal("4.0"));
        ing.setSnapshotFatG(new BigDecimal("4.5"));
        return ing;
    }
}
