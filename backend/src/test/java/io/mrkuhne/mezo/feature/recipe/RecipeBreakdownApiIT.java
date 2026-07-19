package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeBreakdownResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Template-breakdown endpoint e2e (mezo-bw3y) against the deterministic {@code FakeCompanionLlm}:
 * the {@code [fake-recipe-fit:{json}]} sentinel planted in the RECIPE NAME is echoed as the LLM
 * answer, driving canned prose through the real prompt → parse → merge → persist path. A recipe
 * WITHOUT the sentinel gets the prompt echo (unparseable) → the deterministic-envelope degrade,
 * which doubles as the LLM-failure path.
 */
@ActiveProfiles("companion-fake")
class RecipeBreakdownApiIT extends ApiIntegrationTest {

    private static final String CANNED_PROSE = """
        {"summary":"Fake sablon-olvasat.","fitsFor":["Post-workout · este","Fehérje-fókusz"],\
        "details":{"macro":"Fake makró magyarázat.","micro":"Fake mikró magyarázat.",\
        "nova":"Fake nova magyarázat."},\
        "improve":[{"text":"Adj hozzá zöldséget.","impact":"+rost"}]}""";

    private static final String SENTINEL_NAME = "Túrós tál [fake-recipe-fit:" + CANNED_PROSE + "]";

    @Autowired
    private RecipeRepository recipeRepository;

    /** Creates a per-100g food via the API (owned by the authenticated owner) and returns its id. */
    private UUID createFood(HttpHeaders auth, String name, String kcal) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        if (kcal != null) {
            r.setKcal(new BigDecimal(kcal));
            r.setProteinG(new BigDecimal("13"));
            r.setCarbsG(new BigDecimal("4"));
            r.setFatG(new BigDecimal("4.5"));
        }
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    private RecipeRequest recipeReq(String name, UUID pantryItemId) {
        RecipeIngredientRequest l = new RecipeIngredientRequest();
        l.setPantryItemId(pantryItemId);
        l.setAmount(new BigDecimal("250"));
        l.setUnit("g");
        RecipeRequest r = new RecipeRequest();
        r.setName(name);
        r.setCategory("breakfast");
        r.setServings(2);
        r.setIngredients(List.of(l));
        return r;
    }

    private UUID createRecipe(HttpHeaders auth, String name, UUID pantryItemId) {
        return postForBody("/api/recipe", recipeReq(name, pantryItemId), auth,
            HttpStatus.CREATED, RecipeResponse.class).getId();
    }

    private RecipeBreakdownResponse getBreakdown(HttpHeaders auth, UUID id) {
        return getForBody("/api/recipe/" + id + "/breakdown", auth, HttpStatus.OK,
            RecipeBreakdownResponse.class);
    }

    @Test
    void testGetBreakdown_shouldReturnEnrichedEnvelopeAndPersist_whenLlmAnswers() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", "110");
        UUID recipe = createRecipe(auth, SENTINEL_NAME, food);

        RecipeBreakdownResponse res = getBreakdown(auth, recipe);

        assertThat(res.getBreakdown()).isNotNull();
        assertThat(res.getBreakdown().getSummary()).isEqualTo("Fake sablon-olvasat.");
        assertThat(res.getFitsFor()).containsExactly("Post-workout · este", "Fehérje-fókusz");
        // 4 dimensions: 3 live (renormalized weights) + the degraded context card last
        assertThat(res.getBreakdown().getDimensions()).hasSize(4);
        var context = res.getBreakdown().getDimensions().get(3);
        assertThat(context.getId()).isEqualTo("context");
        assertThat(context.getWeight()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(context.getScore()).isEqualByComparingTo(BigDecimal.ZERO);
        var macro = res.getBreakdown().getDimensions().getFirst();
        assertThat(macro.getId()).isEqualTo("macro");
        assertThat(macro.getDetail()).isEqualTo("Fake makró magyarázat.");
        assertThat(res.getBreakdown().getImprove()).hasSize(1);
        assertThat(res.getBreakdown().getImprove().getFirst().getImpact()).isEqualTo("+rost");
        assertThat(res.getBreakdown().getTools())
            .anyMatch(t -> "llm:sablon-olvasat".equals(t.getName()));

        // hero ≡ envelope: the read-time fit equals the envelope value by construction
        RecipeResponse detail = getForBody("/api/recipe/" + recipe, auth, HttpStatus.OK, RecipeResponse.class);
        assertThat(detail.getMezoFit().getScore()).isEqualByComparingTo(res.getBreakdown().getValue());
        // persisted (enriched envelopes persist; fitsFor lands on the reserved column)
        var entity = recipeRepository.findById(recipe).orElseThrow();
        assertThat(entity.getBreakdown()).isNotNull();
        assertThat(entity.getBreakdown().summary()).isEqualTo("Fake sablon-olvasat.");
        assertThat(entity.getFitsFor()).containsExactly("Post-workout · este", "Fehérje-fókusz");
        // and the recipe read now carries the persisted fitsFor
        assertThat(detail.getMezoFit().getFitsFor()).containsExactly("Post-workout · este", "Fehérje-fókusz");
    }

