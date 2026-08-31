package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CharacterOverviewResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The companion-off / character-on quadrant (final-review Finding C1, bd mezo-1gim.6): with
 * companion off, {@code CharacterBootstrapService} — {@code @ConditionalOnProperty} array-AND'ed
 * on BOTH the character and companion switches, since it runs an LLM konzílium — does not exist,
 * but {@code CharacterController} itself is character-only (S1 deliberately kept the dossier
 * READS companion-free). The context booting at all with the read surface answering 2xx IS the
 * {@code JournalApiCompanionOffIT} idiom's assertion that no companion-only bean is wired into the
 * character read path; {@code POST /api/character/bootstrap} then answers the HONEST off-state —
 * a 404, never a silent 200 — because the underlying bean is genuinely absent, not because the
 * dossier happens to be empty (that case is a bodyless 204, see {@code CharacterBootstrapIT}).
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CharacterApiCompanionOffIT extends ApiIntegrationTest {

    @Test
    void testCharacterReads_shouldSucceed_whenCompanionSwitchedOff() {
        CharacterOverviewResponse overview = getForBody(
                "/api/character", ownerAuthHeaders(), HttpStatus.OK, CharacterOverviewResponse.class);

        assertThat(overview.getDimensions()).hasSize(7);
    }

    @Test
    void testBootstrapCharacter_shouldReturn404_whenCompanionSwitchedOff() {
        String body = postForBody(
                "/api/character/bootstrap", null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
