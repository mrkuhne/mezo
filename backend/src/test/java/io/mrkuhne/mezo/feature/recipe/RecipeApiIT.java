package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeListResponse;
import io.mrkuhne.mezo.api.dto.RecipeLogListResponse;
import io.mrkuhne.mezo.api.dto.RecipeLogResponse;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

class RecipeApiIT extends ApiIntegrationTest {

    /** Creates a per-100g food via the API (owned by the authenticated owner) and returns its id. */
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
        PantryItemResponse created =
            postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class);
        return created.getId();
    }

    private RecipeIngredientRequest line(UUID pantryItemId, String amount) {
        RecipeIngredientRequest l = new RecipeIngredientRequest();
        l.setPantryItemId(pantryItemId);
        l.setAmount(new BigDecimal(amount));
        l.setUnit("g");
        return l;
    }

    private RecipeRequest recipeReq(UUID... pantryItemIds) {
        RecipeRequest r = new RecipeRequest();
        r.setName("Túrós tál");
        r.setCategory("breakfast");
        r.setServings(2);
        r.setStarred(false);
        r.setTags(List.of("magas-fehérje"));
        List<RecipeIngredientRequest> lines = new java.util.ArrayList<>();
        for (UUID id : pantryItemIds) lines.add(line(id, "200"));
        r.setIngredients(lines);
        return r;
    }

    @Test
    void testCreateThenGet_shouldReturnRecipeWithComputedMacros_whenAuthed() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");

        RecipeResponse created =
            postForBody("/api/recipe", recipeReq(food), auth, HttpStatus.CREATED, RecipeResponse.class);
        assertThat(created.getId()).isNotNull();

        RecipeResponse got =
            getForBody("/api/recipe/" + created.getId(), auth, HttpStatus.OK, RecipeResponse.class);
        assertThat(got.getName()).isEqualTo("Túrós tál");
        assertThat(got.getCategory()).isEqualTo("breakfast");
        // 200 g of a per-100g food: factor 2 -> kcal 220, p 46, c 0, f 3
        assertThat(got.getIngredients()).hasSize(1);
        assertThat(got.getIngredients().get(0).getName()).isEqualTo("Csirkemell");
        assertThat(got.getIngredients().get(0).getLineOrder()).isEqualTo(0);
        assertThat(got.getIngredients().get(0).getContribution().getKcal()).isEqualByComparingTo("220");
        // whole-recipe rollup
        assertThat(got.getMacros().getKcal()).isEqualByComparingTo("220");
        assertThat(got.getMacros().getP()).isEqualByComparingTo("46");
        assertThat(got.getMacros().getF()).isEqualByComparingTo("3");
        // pending mezoFit + derived defaults
        assertThat(got.getMezoFit().getScore()).isNull();
        assertThat(got.getMezoFit().getFitsFor()).isEmpty();
        assertThat(got.getTimesLogged()).isEqualTo(0);
        assertThat(got.getLastLogged()).isEqualTo("—");
    }

    @Test
    void testList_shouldReturnCreatedRecipe_whenAuthed() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        postForBody("/api/recipe", recipeReq(food), auth, HttpStatus.CREATED, RecipeResponse.class);

        RecipeListResponse list = getForBody("/api/recipe", auth, HttpStatus.OK, RecipeListResponse.class);

        assertThat(list.getRecipes()).extracting(RecipeResponse::getName).contains("Túrós tál");
    }

    @Test
    void testGet_shouldReturn404_whenUnknownId() {
        HttpHeaders auth = ownerAuthHeaders();

        exchangeForBody(HttpMethod.GET, "/api/recipe/" + UUID.randomUUID(),
            null, auth, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenIngredientsEmpty() {
        HttpHeaders auth = ownerAuthHeaders();
        RecipeRequest bad = recipeReq(); // zero lines -> violates minItems:1
        bad.setIngredients(List.of());

        String body = exchangeForBody(
            HttpMethod.POST, "/api/recipe", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "ingredients", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenNameBlank() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        RecipeRequest bad = recipeReq(food);
        bad.setName(""); // minLength:1 -> Size

        String body = exchangeForBody(
            HttpMethod.POST, "/api/recipe", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "name", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenCategoryInvalid() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        RecipeRequest bad = recipeReq(food);
        bad.setCategory("brunch"); // fails the pattern ^(breakfast|lunch|dinner|snack)$

        String body = exchangeForBody(
            HttpMethod.POST, "/api/recipe", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "category", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenPantryItemMissing() {
        HttpHeaders auth = ownerAuthHeaders();
        RecipeRequest bad = recipeReq(UUID.randomUUID()); // references a non-existent pantry item

        String body = exchangeForBody(
            HttpMethod.POST, "/api/recipe", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "ingredients", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testUpdate_shouldReturn404_whenUnknownId() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");

        exchangeForBody(HttpMethod.PUT, "/api/recipe/" + UUID.randomUUID(),
            recipeReq(food), auth, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testUpdate_shouldFullReplaceLines_whenOwned() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID chicken = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        UUID oats = createFood(auth, "Zabpehely", "100", "10", "20", "5");

        RecipeResponse created =
            postForBody("/api/recipe", recipeReq(chicken), auth, HttpStatus.CREATED, RecipeResponse.class);
        assertThat(created.getIngredients()).hasSize(1);

        // Full-replace: editor re-sends the COMPLETE recipe, now with two lines (chicken removed, oats added)
        RecipeRequest replace = recipeReq(oats);
        replace.setName("Zabkása");
        putForBody("/api/recipe/" + created.getId(), replace, auth, HttpStatus.NO_CONTENT, Void.class);

        RecipeResponse after =
            getForBody("/api/recipe/" + created.getId(), auth, HttpStatus.OK, RecipeResponse.class);
        assertThat(after.getName()).isEqualTo("Zabkása");
        assertThat(after.getIngredients()).extracting(i -> i.getName()).containsExactly("Zabpehely");
        // 200 g of per-100g oats: factor 2 -> kcal 200
        assertThat(after.getMacros().getKcal()).isEqualByComparingTo("200");
    }

    @Test
    void testDelete_shouldReturn204ThenHide_whenOwned() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        RecipeResponse created =
            postForBody("/api/recipe", recipeReq(food), auth, HttpStatus.CREATED, RecipeResponse.class);

        deleteAndExpect("/api/recipe/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        exchangeForBody(HttpMethod.GET, "/api/recipe/" + created.getId(),
            null, auth, HttpStatus.NOT_FOUND, String.class);
        RecipeListResponse list = getForBody("/api/recipe", auth, HttpStatus.OK, RecipeListResponse.class);
        assertThat(list.getRecipes()).extracting(RecipeResponse::getId).doesNotContain(created.getId());
    }

    @Test
    void testDelete_shouldReturn404_whenUnknownId() {
        HttpHeaders auth = ownerAuthHeaders();

        deleteAndExpect("/api/recipe/" + UUID.randomUUID(), auth, HttpStatus.NOT_FOUND);
    }

    @Test
    void testRecipeLogs_shouldReturnLoggedMeal_whenMealReferencesRecipe() {
        HttpHeaders auth = ownerAuthHeaders();
        // 2-serving recipe (200 g of a per-100g food -> whole rollup kcal 220, per-serving 110)
        UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
        RecipeResponse recipe =
            postForBody("/api/recipe", recipeReq(food), auth, HttpStatus.CREATED, RecipeResponse.class);

        // Log a breakfast meal of 1 serving of the recipe (recipe-arm)
        MealItemRequest item = new MealItemRequest();
        item.setSource("recipe");
        item.setRecipeId(recipe.getId());
        item.setAmount(new BigDecimal("1"));
        item.setUnit("adag");
        MealRequest meal = new MealRequest();
        meal.setSlot("breakfast");
        meal.setTitle("Reggeli");
        meal.setItems(List.of(item));
        MealResponse logged =
            postForBody("/api/meal", meal, auth, HttpStatus.CREATED, MealResponse.class);

        RecipeLogListResponse logs = getForBody(
            "/api/recipe/" + recipe.getId() + "/logs", auth, HttpStatus.OK, RecipeLogListResponse.class);

        assertThat(logs.getRecentLogs())
            .extracting(RecipeLogResponse::getMealId)
            .contains(logged.getId());
        RecipeLogResponse log = logs.getRecentLogs().stream()
            .filter(l -> l.getMealId().equals(logged.getId()))
            .findFirst().orElseThrow();
        assertThat(log.getSlot()).isEqualTo("breakfast");
        // per-serving of the recipe x factor 1 -> kcal 110
        assertThat(log.getKcal()).isEqualByComparingTo("110");
    }
}
