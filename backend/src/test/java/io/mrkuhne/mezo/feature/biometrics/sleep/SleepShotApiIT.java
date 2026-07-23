package io.mrkuhne.mezo.feature.biometrics.sleep;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SleepShotDraftResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/** Screenshot -> draft through the generated SleepShotApi, against the fake companion LLM. */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.sleep-shot.max-photo-bytes=10000")
class SleepShotApiIT extends ApiIntegrationTest {

    private static final String PATH = "/api/sleep/screenshot";

    /** Daniel's canonical Sleep Cycle screenshot values (spec Global Constraints). */
    private static final String DRAFT_JSON =
        "{\"bedtime\":\"0:42\",\"wakeup\":\"9:03\",\"asleepMin\":449,\"inBedMin\":501,"
            + "\"awakeMin\":52,\"lightMin\":206,\"remMin\":144,\"deepMin\":100,\"qualityPct\":95}";

    private static HttpEntity<org.springframework.core.io.ByteArrayResource> pngPart(String content) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_PNG);
        return new HttpEntity<>(photoPart(content.getBytes(UTF_8), "screenshot.png"), h);
    }

    @Test
    void testDraft_shouldExtractAndNormalize_whenScreenshotCarriesSentinel() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", pngPart("[fake-photo:" + DRAFT_JSON + "]"));

        ResponseEntity<SleepShotDraftResponse> res =
            postMultipartForResponse(PATH, parts, SleepShotDraftResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        SleepShotDraftResponse d = res.getBody();
        assertThat(d).isNotNull();
        assertThat(d.getBedtime()).isEqualTo("00:42"); // zero-padded normalization
        assertThat(d.getWakeup()).isEqualTo("09:03");
        assertThat(d.getDurationH()).isEqualByComparingTo(new BigDecimal("7.48")); // 449/60
        assertThat(d.getInBedMin()).isEqualTo(501);
        assertThat(d.getAwakeMin()).isEqualTo(52);
        assertThat(d.getLightMin()).isEqualTo(206);
        assertThat(d.getRemMin()).isEqualTo(144);
        assertThat(d.getDeepMin()).isEqualTo(100);
        assertThat(d.getSourceQualityPct()).isEqualTo(95);
        assertThat(d.getConfidence()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(d.getNeedsReview()).isFalse();
    }

    @Test
    void testDraft_shouldFlagNeedsReview_whenKeyFieldMissing() {
        String partial = "{\"bedtime\":null,\"wakeup\":\"9:03\",\"asleepMin\":449,\"inBedMin\":501,"
            + "\"awakeMin\":null,\"lightMin\":null,\"remMin\":null,\"deepMin\":null,\"qualityPct\":95}";
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", pngPart("[fake-photo:" + partial + "]"));

        ResponseEntity<SleepShotDraftResponse> res =
            postMultipartForResponse(PATH, parts, SleepShotDraftResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getBedtime()).isNull();
        assertThat(res.getBody().getNeedsReview()).isTrue();
    }

    @Test
    void testDraft_shouldReturn502_whenAnswerUnparseable() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", pngPart("no sentinel here"));

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(res.getBody(), "SLEEP_SHOT_EXTRACT_FAILED");
    }

    @Test
    void testDraft_shouldReturn400_whenPhotoOversized() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", pngPart("x".repeat(10001))); // cap lowered to 10000 via @TestPropertySource

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "photo", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testDraft_shouldReturn400_whenMimeUnsupported() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_GIF);
        var gif = new HttpEntity<>(photoPart("gif-bytes".getBytes(UTF_8), "screenshot.gif"), h);
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", gif);

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "photo", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testDraft_shouldReturn400_whenPhotoMissing() {
        var parts = new LinkedMultiValueMap<String, Object>();

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
