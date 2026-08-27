package io.mrkuhne.mezo.feature.character;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** Character switch off ⇒ the whole /api/character HTTP surface does not exist (bean-boundary gating). */
@TestPropertySource(properties = "mezo.feature.character.enabled=false")
class CharacterApiSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testGetOverview_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetDimension_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character/dimension/discipline", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetFeed_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character/feed", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testListConferences_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character/conference", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetConference_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character/conference/" + UUID.randomUUID(), ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
