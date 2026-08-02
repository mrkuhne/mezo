package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.SetUpdateRequest;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutSkipRequest;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
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

/** PUT/DELETE on a single logged set of an ACTIVE instance (mezo-l3on). */
class WorkoutSetMutationIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ExerciseSetRepository exerciseSetRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private WorkoutSessionEntity templateDayForToday(UUID owner) {
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Set-mutation meso", "active");
        return trainPopulator.createWorkoutSession(
            owner, meso.getId(), WorkoutServiceIT.todayLabel(), "Pull Day", 0, "planned");
    }

    private WorkoutInstanceResponse start(WorkoutSessionEntity template, HttpHeaders headers) {
        return postForBody("/api/train/workouts",
            WorkoutStartRequest.builder().templateSessionId(template.getId()).build(),
            headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);
    }

    private ExerciseSetResponse logSet(
        UUID workoutId, UUID exerciseId, int setIndex, String weight, int reps, HttpHeaders headers
    ) {
        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(exerciseId).setIndex(setIndex)
            .weightKg(new BigDecimal(weight)).reps(reps).rir(2).build();
        return postForBody("/api/train/workouts/" + workoutId + "/sets",
            req, headers, HttpStatus.CREATED, ExerciseSetResponse.class);
    }

    private static SetUpdateRequest update(String weight, int reps, Integer rir) {
        return SetUpdateRequest.builder()
            .weightKg(new BigDecimal(weight)).reps(reps).rir(rir).build();
    }

    @Test
    void testUpdateSet_shouldOverwritePerformanceFields_whenOwnedActiveInstance() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        // Log WITH a target* prescription snapshot so the "immutable fields survive" assertions
        // below are non-vacuous (a null target left null would prove nothing).
        SetLogRequest original = SetLogRequest.builder()
            .exerciseId(exercise.getId()).setIndex(0)
            .weightKg(new BigDecimal("80")).reps(10).rir(2)
            .targetWeightKg(new BigDecimal("77.5")).targetReps(12)
            .build();
        ExerciseSetResponse logged = postForBody("/api/train/workouts/" + started.getId() + "/sets",
            original, headers, HttpStatus.CREATED, ExerciseSetResponse.class);

        ExerciseSetResponse updated = putForBody(
            "/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            update("82.5", 8, 1), headers, HttpStatus.OK, ExerciseSetResponse.class);

        assertThat(updated.getId()).isEqualTo(logged.getId());
        assertThat(updated.getWeightKg()).isEqualByComparingTo(new BigDecimal("82.5"));
        assertThat(updated.getReps()).isEqualTo(8);
        assertThat(updated.getRir()).isEqualTo(1);
        // Immutable fields survive the overwrite.
        assertThat(updated.getSetIndex()).isEqualTo(0);
        assertThat(updated.getKind()).isEqualTo(ExerciseSetResponse.KindEnum.WORKING);
        assertThat(updated.getExerciseId()).isEqualTo(exercise.getId());
        // The target* prescription snapshot isn't on the response DTO at all — the only way to
        // prove it survived untouched is reading the persisted row back.
        ExerciseSetEntity persisted = exerciseSetRepository.findById(updated.getId()).orElseThrow();
        assertThat(persisted.getExerciseId()).isEqualTo(exercise.getId());
        assertThat(persisted.getTargetWeightKg()).isEqualByComparingTo(new BigDecimal("77.5"));
        assertThat(persisted.getTargetReps()).isEqualTo(12);
    }

    @Test
    void testUpdateSet_shouldClearOptionalFields_whenAbsentFromRequest() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        SetLogRequest withExtras = SetLogRequest.builder()
            .exerciseId(exercise.getId()).setIndex(0)
            .weightKg(new BigDecimal("80")).reps(10).rir(2)
            .side("L").note("felt strong").build();
        ExerciseSetResponse logged = postForBody("/api/train/workouts/" + started.getId() + "/sets",
            withExtras, headers, HttpStatus.CREATED, ExerciseSetResponse.class);

        // Full replacement, not a patch (spec D7): update()'s SetUpdateRequest omits side/note
        // entirely, which must CLEAR them rather than leave the previously-logged values in place.
        putForBody("/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            update("82.5", 8, 1), headers, HttpStatus.OK, ExerciseSetResponse.class);

        ExerciseSetEntity persisted = exerciseSetRepository.findById(logged.getId()).orElseThrow();
        assertThat(persisted.getSide()).isNull();
        assertThat(persisted.getNote()).isNull();
    }

    @Test
    void testUpdateSet_shouldForceNullRir_whenWarmupSet() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        SetLogRequest warm = SetLogRequest.builder().exerciseId(exercise.getId()).setIndex(0)
            .weightKg(new BigDecimal("40")).reps(12).build();
        warm.setKind("warmup");
        ExerciseSetResponse logged = postForBody("/api/train/workouts/" + started.getId() + "/sets",
            warm, headers, HttpStatus.CREATED, ExerciseSetResponse.class);

        ExerciseSetResponse updated = putForBody(
            "/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            update("42.5", 10, 3), headers, HttpStatus.OK, ExerciseSetResponse.class);

        assertThat(updated.getReps()).isEqualTo(10);
        assertThat(updated.getRir()).isNull();
    }

    @Test
    void testUpdateSet_shouldReturn400_whenRepsOutOfRange() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        ExerciseSetResponse logged = logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);

        putForBody("/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            update("80", 0, 2), headers, HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testUpdateSet_shouldReturn404_whenSetUnknown() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);

        String body = putForBody(
            "/api/train/workouts/" + started.getId() + "/sets/" + UUID.randomUUID(),
            update("80", 8, 2), headers, HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testUpdateSet_shouldReturn404_whenSetIsSkipMarker() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        postForBody("/api/train/workouts/" + started.getId() + "/skip",
            WorkoutSkipRequest.builder().exerciseId(exercise.getId()).build(),
            headers, HttpStatus.NO_CONTENT, String.class);
        // No read endpoint exposes a skip marker (getWorkoutDetail filters it out of each exercise's
        // sets, mirroring the write-side guard under test) — look it up directly to get its id.
        UUID markerId = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(owner, started.getId())
            .stream().filter(ExerciseSetEntity::isSkipped).findFirst()
            .orElseThrow(() -> new IllegalStateException("expected a skip marker row")).getId();

        putForBody("/api/train/workouts/" + started.getId() + "/sets/" + markerId,
            update("80", 8, 2), headers, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testUpdateSet_shouldReturn409_whenWorkoutCompleted() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        ExerciseSetResponse logged = logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);
        postForBody("/api/train/workouts/" + started.getId() + "/finish",
            null, headers, HttpStatus.OK, WorkoutInstanceResponse.class);

        String body = putForBody(
            "/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            update("80", 8, 2), headers, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "TRAIN_WORKOUT_NOT_ACTIVE");
    }

    @Test
    void testDeleteSet_shouldRemoveRowAndRenumberRemaining_whenMiddleSetDeleted() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);
        ExerciseSetResponse second = logSet(started.getId(), exercise.getId(), 1, "82.5", 9, headers);
        logSet(started.getId(), exercise.getId(), 2, "85", 8, headers);

        deleteAndExpect("/api/train/workouts/" + started.getId() + "/sets/" + second.getId(),
            headers, HttpStatus.NO_CONTENT);

        WorkoutInstanceResponse after = postForBody("/api/train/workouts/" + started.getId() + "/finish",
            null, headers, HttpStatus.OK, WorkoutInstanceResponse.class);
        List<ExerciseSetResponse> sets = after.getSets();
        assertThat(sets).hasSize(2);
        assertThat(sets).extracting(ExerciseSetResponse::getSetIndex).containsExactly(0, 1);
        assertThat(sets).extracting(ExerciseSetResponse::getWeightKg)
            .containsExactly(new BigDecimal("80.00"), new BigDecimal("85.00"));
    }

    @Test
    void testDeleteSet_shouldFreeTheIndex_whenANewSetIsLoggedAfterwards() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);
        ExerciseSetResponse second = logSet(started.getId(), exercise.getId(), 1, "82.5", 9, headers);

        deleteAndExpect("/api/train/workouts/" + started.getId() + "/sets/" + second.getId(),
            headers, HttpStatus.NO_CONTENT);
        logSet(started.getId(), exercise.getId(), 1, "90", 6, headers);

        WorkoutInstanceResponse after = postForBody("/api/train/workouts/" + started.getId() + "/finish",
            null, headers, HttpStatus.OK, WorkoutInstanceResponse.class);
        assertThat(after.getSets()).extracting(ExerciseSetResponse::getSetIndex).containsExactly(0, 1);
    }

    @Test
    void testDeleteSet_shouldReturn404_whenSetUnknown() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);

        // The shared ownedActiveSetOrThrow guard backs both PUT and DELETE — prove it on this path
        // too, mirroring testUpdateSet_shouldReturn404_whenSetUnknown.
        String body = exchangeForBody(HttpMethod.DELETE,
            "/api/train/workouts/" + started.getId() + "/sets/" + UUID.randomUUID(),
            null, headers, HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testDeleteSet_shouldReturn409_whenWorkoutCompleted() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        ExerciseSetResponse logged = logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);
        postForBody("/api/train/workouts/" + started.getId() + "/finish",
            null, headers, HttpStatus.OK, WorkoutInstanceResponse.class);

        deleteAndExpect("/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            headers, HttpStatus.CONFLICT);
    }

    @Test
    void testDeleteSet_shouldReturn401_whenUnauthenticated() {
        deleteAndExpect("/api/train/workouts/" + UUID.randomUUID() + "/sets/" + UUID.randomUUID(),
            null, HttpStatus.UNAUTHORIZED);
    }
}
