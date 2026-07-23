package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/**
 * Scrape OFF + photo ON axis (mezo-iqf9): the photo path reuses the scrape slice's
 * {@code ExtractedDraft} TYPE and the unconditional {@code ScrapeDraftValidator} bean, but must
 * NOT depend on the scrape-gated beans ({@code ScrapeExtractionService}, {@code
 * PantryScrapeService} vanish with the scrape switch). This IT proves the independence the
 * javadocs claim — a photo extraction stays fully functional with the scrape feature off.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.pantry-scrape.enabled=false")
class PantryPhotoScrapeOffApiIT extends ApiIntegrationTest {

    private static final String DRAFT_JSON = "{\"name\":\"Skyr epres\",\"brand\":\"Milbona\","
            + "\"per\":100,\"unit\":\"g\",\"kcal\":62,\"proteinG\":10,\"carbsG\":4,\"fatG\":0.2,"
            + "\"fiberG\":null,\"sugarG\":3.9,\"saltG\":0.1,\"saturatedFatG\":0.1,"
            + "\"nova\":2,\"category\":\"dairy\",\"priceHuf\":null,\"priceUnit\":null}";

    @Test
    void testPhoto_shouldExtractDraft_whenScrapeSwitchOff() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_JPEG);
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", new HttpEntity<>(photoPart(
                ("[fake-photo:" + DRAFT_JSON + "]").getBytes(StandardCharsets.UTF_8), "label.jpg"), h));

        ResponseEntity<PantryScrapeResponse> res =
                postMultipartForResponse("/api/pantry-import/photo", parts, PantryScrapeResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().getResult()).isNotNull();
        assertThat(res.getBody().getResult().getName()).isEqualTo("Skyr epres");
        // and the scrape path itself is really off in this context:
        var scrapeGone = exchangeForResponse(org.springframework.http.HttpMethod.POST,
                "/api/pantry-import/scrape",
                new io.mrkuhne.mezo.api.dto.PantryScrapeRequest().url("https://example.com/p/1234567"),
                ownerAuthHeaders());
        assertThat(scrapeGone.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
