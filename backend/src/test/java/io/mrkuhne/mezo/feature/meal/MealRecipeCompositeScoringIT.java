package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.api.dto.MealBreakdown;
import io.mrkuhne.mezo.api.dto.MealContextRow;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealNovaDetail;
import io.mrkuhne.mezo.api.dto.MealNovaItemRow;
import io.mrkuhne.mezo.api.dto.MealNovaStackRow;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.MealScoreDimension;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * The end-to-end proof for mezo-tm3sb: a meal logged from a recipe is scored on its INGREDIENTS.
 *
 * <p>Before this, MealService.applyScore built one ScoredLine per meal item, and a recipe item is a
 * single composite row carrying recipe.novaDominant and no gram amount. So the nova stack read 100%
 * of one group for every recipe-logged meal, plant diversity counted zero, and energy density
 * degraded for want of a mass — while the SAME recipe's own template breakdown, built per ingredient,
 * got all three right. That asymmetry is what this test pins shut.
 *
 * <p>No class-level {@code @Transactional}: it deadlocks against {@code ResetDatabase}'s TRUNCATE
 * when an emitter runs {@code REQUIRES_NEW} (house IT convention).
 */
class MealRecipeCompositeScoringIT extends ApiIntegrationTest {

    private static final OffsetDateTime LOGGED_AT =
        OffsetDateTime.of(2026, 6, 24, 8, 10, 0, 0, ZoneOffset.UTC);

    @Autowired private MealService mealService;
    @Autowired private MealRepository mealRepository;

    // ==== fixtures ====

