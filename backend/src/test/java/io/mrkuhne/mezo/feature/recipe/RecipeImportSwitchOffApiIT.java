package io.mrkuhne.mezo.feature.recipe;

import io.mrkuhne.mezo.api.dto.RecipeImportTextRequest;
import io.mrkuhne.mezo.api.dto.RecipeImportUrlRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** The recipe-import switch OFF: the whole controller bean is gone, every import route 404s. */
@TestPropertySource(properties = "mezo.feature.recipe-import.enabled=false")
class RecipeImportSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void switchOffReturnsDisabled() {
        RecipeImportUrlRequest url = new RecipeImportUrlRequest();
        url.setUrl("https://example.com/recept");
        postForBody("/api/recipe/import/url", url, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        RecipeImportTextRequest text = new RecipeImportTextRequest();
        text.setText("Gulyás");
        postForBody("/api/recipe/import/text", text, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
