package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryQuickAddRequest;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * „Pontosítom" e2e (mezo-r36n9.63): the owner replaces the numbers of a food — here an AI-estimated
 * one from the quick-add (354 kcal / 100 g by the fake) — and HIS recipes that froze the old numbers
 * show the new ones, while everybody else's recipes and every logged meal stay exactly as they were.
 * HTTP-level on purpose: the refresh hangs on the pantry edit's COMMIT.
 */
@ActiveProfiles("companion-fake")
class RecipeSnapshotRefreshIT extends ApiIntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    private PantryItemResponse quickAdd(HttpHeaders auth, String name) {
        PantryQuickAddRequest r = new PantryQuickAddRequest();
        r.setName(name);
        return postForBody("/api/pantry/items/quick-add", r, auth, HttpStatus.OK, PantryItemResponse.class);
    }

    private PantryItemResponse createFood(HttpHeaders auth, String name, String kcal) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal(kcal));
        r.setProteinG(new BigDecimal("10"));
        r.setCarbsG(new BigDecimal("10"));
        r.setFatG(new BigDecimal("10"));
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class);
    }

    private static RecipeIngredientRequest line(UUID pantryItemId, UUID catalogId, String amount, String note) {
        RecipeIngredientRequest l = new RecipeIngredientRequest();
        l.setPantryItemId(pantryItemId);
        l.setCatalogId(catalogId);
        l.setAmount(new BigDecimal(amount));
        l.setUnit("g");
        l.setNote(note);
        return l;
    }

    private RecipeResponse createRecipe(HttpHeaders auth, RecipeIngredientRequest... lines) {
        RecipeRequest r = new RecipeRequest();
        r.setName("Kurkumás rizs");
        r.setCategory("dinner");
        r.setServings(1);
        r.setIngredients(List.of(lines));
        return postForBody("/api/recipe", r, auth, HttpStatus.CREATED, RecipeResponse.class);
    }

    /** The facts form's PUT: every definition field echoed back, kcal replaced. */
    private PantryItemResponse typeKcal(HttpHeaders auth, PantryItemResponse food, String kcal) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(food.getName());
        r.setPer(food.getPer());
        r.setUnit(food.getUnit());
        r.setKcal(new BigDecimal(kcal));
        r.setProteinG(food.getProteinG());
        r.setCarbsG(food.getCarbsG());
        r.setFatG(food.getFatG());
        return putForBody("/api/pantry/" + food.getId(), r, auth, HttpStatus.OK, PantryItemResponse.class);
    }

    private RecipeResponse get(HttpHeaders auth, UUID recipeId) {
        return getForBody("/api/recipe/" + recipeId, auth, HttpStatus.OK, RecipeResponse.class);
    }

    @Test
    void testRefresh_shouldRebuildOwnersRecipeSnapshots() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemResponse estimate = quickAdd(auth, "kurkuma");
        PantryItemResponse rice = createFood(auth, "Rizs", "350");
        RecipeResponse saved = createRecipe(auth,
            line(rice.getId(), null, "200", "mosva"), line(null, estimate.getCatalogId(), "100", "csipet"));
        assertThat(saved.getIngredients().get(1).getContribution().getKcal()).isEqualByComparingTo("354");
        assertThat(saved.getMacros().getKcal()).isEqualByComparingTo("1054");

        PantryItemResponse precise = typeKcal(auth, estimate, "312");

        assertThat(precise.getEstimated()).isFalse();
        assertThat(precise.getSource()).isEqualTo("manual");
        assertThat(precise.getCatalogId()).isEqualTo(estimate.getCatalogId()); // the same food
        RecipeResponse after = get(auth, saved.getId());
        assertThat(after.getIngredients().get(1).getContribution().getKcal()).isEqualByComparingTo("312");
        assertThat(after.getMacros().getKcal()).isEqualByComparingTo("1012");
        // Amount, unit, note and order are what he saved; the other line is untouched.
        assertThat(after.getIngredients()).extracting("name").containsExactly("Rizs", "Kurkuma");
        assertThat(after.getIngredients().get(1).getAmount()).isEqualByComparingTo("100");
        assertThat(after.getIngredients().get(1).getUnit()).isEqualTo("g");
        assertThat(after.getIngredients().get(1).getNote()).isEqualTo("csipet");
        assertThat(after.getIngredients().get(1).getLineOrder()).isEqualTo(1);
        assertThat(after.getIngredients().get(0).getContribution().getKcal()).isEqualByComparingTo("700");
        assertThat(after.getIngredients().get(0).getNote()).isEqualTo("mosva");
    }

    @Test
    void testRefresh_shouldNotTouchOtherUsersRecipes() {
        HttpHeaders anna = registerUser("Anna").headers();
        HttpHeaders bela = registerUser("Béla").headers();
        PantryItemResponse food = createFood(anna, "Kölesgolyó", "380"); // Anna's verified, shared definition
        RecipeResponse hers = createRecipe(anna, line(food.getId(), null, "100", null));
        RecipeResponse his = createRecipe(bela, line(null, food.getCatalogId(), "100", null));

        typeKcal(anna, food, "401"); // the author corrects her food

        assertThat(get(anna, hers.getId()).getIngredients().get(0).getContribution().getKcal())
            .isEqualByComparingTo("401");
        // Béla's recipe froze 380 when HE saved it, and only his own save moves it.
        assertThat(get(bela, his.getId()).getIngredients().get(0).getContribution().getKcal())
            .isEqualByComparingTo("380");
    }

    @Test
    void testRefresh_shouldNotTouchLoggedMeals() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemResponse estimate = quickAdd(auth, "kurkuma");
        RecipeResponse recipe = createRecipe(auth, line(null, estimate.getCatalogId(), "100", null));
        MealItemRequest item = new MealItemRequest();
        item.setSource("recipe");
        item.setRecipeId(recipe.getId());
        item.setAmount(BigDecimal.ONE);
        item.setUnit("adag");
        MealRequest meal = new MealRequest();
        meal.setSlot("dinner");
        meal.setItems(List.of(item));
        MealResponse logged = postForBody("/api/meal", meal, auth, HttpStatus.CREATED, MealResponse.class);
        List<Map<String, Object>> itemsBefore =
            jdbc.queryForList("select * from meal_item where meal_id = ? order by line_order", logged.getId());
        Map<String, Object> mealBefore = jdbc.queryForMap("select score::text, breakdown::text from meal where id = ?",
            logged.getId());

        typeKcal(auth, estimate, "312");

        assertThat(get(auth, recipe.getId()).getMacros().getKcal()).isEqualByComparingTo("312"); // the recipe followed
        // …the logged meal is history: every stored number is exactly what it was logged with.
        assertThat(jdbc.queryForList("select * from meal_item where meal_id = ? order by line_order", logged.getId()))
            .isEqualTo(itemsBefore);
        assertThat(jdbc.queryForMap("select score::text, breakdown::text from meal where id = ?", logged.getId()))
            .isEqualTo(mealBefore);
    }

    @Test
    void testRefresh_shouldLeaveRecipesAloneWhenOnlyStateFieldsChange() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemResponse food = createFood(auth, "Rizs", "350");
        RecipeResponse saved = createRecipe(auth, line(food.getId(), null, "100", null));
        jdbc.update("update recipe_ingredient set snapshot_kcal = 999 where recipe_id = ?", saved.getId()); // a marker

        PantryItemRequest priceOnly = new PantryItemRequest();
        priceOnly.setKind(PantryItemRequest.KindEnum.FOOD);
        priceOnly.setName("Rizs");
        priceOnly.setPrice(890);
        putForBody("/api/pantry/" + food.getId(), priceOnly, auth, HttpStatus.OK, PantryItemResponse.class);

        // No fact changed, so nothing was republished and the marker survived.
        assertThat(jdbc.queryForObject("select snapshot_kcal from recipe_ingredient where recipe_id = ?",
            BigDecimal.class, saved.getId())).isEqualByComparingTo("999");
    }
}
