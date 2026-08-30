package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.api.dto.MealBreakdown;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealItemResponse;
import io.mrkuhne.mezo.api.dto.MealProvenance;
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
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

class MealApiIT extends ApiIntegrationTest {

    /** Fixed instant so meal_date is deterministic across the test run. */
    private static final OffsetDateTime LOGGED_AT =
        OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC);
    private static final LocalDate MEAL_DATE = LocalDate.of(2026, 6, 24);

    @Autowired private io.mrkuhne.mezo.support.populator.TrainPopulator train;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
    @Autowired private io.mrkuhne.mezo.support.populator.WeightLogPopulator weightLogs;

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
        return createRecipe(auth, foodId, "200");
    }

    /** Same 2-serving recipe, caller-chosen line amount — for the gram-precision fixture. */
    private RecipeResponse createRecipe(HttpHeaders auth, UUID foodId, String grams) {
        RecipeIngredientRequest line = new RecipeIngredientRequest();
        line.setPantryItemId(foodId);
        line.setAmount(new BigDecimal(grams));
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

    /** Creates a per-100g food carrying nutrition-quality facts (fiber 4 / sugar 22 / salt 0.4 /
     *  saturatedFat 0.6 — the same fixture the NOVA/context tests above use) and returns its id. */
    private UUID createFoodWithFacts(HttpHeaders auth, String name) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("250"));
        r.setProteinG(new BigDecimal("6"));
        r.setCarbsG(new BigDecimal("48"));
        r.setFatG(new BigDecimal("3"));
        r.setNova(4);
        r.setFiberG(new BigDecimal("4"));
        r.setSugarG(new BigDecimal("22"));
        r.setSaltG(new BigDecimal("0.4"));
        r.setSaturatedFatG(new BigDecimal("0.6"));
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    /** Logs a single pantry-arm item of {@code amount} grams of a facts-carrying food (mezo-m6uv). */
    private MealResponse logPantryMeal(BigDecimal amount) {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFoodWithFacts(auth, "Mézes banán toast");
        return postForBody("/api/meal", mealReq(pantryItem(food, amount.toPlainString())),
            auth, HttpStatus.CREATED, MealResponse.class);
    }

    /** Logs a single recipe-arm item of {@code servings} adag of a 2-serving, 200 g-of-facts-food
     *  recipe (mezo-m6uv). */
    private MealResponse logRecipeMeal(BigDecimal servings) {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFoodWithFacts(auth, "Zabkása alap");
        RecipeResponse recipe = createRecipe(auth, food);
        return postForBody("/api/meal", mealReq(recipeItem(recipe.getId(), servings.toPlainString())),
            auth, HttpStatus.CREATED, MealResponse.class);
    }

    /** An estimate-arm meal item: source=estimate, verbatim name + per-basis macro snapshot, no FK. */
    private MealItemRequest estimateItem() {
        MealItemRequest i = new MealItemRequest();
        i.setSource("estimate");
        i.setAmount(new BigDecimal("1"));
        i.setUnit("db");
        i.setName("Csirkés wrap");
        i.setPer(new BigDecimal("1"));
        i.setBasisUnit("db");
        i.setKcal(new BigDecimal("450"));
        i.setProteinG(new BigDecimal("28"));
        i.setCarbsG(new BigDecimal("40"));
        i.setFatG(new BigDecimal("18"));
        return i;
    }

    /** A breakfast meal request at the fixed instant carrying the given items. */
    private MealRequest mealReq(MealItemRequest... items) {
        return mealReqAt(LOGGED_AT, items);
    }

    /** Same breakfast request at a caller-chosen instant — the week rollup needs meals on
     *  DIFFERENT days inside {@code start..start+6}. */
    private MealRequest mealReqAt(OffsetDateTime loggedAt, MealItemRequest... items) {
        MealRequest r = new MealRequest();
        r.setSlot("breakfast");
        r.setLoggedAt(loggedAt);
        r.setTitle("Reggeli");
        r.setItems(List.of(items));
        return r;
    }

    @Test
    void testCreate_shouldScoreAsPreWorkoutFuel_whenGymSlotAfterMeal() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        // NOVA-4, high-sugar, carb-heavy food (fuel shape)
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Mézes banán toast");
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("250"));
        r.setProteinG(new BigDecimal("6"));
        r.setCarbsG(new BigDecimal("48"));
        r.setFatG(new BigDecimal("3"));
        r.setNova(4);
        r.setFiberG(new BigDecimal("4"));
        r.setSugarG(new BigDecimal("22"));
        r.setSaltG(new BigDecimal("0.4"));
        r.setSaturatedFatG(new BigDecimal("0.6"));
        UUID food = postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class)
            .getId();

        // no gym slot yet → standard score
        MealResponse standard = postForBody(
            "/api/meal", mealReq(pantryItem(food, "100")), auth, HttpStatus.CREATED, MealResponse.class);
        BigDecimal standardScore = standard.getScore().getValue();

        // seed a gym slot at 14:30 on Wednesday (meal date 2026-06-24), re-log → pre-workout
        train.createGymSlot(owner, 2, "14:30");
        MealResponse pre = postForBody(
            "/api/meal", mealReq(pantryItem(food, "100")), auth, HttpStatus.CREATED, MealResponse.class);

        assertThat(pre.getScore().getValue().doubleValue())
            .isGreaterThan(standardScore.doubleValue());
        assertThat(pre.getScore().getBreakdown().getDimensions())
            .filteredOn(d -> "context".equals(d.getId()))
            .flatExtracting(d -> d.getContext())
            .anySatisfy(row -> assertThat(row.getLabel()).isEqualTo("Szerep"));
    }

    @Test
    void testCreate_shouldScoreStandard_whenNoWorkoutThatDay() {
        HttpHeaders auth = ownerAuthHeaders();
        databasePopulator.populateUser(ownerProperties.ownerEmail());   // owner exists, no slots
        UUID food = createFood(auth, "Zabpehely", "370", "13", "59", "7");   // NOVA-less plain food

        MealResponse res = postForBody(
            "/api/meal", mealReq(pantryItem(food, "100")), auth, HttpStatus.CREATED, MealResponse.class);

        // no workout day → no Szerep row (standard rubric)
        assertThat(res.getScore().getBreakdown().getDimensions())
            .filteredOn(d -> "context".equals(d.getId()))
            .flatExtracting(d -> d.getContext())
            .noneSatisfy(row -> assertThat(row.getLabel()).isEqualTo("Szerep"));
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
        // deterministic score at write (mezo-yta): scalar + 8-dim envelope (mezo-7797). These plain
        // foods carry no NOVA / nutrition facts / category -> micro/who/fat_quality/nova/
        // plant_diversity degrade honestly (weight 0); macro + context stay real and energy_density
        // lights up from the 200 g gram-based pantry arm.
        assertThat(created.getScore().getValue()).isNotNull();
        assertThat(created.getScore().getValue().doubleValue()).isBetween(0.0, 1.0);
        MealBreakdown breakdown = created.getScore().getBreakdown();
        assertThat(breakdown).isNotNull();
        assertThat(breakdown.getDimensions()).extracting(MealScoreDimension::getId)
            .containsExactly("macro", "micro", "who", "fat_quality", "nova",
                "plant_diversity", "energy_density", "context");
        assertThat(breakdown.getDimensions())
            .filteredOn(d -> d.getWeight().signum() == 0)
            .extracting(MealScoreDimension::getId)
            .containsExactly("micro", "who", "fat_quality", "nova", "plant_diversity");
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
    void testCreate_shouldScoreAllLiveDimensions_whenSourcesCarryNovaAndFacts() {
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
        // 8-dim meal surface (mezo-7797): every dimension lives EXCEPT plant_diversity — the food
        // carries no category — which degrades to weight 0. Meal weights are RAW (not renormalized).
        assertThat(b.getDimensions()).extracting(MealScoreDimension::getId)
            .containsExactly("macro", "micro", "who", "fat_quality", "nova",
                "plant_diversity", "energy_density", "context");
        assertThat(b.getDimensions()).extracting(MealScoreDimension::getWeight)
            .extracting(BigDecimal::doubleValue)
            .containsExactly(0.22, 0.10, 0.14, 0.10, 0.18, 0.00, 0.06, 0.12);
        // confidence stays 1.00: the degraded plant_diversity drops out of the renormalized sum,
        // and every live dimension has full coverage
        assertThat(b.getConfidence()).isEqualByComparingTo("1.00");
        // micro carries the single fiber row since mezo-7797: fiber 10 g on a 370 kcal breakfast -> good
        MealScoreDimension micro = b.getDimensions().get(1);
        assertThat(micro.getMicros()).hasSize(1);
        assertThat(micro.getMicros().getFirst().getName()).isEqualTo("Rost");
        assertThat(micro.getMicros().getFirst().getStatus()).isEqualTo("good");
        // NOVA detail: single NOVA-1 line dominates
        MealScoreDimension nova = b.getDimensions().get(4);
        assertThat(nova.getNova().getDominant()).isEqualTo(1);
        assertThat(nova.getScore()).isEqualByComparingTo("1.00");
        // context rows present (timing 13:20 is outside the breakfast window -> penalized, not absent)
        assertThat(b.getDimensions().get(7).getContext()).hasSize(3);
        assertThat(b.getTools()).extracting(t -> t.getType()).contains("read", "compute");
    }

    @Test
    void testCreateMeal_shouldFreezeNutrients_onBothArms() {
        // pantry arm: 150 g of a per-100 g source carrying facts → factor 1.5
        MealResponse pantryMeal = logPantryMeal(new BigDecimal("150"));
        assertThat(pantryMeal.getItems().get(0).getNutrients().getFiberG()).isEqualByComparingTo("6.0");
        assertThat(pantryMeal.getNutrients().getFiberG()).isEqualByComparingTo("6.0");

        // recipe arm: 1 adag of a 2-serving recipe → the per-serving half of the whole rollup
        MealResponse recipeMeal = logRecipeMeal(new BigDecimal("1"));
        assertThat(recipeMeal.getItems().get(0).getNutrients().getSaltG()).isNotNull();
        assertThat(recipeMeal.getItems().get(0).getNutrients().getSaltG())
            .isEqualByComparingTo(recipeMeal.getNutrients().getSaltG());
    }

    /**
     * The gram precision guard (mezo-m6uv, review fix 1). Grams are rounded PER LINE and then the
     * whole-recipe sum is divided by servings, so a one-decimal scale quantizes twice: this line is
     * truly 0.4 g/100 g × 20 g = 0.08 g whole → ÷ 2 servings = <b>0.040 g/adag</b>, which the old
     * rule inflated to 0.1 g (0.08→0.1, then 0.1÷2=0.05→0.1) — 2.5×, on salt, the number this
     * feature exists to show. Deliberately a fixture that is NOT exact at one decimal: every other
     * nutrient assertion in the suite lands on a round value and would survive a revert to
     * {@code setScale(1)}. This one fails on a revert of ANY of the three hops —
     * {@code RecipeMapper.scaledGram} (→0.050), {@code MealService.perServingGram} (→0.0) or
     * {@code MealMapper.scaledGram} (→0.0).
     */
    @Test
    void testCreateMeal_shouldKeepThreeDecimalGrams_whenTheWholeRollupIsDividedByServings() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFoodWithFacts(auth, "Sós keksz"); // salt 0.4 g / 100 g
        RecipeResponse recipe = createRecipe(auth, food, "20"); // 20 g line, 2 servings

        MealResponse meal = postForBody("/api/meal", mealReq(recipeItem(recipe.getId(), "1")),
            auth, HttpStatus.CREATED, MealResponse.class);

        assertThat(meal.getItems().get(0).getNutrients().getSaltG())
            .isEqualByComparingTo(new BigDecimal("0.040"));
    }

    @Test
    void testCreate_shouldPersistEstimateLineAndScore_whenAiDraftConfirmed() {
        HttpHeaders auth = ownerAuthHeaders();
        // AI confirm path: an estimate line carries its own verbatim snapshot (no recipe/pantry FK)
        // and the meal carries an ai-text provenance envelope (persistence asserted in MealServiceIT).
        MealRequest req = mealReq(estimateItem());
        MealProvenance prov = new MealProvenance();
        prov.setOrigin("ai-text");
        prov.setRawText("ettem egy csirkés wrapot");
        req.setProvenance(prov);

        MealResponse res = postForBody("/api/meal", req, auth, HttpStatus.CREATED, MealResponse.class);

        assertThat(res.getItems()).hasSize(1);
        MealItemResponse line = res.getItems().getFirst();
        assertThat(line.getSource()).isEqualTo("estimate");
        assertThat(line.getName()).isEqualTo("Csirkés wrap");
        // amount 1 / per 1 -> factor 1: contribution == snapshot verbatim
        assertThat(line.getContribution().getKcal()).isEqualByComparingTo("450");
        assertThat(line.getContribution().getP()).isEqualByComparingTo("28");
        assertThat(line.getContribution().getC()).isEqualByComparingTo("40");
        assertThat(line.getContribution().getF()).isEqualByComparingTo("18");
        // scoring ran end-to-end on a both-FK-null line: macro dim scores, micro/nova degrade
        // honestly (no live source facts) — the meal score is present, not an NPE-500.
        assertThat(res.getScore()).isNotNull();
        assertThat(res.getScore().getValue()).isNotNull();
        assertThat(res.getScore().getValue().doubleValue()).isBetween(0.0, 1.0);
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenEstimateLineMissingMacros() {
        HttpHeaders auth = ownerAuthHeaders();
        // estimate arm requires the full per-basis macro set; drop the macros -> rejected on "items"
        MealItemRequest estimate = estimateItem();
        estimate.setKcal(null);
        estimate.setProteinG(null);
        estimate.setCarbsG(null);
        estimate.setFatG(null);

        String body = exchangeForBody(
            HttpMethod.POST, "/api/meal", mealReq(estimate), auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenEstimateLineCarriesFk() {
        HttpHeaders auth = ownerAuthHeaders();
        // an estimate line must carry NEITHER recipeId nor pantryItemId
        MealItemRequest estimate = estimateItem();
        estimate.setPantryItemId(UUID.randomUUID());

        String body = exchangeForBody(
            HttpMethod.POST, "/api/meal", mealReq(estimate), auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
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
    void testGetFuelWeek_shouldAverageScoredMealsAndDailyLatestWeighIns_whenBothPresent() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        UUID food = createFoodWithFacts(auth, "Mézes banán toast");

        // two scored meals on two different days of the 2026-06-22..28 week
        MealResponse first = postForBody("/api/meal",
            mealReqAt(LOGGED_AT, pantryItem(food, "100")), auth, HttpStatus.CREATED, MealResponse.class);
        MealResponse second = postForBody("/api/meal",
            mealReqAt(OffsetDateTime.of(2026, 6, 26, 8, 5, 0, 0, ZoneOffset.UTC), pantryItem(food, "220")),
            auth, HttpStatus.CREATED, MealResponse.class);

        // weigh-ins: one before the week (ignored), one mid-week, one day weighed TWICE
        weightLogs.createWeightLog(owner, LocalDate.of(2026, 6, 21), new BigDecimal("90.00"));
        weightLogs.createWeightLog(owner, LocalDate.of(2026, 6, 23), new BigDecimal("82.40"));
        weightLogs.createWeightLogAt(owner, LocalDate.of(2026, 6, 25), new BigDecimal("81.00"),
            Instant.parse("2026-06-25T06:00:00Z"));
        weightLogs.createWeightLogAt(owner, LocalDate.of(2026, 6, 25), new BigDecimal("81.60"),
            Instant.parse("2026-06-25T19:00:00Z")); // later ⇒ this is the day's value

        FuelWeekResponse week = getForBody(
            "/api/fuel/week/2026-06-22", auth, HttpStatus.OK, FuelWeekResponse.class);

        BigDecimal expectedScoreAvg = first.getScore().getValue().add(second.getScore().getValue())
            .divide(new BigDecimal("2"), 3, RoundingMode.HALF_UP);
        assertThat(week.getMealScoreAvg()).isEqualByComparingTo(expectedScoreAvg);
        // (82.40 + 81.60) / 2 — the 06-21 weigh-in is outside the week, 81.00 lost the same-day tie
        assertThat(week.getWeightAvgKg()).isEqualByComparingTo("82.00");
    }

    @Test
    void testGetFuelWeek_shouldReturnNullAverages_whenWeekHasNoMealsAndNoWeighIns() {
        HttpHeaders auth = ownerAuthHeaders();

        FuelWeekResponse week = getForBody(
            "/api/fuel/week/2026-06-22", auth, HttpStatus.OK, FuelWeekResponse.class);

        // honest state: nothing to average ⇒ null, never a 0-as-a-fake
        assertThat(week.getMealScoreAvg()).isNull();
        assertThat(week.getWeightAvgKg()).isNull();
    }

    @Test
    void testGetFuelWeek_shouldReturnNullWeightAvg_whenWeekHasMealsButNoWeighIn() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFoodWithFacts(auth, "Mézes banán toast");
        MealResponse meal = postForBody("/api/meal",
            mealReq(pantryItem(food, "100")), auth, HttpStatus.CREATED, MealResponse.class);

        FuelWeekResponse week = getForBody(
            "/api/fuel/week/2026-06-22", auth, HttpStatus.OK, FuelWeekResponse.class);

        assertThat(week.getMealScoreAvg())
            .isEqualByComparingTo(meal.getScore().getValue().setScale(3, RoundingMode.HALF_UP));
        assertThat(week.getWeightAvgKg()).isNull();
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
