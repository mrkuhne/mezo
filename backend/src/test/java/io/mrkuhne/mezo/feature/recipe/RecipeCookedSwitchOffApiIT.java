package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/**
 * The recipe-cooked switch OFF: the controller bean is gone, so the operation is not served.
 *
 * <p>The answer is 405, not 404: {@code /api/recipe/cooked} is a single segment under
 * {@code /api/recipe}, so with the bean gone the path still matches {@code /api/recipe/{id}}
 * (GET/PUT/DELETE) and Spring reports the missing POST. Same collision the pantry fragment documents
 * for its own static segments. Either way nothing is read, matched or sent to the AI.
 */
@TestPropertySource(properties = "mezo.feature.recipe-cooked.enabled=false")
class RecipeCookedSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testCooked_shouldNotBeServedWhenSwitchedOff() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("text", "fél kiló csirkemell");

        ResponseEntity<String> resp = postMultipartForResponse("/api/recipe/cooked", parts, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
    }
}
