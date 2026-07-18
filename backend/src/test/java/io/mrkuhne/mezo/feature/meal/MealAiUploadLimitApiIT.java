package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/**
 * The servlet-container multipart cap ({@code spring.servlet.multipart.max-file-size}, mezo-78rn) is
 * the OUTER guard: a photo bigger than it is rejected during multipart parsing, BEFORE
 * {@code MealAiDraftService} (and its {@code mezo.meal-ai-log.max-photo-bytes} check) ever runs. This
 * IT shrinks that container cap to 10 kB — leaving the 5 MB app cap at its default — and POSTs a
 * 20 kB photo, proving {@code GlobalExceptionHandler.handleMaxUploadSize} maps the resulting
 * {@code MaxUploadSizeExceededException} to the SAME 400 "photo" field error as the service size
 * check, not a stack-trace-noisy generic 500.
 *
 * <p>In production the container cap (6 MB) sits ABOVE the app cap (5 MB), so the message-bearing
 * service check is normally the effective limit; this handler is its safety net if the container
 * limit is ever hit anyway. Own class because the shrunk container property must NOT bleed into
 * {@code MealAiDraftApiIT}, which needs the real 6 MB container cap so its 20 kB payload trips the
 * SERVICE cap instead.
 */
@TestPropertySource(properties = "spring.servlet.multipart.max-file-size=10KB")
class MealAiUploadLimitApiIT extends ApiIntegrationTest {

    private static final String PATH = "/api/meal/ai-draft";

    @Test
    void testDraft_should400_whenPhotoExceedsContainerCap() {
        byte[] oversized = new byte[20_000]; // > the 10 kB container cap, < the 5 MB app cap
        HttpHeaders photoHeaders = new HttpHeaders();
        photoHeaders.setContentType(MediaType.IMAGE_PNG);

        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("photo", new HttpEntity<>(photoPart(oversized, "big.png"), photoHeaders));

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "photo", "VALIDATION_INVALID_VALUE");
    }
}
