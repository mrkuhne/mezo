package io.mrkuhne.mezo.feature.pantry;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PantryImportEntryResponse;
import io.mrkuhne.mezo.api.dto.PantryImportRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.api.dto.PantryScrapeRequest;
import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.api.dto.PantrySource;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * HTTP-level ITs for POST /api/pantry-import/scrape (mezo-8vum). The shop is WireMock; the LLM is
 * {@code FakeCompanionLlm} (companion-fake) scripted via {@code [fake-scrape:{json}]} sentinels
 * embedded in the served page text — the full fetch->strip->prompt->parse path runs. The
 * {@code companion-fake} profile MERGES with {@code ApiIntegrationTest}'s {@code demodata}
 * (inheritProfiles defaults true), so the seeded owner still exists for login.
 */
@ActiveProfiles("companion-fake")
class PantryScrapeApiIT extends ApiIntegrationTest {

    static final WireMockServer SHOP = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void shopProps(DynamicPropertyRegistry registry) {
        SHOP.start();
        registry.add("mezo.pantry-scrape.allow-private-hosts", () -> "true");
    }

    @AfterAll
    static void stop() {
        SHOP.stop();
    }

    @BeforeEach
    void reset() {
        SHOP.resetAll();
    }

    private static final String WHEY_JSON = """
        {"name":"Impact Whey Protein","brand":"Myprotein","per":100,"unit":"g","kcal":412,
         "proteinG":82,"carbsG":4,"fatG":7.5,"fiberG":null,"sugarG":4,"saltG":0.5,
         "saturatedFatG":5,"nova":4,"category":"supplement","priceHuf":24990,"priceUnit":"/kg"}""";

    private void stubShopPage(String path, String sentinelJson) {
        SHOP.stubFor(get(urlPathEqualTo(path)).willReturn(aResponse()
            .withHeader("Content-Type", "text/html")
            .withBody("<html><body><h1>Termék</h1><p>[fake-scrape:" + sentinelJson + "]</p></body></html>")));
    }

    private PantryScrapeResponse scrape(String url, HttpStatus expected) {
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl(url);
        return postForBody("/api/pantry-import/scrape", req, ownerAuthHeaders(), expected, PantryScrapeResponse.class);
    }

    @Test
    void testScrape_shouldReturnEnrichedDraft_whenPageCarriesNutrition() {
        stubShopPage("/p/impact-whey", WHEY_JSON);
        PantryScrapeResponse resp = scrape(SHOP.baseUrl() + "/p/impact-whey", HttpStatus.OK);
        assertThat(resp.getResult()).isNotNull();
        assertThat(resp.getResult().getName()).isEqualTo("Impact Whey Protein");
        assertThat(resp.getResult().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(412));
        assertThat(resp.getResult().getSource().getValue()).isEqualTo("web"); // WireMock host is not a known shop domain
        assertThat(resp.getResult().getNeedsReview()).isFalse(); // Atwater-consistent fixture
        assertThat(resp.getResult().getConfidence().doubleValue()).isEqualTo(1.0);
    }

    @Test
    void testScrape_shouldReturnNullResult_whenPageHasNoNutrition() {
        stubShopPage("/p/tshirt", "{\"name\":\"Póló\",\"brand\":null,\"per\":100,\"unit\":\"g\",\"kcal\":null,"
            + "\"proteinG\":null,\"carbsG\":null,\"fatG\":null,\"fiberG\":null,\"sugarG\":null,\"saltG\":null,"
            + "\"saturatedFatG\":null,\"nova\":null,\"category\":null,\"priceHuf\":null,\"priceUnit\":null}");
        PantryScrapeResponse resp = scrape(SHOP.baseUrl() + "/p/tshirt", HttpStatus.OK);
        assertThat(resp.getResult()).isNull();
    }

