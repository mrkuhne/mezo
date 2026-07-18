package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryScrapeRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

/** Scrape on, companion off -> no CompanionLlm bean -> clean 503, never a 500 (mezo-8vum). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class PantryScrapeLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testScrape_should503_whenCompanionSwitchOff() {
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl("https://www.myprotein.hu/p/impact-whey/10530943/");
        ResponseEntity<String> resp = exchangeForResponse(
            HttpMethod.POST, "/api/pantry-import/scrape", req, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(resp.getBody(), "PANTRY_SCRAPE_LLM_UNAVAILABLE");
    }
}
