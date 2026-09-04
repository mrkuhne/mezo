package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.api.dto.WorkshopDraftLine;
import io.mrkuhne.mezo.api.dto.WorkshopTurnRequest;
import io.mrkuhne.mezo.api.dto.WorkshopTurnResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Receptműhely turn e2e (mezo-92pb) against the deterministic {@code FakeCompanionLlm}: the
 * {@code [fake-workshop:{json}]} sentinel planted in the user message is echoed back verbatim as
 * the LLM answer, so the parse -> sanitize pipeline is assertable over real HTTP without a model.
 */
@ActiveProfiles("companion-fake")
class RecipeWorkshopApiIT extends ApiIntegrationTest {

    /** Creates a per-100g food via the API (owned by the authenticated owner) and returns its id. */
    private UUID createFood(HttpHeaders auth, String name) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("110"));
        r.setProteinG(new BigDecimal("23"));
        r.setCarbsG(new BigDecimal("0"));
        r.setFatG(new BigDecimal("1.5"));
        PantryItemResponse created =
            postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class);
        return created.getId();
    }

    @Test
    void testTurn_shouldReturnDraft_whenSentinelCarriesFullDraft() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID pantryId = createFood(auth, "Csirkemell");

        String sentinel = """
            [fake-workshop:{"reply":"Kész.","draft":{"name":"Csirketál","category":"dinner",\
            "servings":2,"steps":["Süsd meg."],\
            "lines":[{"pantryItemId":"%s","name":"x","amount":300,"unit":"g",\
            "kcal":null,"proteinG":null,"carbsG":null,"fatG":null}]}}]""".formatted(pantryId);

        WorkshopTurnRequest req = new WorkshopTurnRequest();
        req.setMessage(sentinel);

        WorkshopTurnResponse res =
            postForBody("/api/recipe/workshop/turn", req, auth, HttpStatus.OK, WorkshopTurnResponse.class);

        assertThat(res.getReply()).isEqualTo("Kész.");
        assertThat(res.getDraft().getLines()).hasSize(1);
        WorkshopDraftLine line = res.getDraft().getLines().get(0);
        assertThat(line.getSource()).isEqualTo("pantry");
        assertThat(line.getPantryItemId()).isEqualTo(pantryId);
        assertThat(line.getName()).isEqualTo("Csirkemell");
        assertThat(line.getKcal()).isNull();
    }

    @Test
    void testTurn_shouldDemoteHallucinatedPantryId() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID hallucinated = UUID.randomUUID();

        String sentinel = """
            [fake-workshop:{"reply":"Kész.","draft":{"name":"Csirketál","category":"dinner",\
            "servings":2,"steps":["Süsd meg."],\
            "lines":[{"pantryItemId":"%s","name":"Random hozzávaló","amount":150,"unit":"g",\
            "kcal":200,"proteinG":10,"carbsG":20,"fatG":5}]}}]""".formatted(hallucinated);

        WorkshopTurnRequest req = new WorkshopTurnRequest();
        req.setMessage(sentinel);

        WorkshopTurnResponse res =
            postForBody("/api/recipe/workshop/turn", req, auth, HttpStatus.OK, WorkshopTurnResponse.class);

        assertThat(res.getDraft().getLines()).hasSize(1);
        WorkshopDraftLine line = res.getDraft().getLines().get(0);
        assertThat(line.getSource()).isEqualTo("estimate");
        assertThat(line.getPantryItemId()).isNull();
    }

    @Test
    void testTurn_shouldMatchCatalogByName_andPutItOnMyShelf_whenLlmLeftTheIdNull() {
        RegisteredUser anna = registerUser("Anna");
        HttpHeaders bela = registerUser("Béla").headers();
        createFood(anna.headers(), "Kölesgolyó"); // Anna's definition, shared

        String sentinel = """
            [fake-workshop:{"reply":"Kész.","draft":{"name":"Golyós tál","category":"snack",\
            "servings":1,"steps":[],\
            "lines":[{"pantryItemId":null,"name":"kölesgolyó","amount":40,"unit":"g",\
            "kcal":200,"proteinG":10,"carbsG":20,"fatG":5}]}}]""";
        WorkshopTurnRequest req = new WorkshopTurnRequest();
        req.setMessage(sentinel);

        WorkshopTurnResponse res = postForBody("/api/recipe/workshop/turn", req, bela, HttpStatus.OK, WorkshopTurnResponse.class);

        WorkshopDraftLine line = res.getDraft().getLines().get(0);
        assertThat(line.getSource()).isEqualTo("pantry");
        assertThat(line.getName()).isEqualTo("Kölesgolyó");
        assertThat(line.getKcal()).isNull(); // pantry lines carry no macros — the FE computes them
        PantryResponse pantry = getForBody("/api/pantry", bela, HttpStatus.OK, PantryResponse.class);
        assertThat(pantry.getIngredients()).extracting("id").contains(line.getPantryItemId()); // Béla's own row now exists
    }

    @Test
    void testTurn_should400_whenMessageBlank() {
        HttpHeaders auth = ownerAuthHeaders();

        String body = exchangeForBody(org.springframework.http.HttpMethod.POST,
            "/api/recipe/workshop/turn", Map.of("message", ""), auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "message", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testTurn_should502_whenAnswerUnparseable() {
        HttpHeaders auth = ownerAuthHeaders();
        // Matches the WORKSHOP_SENTINEL regex ([fake-workshop:{.*}]) but the payload is invalid
        // JSON -> the fake echoes it verbatim -> Jackson fails to parse -> 502.
        WorkshopTurnRequest req = new WorkshopTurnRequest();
        req.setMessage("x [fake-workshop:{\"reply\":}]");

        String body = exchangeForBody(org.springframework.http.HttpMethod.POST,
            "/api/recipe/workshop/turn", req, auth, HttpStatus.BAD_GATEWAY, String.class);

        assertHasRequestError(body, "RECIPE_WORKSHOP_EXTRACT_FAILED");
    }
}
