package io.mrkuhne.mezo.feature.meal;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The meal-ai-log switch OFF state (configuration_conventions.md: both switch states tested):
 * {@code @ConditionalOnProperty} drops the whole {@code MealAiDraftController} bean, so the
 * {@code POST /api/meal/ai-draft} handler ceases to exist — while the rest of the Meal surface
 * stays on (only this feature switch is flipped).
 *
 * <p><b>Why this asserts 500, not the 404 the pantry switch-off IT gets:</b> unlike
 * {@code /api/pantry-import/scrape}, the ai-draft path {@code /api/meal/ai-draft} collides with the
 * still-mapped {@code /api/meal/{id}} pattern ({@code PUT}/{@code DELETE} on {@code MealController}).
 * With the ai-draft POST handler gone, Spring matches the path but finds no POST method and raises
 * {@code HttpRequestMethodNotSupportedException} (405); the app's catch-all handler maps that to 500
 * (there is no dedicated 405 handler — an app-wide behavior, not specific to this feature). The
 * gating contract this test locks in is therefore "switch off ⇒ the ai-draft POST handler is gone":
 * proven by the generic {@code INTERNAL_ERROR} body (NOT a {@code MEAL_AI_*} code, so the service
 * never ran) rather than a clean 404. A plain JSON POST is used — the multipart plumbing is already
 * exercised by {@code MealAiDraftApiIT}, and the route is gone regardless of content type.
 */
@TestPropertySource(properties = "mezo.feature.meal-ai-log.enabled=false")
class MealAiDraftSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testDraft_should500ViaMethodNotAllowed_whenFeatureSwitchOff() {
        String body = postForBody("/api/meal/ai-draft", Map.of("date", "2026-07-18"),
                ownerAuthHeaders(), HttpStatus.INTERNAL_SERVER_ERROR, String.class);
        // generic catch-all, NOT a MEAL_AI_* code -> the ai-draft handler/service was never reached
        assertHasRequestError(body, "INTERNAL_ERROR");
    }
}
