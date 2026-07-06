package io.mrkuhne.mezo.feature.proactive;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Companion off + proactive on ⇒ proactive beans must ALSO not exist (they inject the
 * CompanionLlm port, which is absent) — the dual-name @ConditionalOnProperty contract.
 * The context booting at all IS the assertion; the 404 confirms no controller routed.
 */
@TestPropertySource(properties = {
        "mezo.feature.companion.enabled=false",
        "mezo.feature.proactive.enabled=true"})
class ProactiveApiCompanionOffIT extends ApiIntegrationTest {

    @Test
    void testGetBriefing_shouldReturn404_whenCompanionSwitchedOff() {
        String body = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
