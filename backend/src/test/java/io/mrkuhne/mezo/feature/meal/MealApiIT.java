package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.api.dto.MealBreakdown;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealItemResponse;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.MealScoreDimension;
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
        // deterministic score at write (mezo-yta): scalar + 4-dim envelope; these plain foods carry
        // no NOVA / nutrition facts -> micro + nova degrade honestly (weight 0), macro/context real
        assertThat(created.getScore().getValue()).isNotNull();
        assertThat(created.getScore().getValue().doubleValue()).isBetween(0.0, 1.0);
        MealBreakdown breakdown = created.getScore().getBreakdown();
        assertThat(breakdown).isNotNull();
        assertThat(breakdown.getDimensions()).extracting(MealScoreDimension::getId)
            .containsExactly("macro", "micro", "nova", "context");
        assertThat(breakdown.getDimensions().get(1).getWeight()).isEqualByComparingTo("0");
        assertThat(breakdown.getDimensions().get(2).getWeight()).isEqualByComparingTo("0");
        assertThat(breakdown.getSummary()).isNull();   // P8 prose stays honest-empty
        assertThat(breakdown.getImprove()).isEmpty();
        assertThat(breakdown.getConfidence().doubleValue()).isLessThan(1.0);

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
    void testCreate_shouldScoreAllFourDimensions_whenSourcesCarryNovaAndFacts() {
        HttpHeaders auth = ownerAuthHeaders();
        // NOVA-1 food WITH nutrition facts per 100 g (fiber/sugar/salt/satFat)
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Zabpehely");
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("370"));
        r.setProteinG(new BigDecimal("13"));
        r.setCarbsG(new BigDecimal("59"));
        r.setFatG(new BigDecimal("7"));
        r.setNova(1);
        r.setFiberG(new BigDecimal("10"));
        r.setSugarG(new BigDecimal("1"));
        r.setSaltG(new BigDecimal("0.1"));
        r.setSaturatedFatG(new BigDecimal("1.2"));
        UUID oats = postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class)
            .getId();

        MealResponse created = postForBody(
            "/api/meal", mealReq(pantryItem(oats, "100")), auth, HttpStatus.CREATED, MealResponse.class);

        MealBreakdown b = created.getScore().getBreakdown();
        assertThat(b.getDimensions()).extracting(MealScoreDimension::getWeight)
            .extracting(BigDecimal::doubleValue)
            .containsExactly(0.30, 0.25, 0.25, 0.20); // full coverage -> no degrade
        assertThat(b.getConfidence()).isEqualByComparingTo("1.00");
        // micro rows frozen into the envelope: fiber 10 g on a 370 kcal breakfast -> over-allotment
        MealScoreDimension micro = b.getDimensions().get(1);
        assertThat(micro.getMicros()).hasSize(4);
        assertThat(micro.getMicros().getFirst().getName()).isEqualTo("Rost");
        assertThat(micro.getMicros().getFirst().getStatus()).isEqualTo("good");
        // NOVA detail: single NOVA-1 line dominates
        MealScoreDimension nova = b.getDimensions().get(2);
        assertThat(nova.getNova().getDominant()).isEqualTo(1);
        assertThat(nova.getScore()).isEqualByComparingTo("1.00");
        // context rows present (timing 13:20 is outside the breakfast window -> penalized, not absent)
        assertThat(b.getDimensions().get(3).getContext()).hasSize(3);
        assertThat(b.getTools()).extracting(t -> t.getType()).contains("read", "compute");
    }

    @Test
    void testRecipeLogs_shouldCarryMealScore_whenMealScored() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", "110", "23", "0", "1.5");
        RecipeResponse recipe = createRecipe(auth, food);
        postForBody("/api/meal", mealReq(recipeItem(recipe.getId(), "1")), auth,
            HttpStatus.CREATED, MealResponse.class);

        String body = getForBody("/api/recipe/" + recipe.getId() + "/logs", auth,
            HttpStatus.OK, String.class);

        assertThat(body).contains("\"score\":"); // present…
        assertThat(body).doesNotContain("\"score\":null"); // …and real for a freshly scored meal
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

    @Test
    void testGetFuelWeek_shouldReturnSevenRollupsWithConfigTargets_whenNoMealsLogged() {
        HttpHeaders auth = ownerAuthHeaders();

        FuelWeekResponse week = getForBody(
            "/api/fuel/week/2026-06-22", auth, HttpStatus.OK, FuelWeekResponse.class);

        assertThat(week.getStart()).isEqualTo(LocalDate.of(2026, 6, 22));
        assertThat(week.getDays()).hasSize(7);
        assertThat(week.getDays().getFirst().getDate()).isEqualTo(LocalDate.of(2026, 6, 22));
        assertThat(week.getDays().getLast().getDate()).isEqualTo(LocalDate.of(2026, 6, 28));
        assertThat(week.getDays().getFirst().getTargets().getKcal()).isEqualByComparingTo("3100");
        assertThat(week.getDays().getFirst().getConsumed().getKcal()).isEqualByComparingTo("0");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenItemsEmpty() {
        HttpHeaders auth = ownerAuthHeaders();
        MealRequest bad = mealReq(); // zero items -> violates minItems:1
        bad.setItems(List.of());

        String body = exchangeForBody(
            HttpMethod.POST, "/api/meal", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenSlotInvalid() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        MealRequest bad = mealReq(pantryItem(food, "100"));
        bad.setSlot("brunch"); // fails pattern ^(breakfast|lunch|dinner|snack)$

        String body = exchangeForBody(
            HttpMethod.POST, "/api/meal", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "slot", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenSourceArmMismatch() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        // source=recipe but the recipe arm is empty and a pantry id is supplied -> exactly-one-of violated
        MealItemRequest mismatched = new MealItemRequest();
        mismatched.setSource("recipe");
        mismatched.setPantryItemId(food); // wrong arm for source=recipe
        mismatched.setAmount(new BigDecimal("1"));
        mismatched.setUnit("adag");

        String body = exchangeForBody(
            HttpMethod.POST, "/api/meal", mealReq(mismatched), auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenSourceRowMissing() {
        HttpHeaders auth = ownerAuthHeaders();
        // references a non-existent recipe id -> resolve fails owner-scoped
        MealRequest bad = mealReq(recipeItem(UUID.randomUUID(), "1"));

        String body = exchangeForBody(
            HttpMethod.POST, "/api/meal", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testUpdate_shouldReturn404_whenUnknownId() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");

        exchangeForBody(HttpMethod.PUT, "/api/meal/" + UUID.randomUUID(),
            mealReq(pantryItem(food, "100")), auth, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDelete_shouldReturn404_whenUnknownId() {
        HttpHeaders auth = ownerAuthHeaders();

        deleteAndExpect("/api/meal/" + UUID.randomUUID(), auth, HttpStatus.NOT_FOUND);
    }

    @Test
    void testUpdate_shouldFullReplaceItems_whenOwned() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID chicken = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        UUID oats = createFood(auth, "Zabpehely", "100", "10", "20", "5");

        MealResponse created = postForBody(
            "/api/meal", mealReq(pantryItem(chicken, "200")), auth, HttpStatus.CREATED, MealResponse.class);
        assertThat(created.getItems()).hasSize(1);
        // 200 g of per-100g chicken: factor 2 -> kcal 220
        assertThat(created.getMacros().getKcal()).isEqualByComparingTo("220");

        // Full-replace: re-send the COMPLETE meal, now a single 100 g oats line (chicken removed)
        MealRequest replace = mealReq(pantryItem(oats, "100"));
        replace.setTitle("Zabkása");
        putForBody("/api/meal/" + created.getId(), replace, auth, HttpStatus.NO_CONTENT, Void.class);

        FuelDayResponse day = getForBody(
            "/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK, FuelDayResponse.class);
        MealResponse after = day.getMeals().stream()
            .filter(m -> m.getId().equals(created.getId()))
            .findFirst().orElseThrow();
        assertThat(after.getTitle()).isEqualTo("Zabkása");
        assertThat(after.getItems()).extracting(MealItemResponse::getName).containsExactly("Zabpehely");
        // 100 g of per-100g oats: factor 1 -> kcal 100
        assertThat(after.getMacros().getKcal()).isEqualByComparingTo("100");
    }

    @Test
    void testDelete_shouldReturn204ThenAbsentFromDay_whenOwned() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        MealResponse created = postForBody(
            "/api/meal", mealReq(pantryItem(food, "200")), auth, HttpStatus.CREATED, MealResponse.class);

        deleteAndExpect("/api/meal/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        FuelDayResponse day = getForBody(
            "/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK, FuelDayResponse.class);
        assertThat(day.getMeals()).extracting(MealResponse::getId).doesNotContain(created.getId());
        assertThat(day.getConsumed().getKcal()).isEqualByComparingTo("0");
        // re-delete the now soft-deleted meal -> 404
        deleteAndExpect("/api/meal/" + created.getId(), auth, HttpStatus.NOT_FOUND);
    }
}
