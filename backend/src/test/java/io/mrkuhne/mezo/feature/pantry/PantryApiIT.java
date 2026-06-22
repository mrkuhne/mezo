package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class PantryApiIT extends ApiIntegrationTest {

    private PantryItemRequest foodReq() {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Túró");
        r.setUnit("g");
        r.setKcal(BigDecimal.valueOf(130));
        return r;
    }

    @Test
    void testCreateThenGet_shouldReturnFoodInIngredients_whenAuthed() {
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/pantry", foodReq(), auth, HttpStatus.CREATED, PantryItemResponse.class);
        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        assertThat(pantry.getIngredients()).extracting("name").contains("Túró");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenFoodMissingKcal() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemRequest bad = foodReq();
        bad.setKcal(null);

        String body = exchangeForBody(
            org.springframework.http.HttpMethod.POST, "/api/pantry", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "kcal", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testUpdate_shouldReturn404_whenUnknownId() {
        HttpHeaders auth = ownerAuthHeaders();

        exchangeForBody(org.springframework.http.HttpMethod.PUT, "/api/pantry/" + UUID.randomUUID(),
            foodReq(), auth, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDelete_shouldReturn204ThenHide_whenOwned() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemResponse created = postForBody("/api/pantry", foodReq(), auth, HttpStatus.CREATED, PantryItemResponse.class);

        deleteAndExpect("/api/pantry/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);
        assertThat(pantry.getIngredients()).extracting("id").doesNotContain(created.getId());
    }
}
