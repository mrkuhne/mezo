package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/** „Ezt főztem" on, companion off: no AI bean, so the capture answers a clean 503 — never a 500. */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class RecipeCookedLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testCooked_shouldAnswer503WithoutTheAi() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("text", "fél kiló csirkemell és 30 deka rizs");

        ResponseEntity<String> resp = postMultipartForResponse("/api/recipe/cooked", parts, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(resp.getBody(), "RECIPE_COOKED_LLM_UNAVAILABLE");
    }

    @Test
    void testCooked_shouldStillValidateTheInputFirst() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("text", " ");

        ResponseEntity<String> resp = postMultipartForResponse("/api/recipe/cooked", parts, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(resp.getBody(), "text", "VALIDATION_INVALID_VALUE");
    }
}
