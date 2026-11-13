package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RecipeImportUrlRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

/** Default configuration (private hosts NOT allowed): an imported link is attacker-influenced input. */
@ActiveProfiles("companion-fake")
class RecipeImportSsrfApiIT extends ApiIntegrationTest {

    @Test
    void privateAndNonHttpAddressesAreRefused() {
        for (String url : new String[] {"http://127.0.0.1:9/x", "http://169.254.169.254/latest/meta-data/",
            "http://10.0.0.5/admin", "file:///etc/passwd", "ftp://example.com/r"}) {
            RecipeImportUrlRequest req = new RecipeImportUrlRequest();
            req.setUrl(url);
            ResponseEntity<String> resp = exchangeForResponse(HttpMethod.POST, "/api/recipe/import/url", req, ownerAuthHeaders());
            assertThat(resp.getStatusCode()).as(url).isEqualTo(HttpStatus.BAD_REQUEST);
            assertHasFieldError(resp.getBody(), "url", "VALIDATION_INVALID_VALUE");
        }
    }
}
