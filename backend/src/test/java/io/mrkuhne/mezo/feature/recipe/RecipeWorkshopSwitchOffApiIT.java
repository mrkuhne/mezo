package io.mrkuhne.mezo.feature.recipe;

import io.mrkuhne.mezo.api.dto.WorkshopTurnRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The Receptműhely switch OFF state (configuration_conventions.md: both switch states tested):
 * {@code @ConditionalOnProperty} drops the whole {@code RecipeWorkshopController} bean, so the
 * {@code POST /api/recipe/workshop/turn} handler ceases to exist. Unlike the meal ai-draft
 * switch-off (which collides with {@code /api/meal/{id}} and gets a 405), this path does NOT
 * collide with {@code /api/recipe/{id}} — different segment count — so Spring finds no mapping
 * at all and {@code GlobalExceptionHandler} answers the plain no-handler 404, mirroring
 * {@code PantryScrapeDisabledApiIT}.
 */
@TestPropertySource(properties = "mezo.feature.recipe-workshop.enabled=false")
class RecipeWorkshopSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testTurn_shouldReturn404_whenWorkshopSwitchOff() {
        WorkshopTurnRequest req = new WorkshopTurnRequest();
        req.setMessage("x");

        String body = postForBody("/api/recipe/workshop/turn", req,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        // GlobalExceptionHandler.handleNotFound(NoResourceFoundException) -> RESOURCE_NOT_FOUND
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
