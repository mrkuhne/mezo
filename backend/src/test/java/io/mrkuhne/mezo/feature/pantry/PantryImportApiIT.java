package io.mrkuhne.mezo.feature.pantry;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PantryImportEntryResponse;
import io.mrkuhne.mezo.api.dto.PantryImportRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryLookupResponse;
import io.mrkuhne.mezo.api.dto.PantryLookupResult;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.api.dto.PantrySource;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryImportPopulator;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * HTTP-level ITs for the OpenFoodFacts lookup + import endpoints (Fuel P6, mezo-bka).
 * OFF itself is stubbed with WireMock (integration_test_framework.md: external HTTP is
 * stubbed, never called live, never bean-mocked).
 */
class PantryImportApiIT extends ApiIntegrationTest {

    static final WireMockServer OFF = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void offBaseUrl(DynamicPropertyRegistry registry) {
        OFF.start();
        registry.add("mezo.pantry-import.base-url", OFF::baseUrl);
    }

    @AfterAll
    static void stopOff() {
        OFF.stop();
    }

    @Autowired
    private PantryImportPopulator pantryImportPopulator;

    @BeforeEach
    void resetStubs() {
        OFF.resetAll();
    }

    private static final String SEARCH_BODY = """
        {"products":[
          {"code":"111","product_name":"Skyr natúr","brands":"Ehrmann, Aldi","nova_group":1,
           "nutriments":{"energy-kcal_100g":63,"proteins_100g":10.6,"carbohydrates_100g":4.0,
                         "fat_100g":0.2,"fiber_100g":0,"sugars_100g":3.9,"salt_100g":0.09,
                         "saturated-fat_100g":0.1}},
          {"code":"222","product_name":"Kcal nélküli termék","nutriments":{"proteins_100g":5}}
        ]}""";

    private static final String PRODUCT_BODY = """
        {"status":1,"code":"5900512300108",
         "product":{"code":"5900512300108","product_name":"Zabkása","brands":"Melvit","nova_group":3,
                    "nutriments":{"energy-kcal_100g":370,"proteins_100g":13}}}""";

    private PantryImportRequest importReq() {
        PantryImportRequest r = new PantryImportRequest();
        r.setName("Skyr natúr");
        r.setBrand("Ehrmann");
        r.setBarcode("111");
        r.setPer(BigDecimal.valueOf(100));
        r.setUnit("g");
        r.setKcal(BigDecimal.valueOf(63));
        r.setProteinG(BigDecimal.valueOf(10.6));
        r.setNova(1);
        return r;
    }

    @Test
    void testLookup_shouldMapOffSearchAndDropKcalLessRows_whenTextQuery() {
        OFF.stubFor(get(urlPathEqualTo("/cgi/search.pl"))
            .withQueryParam("search_terms", equalTo("skyr"))
            .willReturn(aResponse().withHeader("Content-Type", "application/json").withBody(SEARCH_BODY)));

        PantryLookupResponse res = getForBody("/api/pantry-import/lookup?q=skyr",
            ownerAuthHeaders(), HttpStatus.OK, PantryLookupResponse.class);

        assertThat(res.getResults()).hasSize(1);
        PantryLookupResult r = res.getResults().getFirst();
        assertThat(r.getName()).isEqualTo("Skyr natúr");
        assertThat(r.getBrand()).isEqualTo("Ehrmann"); // first of the comma list
        assertThat(r.getBarcode()).isEqualTo("111");
        assertThat(r.getPer()).isEqualByComparingTo(BigDecimal.valueOf(100));
        assertThat(r.getUnit()).isEqualTo("g");
        assertThat(r.getKcal()).isEqualByComparingTo(BigDecimal.valueOf(63));
        assertThat(r.getProteinG()).isEqualByComparingTo(BigDecimal.valueOf(10.6));
        assertThat(r.getSaturatedFatG()).isEqualByComparingTo(BigDecimal.valueOf(0.1));
        assertThat(r.getNova()).isEqualTo(1); // OFF nova_group passthrough
    }

