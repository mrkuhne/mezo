package io.mrkuhne.mezo.feature.pantry;

import io.mrkuhne.mezo.api.dto.PantryImportRequest;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The pantry-import switch OFF state (configuration_conventions.md: both switch states tested):
 * the whole controller bean disappears -> 404, while the pantry read (feed + suggestions
 * composition) stays on.
 */
@TestPropertySource(properties = "mezo.feature.pantry-import.enabled=false")
class PantryImportDisabledApiIT extends ApiIntegrationTest {

    @Test
    void testLookup_shouldReturn404_whenSwitchOff() {
        getForBody("/api/pantry-import/lookup?q=skyr", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testImport_shouldReturn404_whenSwitchOff() {
        PantryImportRequest req = new PantryImportRequest();
        req.setName("Skyr");
        req.setPer(BigDecimal.valueOf(100));
        req.setUnit("g");
        req.setKcal(BigDecimal.valueOf(63));

        postForBody("/api/pantry-import", req, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testGetPantry_shouldStillCarryImportsAndSuggestions_whenSwitchOff() {
        PantryResponse pantry = getForBody("/api/pantry", ownerAuthHeaders(), HttpStatus.OK, PantryResponse.class);

        Assertions.assertThat(pantry.getImports()).isNotNull();
        Assertions.assertThat(pantry.getSuggestions()).isNotNull();
    }
}
