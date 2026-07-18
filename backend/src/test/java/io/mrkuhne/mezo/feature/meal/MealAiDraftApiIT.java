package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealAiDraftResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/**
 * HTTP-level suite for {@code POST /api/meal/ai-draft} (mezo-78rn): drives the real multipart
 * plumbing + {@code MealAiDraftController} → {@code MealAiDraftService} against the deterministic
 * {@code FakeCompanionLlm}. The {@code [fake-meal:{json}]} sentinel is echoed verbatim by the fake
 * — planted in the {@code text} field (text path) or in the UTF-8 photo bytes (multimodal path) —
 * so the canned LLM answer flows through parse → catalog-match → response without a model.
 *
 * <p>The photo size cap is shrunk to the {@code @Min(10_000)} floor via {@code @TestPropertySource}
 * so the oversized-photo test's payload (20 kB) trips the SERVICE cap while staying well under the
 * 6 MB {@code spring.servlet.multipart.max-file-size} container cap (mezo-78rn) — the container cap
 * is deliberately raised above the 5 MB app cap so the message-bearing SERVICE check is the effective
 * limit, and the container-cap path is proven separately by {@code MealAiUploadLimitApiIT}. Every
 * other test here sends a sub-kilobyte payload, so the shrunk cap is inert for them.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.meal-ai-log.max-photo-bytes=10000")
class MealAiDraftApiIT extends ApiIntegrationTest {

    private static final String PATH = "/api/meal/ai-draft";

    @Test
    void testDraft_shouldReturnDraft_whenTextCarriesSentinel() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("text", "latte [fake-meal:{\"slot\":\"snack\",\"title\":null,\"note\":null,"
                + "\"items\":[{\"pantryItemId\":null,\"recipeId\":null,\"name\":\"Latte\","
                + "\"amount\":1,\"unit\":\"db\",\"kcal\":120,\"proteinG\":6,\"carbsG\":10,\"fatG\":6}]}]");

        ResponseEntity<MealAiDraftResponse> res = postMultipartForResponse(PATH, parts, MealAiDraftResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().getSlot()).isEqualTo("snack");
        assertThat(res.getBody().getItems()).hasSize(1);
        assertThat(res.getBody().getItems().getFirst().getSource()).isEqualTo("estimate");
    }

    @Test
    void testDraft_shouldReturnDraft_whenPhotoBytesCarrySentinel() {
        byte[] fakeJpeg = "[fake-meal:{\"slot\":\"dinner\",\"title\":null,\"note\":null,\"items\":[]}]"
                .getBytes(StandardCharsets.UTF_8);
        HttpHeaders photoHeaders = new HttpHeaders();
        photoHeaders.setContentType(MediaType.IMAGE_JPEG);

        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("photo", new HttpEntity<>(photoPart(fakeJpeg, "meal.jpg"), photoHeaders));

        ResponseEntity<MealAiDraftResponse> res = postMultipartForResponse(PATH, parts, MealAiDraftResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().getSlot()).isEqualTo("dinner");
        assertThat(res.getBody().getItems()).isEmpty(); // honest empty — nothing recognized
    }

    @Test
    void testDraft_should400_whenNeitherTextNorPhoto() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(res.getBody(), "MEAL_AI_INPUT_REQUIRED");
    }

    @Test
    void testDraft_should400_whenPhotoMimeNotAllowed() {
        HttpHeaders photoHeaders = new HttpHeaders();
        photoHeaders.setContentType(MediaType.APPLICATION_PDF);

        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("photo", new HttpEntity<>(photoPart(new byte[] {1, 2, 3}, "x.pdf"), photoHeaders));

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "photo", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testDraft_should400_whenPhotoTooLarge() {
        // 20 kB payload > the shrunk 10 kB service cap (max-photo-bytes above), but < the 6 MB
        // multipart container cap — so the SERVICE cap fires, not the container. A valid image MIME so
        // the size check (which precedes the MIME check) is the thing under test.
        byte[] oversized = new byte[20_000];
        HttpHeaders photoHeaders = new HttpHeaders();
        photoHeaders.setContentType(MediaType.IMAGE_PNG);

        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("photo", new HttpEntity<>(photoPart(oversized, "big.png"), photoHeaders));

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "photo", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testDraft_should502_whenLlmAnswerUnparseable() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("text", "no sentinel here"); // fake echoes the prompt -> unparseable -> 502

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(res.getBody(), "MEAL_AI_EXTRACT_FAILED");
    }
}
