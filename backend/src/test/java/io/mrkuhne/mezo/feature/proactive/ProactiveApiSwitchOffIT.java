package io.mrkuhne.mezo.feature.proactive;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** Proactive switch off ⇒ the whole proactive HTTP surface does not exist (bean-boundary gating). */
@TestPropertySource(properties = "mezo.feature.proactive.enabled=false")
class ProactiveApiSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testGetBriefing_shouldReturn404_whenProactiveSwitchedOff() {
        String body = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetWeeklySuggestion_shouldReturn404_whenProactiveSwitchedOff() {
        String body = getForBody(
                "/api/proactive/weekly-suggestion", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetMemoir_shouldReturn404_whenProactiveSwitchedOff() {
        String body = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetHeartbeat_shouldReturn404_whenProactiveSwitchedOff() {
        String body = getForBody(
                "/api/proactive/heartbeat", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetPredictions_shouldReturn404_whenProactiveSwitchedOff() {
        String body = getForBody(
                "/api/proactive/prediction", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
