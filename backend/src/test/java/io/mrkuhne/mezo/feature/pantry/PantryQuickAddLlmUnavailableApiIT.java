package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryQuickAddRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

/**
 * Quick-add on, companion off: binding a food the shared catalog already has needs no AI and still
 * works; only the estimate step answers a clean 503 — and creates nothing.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class PantryQuickAddLlmUnavailableApiIT extends ApiIntegrationTest {

    private static PantryQuickAddRequest request(String name) {
        PantryQuickAddRequest r = new PantryQuickAddRequest();
        r.setName(name);
        return r;
    }

    @Test
    void testQuickAdd_shouldStillBindSharedFoodWithoutTheAi() {
        HttpHeaders anna = registerUser("Anna").headers();
        HttpHeaders bela = registerUser("Béla").headers();
        PantryItemRequest food = new PantryItemRequest();
        food.setKind(PantryItemRequest.KindEnum.FOOD);
        food.setName("Kurkuma");
        food.setPer(new BigDecimal("100"));
        food.setUnit("g");
        food.setKcal(new BigDecimal("312"));
        UUID catalogId = postForBody("/api/pantry", food, anna, HttpStatus.CREATED, PantryItemResponse.class).getCatalogId();

        PantryItemResponse added = postForBody("/api/pantry/items/quick-add", request("kurkuma"), bela,
            HttpStatus.OK, PantryItemResponse.class);

        assertThat(added.getCatalogId()).isEqualTo(catalogId);
        assertThat(added.getEstimated()).isFalse();
    }

    @Test
    void testQuickAdd_shouldAnswer503WhenAnEstimateWouldBeNeeded() {
        ResponseEntity<String> resp = exchangeForResponse(HttpMethod.POST, "/api/pantry/items/quick-add",
            request("szumák"), ownerAuthHeaders());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(resp.getBody(), "PANTRY_QUICK_ADD_LLM_UNAVAILABLE");
    }
}
