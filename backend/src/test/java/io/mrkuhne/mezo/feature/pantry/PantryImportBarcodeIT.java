package io.mrkuhne.mezo.feature.pantry;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PantryImportRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryLookupResponse;
import io.mrkuhne.mezo.api.dto.PantryLookupResult;
import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Barcode-keyed lookup: OFF first time, our own catalog row afterwards (spec §7.3, B4 Étel). */
class PantryImportBarcodeIT extends ApiIntegrationTest {

    static final WireMockServer OFF = new WireMockServer(wireMockConfig().dynamicPort());
    private static final String CODE = "5900512300108";

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
    private PantryCatalogRepository catalogRepository;

    @BeforeEach
    void resetStubs() {
        OFF.resetAll();
    }

    private static final String PRODUCT_BODY = """
        {"status":1,"code":"5900512300108",
         "product":{"code":"5900512300108","product_name":"Zabkása","brands":"Melvit","nova_group":3,
                    "allergens_tags":["en:gluten"],"traces_tags":["en:milk"],
                    "serving_size":"50 g","serving_quantity":50,
                    "nutriments":{"energy-kcal_100g":370,"proteins_100g":13}}}""";

    private PantryLookupResponse lookup(HttpHeaders auth, String q, HttpStatus status) {
        return getForBody("/api/pantry-import/lookup?q=" + q, auth, status, PantryLookupResponse.class);
    }

    private PantryImportRequest importFrom(PantryLookupResult r) {
        PantryImportRequest req = new PantryImportRequest();
        req.setName(r.getName());
        req.setBrand(r.getBrand());
        req.setBarcode(r.getBarcode());
        req.setPer(r.getPer());
        req.setUnit(r.getUnit());
        req.setKcal(r.getKcal());
        req.setProteinG(r.getProteinG());
        req.setNova(r.getNova());
        req.setAllergens(r.getAllergens());
        return req;
    }

    @Test
    void offLookupCarriesAllergensAndServing() {
        OFF.stubFor(get(urlPathEqualTo("/api/v2/product/" + CODE))
            .willReturn(aResponse().withHeader("Content-Type", "application/json").withBody(PRODUCT_BODY)));

        PantryLookupResponse res = lookup(ownerAuthHeaders(), CODE, HttpStatus.OK);

        assertThat(res.getSource()).isEqualTo(PantryLookupResponse.SourceEnum.OFF);
        PantryLookupResult r = res.getResults().getFirst();
        assertThat(r.getAllergens()).containsEntry("gluten", "contains").containsEntry("milk", "traces")
            .containsEntry("eggs", "unknown").hasSize(14);
        assertThat(r.getServingSize()).isEqualTo("50 g");
        assertThat(r.getServingQuantity()).isEqualByComparingTo("50");
    }

    @Test
    void knownBarcodeReturnsOwnCatalogRow() {
        OFF.stubFor(get(urlPathEqualTo("/api/v2/product/" + CODE))
            .willReturn(aResponse().withHeader("Content-Type", "application/json").withBody(PRODUCT_BODY)));
        HttpHeaders auth = ownerAuthHeaders();
        PantryLookupResult fromOff = lookup(auth, CODE, HttpStatus.OK).getResults().getFirst();
        postForBody("/api/pantry-import", importFrom(fromOff), auth, HttpStatus.CREATED, PantryItemResponse.class);
        long rows = catalogRepository.count();
        OFF.resetAll(); // a second OFF call would now 404 the lookup — CATALOG must not need it

        PantryLookupResponse again = lookup(auth, CODE, HttpStatus.OK);

        assertThat(again.getSource()).isEqualTo(PantryLookupResponse.SourceEnum.CATALOG);
        PantryLookupResult r = again.getResults().getFirst();
        assertThat(r.getName()).isEqualTo("Zabkása");
        assertThat(r.getBarcode()).isEqualTo(CODE);
        assertThat(r.getKcal()).isEqualByComparingTo(BigDecimal.valueOf(370));
        assertThat(r.getAllergens()).containsEntry("gluten", "contains").containsEntry("milk", "traces");

        // importing the same barcode again binds to the same row, never a second one
        postForBody("/api/pantry-import", importFrom(r), auth, HttpStatus.CREATED, PantryItemResponse.class);
        assertThat(catalogRepository.count()).isEqualTo(rows);
        assertThat(catalogRepository.findAll().stream().filter(c -> CODE.equals(c.getBarcode())))
            .singleElement().satisfies(c -> assertThat(c.getAllergens())
                .hasSize(14)
                .containsEntry("gluten", AllergenState.CONTAINS)
                .containsEntry("milk", AllergenState.TRACES)
                .containsEntry("eggs", AllergenState.UNKNOWN));
    }

    @Test
    void unknownBarcodeReturnsNoneAndCreatesNothing() {
        OFF.stubFor(get(urlPathEqualTo("/api/v2/product/40084242424242"))
            .willReturn(aResponse().withStatus(404)
                .withHeader("Content-Type", "application/json").withBody("{\"status\":0}")));
        long rows = catalogRepository.count();

        PantryLookupResponse res = lookup(ownerAuthHeaders(), "40084242424242", HttpStatus.OK);

        assertThat(res.getSource()).isEqualTo(PantryLookupResponse.SourceEnum.NONE);
        assertThat(res.getResults()).isEmpty();
        assertThat(catalogRepository.count()).isEqualTo(rows);
    }
}
