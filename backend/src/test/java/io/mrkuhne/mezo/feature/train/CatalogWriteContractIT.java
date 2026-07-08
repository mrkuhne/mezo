package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.CatalogVideoRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract tests for the catalog write endpoints: creating a user-authored row (editable,
 * slug generated), master rows staying read-only (409 CATALOG_MASTER_READONLY), and attaching a demo
 * video to any row (master stays non-editable).
 */
class CatalogWriteContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator train;

    @Test
    void testCreateExercise_shouldReturnEditableUserRow_whenValid() {
        CatalogExerciseCreateRequest req = CatalogExerciseCreateRequest.builder()
            .name("DB Jump Squat").muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.PLYO)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
        ExerciseCatalogItem body = postForBody(
            "/api/train/exercises", req, ownerAuthHeaders(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        assertThat(body.getEditable()).isTrue();
        assertThat(body.getSlug()).startsWith("db-jump-squat");
    }

    @Test
    void testUpdateMasterExercise_shouldReturn409_whenMasterReadonly() {
        HttpHeaders auth = ownerAuthHeaders();
        ExerciseCatalogItem boxJump = getForList("/api/train/exercises", auth, HttpStatus.OK, ExerciseCatalogItem.class)
            .stream().filter(e -> "box-jump".equals(e.getSlug())).findFirst().orElseThrow();
        CatalogExerciseCreateRequest req = CatalogExerciseCreateRequest.builder()
            .name("x").muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.PLYO)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
        String body = putForBody(
            "/api/train/exercises/" + boxJump.getId(), req, auth, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "CATALOG_MASTER_READONLY");
    }

    @Test
    void testSetVideo_shouldAttachToMaster_whenAnyRow() {
        HttpHeaders auth = ownerAuthHeaders();
        ExerciseCatalogItem boxJump = getForList("/api/train/exercises", auth, HttpStatus.OK, ExerciseCatalogItem.class)
            .stream().filter(e -> "box-jump".equals(e.getSlug())).findFirst().orElseThrow();
        CatalogVideoRequest vidReq = CatalogVideoRequest.builder().videoUrl("https://youtu.be/abc").build();
        ExerciseCatalogItem out = putForBody(
            "/api/train/exercises/" + boxJump.getId() + "/video", vidReq, auth, HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(out.getVideoUrl()).isEqualTo("https://youtu.be/abc");
        assertThat(out.getEditable()).isFalse(); // master stays non-editable

        // box-jump is a master row ResetDatabase never cleans — clear the video so no cross-test residue.
        CatalogVideoRequest clear = CatalogVideoRequest.builder().videoUrl(null).build();
        putForBody("/api/train/exercises/" + boxJump.getId() + "/video", clear, auth, HttpStatus.OK, ExerciseCatalogItem.class);
    }

    @Test
    void testDeleteMasterExercise_shouldReturn409_whenMasterReadonly() {
        HttpHeaders auth = ownerAuthHeaders();
        ExerciseCatalogItem boxJump = getForList("/api/train/exercises", auth, HttpStatus.OK, ExerciseCatalogItem.class)
            .stream().filter(e -> "box-jump".equals(e.getSlug())).findFirst().orElseThrow();
        String body = exchangeForBody(
            HttpMethod.DELETE, "/api/train/exercises/" + boxJump.getId(), null, auth, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "CATALOG_MASTER_READONLY");
    }

    @Test
    void testUpdateForeignUserExercise_shouldReturn404_whenNotOwner() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID otherUserId = databasePopulator.populateUser("other@example.com");
        ExerciseCatalogEntity foreign = train.createUserCatalogExercise(otherUserId, "Foreign Move", "quad", "plyo");
        CatalogExerciseCreateRequest req = CatalogExerciseCreateRequest.builder()
            .name("x").muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.PLYO)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
        putForBody("/api/train/exercises/" + foreign.getId(), req, auth, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDeleteOwnedExercise_shouldSoftDelete_whenOwner() {
        HttpHeaders auth = ownerAuthHeaders();
        CatalogExerciseCreateRequest req = CatalogExerciseCreateRequest.builder()
            .name("My Delete Move").muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.PLYO)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
        ExerciseCatalogItem created = postForBody(
            "/api/train/exercises", req, auth, HttpStatus.CREATED, ExerciseCatalogItem.class);

        deleteAndExpect("/api/train/exercises/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        List<ExerciseCatalogItem> after = getForList("/api/train/exercises", auth, HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(after).extracting(ExerciseCatalogItem::getId).doesNotContain(created.getId());
    }
}
