package io.mrkuhne.mezo.feature.proactive;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** F7.5: the archive shelf sits behind the same proactive bean-boundary gate. */
@TestPropertySource(properties = "mezo.feature.proactive.enabled=false")
class ProactiveMemoirArchiveSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testGetMemoirArchive_shouldReturn404_whenProactiveSwitchedOff() {
        String body = getForBody(
                "/api/proactive/memoir/archive", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
