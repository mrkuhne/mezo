package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.PantryCatalogEntry;
import io.mrkuhne.mezo.api.dto.PantryFromCatalogRequest;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * S4 (mezo-qw37.4): the shared catalog over HTTP — natural-key binding across users, search,
 * from-catalog idempotency, the author/OWNER edit gate, and delete that spares the definition.
 */
class PantryCatalogApiIT extends ApiIntegrationTest {

    /** A loader master row (seed/pantry-catalog.json) — written out literally, never read from a production constant. */
    private static final String MASTER_FOOD_NAME = "Bulgur Raw Kifli";

    private PantryItemRequest food(String name, String brand, int kcal) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setBrand(brand);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(BigDecimal.valueOf(kcal));
        r.setPrice(990);
        return r;
    }

    private IngredientResponse ingredientOf(HttpHeaders auth, UUID itemId) {
        return getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class).getIngredients().stream()
            .filter(i -> i.getId().equals(itemId)).findFirst().orElseThrow();
    }

    private PantryFromCatalogRequest fromCatalog(UUID catalogId) {
        return new PantryFromCatalogRequest().catalogId(catalogId);
    }

    @Test
    void testCreate_shouldBindToExistingCatalogRow_whenAnotherUserAlreadyDefinedTheSameNameAndBrand() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");

        PantryItemResponse annas = postForBody("/api/pantry", food("Skyr natúr", "Ehrmann", 63),
            anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        PantryItemResponse belas = postForBody("/api/pantry", food("skyr natúr", "EHRMANN", 999),
            bela.headers(), HttpStatus.CREATED, PantryItemResponse.class);

        assertThat(belas.getId()).isNotEqualTo(annas.getId());
        assertThat(belas.getCatalogId()).isEqualTo(annas.getCatalogId()); // natural-key hit, no 409
        IngredientResponse belaSees = ingredientOf(bela.headers(), belas.getId());
        assertThat(belaSees.getMacros().getKcal()).isEqualByComparingTo("63"); // the winner's definition, not Béla's 999
        assertThat(belaSees.getPrice()).isEqualByComparingTo("990");           // his own state
        assertThat(belaSees.getSharedFrom()).isNotNull();
        assertThat(belaSees.getSharedFrom().getAuthorName()).isEqualTo("Anna");
        assertThat(belaSees.getCatalogEditable()).isFalse();
        assertThat(ingredientOf(anna.headers(), annas.getId()).getSharedFrom()).isNull();
        assertThat(ingredientOf(anna.headers(), annas.getId()).getCatalogEditable()).isTrue();
    }

    @Test
    void testCreate_shouldNotMintASecondDefinition_whenTheNameOnlyDiffersByWhitespace() {
        RegisteredUser anna = registerUser("Anna");

        PantryItemResponse first = postForBody("/api/pantry", food("Túró", "Mizo", 130),
            anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        // A trailing space must NOT create a second catalog row: the natural key is trimmed on both sides.
        PantryItemResponse second = postForBody("/api/pantry", food("Túró ", " Mizo", 130),
            anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);

        assertThat(second.getCatalogId()).isEqualTo(first.getCatalogId());
        assertThat(second.getId()).isEqualTo(first.getId()); // one live shelf row per (user, definition)
        // (query kept ASCII and space-free: TestRestTemplate re-encodes percent escapes in a raw URI string)
        List<PantryCatalogEntry> hits = getForList("/api/pantry/catalog?q=mizo",
            anna.headers(), HttpStatus.OK, PantryCatalogEntry.class);
        assertThat(hits).filteredOn(e -> "Túró".equals(e.getName())).hasSize(1);
    }

    @Test
    void testSearch_shouldFindEveryUsersDefinitionsAndMaster_whenQueryMatchesNameOrBrand() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        postForBody("/api/pantry", food("Kecsketej", "Hollandia", 60), anna.headers(),
            HttpStatus.CREATED, PantryItemResponse.class);

        // Béla sees a definition he never created — the catalog is global, not owner-scoped.
        List<PantryCatalogEntry> hits =
            getForList("/api/pantry/catalog?q=kecske", bela.headers(), HttpStatus.OK, PantryCatalogEntry.class);
        assertThat(hits).extracting(PantryCatalogEntry::getName).containsExactly("Kecsketej");
        assertThat(hits.getFirst().getAuthorName()).isEqualTo("Anna");

        // brand-side match for the same row
        List<PantryCatalogEntry> byBrand =
            getForList("/api/pantry/catalog?q=holland", bela.headers(), HttpStatus.OK, PantryCatalogEntry.class);
        assertThat(byBrand).extracting(PantryCatalogEntry::getName).contains("Kecsketej");

        List<PantryCatalogEntry> master =
            getForList("/api/pantry/catalog?q=bulgur", bela.headers(), HttpStatus.OK, PantryCatalogEntry.class);
        assertThat(master).extracting(PantryCatalogEntry::getName).contains(MASTER_FOOD_NAME);
        assertThat(master).allMatch(e -> e.getAuthorName() == null); // loader master rows have no author

        List<PantryCatalogEntry> supplements =
            getForList("/api/pantry/catalog?kind=supplement", bela.headers(), HttpStatus.OK, PantryCatalogEntry.class);
        assertThat(supplements).allMatch(e -> e.getKind() == PantryCatalogEntry.KindEnum.SUPPLEMENT);

        getForBody("/api/pantry/catalog?kind=drink", bela.headers(), HttpStatus.BAD_REQUEST, String.class);
        getForBody("/api/pantry/catalog?q=bulgur", null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testFromCatalog_shouldBeIdempotent_andReturn404ForUnknownEntry() {
        RegisteredUser bela = registerUser("Béla");
        UUID bulgur = getForList("/api/pantry/catalog?q=bulgur", bela.headers(),
            HttpStatus.OK, PantryCatalogEntry.class).stream()
            .filter(e -> MASTER_FOOD_NAME.equals(e.getName())).findFirst().orElseThrow().getId();

        PantryItemResponse first = postForBody("/api/pantry/items/from-catalog", fromCatalog(bulgur),
            bela.headers(), HttpStatus.OK, PantryItemResponse.class);
        PantryItemResponse second = postForBody("/api/pantry/items/from-catalog", fromCatalog(bulgur),
            bela.headers(), HttpStatus.OK, PantryItemResponse.class);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(first.getCatalogId()).isEqualTo(bulgur);
        PantryResponse pantry = getForBody("/api/pantry", bela.headers(), HttpStatus.OK, PantryResponse.class);
        assertThat(pantry.getIngredients()).filteredOn(i -> i.getCatalogId().equals(bulgur)).hasSize(1);
        IngredientResponse mine = pantry.getIngredients().stream()
            .filter(i -> i.getCatalogId().equals(bulgur)).findFirst().orElseThrow();
        assertThat(mine.getSharedFrom()).isNull();        // master: not "shared from" anyone
        assertThat(mine.getCatalogEditable()).isFalse();  // a USER cannot edit master content

        String body = postForBody("/api/pantry/items/from-catalog", fromCatalog(UUID.randomUUID()),
            bela.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testUpdate_shouldGateDefinitionEditsByAuthorOrOwner_andAlwaysAllowState() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        HttpHeaders owner = ownerAuthHeaders();
        PantryItemResponse annas = postForBody("/api/pantry", food("Görög joghurt", "Mizo", 119),
            anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        PantryItemResponse belas = postForBody("/api/pantry/items/from-catalog", fromCatalog(annas.getCatalogId()),
            bela.headers(), HttpStatus.OK, PantryItemResponse.class);

        // Béla changes only STATE (price) while echoing the definition unchanged -> 200
        PantryItemRequest priceOnly = food("Görög joghurt", "Mizo", 119);
        priceOnly.setPrice(1490);
        putForBody("/api/pantry/" + belas.getId(), priceOnly, bela.headers(), HttpStatus.OK, PantryItemResponse.class);
        assertThat(ingredientOf(bela.headers(), belas.getId()).getPrice()).isEqualByComparingTo("1490");

        // Béla changes a DEFINITION field (kcal) -> 403, and NOTHING is written (not even a partial flush)
        PantryItemRequest kcalEdit = food("Görög joghurt", "Mizo", 200);
        kcalEdit.setPrice(2500);
        String body = exchangeForBody(HttpMethod.PUT, "/api/pantry/" + belas.getId(), kcalEdit,
            bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "PANTRY_CATALOG_NOT_EDITABLE");
        assertThat(ingredientOf(anna.headers(), annas.getId()).getMacros().getKcal()).isEqualByComparingTo("119");
        assertThat(ingredientOf(bela.headers(), belas.getId()).getPrice()).isEqualByComparingTo("1490");

        // Anna (the author) edits kcal -> 200, and Béla sees it too (one shared definition)
        putForBody("/api/pantry/" + annas.getId(), food("Görög joghurt", "Mizo", 200),
            anna.headers(), HttpStatus.OK, PantryItemResponse.class);
        assertThat(ingredientOf(bela.headers(), belas.getId()).getMacros().getKcal()).isEqualByComparingTo("200");

        // OWNER edits somebody else's definition -> 200 (through his own shelf row)
        PantryItemResponse owners = postForBody("/api/pantry/items/from-catalog", fromCatalog(annas.getCatalogId()),
            owner, HttpStatus.OK, PantryItemResponse.class);
        putForBody("/api/pantry/" + owners.getId(), food("Görög joghurt", "Mizo", 210),
            owner, HttpStatus.OK, PantryItemResponse.class);
        assertThat(ingredientOf(anna.headers(), annas.getId()).getMacros().getKcal()).isEqualByComparingTo("210");

        // Renaming onto another entry's natural key -> 409, not a unique-index 500
        postForBody("/api/pantry", food("Skyr natúr", "Mizo", 63), anna.headers(),
            HttpStatus.CREATED, PantryItemResponse.class);
        String clash = exchangeForBody(HttpMethod.PUT, "/api/pantry/" + annas.getId(),
            food("Skyr natúr", "Mizo", 210), anna.headers(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(clash, "PANTRY_CATALOG_NAME_TAKEN");
        assertThat(ingredientOf(anna.headers(), annas.getId()).getName()).isEqualTo("Görög joghurt");
    }

    @Test
    void testDelete_shouldSoftDeleteOnlyTheShelfRow_whenAnotherUserSharesTheDefinition() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        PantryItemResponse annas = postForBody("/api/pantry", food("Kefir", "Mizo", 55),
            anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        PantryItemResponse belas = postForBody("/api/pantry/items/from-catalog", fromCatalog(annas.getCatalogId()),
            bela.headers(), HttpStatus.OK, PantryItemResponse.class);

        deleteAndExpect("/api/pantry/" + annas.getId(), anna.headers(), HttpStatus.NO_CONTENT);

        assertThat(getForBody("/api/pantry", anna.headers(), HttpStatus.OK, PantryResponse.class).getIngredients())
            .isEmpty();
        assertThat(ingredientOf(bela.headers(), belas.getId()).getName()).isEqualTo("Kefir"); // definition survives
        // and Anna can re-add it from the catalog (a NEW live row; the old one stays soft-deleted)
        PantryItemResponse again = postForBody("/api/pantry/items/from-catalog", fromCatalog(annas.getCatalogId()),
            anna.headers(), HttpStatus.OK, PantryItemResponse.class);
        assertThat(again.getId()).isNotEqualTo(annas.getId());
        assertThat(again.getCatalogId()).isEqualTo(annas.getCatalogId());
    }
}
