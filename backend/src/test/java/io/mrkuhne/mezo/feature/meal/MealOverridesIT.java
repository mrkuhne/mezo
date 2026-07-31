package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MealIngredientOverrideRequest;
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

/**
 * Per-ingredient overrides on the recipe arm (mezo-ormb).
 *
 * <p>Fixture arithmetic (per-100g source 110 kcal / 13 p / 4 c / 4.5 f, 2-serving recipe with TWO
 * lines pointing at the SAME pantry item — which is legal, there is no unique
 * (recipe_id, pantry_item_id), and is exactly why lineOrder is the key):
 * <pre>
 * line 0: 250 g -> factor 2.5 -> 275/32.5/10/11.25 -> round 275/33/10/11
 * line 1:  20 g -> factor 0.2 ->  22/2.6/0.8/0.9   -> round  22/3/1/1
 * whole = 297/36/11/12 ; per serving (÷2, unrounded) = 148.5/18/5.5/6 ; 1 adag -> 149/18/6/6
 * line 1 overridden to 0 -> whole 275/33/10/11 ; per serving 137.5/16.5/5/5.5 -> 1 adag -> 138/17/5/6
 * </pre>
 */
class MealOverridesIT extends ApiIntegrationTest {

    private static final OffsetDateTime LOGGED_AT =
        OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC);
    private static final LocalDate MEAL_DATE = LocalDate.of(2026, 6, 24);

    private UUID createFood(HttpHeaders auth, String name, Integer nova) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("110"));
        r.setProteinG(new BigDecimal("13"));
        r.setCarbsG(new BigDecimal("4"));
        r.setFatG(new BigDecimal("4.5"));
        r.setNova(nova);
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    private RecipeIngredientRequest ingredient(UUID foodId, String amount) {
        RecipeIngredientRequest line = new RecipeIngredientRequest();
        line.setPantryItemId(foodId);
        line.setAmount(new BigDecimal(amount));
        line.setUnit("g");
        return line;
    }

    /** 2-serving recipe; both lines reference the SAME pantry item (250 g then 20 g). */
    private RecipeResponse createRecipe(HttpHeaders auth, RecipeIngredientRequest... lines) {
        RecipeRequest r = new RecipeRequest();
        r.setName("Túrós tál");
        r.setCategory("breakfast");
        r.setServings(2);
        r.setStarred(false);
        r.setTags(List.of("magas-fehérje"));
        r.setIngredients(List.of(lines));
        return postForBody("/api/recipe", r, auth, HttpStatus.CREATED, RecipeResponse.class);
    }

    private MealIngredientOverrideRequest override(int lineOrder, UUID pantryItemId, String amount) {
        MealIngredientOverrideRequest o = new MealIngredientOverrideRequest();
        o.setLineOrder(lineOrder);
        o.setPantryItemId(pantryItemId);
        o.setAmount(new BigDecimal(amount));
        return o;
    }

    private MealItemRequest recipeItem(UUID recipeId, String servings,
                                       List<MealIngredientOverrideRequest> overrides) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("recipe");
        i.setRecipeId(recipeId);
        i.setAmount(new BigDecimal(servings));
        i.setUnit("adag");
        i.setIngredientOverrides(overrides);
        return i;
    }

    private MealRequest mealReq(MealItemRequest... items) {
        MealRequest r = new MealRequest();
        r.setSlot("breakfast");
        r.setLoggedAt(LOGGED_AT);
        r.setTitle("Reggeli");
        r.setItems(List.of(items));
        return r;
    }

    private String postBadMeal(HttpHeaders auth, MealRequest req) {
        return exchangeForBody(HttpMethod.POST, "/api/meal", req, auth, HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testCreate_shouldStayBitIdentical_whenNoOverridesAreSent() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));

        MealResponse created = postForBody("/api/meal", mealReq(recipeItem(recipe.getId(), "1", null)),
            auth, HttpStatus.CREATED, MealResponse.class);

        MealItemResponse item = created.getItems().get(0);
        assertThat(item.getContribution().getKcal()).isEqualByComparingTo("149");
        assertThat(item.getContribution().getP()).isEqualByComparingTo("18");
        assertThat(item.getContribution().getC()).isEqualByComparingTo("6");
        assertThat(item.getContribution().getF()).isEqualByComparingTo("6");
        assertThat(item.getIngredientOverrides()).isNull();
    }

    @Test
    void testCreate_shouldRecomputeSnapshot_whenOneLineIsZeroed() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));

        MealResponse created = postForBody("/api/meal",
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(1, food, "0")))),
            auth, HttpStatus.CREATED, MealResponse.class);

        MealItemResponse item = created.getItems().get(0);
        assertThat(item.getContribution().getKcal()).isEqualByComparingTo("138");
        assertThat(item.getContribution().getP()).isEqualByComparingTo("17");
        assertThat(item.getContribution().getC()).isEqualByComparingTo("5");
        assertThat(item.getContribution().getF()).isEqualByComparingTo("6");
        // self-describing envelope: only the changed line, carrying its original amount
        assertThat(item.getIngredientOverrides()).singleElement().satisfies(o -> {
            assertThat(o.getLineOrder()).isEqualTo(1);
            assertThat(o.getPantryItemId()).isEqualTo(food);
            assertThat(o.getName()).isEqualTo("Túró");
            assertThat(o.getUnit()).isEqualTo("g");
            assertThat(o.getOriginalAmount()).isEqualByComparingTo("20");
            assertThat(o.getAmount()).isEqualByComparingTo("0");
        });
    }

    @Test
    void testCreate_shouldOnlyTouchTheAddressedLine_whenBothLinesShareAPantryItem() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));

        // halve line 0 only: 125 g -> 137.5/16.25/5/5.625 -> round 138/16/5/6 ; line 1 stays 22/3/1/1
        // whole 160/19/6/7 ; per serving 80/9.5/3/3.5 -> 1 adag -> 80/10/3/4
        MealResponse created = postForBody("/api/meal",
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(0, food, "125")))),
            auth, HttpStatus.CREATED, MealResponse.class);

        MealItemResponse item = created.getItems().get(0);
        assertThat(item.getContribution().getKcal()).isEqualByComparingTo("80");
        assertThat(item.getContribution().getP()).isEqualByComparingTo("10");
        assertThat(item.getContribution().getC()).isEqualByComparingTo("3");
        assertThat(item.getContribution().getF()).isEqualByComparingTo("4");
        assertThat(item.getIngredientOverrides()).singleElement()
            .satisfies(o -> assertThat(o.getOriginalAmount()).isEqualByComparingTo("250"));
    }

    @Test
    void testCreate_shouldFallBackToTheNextHighestNova_whenTheTopNovaLineIsZeroed() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID clean = createFood(auth, "Túró", 1);
        UUID processed = createFood(auth, "Szirup", 4);
        RecipeResponse recipe = createRecipe(auth, ingredient(clean, "250"), ingredient(processed, "20"));

        MealResponse asWritten = postForBody("/api/meal", mealReq(recipeItem(recipe.getId(), "1", null)),
            auth, HttpStatus.CREATED, MealResponse.class);
        assertThat(asWritten.getItems().get(0).getNova()).isEqualTo(4);

        MealResponse zeroed = postForBody("/api/meal",
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(1, processed, "0")))),
            auth, HttpStatus.CREATED, MealResponse.class);
        assertThat(zeroed.getItems().get(0).getNova()).isEqualTo(1);
    }

    @Test
    void testCreate_shouldKeepTheFrozenNova_whenAnOverrideOnlyChangesAnAmount() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID clean = createFood(auth, "Túró", 1);
        UUID processed = createFood(auth, "Szirup", 4);
        RecipeResponse recipe = createRecipe(auth, ingredient(clean, "250"), ingredient(processed, "20"));

        // halving an UNRELATED line must not move the dominant NOVA off the recipe's frozen value —
        // the same ingredients still went in, only less of one of them
        MealResponse halved = postForBody("/api/meal",
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(0, clean, "125")))),
            auth, HttpStatus.CREATED, MealResponse.class);

        assertThat(halved.getItems().get(0).getNova()).isEqualTo(4);
    }

    @Test
    void testCreate_shouldReject_whenLineOrderIsOutOfRange() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"));

        String body = postBadMeal(auth,
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(7, food, "10")))));

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReject_whenPantryItemIdDoesNotMatchThatLine() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        UUID other = createFood(auth, "Méz", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"));

        String body = postBadMeal(auth,
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(0, other, "10")))));

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReject_whenTheSameLineIsOverriddenTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"));

        String body = postBadMeal(auth, mealReq(recipeItem(recipe.getId(), "1",
            List.of(override(0, food, "10"), override(0, food, "20")))));

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReject_whenAnOverrideElementIsNull() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"));

        // a null element slips past @Valid's cascade (it validates non-null elements only);
        // without the guard this NPEs into a 500 instead of the contract's 400
        List<MealIngredientOverrideRequest> withNull = new java.util.ArrayList<>();
        withNull.add(null);

        assertHasFieldError(postBadMeal(auth, mealReq(recipeItem(recipe.getId(), "1", withNull))),
            "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReject_whenOverridesRideOnAPantryItem() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);

        MealItemRequest pantry = new MealItemRequest();
        pantry.setSource("pantry");
        pantry.setPantryItemId(food);
        pantry.setAmount(new BigDecimal("100"));
        pantry.setUnit("g");
        pantry.setIngredientOverrides(List.of(override(0, food, "10")));

        assertHasFieldError(postBadMeal(auth, mealReq(pantry)), "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testUpdate_shouldRoundTripTheOverrides_whenTheMealIsEdited() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));
        MealResponse created = postForBody("/api/meal", mealReq(recipeItem(recipe.getId(), "1", null)),
            auth, HttpStatus.CREATED, MealResponse.class);

        exchangeForBody(HttpMethod.PUT, "/api/meal/" + created.getId(),
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(1, food, "0")))),
            auth, HttpStatus.NO_CONTENT, String.class);

        // there is no GET /api/meal/{id} (meal.yml exposes only put/delete there) — re-read the day
        MealResponse reread = getForBody("/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK,
            FuelDayResponse.class).getMeals().stream()
            .filter(m -> m.getId().equals(created.getId())).findFirst().orElseThrow();
        assertThat(reread.getItems().get(0).getIngredientOverrides()).hasSize(1);
        assertThat(reread.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("138");
    }

    @Test
    void testCreate_shouldNotRewriteHistory_whenTheRecipeIsEditedAfterwards() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));
        MealResponse logged = postForBody("/api/meal",
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(1, food, "0")))),
            auth, HttpStatus.CREATED, MealResponse.class);
        assertThat(logged.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("138");

        // rewrite the recipe entirely — a single, much smaller line
        RecipeRequest edited = new RecipeRequest();
        edited.setName("Túrós tál v2");
        edited.setCategory("breakfast");
        edited.setServings(2);
        edited.setStarred(false);
        edited.setTags(List.of());
        edited.setIngredients(List.of(ingredient(food, "10")));
        exchangeForBody(HttpMethod.PUT, "/api/recipe/" + recipe.getId(), edited,
            auth, HttpStatus.NO_CONTENT, String.class);

        MealResponse reread = getForBody("/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK,
            FuelDayResponse.class).getMeals().stream()
            .filter(m -> m.getId().equals(logged.getId())).findFirst().orElseThrow();
        // frozen: macros, the snapshot name, and the self-describing envelope all survive the edit
        assertThat(reread.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("138");
        assertThat(reread.getItems().get(0).getName()).isEqualTo("Túrós tál");
        assertThat(reread.getItems().get(0).getIngredientOverrides()).singleElement()
            .satisfies(o -> assertThat(o.getOriginalAmount()).isEqualByComparingTo("20"));
    }
}
