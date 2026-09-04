package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealBreakdown;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeBreakdownResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
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

    @Autowired
    private PantryItemRepository pantryItemRepository;

    @Autowired
    private PantryCatalogRepository pantryCatalogRepository;

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

    /**
     * A per-100g PURE-CARB food (honey-like). The default {@link #createFood} profile is
     * protein+fat-leaning, which the pre-workout rubric scores LOWER than the base one — only a
     * carb-only profile makes the overlay's "fast carbs are fuel" reading visible as a higher value.
     */
    private UUID createCarbFood(HttpHeaders auth, String name, String kcal) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal(kcal));
        r.setProteinG(BigDecimal.ZERO);
        r.setCarbsG(new BigDecimal("80"));
        r.setFatG(BigDecimal.ZERO);
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

    /** Same recipe request but with an explicit canonical category (slot stays unset — null). */
    private RecipeRequest recipeReq(String name, UUID pantryItemId, String category) {
        RecipeRequest r = recipeReq(name, pantryItemId);
        r.setCategory(category);
        return r;
    }

    private UUID createRecipe(HttpHeaders auth, String name, UUID pantryItemId) {
        return postForBody("/api/recipe", recipeReq(name, pantryItemId), auth,
            HttpStatus.CREATED, RecipeResponse.class).getId();
    }

    /** A per-100g food that also carries the four nutrition-quality facts (mezo-m6uv fixture). */
    private UUID createFoodWithFacts(HttpHeaders auth, String name) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("110"));
        r.setProteinG(new BigDecimal("13"));
        r.setCarbsG(new BigDecimal("4"));
        r.setFatG(new BigDecimal("4.5"));
        r.setFiberG(new BigDecimal("3.2"));
        r.setSugarG(new BigDecimal("4.1"));
        r.setSaltG(new BigDecimal("0.4"));
        r.setSaturatedFatG(new BigDecimal("2.8"));
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    private RecipeBreakdownResponse getBreakdown(HttpHeaders auth, UUID id) {
        return getForBody("/api/recipe/" + id + "/breakdown", auth, HttpStatus.OK,
            RecipeBreakdownResponse.class);
    }

    /** The grams of fiber the fit actually scored, read out of the micro dimension's "Rost" row
     *  ({@code "{fiber} g"}). */
    private static double fiberGramsOf(MealBreakdown breakdown) {
        String value = breakdown.getDimensions().stream()
            .filter(d -> "micro".equals(d.getId())).findFirst().orElseThrow()
            .getMicros().stream()
            .filter(row -> "Rost".equals(row.getName())).findFirst().orElseThrow()
            .getValue();
        return Double.parseDouble(value.substring(0, value.indexOf(" g")));
    }

    @Test
    void testGetBreakdown_shouldUseFrozenFacts_whenThePantryRowDriftedAfterSave() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFoodWithFacts(auth, "Túró");
        UUID recipe = createRecipe(auth, "Túrós tál", food);

        // the pantry row drifts AFTER the line froze its snapshot: 3.2 g -> 90 g fiber per 100 g
        var row = pantryItemRepository.findWithCatalogById(food).orElseThrow();
        row.getCatalog().setFiberG(new BigDecimal("90"));
        pantryCatalogRepository.saveAndFlush(row.getCatalog());

        RecipeBreakdownResponse body = getBreakdown(auth, recipe);

        // Frozen: 3.2 g/100 g × 250 g ÷ 2 servings = 4.0 g per adag. A live read of the DRIFTED row
        // would have scored 90 × 2.5 ÷ 2 = 112.5 g.
        assertThat(fiberGramsOf(body.getBreakdown())).isEqualTo(4.0);
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
        // 8 template dimensions (mezo-7797): the meal surface minus context, plus portion last;
        // weights renormalized over the live ones (there is NO context row in a template envelope)
        assertThat(res.getBreakdown().getDimensions()).extracting(d -> d.getId())
            .containsExactly("macro", "micro", "who", "fat_quality", "nova",
                "plant_diversity", "energy_density", "portion");
        // this plain food carries no facts/NOVA/category -> micro/who/fat_quality/nova/plant_diversity
        // degrade honestly (weight 0); macro/energy_density/portion stay live
        assertThat(res.getBreakdown().getDimensions())
            .filteredOn(d -> d.getWeight().signum() == 0)
            .extracting(d -> d.getId())
            .containsExactly("micro", "who", "fat_quality", "nova", "plant_diversity");
        var macro = res.getBreakdown().getDimensions().getFirst();
        assertThat(macro.getId()).isEqualTo("macro");
        assertThat(macro.getDetail()).isEqualTo("Fake makró magyarázat.");
        // energy-density arithmetic PINNED end-to-end through RecipeService.fitLines: the 250 g line
        // of a 110 kcal/100 g food over 2 servings -> per-serving 137.5 kcal / 125 g (grams scale by
        // 1/servings only) -> 137.5 / 125 * 100 = 110 kcal/100g. A bug re-applying amount/per to the
        // gram mass would blow this up ~88x, so this row is the only IT guard on the composer.
        var energyDensity = res.getBreakdown().getDimensions().get(6);
        assertThat(energyDensity.getId()).isEqualTo("energy_density");
        assertThat(energyDensity.getContext())
            .anySatisfy(row -> {
                assertThat(row.getLabel()).isEqualTo("Sűrűség");
                assertThat(row.getValue()).isEqualTo("110 kcal/100g");
            });
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
    void testGetBreakdown_shouldBudgetPortionFromCategory_notTheFreeFormSlot() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Csirkemell", "165");
        // Canonical category 'lunch' (share 0.35); `slot` is never set (null on FE create). A
        // slot-keyed portion budget would wrongly fall back to the .30 default share (930 kcal /
        // "alap 30%"). Keyed on `category` the budget is targets.kcal 3100 × 0.35 = 1085 kcal, and
        // slotLabel(lunch)="ebéd" → the row must read "1085 kcal (ebéd 35%)".
        UUID recipe = postForBody("/api/recipe", recipeReq("Ebéd tál", food, "lunch"), auth,
            HttpStatus.CREATED, RecipeResponse.class).getId();

        RecipeBreakdownResponse res = getBreakdown(auth, recipe);

        var portion = res.getBreakdown().getDimensions().stream()
            .filter(d -> "portion".equals(d.getId())).findFirst().orElseThrow();
        assertThat(portion.getContext())
            .anySatisfy(row -> {
                assertThat(row.getLabel()).isEqualTo("Slot-büdzsé");
                assertThat(row.getValue()).isEqualTo("1085 kcal (ebéd 35%)");
            });
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
        // live-read inputs are NOVA + the four nutrition-quality facts; assigning a NOVA class wakes
        // the until-now degraded nova dimension (weight .18), so the envelope numbers genuinely change.
        var entity = recipeRepository.findById(recipe).orElseThrow();
        entity.setName("Túrós tál");
        recipeRepository.saveAndFlush(entity);
        PantryItemRequest upd = new PantryItemRequest();
        upd.setKind(PantryItemRequest.KindEnum.FOOD);
        upd.setName("Túró");
        upd.setUnit("g"); // per-kind validation: food requires unit + kcal even on partial update
        upd.setKcal(new BigDecimal("110"));
        upd.setNova(4);
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
    void testGetBreakdown_shouldRegenerateAndReplace_whenCachedEnvelopeHasStaleDimensionCount() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", "110");
        UUID recipe = createRecipe(auth, SENTINEL_NAME, food);

        // Seed a pre-mezo-7797 4-dimension envelope straight onto the entity (the old shape a
        // persisted cache could still hold across the widening). Its dimension COUNT (4) differs
        // from the fresh template run (8), which the matches() size guard cannot reconcile.
        var entity = recipeRepository.findById(recipe).orElseThrow();
        entity.setBreakdown(new MealBreakdownJson(new BigDecimal("0.50"), new BigDecimal("0.50"),
            "Régi 4-dimenziós olvasat.", null,
            List.of(staleDim("macro"), staleDim("micro"), staleDim("nova"), staleDim("context")),
            List.of(), List.of(), MealScoringService.FORMULA_VERSION));
        entity.setFitsFor(List.of("régi"));
        recipeRepository.saveAndFlush(entity);

        RecipeBreakdownResponse res = getBreakdown(auth, recipe);

        // size mismatch (4 != 8) forces a regenerate -> the fresh 8-dimension template envelope
        assertThat(res.getBreakdown().getDimensions()).extracting(d -> d.getId())
            .containsExactly("macro", "micro", "who", "fat_quality", "nova",
                "plant_diversity", "energy_density", "portion");
        // regenerated + prose-enriched (sentinel present) -> the stale cache is replaced, not served
        var restored = recipeRepository.findById(recipe).orElseThrow().getBreakdown();
        assertThat(restored.dimensions()).hasSize(8);
        assertThat(restored.summary()).isEqualTo("Fake sablon-olvasat.");
    }

    /** A minimal old-shape dimension for seeding a stale 4-dim cache. */
    private static MealBreakdownJson.Dimension staleDim(String id) {
        return new MealBreakdownJson.Dimension(id, id, new BigDecimal("0.25"),
            new BigDecimal("0.50"), "régi", null, null, null, null, null);
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
    void testGetBreakdown_shouldRegenerateEnvelope_whenOnlyTheRoleChanged() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createCarbFood(auth, "Méz", "300");
        RecipeRequest req = recipeReq(SENTINEL_NAME, food);
        RecipeResponse created =
            postForBody("/api/recipe", req, auth, HttpStatus.CREATED, RecipeResponse.class);

        RecipeBreakdownResponse first = getBreakdown(auth, created.getId());
        assertThat(recipeRepository.findById(created.getId()).orElseThrow().getBreakdown()).isNotNull();

        // ONLY the role changes — every macro/fact input stays byte-identical. Two independent
        // mechanisms would each regenerate here: the blanket cache null in RecipeService.update, and
        // (since mezo-uavr) the staleness compare itself, because `fresh` is now scored under the new
        // role and no longer matches the stored numbers. What this test pins is the OBSERVABLE
        // outcome — a role edit must not keep serving the old-rubric envelope.
        req.setRole("pre_workout");
        putForBody("/api/recipe/" + created.getId(), req, auth, HttpStatus.NO_CONTENT, Void.class);

        assertThat(recipeRepository.findById(created.getId()).orElseThrow().getBreakdown()).isNull();

        RecipeBreakdownResponse second = getBreakdown(auth, created.getId());
        assertThat(second.getBreakdown().getValue())
            .isGreaterThan(first.getBreakdown().getValue());
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