    @Test
    void testLookup_shouldFetchProduct_whenAllDigitBarcodeQuery() {
        OFF.stubFor(get(urlPathEqualTo("/api/v2/product/5900512300108"))
            .willReturn(aResponse().withHeader("Content-Type", "application/json").withBody(PRODUCT_BODY)));

        PantryLookupResponse res = getForBody("/api/pantry-import/lookup?q=5900512300108",
            ownerAuthHeaders(), HttpStatus.OK, PantryLookupResponse.class);

        assertThat(res.getResults()).hasSize(1);
        assertThat(res.getResults().getFirst().getName()).isEqualTo("Zabkása");
        assertThat(res.getResults().getFirst().getNova()).isEqualTo(3);
    }

    @Test
    void testLookup_shouldReturnEmpty_whenBarcodeUnknown() {
        OFF.stubFor(get(urlPathEqualTo("/api/v2/product/40084242424242"))
            .willReturn(aResponse().withStatus(404)
                .withHeader("Content-Type", "application/json").withBody("{\"status\":0}")));

        PantryLookupResponse res = getForBody("/api/pantry-import/lookup?q=40084242424242",
            ownerAuthHeaders(), HttpStatus.OK, PantryLookupResponse.class);

        assertThat(res.getResults()).isEmpty();
    }

    @Test
    void testLookup_shouldReturn502WithSystemMessage_whenOffErrors() {
        OFF.stubFor(get(urlPathEqualTo("/cgi/search.pl"))
            .willReturn(aResponse().withStatus(500).withBody("upstream boom")));

        String body = getForBody("/api/pantry-import/lookup?q=skyr",
            ownerAuthHeaders(), HttpStatus.BAD_GATEWAY, String.class);

        assertHasRequestError(body, "PANTRY_IMPORT_LOOKUP_FAILED");
    }

    @Test
    void testLookup_shouldReturn401_whenNoToken() {
        getForBody("/api/pantry-import/lookup?q=skyr", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testImport_shouldCreateItemAndFeedRow_whenValidDraft() {
        HttpHeaders auth = ownerAuthHeaders();

        PantryItemResponse created = postForBody("/api/pantry-import", importReq(), auth,
            HttpStatus.CREATED, PantryItemResponse.class);

        assertThat(created.getKind()).isEqualTo(PantryItemResponse.KindEnum.FOOD);
        assertThat(created.getSource()).isEqualTo("openfoodfacts");

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);
        assertThat(pantry.getIngredients()).extracting("id").contains(created.getId());
        assertThat(pantry.getImports()).hasSize(1);
        PantryImportEntryResponse feed = pantry.getImports().getFirst();
        assertThat(feed.getOfWhat()).isEqualTo("Skyr natúr");
        assertThat(feed.getSource()).isEqualTo(PantrySource.OPENFOODFACTS);
        assertThat(feed.getStatus()).isEqualTo(PantryImportEntryResponse.StatusEnum.SYNCED);
        assertThat(feed.getItems()).isEqualTo(1);
        assertThat(feed.getWhen()).isNotNull();

        var ing = pantry.getIngredients().stream().filter(i -> i.getId().equals(created.getId())).findFirst().orElseThrow();
        assertThat(ing.getCatalogId()).isNotNull();
        assertThat(ing.getSharedFrom()).isNull();         // own definition
        assertThat(ing.getCatalogEditable()).isTrue();    // author (OWNER here anyway)
    }

    @Test
    void testImport_shouldBindToExistingDefinition_whenAnotherUserImportedTheSameProduct() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        PantryImportRequest annaReq = new PantryImportRequest();
        annaReq.setName("Skyr natúr");
        annaReq.setBrand("Ehrmann");
        annaReq.setPer(new BigDecimal("100"));
        annaReq.setUnit("g");
        annaReq.setKcal(new BigDecimal("63"));
        PantryItemResponse annas = postForBody("/api/pantry-import", annaReq, anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);

        // Béla's draft deliberately disagrees on kcal — his import is neither the author nor
        // OWNER, so this MUST NOT overwrite Anna's already-curated value (fix round 1 Important 2/4).
        PantryImportRequest belaReq = new PantryImportRequest();
        belaReq.setName("Skyr natúr");
        belaReq.setBrand("Ehrmann");
        belaReq.setPer(new BigDecimal("100"));
        belaReq.setUnit("g");
        belaReq.setKcal(new BigDecimal("999"));
        PantryItemResponse belas = postForBody("/api/pantry-import", belaReq, bela.headers(), HttpStatus.CREATED, PantryItemResponse.class);

        assertThat(belas.getCatalogId()).isEqualTo(annas.getCatalogId());
        assertThat(belas.getId()).isNotEqualTo(annas.getId());
        // each user's feed has exactly one row, pointing at their own shelf item
        assertThat(getForBody("/api/pantry", bela.headers(), HttpStatus.OK, PantryResponse.class).getImports()).hasSize(1);

        // load-bearing: Béla's kcal must not have leaked onto Anna's (the shared) definition.
        PantryResponse annaPantry = getForBody("/api/pantry", anna.headers(), HttpStatus.OK, PantryResponse.class);
        var annaIng = annaPantry.getIngredients().stream()
            .filter(i -> i.getId().equals(annas.getId())).findFirst().orElseThrow();
        assertThat(annaIng.getMacros().getKcal()).isEqualByComparingTo(new BigDecimal("63"));
    }

