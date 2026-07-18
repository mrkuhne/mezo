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
 * <p><b>Why 405, not the 404 the pantry switch-off IT gets:</b> unlike {@code /api/pantry-import/scrape},
 * the ai-draft path {@code /api/meal/ai-draft} collides with the still-mapped {@code /api/meal/{id}}
 * pattern ({@code PUT}/{@code DELETE} on {@code MealController}). With the ai-draft POST handler gone,
 * Spring matches the path but finds no POST method and raises {@code HttpRequestMethodNotSupportedException},
 * which {@code GlobalExceptionHandler} maps to a clean 405 {@code METHOD_NOT_ALLOWED} SystemMessage
 * (previously this fell through to a generic 500 — deviation from the plan's 404 expectation, recorded
 * for the docs task). The gating contract this locks in: switch off ⇒ the ai-draft POST handler is gone
 * (proven by the generic {@code METHOD_NOT_ALLOWED} body — NOT a {@code MEAL_AI_*} code, so the service
 * never ran). A plain JSON POST is used — the multipart plumbing is exercised by {@code MealAiDraftApiIT},
 * and the route is gone regardless of content type.
 */
@TestPropertySource(properties = "mezo.feature.meal-ai-log.enabled=false")
class MealAiDraftSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testDraft_should405_whenFeatureSwitchOff() {
        String body = postForBody("/api/meal/ai-draft", Map.of("date", "2026-07-18"),
                ownerAuthHeaders(), HttpStatus.METHOD_NOT_ALLOWED, String.class);
        // generic METHOD_NOT_ALLOWED, NOT a MEAL_AI_* code -> the ai-draft handler/service never ran
        assertHasRequestError(body, "METHOD_NOT_ALLOWED");
    }
}
