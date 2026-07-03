package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** Switch off ⇒ the whole companion HTTP surface does not exist (bean-boundary gating). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CompanionApiSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testListConversations_shouldReturn404_whenCompanionSwitchedOff() {
        String body = getForBody(
                "/api/companion/conversation", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