    /**
     * Review finding (g): before Task 7, importItem unconditionally inserted a fresh
     * pantry_item, so a second import of the same product by the SAME user violated
     * uq_pantry_item_created_by_catalog_id (or, pre-split, silently duplicated the shelf row).
     * Now it must route through PantryCatalogService#ensureItem and reuse the existing row.
     */
    @Test
    void testImport_shouldReuseSameShelfRow_whenSameUserImportsTheSameProductTwice() {
        HttpHeaders auth = ownerAuthHeaders();

        PantryImportRequest priced = importReq();
        priced.setPriceHuf(590);
        priced.setPriceUnit("db");
        PantryItemResponse first = postForBody("/api/pantry-import", priced, auth,
            HttpStatus.CREATED, PantryItemResponse.class);
        // The second (re-)import carries NO price — fix round 1 Important 1: this must not null
        // out the price the user already entered on their existing shelf row.
        PantryItemResponse second = postForBody("/api/pantry-import", importReq(), auth,
            HttpStatus.CREATED, PantryItemResponse.class);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getCatalogId()).isEqualTo(first.getCatalogId());

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);
        var ings = pantry.getIngredients().stream().filter(i -> i.getId().equals(first.getId())).toList();
        assertThat(ings).hasSize(1);
        assertThat(ings.getFirst().getPrice()).isEqualByComparingTo(new BigDecimal("590"));
        // both imports still feed the activity log — one row per import event, one shelf row total
        assertThat(pantry.getImports()).hasSize(2);
    }

    @Test
    void testImport_shouldPersistPhotoSource_whenOriginPhoto() {
        HttpHeaders auth = ownerAuthHeaders();

        PantryImportRequest req = new PantryImportRequest();
        req.setName("Skyr epres");
        req.setPer(BigDecimal.valueOf(100));
        req.setUnit("g");
        req.setKcal(BigDecimal.valueOf(62));
        req.setOrigin("photo");
        req.setConfidence(BigDecimal.valueOf(0.95));

        PantryItemResponse created = postForBody("/api/pantry-import", req, auth,
            HttpStatus.CREATED, PantryItemResponse.class);

        assertThat(created.getSource()).isEqualTo("photo");

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);
        PantryImportEntryResponse feed = pantry.getImports().stream()
            .filter(f -> "Skyr epres".equals(f.getOfWhat())).findFirst().orElseThrow();
        assertThat(feed.getSource()).isEqualTo(PantrySource.PHOTO);
        assertThat(feed.getStatus()).isEqualTo(PantryImportEntryResponse.StatusEnum.SYNCED);
    }

    @Test
    void testImport_shouldReturn400FieldError_whenKcalMissing() {
        PantryImportRequest bad = importReq();
        bad.setKcal(null);

        String body = exchangeForBody(HttpMethod.POST, "/api/pantry-import", bad,
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "kcal", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testImport_shouldReturn401_whenNoToken() {
        postForBody("/api/pantry-import", importReq(), null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetPantry_shouldHideForeignImports_whenOtherUserImported() {
        var strangerId = databasePopulator.populateUser("stranger-p6@test.local");
        pantryImportPopulator.createImport(strangerId, "Idegen import");

        PantryResponse pantry = getForBody("/api/pantry", ownerAuthHeaders(), HttpStatus.OK, PantryResponse.class);

        assertThat(pantry.getImports()).isEmpty();
    }
}
