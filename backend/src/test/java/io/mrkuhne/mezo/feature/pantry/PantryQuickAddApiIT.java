package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.PantryCatalogEntry;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryQuickAddRequest;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.api.dto.PantrySource;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * The one-tap „+ Kamrába" e2e (mezo-r36n9.63). The LLM is {@code FakeCompanionLlm}: the estimate call
 * carries only the food's name, so its answer is canned (354 kcal / 7.8 / 64.9 / 9.9 per 100 g), and a
 * name carrying {@link FakeCompanionLlm#ESTIMATE_IMPLAUSIBLE_NAME} gets a self-contradicting one.
 */
@ActiveProfiles("companion-fake")
class PantryQuickAddApiIT extends ApiIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private FakeCompanionLlm fakeLlm;

    private PantryItemResponse quickAdd(HttpHeaders auth, String name) {
        return postForBody("/api/pantry/items/quick-add", request(name), auth, HttpStatus.OK, PantryItemResponse.class);
    }

    private ResponseEntity<String> quickAddRaw(HttpHeaders auth, String name) {
        return exchangeForResponse(HttpMethod.POST, "/api/pantry/items/quick-add", request(name), auth);
    }

    private static PantryQuickAddRequest request(String name) {
        PantryQuickAddRequest r = new PantryQuickAddRequest();
        r.setName(name);
        return r;
    }

    private PantryItemResponse createItem(HttpHeaders auth, PantryItemRequest.KindEnum kind, String name) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(kind);
        r.setName(name);
        if (kind == PantryItemRequest.KindEnum.FOOD) {
            r.setPer(new BigDecimal("100"));
            r.setUnit("g");
            r.setKcal(new BigDecimal("312"));
            r.setProteinG(new BigDecimal("9"));
            r.setCarbsG(new BigDecimal("60"));
            r.setFatG(new BigDecimal("4"));
        } else {
            r.setDose("1 kapszula");
        }
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class);
    }

    private int llmCalls() {
        return fakeLlm.completeCallCount();
    }

    @Test
    void testQuickAdd_shouldBindVerifiedSharedFood() {
        HttpHeaders anna = registerUser("Anna").headers();
        HttpHeaders bela = registerUser("Béla").headers();
        UUID catalogId = createItem(anna, PantryItemRequest.KindEnum.FOOD, "Kurkuma őrölt").getCatalogId();
        int callsBefore = llmCalls();

        PantryItemResponse added = quickAdd(bela, "  kurkuma ŐRÖLT ");

        assertThat(added.getCatalogId()).isEqualTo(catalogId); // the shared food, not a second one
        assertThat(added.getEstimated()).isFalse();
        assertThat(added.getName()).isEqualTo("Kurkuma őrölt");
        assertThat(added.getKcal()).isEqualByComparingTo("312"); // its real facts
        assertThat(llmCalls()).isEqualTo(callsBefore); // exact data exists: nothing is guessed
        assertThat(getForBody("/api/pantry", bela, HttpStatus.OK, PantryResponse.class).getIngredients())
            .extracting(IngredientResponse::getName).containsExactly("Kurkuma őrölt");
    }

    @Test
    void testQuickAdd_shouldCreateEstimatedDraftFood() {
        HttpHeaders auth = ownerAuthHeaders();

        PantryItemResponse added = quickAdd(auth, "kurkuma");

        assertThat(added.getEstimated()).isTrue();
        assertThat(added.getName()).isEqualTo("Kurkuma");
        assertThat(added.getKind()).isEqualTo(PantryItemResponse.KindEnum.FOOD);
        assertThat(added.getSource()).isEqualTo("ai_estimate");
        assertThat(added.getPer()).isEqualByComparingTo("100");
        assertThat(added.getUnit()).isEqualTo("g");
        assertThat(added.getKcal()).isEqualByComparingTo("354");
        assertThat(added.getProteinG()).isEqualByComparingTo("7.8");
        assertThat(added.getCarbsG()).isEqualByComparingTo("64.9");
        assertThat(added.getFatG()).isEqualByComparingTo("9.9");

        Map<String, Object> row = jdbc.queryForMap(
            "select status, source, nova, allergens::text as allergens, fiber_g, created_by is not null as authored "
                + "from pantry_catalog where id = ?", added.getCatalogId());
        assertThat(row.get("status")).isEqualTo("draft");
        assertThat(row.get("source")).isEqualTo("ai_estimate");
        assertThat(row.get("nova")).isNull();              // never guessed
        assertThat(row.get("allergens")).isEqualTo("{}");  // never guessed
        assertThat((BigDecimal) row.get("fiber_g")).isEqualByComparingTo("21.1");
        assertThat(row.get("authored")).isEqualTo(true);

        // The shelf shows it, tagged; the closed source enum carries the new value.
        IngredientResponse onShelf = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class)
            .getIngredients().stream().filter(i -> i.getId().equals(added.getId())).findFirst().orElseThrow();
        assertThat(onShelf.getEstimated()).isTrue();
        assertThat(onShelf.getSource()).isEqualTo(PantrySource.AI_ESTIMATE);
        assertThat(onShelf.getNova()).isNull();

        // An unreviewed estimate is the author's only: nobody finds it in the shared catalog.
        HttpHeaders bela = registerUser("Béla").headers();
        assertThat(getForList("/api/pantry/catalog?q=kurkuma", bela, HttpStatus.OK, PantryCatalogEntry.class)).isEmpty();
    }

    @Test
    void testQuickAdd_shouldBeIdempotent() {
        HttpHeaders auth = ownerAuthHeaders();
        int callsBefore = llmCalls();

        PantryItemResponse first = quickAdd(auth, "Kurkuma");
        PantryItemResponse second = quickAdd(auth, "kurkuma "); // the double tap, spelled a little differently

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getCatalogId()).isEqualTo(first.getCatalogId());
        assertThat(second.getEstimated()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from pantry_item where catalog_id = ?", Integer.class,
            first.getCatalogId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from pantry_catalog where lower(name) = 'kurkuma'",
            Integer.class)).isEqualTo(1);
        assertThat(llmCalls()).isEqualTo(callsBefore + 1); // estimated once
    }

    @Test
    void testQuickAdd_shouldAnswer409OnForeignOrNonFoodName() {
        HttpHeaders anna = registerUser("Anna").headers();
        HttpHeaders bela = registerUser("Béla").headers();
        createItem(anna, PantryItemRequest.KindEnum.SUPPLEMENT, "Kurkuma"); // a supplement owns the name
        quickAdd(anna, "Szumák");                                            // Anna's unreviewed estimate
        UUID deleted = createItem(anna, PantryItemRequest.KindEnum.FOOD, "Római kömény").getCatalogId();
        jdbc.update("update pantry_catalog set is_deleted = true where id = ?", deleted);
        int catalogBefore = jdbc.queryForObject("select count(*) from pantry_catalog", Integer.class);
        int itemsBefore = jdbc.queryForObject("select count(*) from pantry_item", Integer.class);

        for (String name : List.of("kurkuma", "szumák", "római kömény")) {
            ResponseEntity<String> resp = quickAddRaw(bela, name);
            assertThat(resp.getStatusCode()).as(name).isEqualTo(HttpStatus.CONFLICT);
            assertHasRequestError(resp.getBody(), "PANTRY_QUICK_ADD_NAME_TAKEN");
        }

        // Never a wrong bind, never a revival, never a second row.
        assertThat(jdbc.queryForObject("select count(*) from pantry_catalog", Integer.class)).isEqualTo(catalogBefore);
        assertThat(jdbc.queryForObject("select count(*) from pantry_item", Integer.class)).isEqualTo(itemsBefore);
        assertThat(jdbc.queryForObject("select is_deleted from pantry_catalog where id = ?", Boolean.class, deleted)).isTrue();
    }

    @Test
    void testQuickAdd_shouldAnswer502OnInvalidEstimate() {
        HttpHeaders auth = ownerAuthHeaders();
        int catalogBefore = jdbc.queryForObject("select count(*) from pantry_catalog", Integer.class);

        ResponseEntity<String> implausible = quickAddRaw(auth, FakeCompanionLlm.ESTIMATE_IMPLAUSIBLE_NAME + " fűszer");
        ResponseEntity<String> failed = quickAddRaw(auth, "kurkuma " + FakeCompanionLlm.FAIL_COMPLETE);

        assertThat(implausible.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(implausible.getBody(), "PANTRY_QUICK_ADD_ESTIMATE_FAILED");
        assertThat(failed.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(failed.getBody(), "PANTRY_QUICK_ADD_ESTIMATE_FAILED");
        assertThat(jdbc.queryForObject("select count(*) from pantry_catalog", Integer.class)).isEqualTo(catalogBefore);
    }

    @Test
    void testQuickAdd_shouldLetRecipeSaveUseTheNewFood() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemResponse added = quickAdd(auth, "kurkuma");
        RecipeIngredientRequest ing = new RecipeIngredientRequest();
        ing.setCatalogId(added.getCatalogId());
        ing.setAmount(new BigDecimal("50"));
        ing.setUnit(added.getUnit());
        RecipeRequest req = new RecipeRequest();
        req.setName("Kurkumás");
        req.setCategory("dinner");
        req.setIngredients(List.of(ing));

        RecipeResponse saved = postForBody("/api/recipe", req, auth, HttpStatus.CREATED, RecipeResponse.class);

        assertThat(saved.getIngredients()).hasSize(1);
        assertThat(saved.getIngredients().get(0).getName()).isEqualTo("Kurkuma");
        assertThat(saved.getIngredients().get(0).getPantryItemId()).isEqualTo(added.getId());
        assertThat(saved.getIngredients().get(0).getContribution().getKcal()).isEqualByComparingTo("177"); // 50 g of 354 kcal / 100 g
    }

    @Test
    void testQuickAdd_shouldRejectBlankOrOverlongName() {
        HttpHeaders auth = ownerAuthHeaders();

        assertThat(quickAddRaw(auth, "   ").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(quickAddRaw(auth, "").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(quickAddRaw(auth, "k".repeat(121)).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testQuickAdd_shouldRequireAToken() {
        assertThat(quickAddRaw(new HttpHeaders(), "kurkuma").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
