package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.CatalogImagesRequest;
import io.mrkuhne.mezo.api.dto.CatalogVideoRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * The multi-user permission matrix of the shared exercise catalog (S5, mezo-qw37.5):
 * master row content → 409 for everyone; master row media → OWNER only (403 otherwise);
 * user-authored row → its author or the OWNER (403 otherwise); plus the per-viewer flags
 * (editable / mediaEditable / authoredByMe / authorName) on the list.
 */
class ExerciseCatalogPermissionIT extends ApiIntegrationTest {

    private static final String VIDEO = "https://youtu.be/dQw4w9WgXcQ";

    private static CatalogExerciseCreateRequest request(String name) {
        return CatalogExerciseCreateRequest.builder()
            .name(name).muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.COMPOUND)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
    }

    private static CatalogVideoRequest video(String url) {
        return CatalogVideoRequest.builder().videoUrl(url).build();
    }

    // Carries the media fields through, mirroring what a well-behaved edit client (FE
    // mezo-qw37.5 fix-wave) must send on every update() call, since the service writes
    // imageStartUrl/imageEndUrl UNCONDITIONALLY — omitting them wipes the row's stills.
    private static CatalogExerciseCreateRequest requestWithMedia(String name, String imageStartUrl, String imageEndUrl) {
        return CatalogExerciseCreateRequest.builder()
            .name(name).muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.COMPOUND)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4))
            .imageStartUrl(imageStartUrl).imageEndUrl(imageEndUrl).build();
    }

    private ExerciseCatalogItem find(HttpHeaders viewer, UUID id) {
        return getForList("/api/train/exercises", viewer, HttpStatus.OK, ExerciseCatalogItem.class)
            .stream().filter(e -> id.equals(e.getId())).findFirst().orElseThrow();
    }

    private ExerciseCatalogItem master(HttpHeaders viewer, String slug) {
        return getForList("/api/train/exercises", viewer, HttpStatus.OK, ExerciseCatalogItem.class)
            .stream().filter(e -> slug.equals(e.getSlug())).findFirst().orElseThrow();
    }

    private ExerciseCatalogItem createAs(HttpHeaders author, String name) {
        return postForBody("/api/train/exercises", request(name), author, HttpStatus.CREATED, ExerciseCatalogItem.class);
    }

    // ---- master rows ----

    @Test
    void testSetVideo_shouldReturn403_whenUserTouchesMasterRow() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem boxJump = master(anna.headers(), "box-jump");
        String body = putForBody("/api/train/exercises/" + boxJump.getId() + "/video", video(VIDEO),
            anna.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "EXERCISE_CATALOG_NOT_EDITABLE");
    }

    @Test
    void testSetImages_shouldReturn403_whenUserTouchesMasterRow() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem boxJump = master(anna.headers(), "box-jump");
        CatalogImagesRequest req = CatalogImagesRequest.builder()
            .imageStartUrl("/exercises/box-jump-a.jpg").imageEndUrl("/exercises/box-jump-b.jpg").build();
        String body = putForBody("/api/train/exercises/" + boxJump.getId() + "/images", req,
            anna.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "EXERCISE_CATALOG_NOT_EDITABLE");
    }

    @Test
    void testUpdateAndDelete_shouldReturn409_whenUserTouchesMasterRow() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem boxJump = master(anna.headers(), "box-jump");
        String put = putForBody("/api/train/exercises/" + boxJump.getId(), request("x"),
            anna.headers(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(put, "CATALOG_MASTER_READONLY");
        String del = exchangeForBody(HttpMethod.DELETE, "/api/train/exercises/" + boxJump.getId(), null,
            anna.headers(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(del, "CATALOG_MASTER_READONLY");
    }

    @Test
    void testSetVideo_shouldReturn200_whenOwnerTouchesMasterRow() {
        HttpHeaders owner = ownerAuthHeaders();
        ExerciseCatalogItem boxJump = master(owner, "box-jump");
        try {
            ExerciseCatalogItem out = putForBody("/api/train/exercises/" + boxJump.getId() + "/video", video(VIDEO),
                owner, HttpStatus.OK, ExerciseCatalogItem.class);
            assertThat(out.getVideoUrl()).isEqualTo(VIDEO);
            assertThat(out.getEditable()).isFalse();
            assertThat(out.getMediaEditable()).isTrue();
        } finally {
            // box-jump is a master row ResetDatabase never cleans — clear the residue on every
            // path, so a failed assertion above cannot leak the video into later tests.
            putForBody("/api/train/exercises/" + boxJump.getId() + "/video", video(null), owner, HttpStatus.OK, ExerciseCatalogItem.class);
        }
    }

    // ---- user-authored rows ----

    @Test
    void testUpdateAndSetVideoAndImages_shouldReturn200_whenUserTouchesOwnRow() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem mine = createAs(anna.headers(), "Anna Move");
        ExerciseCatalogItem updated = putForBody("/api/train/exercises/" + mine.getId(), request("Anna Move v2"),
            anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(updated.getName()).isEqualTo("Anna Move v2");
        ExerciseCatalogItem withVideo = putForBody("/api/train/exercises/" + mine.getId() + "/video", video(VIDEO),
            anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(withVideo.getVideoUrl()).isEqualTo(VIDEO);
        CatalogImagesRequest imagesReq = CatalogImagesRequest.builder()
            .imageStartUrl("/exercises/anna-move-a.jpg").imageEndUrl("/exercises/anna-move-b.jpg").build();
        ExerciseCatalogItem withImages = putForBody("/api/train/exercises/" + mine.getId() + "/images", imagesReq,
            anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(withImages.getImageStartUrl()).isEqualTo("/exercises/anna-move-a.jpg");
        assertThat(withImages.getImageEndUrl()).isEqualTo("/exercises/anna-move-b.jpg");
        deleteAndExpect("/api/train/exercises/" + mine.getId(), anna.headers(), HttpStatus.NO_CONTENT);
    }

    @Test
    void testUpdateDeleteAndMedia_shouldReturn403_whenUserTouchesOtherUsersRow() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        ExerciseCatalogItem annas = createAs(anna.headers(), "Anna Move");

        String put = putForBody("/api/train/exercises/" + annas.getId(), request("hijack"),
            bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(put, "EXERCISE_CATALOG_NOT_EDITABLE");
        String del = exchangeForBody(HttpMethod.DELETE, "/api/train/exercises/" + annas.getId(), null,
            bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(del, "EXERCISE_CATALOG_NOT_EDITABLE");
        String vid = putForBody("/api/train/exercises/" + annas.getId() + "/video", video(VIDEO),
            bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(vid, "EXERCISE_CATALOG_NOT_EDITABLE");
        String img = putForBody("/api/train/exercises/" + annas.getId() + "/images",
            CatalogImagesRequest.builder().imageStartUrl("/x-a.jpg").imageEndUrl("/x-b.jpg").build(),
            bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(img, "EXERCISE_CATALOG_NOT_EDITABLE");

        // Nothing leaked through: the row is unchanged for its author.
        assertThat(find(anna.headers(), annas.getId()).getName()).isEqualTo("Anna Move");
    }

    @Test
    void testOwner_shouldReturn200_whenTouchingAnotherUsersRow() {
        RegisteredUser anna = registerUser("Anna");
        HttpHeaders owner = ownerAuthHeaders();
        ExerciseCatalogItem annas = createAs(anna.headers(), "Anna Move");

        ExerciseCatalogItem updated = putForBody("/api/train/exercises/" + annas.getId(), request("Curated by owner"),
            owner, HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(updated.getName()).isEqualTo("Curated by owner");
        assertThat(updated.getAuthoredByMe()).isFalse();
        assertThat(updated.getAuthorName()).isEqualTo("Anna");
        putForBody("/api/train/exercises/" + annas.getId() + "/video", video(VIDEO), owner, HttpStatus.OK, ExerciseCatalogItem.class);
        deleteAndExpect("/api/train/exercises/" + annas.getId(), owner, HttpStatus.NO_CONTENT);
    }

    // Regression (mezo-qw37.5 fix-wave): update() writes imageStartUrl/imageEndUrl
    // UNCONDITIONALLY (intentional — it's how a client clears a still by sending null),
    // so any edit body that omits them wipes the row's demo stills. This slice newly lets
    // the OWNER edit another user's row, so an owner-driven update must carry the row's
    // existing media through — pin that contract here, not just the FE code that relies on it.
    @Test
    void testOwner_shouldPreserveMedia_whenUpdatingAnotherUsersRowWithMediaCarriedThrough() {
        RegisteredUser anna = registerUser("Anna");
        HttpHeaders owner = ownerAuthHeaders();
        ExerciseCatalogItem annas = createAs(anna.headers(), "Anna Move");
        putForBody("/api/train/exercises/" + annas.getId() + "/images",
            CatalogImagesRequest.builder().imageStartUrl("/exercises/anna-move-a.jpg").imageEndUrl("/exercises/anna-move-b.jpg").build(),
            anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class);

        ExerciseCatalogItem updated = putForBody("/api/train/exercises/" + annas.getId(),
            requestWithMedia("Curated by owner", "/exercises/anna-move-a.jpg", "/exercises/anna-move-b.jpg"),
            owner, HttpStatus.OK, ExerciseCatalogItem.class);

        assertThat(updated.getName()).isEqualTo("Curated by owner");
        assertThat(updated.getImageStartUrl()).isEqualTo("/exercises/anna-move-a.jpg");
        assertThat(updated.getImageEndUrl()).isEqualTo("/exercises/anna-move-b.jpg");
        // Also confirmed on a fresh read, not just the mutation's own response.
        ExerciseCatalogItem reread = find(anna.headers(), annas.getId());
        assertThat(reread.getImageStartUrl()).isEqualTo("/exercises/anna-move-a.jpg");
        assertThat(reread.getImageEndUrl()).isEqualTo("/exercises/anna-move-b.jpg");
    }

    @Test
    void testAnyWrite_shouldReturn404_whenIdUnknown() {
        RegisteredUser anna = registerUser("Anna");
        UUID ghost = UUID.randomUUID();
        putForBody("/api/train/exercises/" + ghost, request("x"), anna.headers(), HttpStatus.NOT_FOUND, String.class);
        putForBody("/api/train/exercises/" + ghost + "/video", video(VIDEO), anna.headers(), HttpStatus.NOT_FOUND, String.class);
        putForBody("/api/train/exercises/" + ghost, request("x"), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    // ---- the per-viewer flags on the list ----

    @Test
    void testList_shouldCarryViewerPermissions_whenThreeAccountsLookAtTheSameRows() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        HttpHeaders owner = ownerAuthHeaders();
        UUID annasId = createAs(anna.headers(), "Anna Move").getId();

        ExerciseCatalogItem asAnna = find(anna.headers(), annasId);
        assertThat(asAnna.getAuthoredByMe()).isTrue();
        assertThat(asAnna.getAuthorName()).isEqualTo("Anna");
        assertThat(asAnna.getEditable()).isTrue();
        assertThat(asAnna.getMediaEditable()).isTrue();

        ExerciseCatalogItem asBela = find(bela.headers(), annasId);
        assertThat(asBela.getAuthoredByMe()).isFalse();
        assertThat(asBela.getAuthorName()).isEqualTo("Anna");
        assertThat(asBela.getEditable()).isFalse();
        assertThat(asBela.getMediaEditable()).isFalse();

        ExerciseCatalogItem asOwner = find(owner, annasId);
        assertThat(asOwner.getAuthoredByMe()).isFalse();
        assertThat(asOwner.getAuthorName()).isEqualTo("Anna");
        assertThat(asOwner.getEditable()).isTrue();
        assertThat(asOwner.getMediaEditable()).isTrue();

        ExerciseCatalogItem masterAsBela = master(bela.headers(), "box-jump");
        assertThat(masterAsBela.getAuthoredByMe()).isFalse();
        assertThat(masterAsBela.getAuthorName()).isNull();
        assertThat(masterAsBela.getEditable()).isFalse();
        assertThat(masterAsBela.getMediaEditable()).isFalse();

        ExerciseCatalogItem masterAsOwner = master(owner, "box-jump");
        assertThat(masterAsOwner.getEditable()).isFalse();
        assertThat(masterAsOwner.getMediaEditable()).isTrue();
    }

    @Test
    void testList_shouldShowEveryUsersRows_whenTwoUsersAuthor() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        UUID annasId = createAs(anna.headers(), "Anna Move").getId();
        UUID belasId = createAs(bela.headers(), "Béla Move").getId();
        assertThat(getForList("/api/train/exercises", anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class))
            .extracting(ExerciseCatalogItem::getId).contains(annasId, belasId);
        assertThat(getForList("/api/train/exercises", bela.headers(), HttpStatus.OK, ExerciseCatalogItem.class))
            .extracting(ExerciseCatalogItem::getId).contains(annasId, belasId);
    }
}
