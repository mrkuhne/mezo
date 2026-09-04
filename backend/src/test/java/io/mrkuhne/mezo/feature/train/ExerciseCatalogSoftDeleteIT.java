package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Deleting a shared catalog row is a SOFT delete (spec §9): it vanishes from every user's list
 * and from by-id reads, its slug stays occupied, and another user's exercise.catalog_id link to
 * it survives untouched (the ON DELETE SET NULL FK only fires on a physical delete, which never
 * happens on this table).
 */
class ExerciseCatalogSoftDeleteIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator train;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private ExerciseRepository exerciseRepository;

    private static CatalogExerciseCreateRequest request(String name) {
        return CatalogExerciseCreateRequest.builder()
            .name(name).muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.COMPOUND)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
    }

    @Test
    void testDelete_shouldHideRowEverywhereButKeepOtherUsersLink_whenAuthorDeletes() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        ExerciseCatalogItem annas = postForBody("/api/train/exercises", request("Anna Move"),
            anna.headers(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        UUID catalogId = annas.getId();

        // Béla planned Anna's exercise into his own mesocycle (the link every user may make).
        MesocycleEntity meso = train.createMesocycle(bela.id(), "Béla meso", "active");
        WorkoutSessionEntity day = train.createWorkoutSession(bela.id(), meso.getId(), "Hétfő", "push", 0, "active");
        ExerciseEntity linked = train.createExercise(bela.id(), day.getId(), "Anna Move", 0, "quad", "compound", catalogId);

        deleteAndExpect("/api/train/exercises/" + catalogId, anna.headers(), HttpStatus.NO_CONTENT);

        // Hidden from every viewer's list and from by-id reads (Hibernate @SQLRestriction)…
        assertThat(getForList("/api/train/exercises", anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class))
            .extracting(ExerciseCatalogItem::getId).doesNotContain(catalogId);
        assertThat(getForList("/api/train/exercises", bela.headers(), HttpStatus.OK, ExerciseCatalogItem.class))
            .extracting(ExerciseCatalogItem::getId).doesNotContain(catalogId);
        assertThat(catalogRepository.findById(catalogId)).isEmpty();
        assertThat(catalogRepository.existsById(catalogId)).isFalse();
        // …a further write on it is a 404 even for its author…
        putForBody("/api/train/exercises/" + catalogId, request("zombie"), anna.headers(), HttpStatus.NOT_FOUND, String.class);
        // …the physical row (and its slug) is still there…
        assertThat(catalogRepository.countAllBySlugIncludingDeleted(annas.getSlug())).isEqualTo(1);
        // …and Béla's plan still points at it — no SET NULL, no orphaned history.
        assertThat(exerciseRepository.findById(linked.getId()).orElseThrow().getCatalogId()).isEqualTo(catalogId);
    }

    @Test
    void testCreate_shouldNotReuseSlug_whenSameNameRecreatedAfterDelete() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem first = postForBody("/api/train/exercises", request("Phoenix Move"),
            anna.headers(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        deleteAndExpect("/api/train/exercises/" + first.getId(), anna.headers(), HttpStatus.NO_CONTENT);
        ExerciseCatalogItem second = postForBody("/api/train/exercises", request("Phoenix Move"),
            anna.headers(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        assertThat(first.getSlug()).isEqualTo("phoenix-move");
        assertThat(second.getSlug()).isEqualTo("phoenix-move-2"); // the soft-deleted row keeps its slug
    }

    @Test
    void testWrite_shouldReturn404ResourceNotFound_whenRowWasSoftDeleted() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem annas = postForBody("/api/train/exercises", request("Ghost Move"),
            anna.headers(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        UUID catalogId = annas.getId();
        deleteAndExpect("/api/train/exercises/" + catalogId, anna.headers(), HttpStatus.NO_CONTENT);

        String authorAttempt = putForBody("/api/train/exercises/" + catalogId, request("still ghost"),
            anna.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(authorAttempt, "RESOURCE_NOT_FOUND");

        String ownerAttempt = putForBody("/api/train/exercises/" + catalogId, request("still ghost"),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(ownerAttempt, "RESOURCE_NOT_FOUND");
    }
}
