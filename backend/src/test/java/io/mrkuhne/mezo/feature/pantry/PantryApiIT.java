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

    private PantryItemRequest supplementReq() {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.SUPPLEMENT);
        r.setName("Kollagén Teszt Protein");
        r.setDose("20g"); // supplement's required field
        r.setPer(BigDecimal.valueOf(100));
        r.setUnit("g");
        r.setKcal(BigDecimal.valueOf(360));
        r.setProteinG(BigDecimal.valueOf(90));
        r.setPrice(20490);
        return r;
    }

    @Test
    void testCreateThenGet_shouldReturnSupplementInStashWithMacrosAndPrice_whenAuthed() {
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/pantry", supplementReq(), auth, HttpStatus.CREATED, PantryItemResponse.class);
        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        var supp = pantry.getStash().stream()
            .filter(s -> "Kollagén Teszt Protein".equals(s.getName())).findFirst().orElseThrow();
        assertThat(supp.getMacros()).isNotNull();
        assertThat(supp.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(360));
        assertThat(supp.getMacros().getP()).isEqualByComparingTo(BigDecimal.valueOf(90));
        assertThat(supp.getPrice()).isEqualByComparingTo(BigDecimal.valueOf(20490));
    }

    @Test
    void testCreateThenGet_shouldReturnFoodInIngredients_whenAuthed() {
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/pantry", foodReq(), auth, HttpStatus.CREATED, PantryItemResponse.class);
        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        assertThat(pantry.getIngredients()).extracting("name").contains("Túró");
        // P6 (mezo-bka): the response always carries the feed + suggestion arrays (honest-empty)
        assertThat(pantry.getImports()).isNotNull();
        assertThat(pantry.getSuggestions()).isNotNull();
        // S4 (mezo-qw37.4): every shelf row names its shared definition, and the seeded account is
        // the OWNER, so the definition fields are unlocked for it.
        var turo = pantry.getIngredients().stream()
            .filter(i -> "Túró".equals(i.getName())).findFirst().orElseThrow();
        assertThat(turo.getCatalogId()).isNotNull();
        assertThat(turo.getCatalogEditable()).isTrue();
        assertThat(turo.getSharedFrom()).isNull();
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

    @Test
    void testGetPantry_shouldReportFoodKind_forAFoodRowCategorisedAsSupplement() {
        HttpHeaders auth = ownerAuthHeaders();
        // 'supplement' is a LEGAL category on a food row (the add sheet offers it) — the kind and
        // the category are independent axes, and the client must not conflate them (mezo-4orh).
        PantryItemRequest req = foodReq();
        req.setName("Kollagén por");
        req.setCategory(PantryItemRequest.CategoryEnum.SUPPLEMENT);

        postForBody("/api/pantry", req, auth, HttpStatus.CREATED, PantryItemResponse.class);
        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        var kollagen = pantry.getIngredients().stream()
            .filter(i -> "Kollagén por".equals(i.getName())).findFirst().orElseThrow();
        assertThat(kollagen.getKind().getValue()).isEqualTo("food");
        assertThat(kollagen.getCategory()).isEqualTo("supplement");
    }
}
