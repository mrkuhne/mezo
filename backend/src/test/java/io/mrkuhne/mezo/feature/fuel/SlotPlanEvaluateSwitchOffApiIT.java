package io.mrkuhne.mezo.feature.fuel;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The slot-template-ai switch OFF state (configuration_conventions.md: both switch states
 * tested): {@code @ConditionalOnProperty} drops the whole {@code SlotPlanEvaluateController} bean,
 * so the {@code POST /api/fuel/slot-templates/evaluate} handler ceases to exist — while the rest
 * of the Fuel surface stays on.
 *
 * <p><b>Why 405, not 404:</b> the fixed {@code /evaluate} path segment collides with the
 * still-mapped {@code /api/fuel/slot-templates/{dayType}} pattern ({@code PUT}/{@code DELETE} on
 * {@code FuelController}) — Spring matches the URI (dayType="evaluate") but finds no POST method
 * there, raising {@code HttpRequestMethodNotSupportedException}, which {@code GlobalExceptionHandler}
 * maps to a clean 405 {@code METHOD_NOT_ALLOWED} SystemMessage (same mechanism as
 * {@code MealAiDraftSwitchOffApiIT} vs. {@code /api/meal/{id}}). The gating contract this locks
 * in: switch off => the evaluate POST handler is gone (proven by the generic
 * {@code METHOD_NOT_ALLOWED} body — NOT a {@code FUEL_SLOT_TEMPLATE_*} code, so the service never ran).
 */
@TestPropertySource(properties = "mezo.feature.slot-template-ai.enabled=false")
class SlotPlanEvaluateSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testEvaluate_should405_whenFeatureSwitchOff() {
        String body = postForBody("/api/fuel/slot-templates/evaluate", Map.of("dayType", "rest"),
            ownerAuthHeaders(), HttpStatus.METHOD_NOT_ALLOWED, String.class);
        // generic METHOD_NOT_ALLOWED, NOT a FUEL_SLOT_TEMPLATE_* code -> the evaluate handler/service never ran
        assertHasRequestError(body, "METHOD_NOT_ALLOWED");
    }
}
