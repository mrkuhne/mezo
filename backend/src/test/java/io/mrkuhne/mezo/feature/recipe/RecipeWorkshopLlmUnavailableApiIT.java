package io.mrkuhne.mezo.feature.recipe;

import io.mrkuhne.mezo.api.dto.WorkshopTurnRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Receptműhely on, companion off (mezo-92pb): no {@code CompanionLlm} bean -> no
 * {@code RecipeWorkshopLlm} adapter bean -> the {@code ObjectProvider<RecipeWorkshopLlm>} is
 * empty, so {@code RecipeWorkshopService.requireAvailable()} degrades to a clean 503 rather than
 * a 500 — the controller bean itself still exists (only the LLM port is missing). Mirrors
 * {@code MealAiLlmUnavailableApiIT} / {@code PantryScrapeLlmUnavailableApiIT}. The 404 switch-OFF
 * state (controller bean absent) is proven separately in {@code RecipeWorkshopSwitchOffApiIT}.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class RecipeWorkshopLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testTurn_should503_whenCompanionSwitchOff() {
        WorkshopTurnRequest req = new WorkshopTurnRequest();
        req.setMessage("x");

        String body = postForBody("/api/recipe/workshop/turn", req,
            ownerAuthHeaders(), HttpStatus.SERVICE_UNAVAILABLE, String.class);

        assertHasRequestError(body, "RECIPE_WORKSHOP_LLM_UNAVAILABLE");
    }
}
