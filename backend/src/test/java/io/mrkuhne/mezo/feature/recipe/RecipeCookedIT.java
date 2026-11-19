package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeImportDraft;
import io.mrkuhne.mezo.api.dto.RecipeImportLine;
import io.mrkuhne.mezo.api.dto.RecipeImportMatch;
import io.mrkuhne.mezo.api.dto.RecipeImportResponse;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/**
 * „Ezt főztem" e2e (mezo-r36n9.63): the LLM is {@code FakeCompanionLlm} — the READ is scripted with a
 * {@code [fake-cooked:{json}]} sentinel in the typed note or in a photo's bytes, the PICK is answered
 * deterministically (first listed candidate chosen, next two runners-up) — so the real multipart ->
 * read -> parse -> exact match -> shortlist -> pick -> basis-unit path runs without a model.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.recipe-cooked.max-total-bytes=100000")
class RecipeCookedIT extends ApiIntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    private PantryItemResponse createFood(HttpHeaders auth, String name, String unit) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit(unit);
        r.setKcal(new BigDecimal("110"));
        r.setProteinG(new BigDecimal("23"));
        r.setCarbsG(new BigDecimal("0"));
        r.setFatG(new BigDecimal("1.5"));
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class);
    }

    /** The scripted read: one sentinel carrying the given lines as {@code sourceText|ingredient} pairs. */
    private static String script(String name, String... saidAndIngredient) {
        StringBuilder lines = new StringBuilder();
        for (int i = 0; i < saidAndIngredient.length; i += 2) {
            lines.append(i == 0 ? "" : ",").append("{\"sourceText\":\"").append(saidAndIngredient[i])
                .append("\",\"ingredient\":\"").append(saidAndIngredient[i + 1]).append("\"}");
        }
        return "[fake-cooked:{\"name\":" + (name == null ? "null" : "\"" + name + "\"")
            + ",\"servings\":4,\"steps\":[\"Süsd meg.\"],\"lines\":[" + lines + "]}]";
    }

    private static HttpEntity<?> photo(byte[] bytes, MediaType type, String filename) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(type);
        return new HttpEntity<>(photoPart(bytes, filename), h);
    }

    private <T> ResponseEntity<T> cooked(HttpHeaders auth, String text, Class<T> type, HttpEntity<?>... photos) {
        var parts = new LinkedMultiValueMap<String, Object>();
        if (text != null) {
            parts.add("text", text);
        }
        for (HttpEntity<?> p : photos) {
            parts.add("photos", p);
        }
        HttpHeaders headers = new HttpHeaders();
        headers.addAll(auth);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        return rest.exchange("/api/recipe/cooked", HttpMethod.POST, new HttpEntity<>(parts, headers), type);
    }

    private RecipeImportDraft draft(HttpHeaders auth, String text) {
        ResponseEntity<RecipeImportResponse> resp = cooked(auth, text, RecipeImportResponse.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resp.getBody().getResult();
    }

    @Test
    void testCooked_shouldMatchExactNameAsMatched() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID catalogId = createFood(auth, "Csirkemell filé", "g").getCatalogId();

        RecipeImportDraft draft = draft(auth,
            "Csirkés rizst főztem. " + script("Csirkés rizs", "fél kiló csirkemell filé", "500 g Csirkemell filé"));

        assertThat(draft.getName()).isEqualTo("Csirkés rizs");
        assertThat(draft.getServings()).isEqualTo(4);
        assertThat(draft.getSteps()).containsExactly("Süsd meg.");
        assertThat(draft.getStructured()).isFalse();
        assertThat(draft.getNeedsReview()).isFalse();
        RecipeImportLine line = draft.getLines().get(0);
        assertThat(line.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.MATCHED);
        assertThat(line.getMatch().getCatalogId()).isEqualTo(catalogId);
        assertThat(line.getMatch().getOnShelf()).isTrue();
        assertThat(line.getMatch().getAmountDoubt()).isFalse();
        assertThat(line.getMatch().getBasisUnit()).isEqualTo("g");
        assertThat(line.getMatch().getNeedsReview()).isFalse();
        assertThat(line.getMatch().getConfidence()).isEqualByComparingTo("1");
        assertThat(line.getMatch().getAlternatives()).isEmpty();
        assertThat(line.getName()).isEqualTo("Csirkemell filé");
        assertThat(line.getAmount()).isEqualByComparingTo("500");
        assertThat(line.getUnit()).isEqualTo("g");
        assertThat(line.getSourceText()).isEqualTo("fél kiló csirkemell filé"); // what he SAID
        assertThat(line.getPantryItemId()).isNull(); // a preview never binds a shelf row
    }

    @Test
    void testCooked_shouldConvertDekaIntoTheFoodsBasisUnit() {
        HttpHeaders auth = ownerAuthHeaders();
        createFood(auth, "Jázmin rizs", "g");

        RecipeImportLine line = draft(auth, script(null, "30 deka rizs", "30 dkg jázmin rizs")).getLines().get(0);

        assertThat(line.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.MATCHED);
        assertThat(line.getAmount()).isEqualByComparingTo("300");
        assertThat(line.getUnit()).isEqualTo("g");
        assertThat(line.getMatch().getAmountDoubt()).isFalse();
    }

    @Test
    void testCooked_shouldReturnAiPickAsConfirmWithAlternatives() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID first = createFood(auth, "Csirkemell bőrös", "g").getCatalogId();
        UUID second = createFood(auth, "Csirkemell sonka", "g").getCatalogId();
        UUID third = createFood(auth, "Csirkemell filé friss", "g").getCatalogId();
        createFood(auth, "Jázmin rizs", "g");

        RecipeImportDraft draft = draft(auth, script(null, "30 deka csirkemell", "30 dkg csirkemell"));

        RecipeImportLine line = draft.getLines().get(0);
        // No food is called exactly "csirkemell": the AI picked one of the shortlist, so the owner confirms.
        assertThat(line.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.CONFIRM);
        assertThat(line.getMatch().getCatalogId()).isEqualTo(first);
        assertThat(line.getMatch().getNeedsReview()).isTrue();
        assertThat(line.getMatch().getConfidence()).isEqualByComparingTo("0.5");
        assertThat(line.getMatch().getAlternatives()).hasSize(2)
            .extracting("catalogId").containsExactly(second, third);
        assertThat(line.getMatch().getAlternatives().get(0).getName()).isEqualTo("Csirkemell sonka");
        assertThat(line.getMatch().getAlternatives().get(0).getBasisUnit()).isEqualTo("g");
        assertThat(line.getName()).isEqualTo("Csirkemell bőrös"); // the pantry's name, never the model's
        assertThat(line.getAmount()).isEqualByComparingTo("300");
        assertThat(line.getUnit()).isEqualTo("g");
        assertThat(draft.getNeedsReview()).isTrue();
        assertThat(draft.getName()).isEqualTo("Főztöm"); // no dish name said: the bundle default
    }

    @Test
    void testCooked_shouldReturnMissingWithAlternativesWhenTheAiPicksNone() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID oil = createFood(auth, "Olívaolaj extra szűz", "ml").getCatalogId();

        RecipeImportLine line = draft(auth, script(null, "kevés olívaolaj",
            "10 ml olívaolaj " + FakeCompanionLlm.COOKED_PICK_NONE)).getLines().get(0);

        assertThat(line.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.MISSING);
        assertThat(line.getMatch().getCatalogId()).isNull();
        assertThat(line.getMatch().getAlternatives()).extracting("catalogId").containsExactly(oil);
        assertThat(line.getMatch().getAlternatives().get(0).getBasisUnit()).isEqualTo("ml");
    }

    @Test
    void testCooked_shouldReturnMissingWhenNoCandidate() {
        HttpHeaders auth = ownerAuthHeaders();
        createFood(auth, "Jázmin rizs", "g");

        RecipeImportLine line = draft(auth, script(null, "egy teáskanál kurkuma", "1 tk kurkuma")).getLines().get(0);

        assertThat(line.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.MISSING);
        assertThat(line.getMatch().getCatalogId()).isNull();
        assertThat(line.getMatch().getConfidence()).isEqualByComparingTo("0");
        assertThat(line.getMatch().getNeedsReview()).isTrue();
        assertThat(line.getMatch().getOnShelf()).isFalse();
        assertThat(line.getMatch().getAmountDoubt()).isFalse();
        assertThat(line.getMatch().getBasisUnit()).isNull();
        assertThat(line.getMatch().getAlternatives()).isEmpty();
        assertThat(line.getSource()).isEqualTo("estimate");
        assertThat(line.getName()).isEqualTo("kurkuma");
        assertThat(line.getAmount()).isEqualByComparingTo("5"); // 1 tk as the parser reads it: 5 ml, kept as said
        assertThat(line.getUnit()).isEqualTo("ml");
        assertThat(line.getKcal()).isNull(); // no invented facts
        assertThat(line.getAllergens()).isNull();
    }

    @Test
    void testCooked_shouldFlagSpoonsAgainstGramFood() {
        HttpHeaders auth = ownerAuthHeaders();
        createFood(auth, "Olívaolaj", "g");

        RecipeImportLine line = draft(auth, script(null, "2 evőkanál olaj", "2 ek olívaolaj")).getLines().get(0);

        // The name is exact, but 2 tablespoons against a per-100-g food must never be saved as 2 g.
        assertThat(line.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.CONFIRM);
        assertThat(line.getMatch().getAmountDoubt()).isTrue();
        assertThat(line.getMatch().getNeedsReview()).isTrue();
        assertThat(line.getAmount()).isEqualByComparingTo("30");
        assertThat(line.getUnit()).isEqualTo("g");
        assertThat(line.getMatch().getBasisUnit()).isEqualTo("g");
    }

    @Test
    void testCooked_shouldFlagPieceAndMissingAmount() {
        HttpHeaders auth = ownerAuthHeaders();
        createFood(auth, "Vöröshagyma", "g");
        createFood(auth, "Só", "g");

        RecipeImportDraft draft = draft(auth, script(null, "egy fej hagyma", "1 fej vöröshagyma", "só", "só"));

        RecipeImportLine onion = draft.getLines().get(0);
        assertThat(onion.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.CONFIRM);
        assertThat(onion.getMatch().getAmountDoubt()).isTrue();
        assertThat(onion.getAmount()).isEqualByComparingTo("1"); // as said — and flagged, never trusted as 1 g
        assertThat(onion.getUnit()).isEqualTo("g");
        RecipeImportLine salt = draft.getLines().get(1);
        assertThat(salt.getMatch().getAmountDoubt()).isTrue();
        assertThat(salt.getAmount()).isEqualByComparingTo("0"); // nothing stated: a value to type
        assertThat(salt.getUnit()).isEqualTo("g");
    }

    @Test
    void testCooked_shouldMatchOwnersOwnDraftFood() {
        RegisteredUser anna = registerUser("Anna");
        HttpHeaders bela = registerUser("Béla").headers();
        UUID catalogId = createFood(anna.headers(), "Házi lecsó", "g").getCatalogId();
        jdbc.update("update pantry_catalog set status = 'draft' where id = ?", catalogId); // unreviewed: hers only
        String capture = script(null, "20 deka lecsó", "200 g házi lecsó");

        RecipeImportLine hers = draft(anna.headers(), capture).getLines().get(0);
        RecipeImportLine his = draft(bela, capture).getLines().get(0);

        assertThat(hers.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.MATCHED);
        assertThat(hers.getMatch().getCatalogId()).isEqualTo(catalogId);
        // Somebody else's unreviewed draft is neither matched nor offered.
        assertThat(his.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.MISSING);
        assertThat(his.getMatch().getCatalogId()).isNull();
        assertThat(his.getMatch().getAlternatives()).isEmpty();
    }

    @Test
    void testCooked_shouldSayWhenTheMatchedFoodIsNotOnTheShelfYet() {
        HttpHeaders anna = registerUser("Anna").headers();
        HttpHeaders bela = registerUser("Béla").headers();
        createFood(anna, "Kölesgolyó", "g"); // a shared, verified definition — on Anna's shelf only

        RecipeImportLine line = draft(bela, script(null, "4 deka kölesgolyó", "40 g kölesgolyó")).getLines().get(0);

        assertThat(line.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.MATCHED);
        assertThat(line.getMatch().getOnShelf()).isFalse();
    }

    @Test
    void testCooked_shouldDegradeWhenSelectCallFails() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID catalogId = createFood(auth, "Csirkemell filé", "g").getCatalogId();
        createFood(auth, "Jázmin rizs", "g");
        // The read is scripted from a PHOTO; the said text then carries the fake's fail marker into the
        // pick call only — so the read succeeds and the pick throws.
        String scripted = script(null, "csirke", "300 g " + FakeCompanionLlm.FAIL_COMPLETE + " csirkemell",
            "rizs", "200 g jázmin rizs");

        ResponseEntity<RecipeImportResponse> resp = cooked(auth, null, RecipeImportResponse.class,
            photo(scripted.getBytes(StandardCharsets.UTF_8), MediaType.IMAGE_JPEG, "pult.jpg"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK); // degrade, do not fail
        RecipeImportDraft draft = resp.getBody().getResult();
        RecipeImportLine open = draft.getLines().get(0);
        assertThat(open.getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.MISSING);
        assertThat(open.getMatch().getCatalogId()).isNull();
        // „Másik" still offers the lexical best, so he can link it by hand.
        assertThat(open.getMatch().getAlternatives()).extracting("catalogId").containsExactly(catalogId);
        assertThat(draft.getLines().get(1).getMatch().getState()).isEqualTo(RecipeImportMatch.StateEnum.MATCHED);
    }

    @Test
    void testCooked_shouldReadEveryPhoto() {
        HttpHeaders auth = ownerAuthHeaders();
        createFood(auth, "Jázmin rizs", "g");
        byte[] plain = "nincs rajta semmi".getBytes(StandardCharsets.UTF_8);
        byte[] scripted = script(null, "rizs a mérlegen", "250 g jázmin rizs").getBytes(StandardCharsets.UTF_8);

        ResponseEntity<RecipeImportResponse> resp = cooked(auth, "a képen a rizs", RecipeImportResponse.class,
            photo(plain, MediaType.IMAGE_PNG, "1.png"), photo(plain, MediaType.parseMediaType("image/webp"), "2.webp"),
            photo(scripted, MediaType.IMAGE_JPEG, "3.jpg"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().getResult().getLines().get(0).getAmount()).isEqualByComparingTo("250");
    }

    @Test
    void testCooked_shouldAnswerEmptyWhenNothingReadable() {
        HttpHeaders auth = ownerAuthHeaders();

        assertThat(draft(auth, "asdf")).isNull(); // the model's answer is not the expected JSON
        assertThat(draft(auth, "kutyás kép " + script(null))).isNull(); // an honest "no ingredients"
        assertThat(draft(auth, script("Semmi", "valami", " "))).isNull(); // a line with no ingredient
    }

    @Test
    void testCooked_shouldRejectNeitherTextNorPhoto() {
        ResponseEntity<String> resp = cooked(ownerAuthHeaders(), "   ", String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(resp.getBody(), "text", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCooked_shouldRejectOverTotalBytes() {
        byte[] big = new byte[60_000]; // two of them pass the per-photo cap but not the 100 kB total of this IT

        ResponseEntity<String> resp = cooked(ownerAuthHeaders(), "rizs", String.class,
            photo(big, MediaType.IMAGE_JPEG, "1.jpg"), photo(big, MediaType.IMAGE_JPEG, "2.jpg"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(resp.getBody(), "photos", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCooked_shouldRejectTooManyOrUnusablePhotos() {
        HttpHeaders auth = ownerAuthHeaders();
        HttpEntity<?>[] seven = new HttpEntity<?>[7];
        for (int i = 0; i < seven.length; i++) {
            seven[i] = photo("x".getBytes(StandardCharsets.UTF_8), MediaType.IMAGE_JPEG, i + ".jpg");
        }

        ResponseEntity<String> tooMany = cooked(auth, "rizs", String.class, seven);
        ResponseEntity<String> gif = cooked(auth, "rizs", String.class,
            photo("GIF89a".getBytes(StandardCharsets.UTF_8), MediaType.IMAGE_GIF, "a.gif"));

        assertThat(tooMany.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(tooMany.getBody(), "photos", "VALIDATION_INVALID_VALUE");
        assertThat(gif.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(gif.getBody(), "photos", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCooked_shouldRequireAToken() {
        ResponseEntity<String> resp = cooked(new HttpHeaders(), "rizs", String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void testCooked_shouldWriteNothing() {
        HttpHeaders anna = registerUser("Anna").headers();
        HttpHeaders bela = registerUser("Béla").headers();
        createFood(anna, "Kölesgolyó", "g");
        createFood(anna, "Csirkemell filé friss", "g");
        Integer itemsBefore = jdbc.queryForObject("select count(*) from pantry_item", Integer.class);
        Integer catalogBefore = jdbc.queryForObject("select count(*) from pantry_catalog", Integer.class);

        RecipeImportDraft draft = draft(bela, script("Vegyes", "köles", "40 g kölesgolyó",
            "csirke", "300 g csirkemell", "kurkuma", "1 tk kurkuma"));

        assertThat(draft.getLines()).hasSize(3);
        assertThat(jdbc.queryForObject("select count(*) from pantry_item", Integer.class)).isEqualTo(itemsBefore);
        assertThat(jdbc.queryForObject("select count(*) from pantry_catalog", Integer.class)).isEqualTo(catalogBefore);
        assertThat(jdbc.queryForObject("select count(*) from recipe", Integer.class)).isZero();
    }
}