    @Test
    void testGetBreakdown_shouldServeCachedProse_whenNumbersUnchanged() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", "110");
        UUID recipe = createRecipe(auth, SENTINEL_NAME, food);
        getBreakdown(auth, recipe); // generates + persists

        // Rename WITHOUT the sentinel via the repository (a PUT would null the cache): a fresh LLM
        // pass would now echo → degrade prose-less, so a returned summary proves the cache hit.
        var entity = recipeRepository.findById(recipe).orElseThrow();
        entity.setName("Túrós tál");
        recipeRepository.saveAndFlush(entity);

        RecipeBreakdownResponse res = getBreakdown(auth, recipe);

        assertThat(res.getBreakdown().getSummary()).isEqualTo("Fake sablon-olvasat.");
        assertThat(res.getFitsFor()).isNotEmpty();
    }

    @Test
    void testGetBreakdown_shouldRegenerateUnpersisted_whenPantryMacrosDrift() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", "110");
        UUID recipe = createRecipe(auth, SENTINEL_NAME, food);
        RecipeBreakdownResponse first = getBreakdown(auth, recipe);

        // drop the sentinel (fresh LLM pass would degrade) AND drift the pantry numbers.
        // NOTE: macros are frozen line SNAPSHOTS (a pantry kcal edit does NOT move the fit) — the
        // live-read inputs are NOVA + the four nutrition-quality facts; adding sugar wakes the
        // until-now degraded micro dimension, so the envelope numbers genuinely change.
        var entity = recipeRepository.findById(recipe).orElseThrow();
        entity.setName("Túrós tál");
        recipeRepository.saveAndFlush(entity);
        PantryItemRequest upd = new PantryItemRequest();
        upd.setKind(PantryItemRequest.KindEnum.FOOD);
        upd.setName("Túró");
        upd.setUnit("g"); // per-kind validation: food requires unit + kcal even on partial update
        upd.setKcal(new BigDecimal("110"));
        upd.setSugarG(new BigDecimal("50"));
        putForBody("/api/pantry/" + food, upd, auth, HttpStatus.OK, PantryItemResponse.class);

        RecipeBreakdownResponse res = getBreakdown(auth, recipe);

        // numbers no longer match the cache → regenerated; prose degraded (echo unparseable)
        assertThat(res.getBreakdown()).isNotNull();
        assertThat(res.getBreakdown().getSummary()).isNull();
        assertThat(res.getBreakdown().getValue()).isNotEqualByComparingTo(first.getBreakdown().getValue());
        // prose-less envelopes are NOT persisted — the stored cache still holds the old enriched one
        var stored = recipeRepository.findById(recipe).orElseThrow().getBreakdown();
        assertThat(stored.summary()).isEqualTo("Fake sablon-olvasat.");
        assertThat(stored.value()).isEqualByComparingTo(first.getBreakdown().getValue());
    }

    @Test
    void testUpdateRecipe_shouldInvalidateCache_whenEdited() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", "110");
        UUID recipe = createRecipe(auth, SENTINEL_NAME, food);
        getBreakdown(auth, recipe); // generates + persists
        assertThat(recipeRepository.findById(recipe).orElseThrow().getBreakdown()).isNotNull();

        putForBody("/api/recipe/" + recipe, recipeReq(SENTINEL_NAME, food), auth,
            HttpStatus.NO_CONTENT, Void.class);

        var entity = recipeRepository.findById(recipe).orElseThrow();
        assertThat(entity.getBreakdown()).isNull();
        assertThat(entity.getFitsFor()).isNull();
    }

    @Test
    void testGetBreakdown_shouldReturnNullBreakdown_whenRecipeHasNoKcal() {
        HttpHeaders auth = ownerAuthHeaders();
        // a food requires kcal (per-kind validation) — a dose-based, macro-less SUPPLEMENT is the
        // legitimate zero-kcal recipe line (supplements are pickable recipe inputs, mezo-3vu4)
        PantryItemRequest supp = new PantryItemRequest();
        supp.setKind(PantryItemRequest.KindEnum.SUPPLEMENT);
        supp.setName("Kreatin");
        supp.setDose("5 g");
        UUID food = postForBody("/api/pantry", supp, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
        UUID recipe = createRecipe(auth, "Kreatinos víz", food);

        RecipeBreakdownResponse res = getBreakdown(auth, recipe);

        assertThat(res.getBreakdown()).isNull();
        assertThat(res.getFitsFor()).isEmpty();
        assertThat(recipeRepository.findById(recipe).orElseThrow().getBreakdown()).isNull();
    }

    @Test
    void testGetBreakdown_should404_whenRecipeUnknown() {
        HttpHeaders auth = ownerAuthHeaders();

        var res = exchangeForResponse(org.springframework.http.HttpMethod.GET,
            "/api/recipe/" + UUID.randomUUID() + "/breakdown", null, auth);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertHasRequestError(res.getBody(), "RESOURCE_NOT_FOUND");
    }
}
