package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutDetailResponse;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutNoteRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * The workout-level closing note (mezo-d20.8.2.2) — "Hogy ment?", one sentence about the whole
 * session, distinct from the per-exercise and per-set notes that were already real.
 *
 * <p>Two write paths with deliberately different semantics: the finish body is FILL-IF-EMPTY
 * (finishing is idempotent, so a re-finish or a bodyless retry must never wipe what was written),
 * while PUT .../note is last-write-wins and clears on blank.
 */
class WorkoutClosingNoteApiIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private WorkoutSessionEntity activeInstance(UUID owner) {
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        return trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "active");
    }

    private String noteOf(UUID workoutId) {
        return getForBody("/api/train/workouts/" + workoutId, ownerAuthHeaders(),
            HttpStatus.OK, WorkoutDetailResponse.class).getNote();
    }

    // ---------- finish body ----------

    @Test
    void testFinishWorkout_shouldPersistNote_whenBodyCarriesOne() {
        UUID owner = ownerId();
        WorkoutSessionEntity instance = activeInstance(owner);

        WorkoutInstanceResponse finished = postForBody(
            "/api/train/workouts/" + instance.getId() + "/finish",
            WorkoutNoteRequest.builder().note("Öt órát aludtam, mégis ment.").build(),
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(finished.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        assertThat(noteOf(instance.getId())).isEqualTo("Öt órát aludtam, mégis ment.");
    }

    @Test
    void testFinishWorkout_shouldStillComplete_whenNoBodyIsSent() {
        UUID owner = ownerId();
        WorkoutSessionEntity instance = activeInstance(owner);

        WorkoutInstanceResponse finished = postForBody(
            "/api/train/workouts/" + instance.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(finished.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        assertThat(noteOf(instance.getId())).isNull();
    }

    /** The honesty of an idempotent endpoint: finishing twice must not erase the first note. */
    @Test
    void testFinishWorkout_shouldKeepExistingNote_whenRefinishedWithoutOne() {
        UUID owner = ownerId();
        WorkoutSessionEntity instance = activeInstance(owner);
        postForBody("/api/train/workouts/" + instance.getId() + "/finish",
            WorkoutNoteRequest.builder().note("Ez maradjon meg.").build(),
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        postForBody("/api/train/workouts/" + instance.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);
        postForBody("/api/train/workouts/" + instance.getId() + "/finish",
            WorkoutNoteRequest.builder().note("").build(),
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(noteOf(instance.getId())).isEqualTo("Ez maradjon meg.");
    }

    @Test
    void testFinishWorkout_shouldReturn400_whenNoteExceedsMaxLength() {
        UUID owner = ownerId();
        WorkoutSessionEntity instance = activeInstance(owner);

        postForBody("/api/train/workouts/" + instance.getId() + "/finish",
            WorkoutNoteRequest.builder().note("x".repeat(1001)).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    // ---------- PUT .../note ----------

    @Test
    void testSaveWorkoutNote_shouldOverwrite_whenCalledAfterFinish() {
        UUID owner = ownerId();
        WorkoutSessionEntity instance = activeInstance(owner);
        postForBody("/api/train/workouts/" + instance.getId() + "/finish",
            WorkoutNoteRequest.builder().note("első változat").build(),
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        putForBody("/api/train/workouts/" + instance.getId() + "/note",
            WorkoutNoteRequest.builder().note("átírva utólag").build(),
            ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        assertThat(noteOf(instance.getId())).isEqualTo("átírva utólag");
    }

    /** A note can also be ADDED long after the fact — the review page's `＋ Jegyzet` path. */
    @Test
    void testSaveWorkoutNote_shouldAddNote_whenWorkoutWasFinishedWithout()  {
        UUID owner = ownerId();
        WorkoutSessionEntity instance = activeInstance(owner);
        postForBody("/api/train/workouts/" + instance.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        putForBody("/api/train/workouts/" + instance.getId() + "/note",
            WorkoutNoteRequest.builder().note("pótolva").build(),
            ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        assertThat(noteOf(instance.getId())).isEqualTo("pótolva");
    }

    @Test
    void testSaveWorkoutNote_shouldClear_whenNoteIsBlank() {
        UUID owner = ownerId();
        WorkoutSessionEntity instance = activeInstance(owner);
        putForBody("/api/train/workouts/" + instance.getId() + "/note",
            WorkoutNoteRequest.builder().note("törlendő").build(),
            ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        putForBody("/api/train/workouts/" + instance.getId() + "/note",
            WorkoutNoteRequest.builder().note("   ").build(),
            ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        assertThat(noteOf(instance.getId())).isNull();
    }

    @Test
    void testSaveWorkoutNote_shouldReturn400_whenNoteExceedsMaxLength() {
        UUID owner = ownerId();
        WorkoutSessionEntity instance = activeInstance(owner);

        putForBody("/api/train/workouts/" + instance.getId() + "/note",
            WorkoutNoteRequest.builder().note("x".repeat(1001)).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testSaveWorkoutNote_shouldReturn404_whenWorkoutIsUnknownOrATemplateRow() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");

        putForBody("/api/train/workouts/" + UUID.randomUUID() + "/note",
            WorkoutNoteRequest.builder().note("nincs ilyen").build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        putForBody("/api/train/workouts/" + template.getId() + "/note",
            WorkoutNoteRequest.builder().note("terv-sor").build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testSaveWorkoutNote_shouldReturn401_whenUnauthenticated() {
        putForBody("/api/train/workouts/" + UUID.randomUUID() + "/note",
            WorkoutNoteRequest.builder().note("névtelen").build(),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