    /** Zabpehely: NOVA 1, grains — 371 kcal / 100 g. */
    private UUID createOats(HttpHeaders auth) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Zabpehely");
        r.setCategory(PantryItemRequest.CategoryEnum.GRAINS);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("371"));
        r.setProteinG(new BigDecimal("13.5"));
        r.setCarbsG(new BigDecimal("59.8"));
        r.setFatG(new BigDecimal("7"));
        r.setFiberG(new BigDecimal("10.1"));
        r.setSugarG(new BigDecimal("1"));
        r.setSaltG(new BigDecimal("0.01"));
        r.setSaturatedFatG(new BigDecimal("1.2"));
        r.setNova(1);
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    /** Túró: NOVA 3, dairy — 130 kcal / 100 g. The higher NOVA, i.e. the recipe's dominant. */
    private UUID createCurd(HttpHeaders auth) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Túró");
        r.setCategory(PantryItemRequest.CategoryEnum.DAIRY);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("130"));
        r.setProteinG(new BigDecimal("18"));
        r.setCarbsG(new BigDecimal("3.5"));
        r.setFatG(new BigDecimal("4.5"));
        r.setFiberG(BigDecimal.ZERO);
        r.setSugarG(new BigDecimal("3.5"));
        r.setSaltG(new BigDecimal("0.1"));
        r.setSaturatedFatG(new BigDecimal("2.9"));
        r.setNova(3);
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    private static RecipeIngredientRequest ingredient(UUID pantryItemId, String amount) {
        RecipeIngredientRequest line = new RecipeIngredientRequest();
        line.setPantryItemId(pantryItemId);
        line.setAmount(new BigDecimal(amount));
        line.setUnit("g");
        return line;
    }

    /** „Túrós zabkása": zab 70 g (NOVA 1) + túró 200 g (NOVA 3), 2 adag. */
    private UUID createOatmealRecipe(HttpHeaders auth) {
        RecipeRequest rr = new RecipeRequest();
        rr.setName("Túrós zabkása");
        rr.setCategory("breakfast");
        rr.setServings(2);
        rr.setStarred(false);
        rr.setTags(List.of());
        rr.setIngredients(List.of(
            ingredient(createOats(auth), "70"), ingredient(createCurd(auth), "200")));
        return postForBody("/api/recipe", rr, auth, HttpStatus.CREATED, RecipeResponse.class).getId();
    }

    private MealResponse logMealFromRecipe(HttpHeaders auth, UUID recipeId, String servings) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("recipe");
        i.setRecipeId(recipeId);
        i.setAmount(new BigDecimal(servings));
        i.setUnit("adag");
        MealRequest r = new MealRequest();
        r.setSlot("breakfast");
        r.setLoggedAt(LOGGED_AT);
        r.setTitle("Reggeli");
        r.setItems(List.of(i));
        return postForBody("/api/meal", r, auth, HttpStatus.CREATED, MealResponse.class);
    }

    private static MealScoreDimension dimension(MealBreakdown breakdown, String id) {
        return breakdown.getDimensions().stream()
            .filter(d -> id.equals(d.getId())).findFirst().orElseThrow();
    }

    // ==== the rounds ====

    @Test
    void aMealLoggedFromARecipeGetsAnIngredientLevelNovaStack() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID recipeId = createOatmealRecipe(auth);           // zab (N1) + túró (N3), 2 servings
        MealResponse meal = logMealFromRecipe(auth, recipeId, "1"); // one serving

        MealNovaDetail nova = dimension(meal.getScore().getBreakdown(), "nova").getNova();

        // The stack is a real split, not 100% of the dominant group.
        assertThat(nova.getStack()).filteredOn(r -> r.getPct() > 0).hasSizeGreaterThan(1);
        // …and the item receipt names the INGREDIENTS, not the recipe.
        assertThat(nova.getItems()).extracting(MealNovaItemRow::getName)
            .anySatisfy(n -> assertThat(n).contains("Zabpehely"))
            .noneSatisfy(n -> assertThat(n).contains("Túrós zabkása"));
        // The exact split, derived from the kcal each ingredient brings to ONE serving:
        // zab 371 × 70/100 ÷ 2 = 129.85 kcal (NOVA 1), túró 130 × 200/100 ÷ 2 = 130 kcal (NOVA 3)
        // → 129.85/259.85 = 49.97% ≈ 50% and 130/259.85 = 50.03% ≈ 50%.
        assertThat(nova.getStack()).extracting(MealNovaStackRow::getNova, MealNovaStackRow::getPct)
            .containsExactly(
                tuple(1, 50),
                tuple(2, 0),
                tuple(3, 50),
                tuple(4, 0));
    }

    @Test
    void theItemReceiptCarriesEachIngredientsScaledAmount() {
        HttpHeaders auth = ownerAuthHeaders();
        MealResponse meal = logMealFromRecipe(auth, createOatmealRecipe(auth), "1");

        // One logged serving of a 2-adag recipe: 70 g → 35 g, 200 g → 100 g. The label describes
        // THIS meal, not the template — and it is the only place the user reads the mass back.
        assertThat(dimension(meal.getScore().getBreakdown(), "nova").getNova().getItems())
            .extracting(MealNovaItemRow::getName)
            .containsExactly("Zabpehely 35g", "Túró 100g");
    }

    @Test
    void theEnergyDensityDimensionNoLongerDegradesForWantOfAMass() {
        HttpHeaders auth = ownerAuthHeaders();
        MealResponse meal = logMealFromRecipe(auth, createOatmealRecipe(auth), "1");

        MealScoreDimension d = dimension(meal.getScore().getBreakdown(), "energy_density");
        assertThat(d.getCoverage()).isGreaterThan(BigDecimal.ZERO);
        assertThat(d.getContext()).extracting(MealContextRow::getLabel).contains("Sűrűség");
        // 35 g + 100 g = 135 g (past the 100 g floor) carrying 259.85 kcal
        // → 259.85 / 135 × 100 = 192.48 kcal/100g, printed at zero decimals.
        assertThat(d.getContext()).anySatisfy(row -> {
            assertThat(row.getLabel()).isEqualTo("Sűrűség");
            assertThat(row.getValue()).isEqualTo("192 kcal/100g");
        });
    }

    @Test
    void plantDiversityCountsTheRecipesIngredientCategories() {
        HttpHeaders auth = ownerAuthHeaders();
        MealResponse meal = logMealFromRecipe(auth, createOatmealRecipe(auth), "1");

        // The composite row carried a null category, so this dimension degraded on EVERY
        // recipe-logged meal. Now the grains line is a real plant category.
        MealScoreDimension d = dimension(meal.getScore().getBreakdown(), "plant_diversity");
        assertThat(d.getCoverage()).isGreaterThan(BigDecimal.ZERO);
        assertThat(d.getContext()).anySatisfy(row -> {
            assertThat(row.getLabel()).isEqualTo("Növényi kategóriák");
            assertThat(row.getValue()).contains("grains");
        });
    }

    @Test
    void aRecipeDeletedAfterTheLogStillScoresFromTheFrozenSnapshot() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID recipeId = createOatmealRecipe(auth);
        MealResponse meal = logMealFromRecipe(auth, recipeId, "1");
        deleteAndExpect("/api/recipe/" + recipeId, auth, HttpStatus.NO_CONTENT);

        assertThat(mealService.rescore(meal.getId())).isTrue();
        assertThat(mealRepository.findById(meal.getId()).orElseThrow().getScore()).isNotNull();
    }
}
