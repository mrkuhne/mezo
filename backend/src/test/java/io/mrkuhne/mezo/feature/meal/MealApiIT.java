package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealItemResponse;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

class MealApiIT extends ApiIntegrationTest {

    /** Fixed instant so meal_date is deterministic across the test run. */
    private static final OffsetDateTime LOGGED_AT =
        OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC);
    private static final LocalDate MEAL_DATE = LocalDate.of(2026, 6, 24);

    /** Creates a per-100g food via POST /api/pantry (owned by the authed owner) and returns its id. */
    private UUID createFood(HttpHeaders auth, String name, String kcal, String p, String c, String f) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal(kcal));
        r.setProteinG(new BigDecimal(p));
        r.setCarbsG(new BigDecimal(c));
        r.setFatG(new BigDecimal(f));
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    /** Creates a 2-serving recipe via POST /api/recipe from one 200 g pantry line and returns it. */
    private RecipeResponse createRecipe(HttpHeaders auth, UUID foodId) {
        RecipeIngredientRequest line = new RecipeIngredientRequest();
        line.setPantryItemId(foodId);
        line.setAmount(new BigDecimal("200"));
        line.setUnit("g");
        RecipeRequest r = new RecipeRequest();
        r.setName("Túrós tál");
        r.setCategory("breakfast");
        r.setServings(2);
        r.setStarred(false);
        r.setTags(List.of("magas-fehérje"));
        r.setIngredients(List.of(line));
        return postForBody("/api/recipe", r, auth, HttpStatus.CREATED, RecipeResponse.class);
    }

    /** A recipe-arm meal item: source=recipe, recipeId set, amount = servings. */
    private MealItemRequest recipeItem(UUID recipeId, String servings) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("recipe");
        i.setRecipeId(recipeId);
        i.setAmount(new BigDecimal(servings));
        i.setUnit("adag");
        return i;
    }

    /** A pantry-arm meal item: source=pantry, pantryItemId set, amount = quantity. */
    private MealItemRequest pantryItem(UUID pantryItemId, String amount) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("pantry");
        i.setPantryItemId(pantryItemId);
        i.setAmount(new BigDecimal(amount));
        i.setUnit("g");
        return i;
    }

    /** A breakfast meal request at the fixed instant carrying the given items. */
    private MealRequest mealReq(MealItemRequest... items) {
        MealRequest r = new MealRequest();
        r.setSlot("breakfast");
        r.setLoggedAt(LOGGED_AT);
        r.setTitle("Reggeli");
        r.setItems(List.of(items));
        return r;
    }

    @Test
    void testCreateThenGetDay_shouldRollUpMacrosAndConsumed_whenRecipeAndPantryArms() {
        HttpHeaders auth = ownerAuthHeaders();
        // per-100g food: 110 kcal / 23 p / 0 c / 1.5 f
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        // 2-serving recipe of 200 g of that food: whole rollup kcal 220 p 46 c 0 f 3 -> per-serving 110/23/0/1.5
        RecipeResponse recipe = createRecipe(auth, food);

        // Meal: 1 serving of the recipe (recipe-arm) + 200 g of the food (pantry-arm).
        // recipe-arm contribution: per-serving (110/23/0/1.5) x factor 1 -> 110/23/0/2 (1.5 rounds HALF_UP -> 2)
        // pantry-arm contribution: per-100g x factor 2 -> kcal 220 p 46 c 0 f 3
        MealResponse created = postForBody(
            "/api/meal",
            mealReq(recipeItem(recipe.getId(), "1"), pantryItem(food, "200")),
            auth, HttpStatus.CREATED, MealResponse.class);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getSlot()).isEqualTo("breakfast");
        assertThat(created.getMealDate()).isEqualTo(MEAL_DATE);
        assertThat(created.getItems()).hasSize(2);

        // line order preserved from request index
        MealItemResponse arm0 = created.getItems().get(0);
        MealItemResponse arm1 = created.getItems().get(1);
        assertThat(arm0.getSource()).isEqualTo("recipe");
        assertThat(arm0.getLineOrder()).isEqualTo(0);
        assertThat(arm0.getName()).isEqualTo("Túrós tál");
        assertThat(arm0.getContribution().getKcal()).isEqualByComparingTo("110");
        assertThat(arm0.getContribution().getP()).isEqualByComparingTo("23");
        assertThat(arm0.getContribution().getF()).isEqualByComparingTo("2");
        assertThat(arm1.getSource()).isEqualTo("pantry");
        assertThat(arm1.getLineOrder()).isEqualTo(1);
        assertThat(arm1.getName()).isEqualTo("Csirkemell");
        assertThat(arm1.getContribution().getKcal()).isEqualByComparingTo("220");
        assertThat(arm1.getContribution().getP()).isEqualByComparingTo("46");

        // meal rollup = sum of item contributions
        assertThat(created.getMacros().getKcal()).isEqualByComparingTo("330");
        assertThat(created.getMacros().getP()).isEqualByComparingTo("69");
        assertThat(created.getMacros().getF()).isEqualByComparingTo("5");
        // meal score pending (NULL breakdown -> sparkle on the FE)
        assertThat(created.getScore().getValue()).isNull();

        // GET /api/fuel/day/{date}: targets from config, consumed = sum of the day's meals
        FuelDayResponse day = getForBody(
            "/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK, FuelDayResponse.class);
        assertThat(day.getDate()).isEqualTo(MEAL_DATE);
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo("3100");
        assertThat(day.getTargets().getP()).isEqualByComparingTo("220");
        assertThat(day.getTargets().getWater()).isEqualByComparingTo("4000");
        assertThat(day.getConsumed().getKcal()).isEqualByComparingTo("330");
        assertThat(day.getConsumed().getP()).isEqualByComparingTo("69");
        assertThat(day.getMeals()).extracting(MealResponse::getId).contains(created.getId());
    }

    @Test
    void testGetDay_shouldReturnEmptyMealsAndConfigTargets_whenNoMealsLogged() {
        HttpHeaders auth = ownerAuthHeaders();

        FuelDayResponse day = getForBody(
            "/api/fuel/day/2026-01-01", auth, HttpStatus.OK, FuelDayResponse.class);

        assertThat(day.getMeals()).isEmpty();
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo("3100");
        assertThat(day.getConsumed().getKcal()).isEqualByComparingTo("0");
    }

    // ---- guard placeholders implemented in ctrl4 (kept compiling together) ----
}