    @Test
    void testScrape_shouldFlagNeedsReview_whenAtwaterInconsistent() {
        stubShopPage("/p/weird", "{\"name\":\"Gyanús szelet\",\"brand\":null,\"per\":100,\"unit\":\"g\",\"kcal\":900,"
            + "\"proteinG\":10,\"carbsG\":10,\"fatG\":2,\"fiberG\":null,\"sugarG\":null,\"saltG\":null,"
            + "\"saturatedFatG\":null,\"nova\":null,\"category\":\"snacks\",\"priceHuf\":null,\"priceUnit\":null}");
        PantryScrapeResponse resp = scrape(SHOP.baseUrl() + "/p/weird", HttpStatus.OK);
        assertThat(resp.getResult().getNeedsReview()).isTrue();
    }

    @Test
    void testScrape_should502_whenLlmAnswerUnparseable() {
        SHOP.stubFor(get(urlPathEqualTo("/p/garbage")).willReturn(aResponse()
            .withHeader("Content-Type", "text/html")
            .withBody("<html><body>no sentinel here — the fake echoes prompts, not JSON</body></html>")));
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl(SHOP.baseUrl() + "/p/garbage");
        ResponseEntity<String> resp = exchangeForResponse(HttpMethod.POST, "/api/pantry-import/scrape", req, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(resp.getBody(), "PANTRY_SCRAPE_EXTRACT_FAILED");
    }

    @Test
    void testScrape_should502_whenPageUnreachable() {
        SHOP.stubFor(get(urlPathEqualTo("/p/gone")).willReturn(aResponse().withStatus(404)));
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl(SHOP.baseUrl() + "/p/gone");
        ResponseEntity<String> resp = exchangeForResponse(HttpMethod.POST, "/api/pantry-import/scrape", req, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(resp.getBody(), "PANTRY_SCRAPE_FETCH_FAILED");
    }

    @Test
    void testScrape_should400_whenUrlNotHttp() {
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl("ftp://example.com/product");
        ResponseEntity<String> resp = exchangeForResponse(HttpMethod.POST, "/api/pantry-import/scrape", req, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testImport_shouldPersistSourceUrlAndManualReview_whenLowConfidenceScrapedDraftConfirmed() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryImportRequest req = new PantryImportRequest();
        req.setName("Gyanús szelet");
        req.setPer(BigDecimal.valueOf(100));
        req.setUnit("g");
        req.setKcal(BigDecimal.valueOf(900));
        req.setSourceUrl("https://www.gymbeam.hu/p/gyanus-szelet");
        req.setConfidence(BigDecimal.valueOf(0.3));
        PantryItemResponse item = postForBody("/api/pantry-import", req, auth, HttpStatus.CREATED, PantryItemResponse.class);
        assertThat(item.getId()).isNotNull();
        assertThat(item.getSource()).isEqualTo("gymbeam.hu"); // derived from the URL host, never trusted

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);
        assertThat(pantry.getImports()).hasSize(1);
        PantryImportEntryResponse feed = pantry.getImports().getFirst();
        assertThat(feed.getSource()).isEqualTo(PantrySource.GYMBEAM_HU);
        assertThat(feed.getStatus()).isEqualTo(PantryImportEntryResponse.StatusEnum.MANUAL_REVIEW);
        assertThat(feed.getOfWhat()).isEqualTo("Gyanús szelet");
    }

    @Test
    void testImport_shouldFallBackToWebSource_whenSourceUrlMalformed() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryImportRequest req = new PantryImportRequest();
        req.setName("Malformed forrás");
        req.setPer(BigDecimal.valueOf(100));
        req.setUnit("g");
        req.setKcal(BigDecimal.valueOf(200));
        req.setSourceUrl("ht tp://not a url"); // space -> URI.create throws; must degrade to 'web', never 500
        PantryItemResponse item = postForBody("/api/pantry-import", req, auth, HttpStatus.CREATED, PantryItemResponse.class);
        assertThat(item.getId()).isNotNull();
        assertThat(item.getSource()).isEqualTo("web"); // malformed URL host is unparseable -> generic 'web'
    }
}
