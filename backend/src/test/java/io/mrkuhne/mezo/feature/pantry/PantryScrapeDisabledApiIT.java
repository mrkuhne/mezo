package io.mrkuhne.mezo.feature.pantry;

import io.mrkuhne.mezo.api.dto.PantryScrapeRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The pantry-scrape switch OFF state (configuration_conventions.md: both switch states tested):
 * the whole {@code PantryScrapeController} bean disappears -> the scrape path 404s, while the
 * pantry-import switch stays on (only the scrape switch is flipped here).
 */
@TestPropertySource(properties = "mezo.feature.pantry-scrape.enabled=false")
class PantryScrapeDisabledApiIT extends ApiIntegrationTest {

    @Test
    void testScrape_shouldReturn404_whenScrapeSwitchOff() {
        PantryScrapeRequest body = new PantryScrapeRequest();
        body.setUrl("https://www.myprotein.hu/p/impact-whey/10530943/");

        postForBody("/api/pantry-import/scrape", body, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
