package io.mrkuhne.mezo.feature.pantry;

import io.mrkuhne.mezo.api.dto.PantryQuickAddRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** The pantry-quick-add switch OFF: the controller bean is gone, the route 404s. */
@TestPropertySource(properties = "mezo.feature.pantry-quick-add.enabled=false")
class PantryQuickAddDisabledApiIT extends ApiIntegrationTest {

    @Test
    void testQuickAdd_shouldAnswer404WhenSwitchedOff() {
        PantryQuickAddRequest req = new PantryQuickAddRequest();
        req.setName("kurkuma");

        postForBody("/api/pantry/items/quick-add", req, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
