package io.mrkuhne.mezo.feature.biometrics.sleep;

import static java.nio.charset.StandardCharsets.UTF_8;
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

/** Companion OFF -> the adapter bean is gone -> surface stays on but answers 503. */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class SleepShotLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testDraft_shouldReturn503_whenCompanionPortAbsent() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_PNG);
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", new HttpEntity<>(photoPart("x".getBytes(UTF_8), "screenshot.png"), h));

        ResponseEntity<String> res = postMultipartForResponse("/api/sleep/screenshot", parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(res.getBody(), "SLEEP_SHOT_LLM_UNAVAILABLE");
    }
}
