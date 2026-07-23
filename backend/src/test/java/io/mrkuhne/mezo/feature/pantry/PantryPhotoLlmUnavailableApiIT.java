package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

/** Photo on, companion off -> no CompanionLlm bean -> clean 503, never a 500 (mezo-d8tr). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class PantryPhotoLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testPhoto_should503_whenCompanionSwitchOff() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_JPEG);
        var parts = new org.springframework.util.LinkedMultiValueMap<String, Object>();
        parts.add("photo", new HttpEntity<>(
                photoPart("x".getBytes(StandardCharsets.UTF_8), "label.jpg"), h));

        ResponseEntity<String> res = postMultipartForResponse("/api/pantry-import/photo", parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(res.getBody(), "PANTRY_PHOTO_LLM_UNAVAILABLE");
    }
}
