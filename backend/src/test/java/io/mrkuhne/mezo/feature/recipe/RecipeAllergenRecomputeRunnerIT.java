package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.pantry.PantryCatalogAllergenBaselineRunner;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.feature.recipe.service.RecipeService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * The end of the mezo-r36n9.48 chain, on the shape the owner actually has: recipes were saved while
 * the catalog was silent, so their rollup says "no allergens" even after the catalog is filled —
 * the rollup is only written on save. The two runners together must heal them, and the healed value
 * must be the very same one the save path produces.
 */
@Transactional
@ActiveProfiles("demodata")
class RecipeAllergenRecomputeRunnerIT extends AbstractIntegrationTest {

    @Autowired private RecipeService service;
    @Autowired private RecipeRepository repository;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PantryCatalogAllergenBaselineRunner catalogRunner;
    @Autowired private RecipeAllergenRecomputeRunner recipeRunner;

    private UUID owner;

    @BeforeEach
    void setUpOwner() {
        owner = databasePopulator.populateUser("allergen-recompute@test.local");
    }

    /** The live shape: a cod dinner saved while the catalog said nothing about fish. */
    @Test
    void recompute_shouldGiveASilentlySavedFishRecipeItsAllergen() {
        PantryItemEntity cod = shelfFood("Fekete tőkehal filé, nyers", "fish");
        PantryItemEntity rice = shelfFood("Barna rizs, nyers", "grains");

        RecipeResponse saved = service.create(owner,
            req("Fekete tőkehal barna rizzsel", line(cod.getId()), line(rice.getId())));
        // Pre-fix state, and the bug itself: nothing to roll up, so the dish reads as allergen-free.
        assertThat(repository.findById(saved.getId()).orElseThrow().getAllergens()).isEmpty();

        catalogRunner.backfill();
        recipeRunner.recompute();

        assertThat(repository.findById(saved.getId()).orElseThrow().getAllergens())
            .containsEntry("fish", AllergenState.CONTAINS);
    }

    /** An egg breakfast, the owner's other live case. */
    @Test
    void recompute_shouldGiveASilentlySavedEggRecipeItsAllergen() {
        PantryItemEntity egg = shelfFood("Tojás", "eggs");

        RecipeResponse saved = service.create(owner, req("Rántotta", line(egg.getId())));

        catalogRunner.backfill();
        recipeRunner.recompute();

        assertThat(repository.findById(saved.getId()).orElseThrow().getAllergens())
            .containsEntry("eggs", AllergenState.CONTAINS);
    }

    /**
     * The owner's own breakfast: lactose-free quark plus an egg. It must carry the milk allergen
     * (the protein is there) AND be marked lactose-free, so his intolerance does not warn on it.
     */
    @Test
    void recompute_shouldMarkADishLactoseFree_whenEveryMilkLineIs() {
        PantryItemEntity quark = shelfFood("Laktózmentes túró Lidl", "cheese");
        PantryItemEntity egg = shelfFood("Tojás", "eggs");

        RecipeResponse saved = service.create(owner, req("Túrós reggeli", line(quark.getId()), line(egg.getId())));

        catalogRunner.backfill();
        recipeRunner.recompute();

        var healed = repository.findById(saved.getId()).orElseThrow();
        assertThat(healed.getAllergens())
            .containsEntry("milk", AllergenState.CONTAINS)
            .containsEntry("eggs", AllergenState.CONTAINS);
        assertThat(healed.getLactoseFree()).isTrue();
    }

    /** One ordinary dairy line is enough: the dish is not known to be lactose-free. */
    @Test
    void recompute_shouldNotMarkADishLactoseFree_whenOneMilkLineIsOrdinary() {
        PantryItemEntity quark = shelfFood("Laktózmentes túró Lidl", "cheese");
        PantryItemEntity cheddar = shelfFood("Cheddar sajt", "cheese");

        RecipeResponse saved = service.create(owner, req("Sajtos tál", line(quark.getId()), line(cheddar.getId())));

        catalogRunner.backfill();
        recipeRunner.recompute();

        assertThat(repository.findById(saved.getId()).orElseThrow().getLactoseFree()).isFalse();
    }

    /** A dish with no dairy at all has nothing to say about lactose — null, not false. */
    @Test
    void recompute_shouldSayNothingAboutLactose_withoutAnyMilkLine() {
        PantryItemEntity cod = shelfFood("Pangasius filé, nyers", "fish");

        RecipeResponse saved = service.create(owner, req("Pangasius", line(cod.getId())));

        catalogRunner.backfill();
        recipeRunner.recompute();

        assertThat(repository.findById(saved.getId()).orElseThrow().getLactoseFree()).isNull();
    }

    /** Idempotent: a second run changes nothing, so nothing drifts on every boot. */
    @Test
    void recompute_shouldBeIdempotent() {
        PantryItemEntity cod = shelfFood("Tilápia, nyers", "fish");
        service.create(owner, req("Tilápia", line(cod.getId())));

        catalogRunner.backfill();
        recipeRunner.recompute();

        assertThat(recipeRunner.recompute()).isZero();
    }

    /** A pantry food on the given shelf whose catalog row declares no allergens — the live state. */
    private PantryItemEntity shelfFood(String name, String category) {
        PantryItemEntity item = pantryPopulator.createFood(owner, name, LocalDate.of(2026, 11, 13));
        item.getCatalog().setCategory(category);
        item.getCatalog().setAllergens(new java.util.HashMap<>(Map.of()));
        item.getCatalog().setLactoseFree(false);
        return item;
    }

    private RecipeIngredientRequest line(UUID pantryItemId) {
        RecipeIngredientRequest l = new RecipeIngredientRequest();
        l.setPantryItemId(pantryItemId);
        l.setAmount(new BigDecimal("150"));
        l.setUnit("g");
        return l;
    }

    private RecipeRequest req(String name, RecipeIngredientRequest... lines) {
        RecipeRequest r = new RecipeRequest();
        r.setName(name);
        r.setCategory("dinner");
        r.setServings(2);
        r.setIngredients(List.of(lines));
        return r;
    }
}
