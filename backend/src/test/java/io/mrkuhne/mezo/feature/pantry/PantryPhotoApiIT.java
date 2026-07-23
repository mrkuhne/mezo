package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
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
 * HTTP-level suite for {@code POST /api/pantry-import/photo} (mezo-d8tr): real multipart plumbing
 * + {@code PantryPhotoController} → {@code PantryPhotoService} against the deterministic
 * {@code FakeCompanionLlm}. A "photo" is UTF-8 {@code [fake-photo:{json}]} sentinel bytes, so the
 * canned answer flows through decode → parse → validate → response without a model.
 *
 * <p>The photo cap is shrunk to the {@code @Min(10_000)} floor so the oversized test's 20 kB
 * payload trips the SERVICE cap while staying far under the container caps (mezo-78rn pattern).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.pantry-photo.max-photo-bytes=10000")
class PantryPhotoApiIT extends ApiIntegrationTest {

    private static final String PATH = "/api/pantry-import/photo";

    /** Flat draft JSON; Atwater-consistent: 4*10 + 4*4 + 9*0.2 = 57.8 ≈ kcal 62 → confidence 1.0. */
    private static final String DRAFT_JSON = "{\"name\":\"Skyr epres\",\"brand\":\"Milbona\","
            + "\"per\":100,\"unit\":\"g\",\"kcal\":62,\"proteinG\":10,\"carbsG\":4,\"fatG\":0.2,"
            + "\"fiberG\":null,\"sugarG\":3.9,\"saltG\":0.1,\"saturatedFatG\":0.1,"
            + "\"nova\":2,\"category\":\"dairy\",\"priceHuf\":null,\"priceUnit\":null}";

    private static HttpEntity<?> jpegPart(String content) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_JPEG);
        return new HttpEntity<>(photoPart(content.getBytes(StandardCharsets.UTF_8), "label.jpg"), h);
    }

    @Test
    void testPhoto_shouldReturnDraft_whenLabelPhotoCarriesSentinel() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("[fake-photo:" + DRAFT_JSON + "]"));

        ResponseEntity<PantryScrapeResponse> res = postMultipartForResponse(PATH, parts, PantryScrapeResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        var r = res.getBody().getResult();
        assertThat(r).isNotNull();
        assertThat(r.getName()).isEqualTo("Skyr epres");
        assertThat(r.getSource().getValue()).isEqualTo("photo");
        assertThat(r.getSourceUrl()).isNull();
        // mezo-y9ga made structural: per-100 g basis regardless of the model answer
        assertThat(r.getPer()).isEqualByComparingTo(BigDecimal.valueOf(100));
        assertThat(r.getUnit()).isEqualTo("g");
        assertThat(r.getConfidence()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(r.getNeedsReview()).isFalse();
    }

    @Test
    void testPhoto_shouldReturnDraft_whenSentinelIsOnSecondPhoto() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("just a blurry label"));
        parts.add("photo2", jpegPart("[fake-photo:" + DRAFT_JSON + "]"));

        ResponseEntity<PantryScrapeResponse> res = postMultipartForResponse(PATH, parts, PantryScrapeResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getResult()).isNotNull(); // both images reached the LLM call
    }

    @Test
    void testPhoto_shouldReturnEmpty_whenNoNutritionFactsLegible() {
        String noFacts = DRAFT_JSON.replace("\"kcal\":62", "\"kcal\":null");
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("[fake-photo:" + noFacts + "]"));

        ResponseEntity<PantryScrapeResponse> res = postMultipartForResponse(PATH, parts, PantryScrapeResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getResult()).isNull(); // honest empty
    }

    @Test
    void testPhoto_shouldFlagNeedsReview_whenAtwaterInconsistent() {
        // kcal 200 vs Atwater 57.8 → >30% off → 1.0 - 0.4 = 0.6 == threshold → needs review
        String off = DRAFT_JSON.replace("\"kcal\":62", "\"kcal\":200");
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("[fake-photo:" + off + "]"));

        ResponseEntity<PantryScrapeResponse> res = postMultipartForResponse(PATH, parts, PantryScrapeResponse.class);

        assertThat(res.getBody().getResult().getNeedsReview()).isTrue();
    }

    @Test
    void testPhoto_should400_whenPhotoOversized() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("x".repeat(20_000))); // > the shrunk 10 kB cap

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testPhoto_should400_whenMimeUnsupported() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_GIF);
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", new HttpEntity<>(
                photoPart("gif".getBytes(StandardCharsets.UTF_8), "label.gif"), h));

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testPhoto_should400_whenPhotoPartMissing() {
        var parts = new LinkedMultiValueMap<String, Object>();

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testPhoto_should502_whenAnswerUnparseable() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("no sentinel here")); // fake echoes the prompt → parse fails

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(res.getBody(), "PANTRY_PHOTO_EXTRACT_FAILED");
    }
}
