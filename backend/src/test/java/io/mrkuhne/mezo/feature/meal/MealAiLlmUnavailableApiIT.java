package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/**
 * Meal-ai-log on, companion off (mezo-78rn): no {@code CompanionLlm} bean -> no
 * {@code MealDraftLlmAdapter} bean -> the {@code ObjectProvider<MealDraftLlm>} is empty, so
 * {@code MealAiDraftService.requireAvailable()} degrades to a clean 503 rather than a 500 — the
 * controller bean itself still exists (only the LLM port is missing). Mirrors
 * {@code PantryScrapeLlmUnavailableApiIT}. The 404 switch-OFF state (controller bean absent) is
 * proven separately in {@code MealAiDraftSwitchOffApiIT}.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class MealAiLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testDraft_should503_whenCompanionSwitchOff() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("text", "bármi");

        ResponseEntity<String> res =
                postMultipartForResponse("/api/meal/ai-draft", parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(res.getBody(), "MEAL_AI_LLM_UNAVAILABLE");
    }
}
