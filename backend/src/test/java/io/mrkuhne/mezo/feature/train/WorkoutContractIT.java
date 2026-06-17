package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseNoteRequest;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.WorkoutFeedbackInput;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutSkipRequest;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED T2 workout contract (api/openapi.yml). */
class WorkoutContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private WorkoutSessionEntity templateDayForToday(UUID owner) {
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Contract T2 meso", "active");
        return trainPopulator.createWorkoutSession(
            owner, meso.getId(), WorkoutServiceIT.todayLabel(), "Pull Day", 0, "planned");
    }

    private static WorkoutStartRequest start(WorkoutSessionEntity template) {
        return WorkoutStartRequest.builder().templateSessionId(template.getId()).build();
    }

    @Test
    void testGetTodayWorkout_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/workouts/today", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testStartWorkout_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/workouts",
            WorkoutStartRequest.builder().templateSessionId(UUID.randomUUID()).build(),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testLogWorkoutSet_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/workouts/" + UUID.randomUUID() + "/sets",
            SetLogRequest.builder().exerciseId(UUID.randomUUID()).setIndex(0)
                .weightKg(new BigDecimal("100")).reps(8).rir(1).build(),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testSaveWorkoutFeedback_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/workouts/" + UUID.randomUUID() + "/feedback",
            List.of(WorkoutFeedbackInput.builder().exerciseId(UUID.randomUUID())
                .pump(3).jointPain(1).workload(2).build()),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testFinishWorkout_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/workouts/" + UUID.randomUUID() + "/finish", null,
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetTodayWorkout_shouldReturnTodayContext_whenGymDayExists() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        trainPopulator.createExercise(owner, template.getId(), "Chest Supported Row", 0);

        WorkoutTodayResponse today = getForBody("/api/train/workouts/today",
            ownerAuthHeaders(), HttpStatus.OK, WorkoutTodayResponse.class);

        assertThat(today.getTemplateSessionId()).isEqualTo(template.getId());
        assertThat(today.getTitle()).isEqualTo("Pull Day");
        assertThat(today.getExercises()).hasSize(1);
    }

    @Test
    void testStartWorkout_shouldReturn201AndResumeOnSecondCall_whenTemplateOwned() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();

        WorkoutInstanceResponse first = postForBody("/api/train/workouts",
            start(template), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);
        WorkoutInstanceResponse second = postForBody("/api/train/workouts",
            start(template), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);

        assertThat(first.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.ACTIVE);
        assertThat(second.getId()).isEqualTo(first.getId());
    }

    @Test
    void testStartWorkout_shouldReturn404_whenTemplateUnknown() {
        ownerId();
        String body = postForBody("/api/train/workouts",
            WorkoutStartRequest.builder().templateSessionId(UUID.randomUUID()).build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testLogWorkoutSet_shouldReturn400WithFieldError_whenRepsMissing() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = postForBody("/api/train/workouts",
            start(template), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);

        SetLogRequest invalid = SetLogRequest.builder().exerciseId(exercise.getId()).setIndex(0)
            .weightKg(new BigDecimal("100")).rir(1).build(); // reps missing
        String body = postForBody("/api/train/workouts/" + started.getId() + "/sets",
            invalid, headers, HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "reps", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testLogWorkoutSet_shouldReturn409_whenWorkoutCompleted() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        WorkoutSessionEntity completed =
            trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "completed");

        String body = postForBody("/api/train/workouts/" + completed.getId() + "/sets",
            SetLogRequest.builder().exerciseId(exercise.getId()).setIndex(0)
                .weightKg(new BigDecimal("100")).reps(8).rir(1).build(),
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "TRAIN_WORKOUT_NOT_ACTIVE");
    }

    @Test
    void testSaveWorkoutFeedback_shouldReturn400WithFieldError_whenPumpOutOfRange() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = postForBody("/api/train/workouts",
            start(template), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);

        String body = postForBody("/api/train/workouts/" + started.getId() + "/feedback",
            List.of(WorkoutFeedbackInput.builder().exerciseId(exercise.getId())
                .pump(5).jointPain(1).workload(2).build()),
            headers, HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "pump", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testSkipWorkoutExercise_shouldReturn204_whenExerciseInActiveInstance() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = postForBody("/api/train/workouts",
            start(template), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);

        postForBody("/api/train/workouts/" + started.getId() + "/skip",
            WorkoutSkipRequest.builder().exerciseId(exercise.getId()).build(),
            headers, HttpStatus.NO_CONTENT, Void.class);
    }

    @Test
    void testSkipWorkoutExercise_shouldReturn404_whenExerciseForeign() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        WorkoutSessionEntity otherDay = trainPopulator.createWorkoutSession(
            owner, template.getMesocycleId(), "Pén", "Push Day", 1, "planned");
        ExerciseEntity foreign = trainPopulator.createExercise(owner, otherDay.getId(), "Bench", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = postForBody("/api/train/workouts",
            start(template), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);

        String body = postForBody("/api/train/workouts/" + started.getId() + "/skip",
            WorkoutSkipRequest.builder().exerciseId(foreign.getId()).build(),
            headers, HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testSkipWorkoutExercise_shouldReturn409_whenWorkoutCompleted() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        WorkoutSessionEntity completed =
            trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "completed");

        String body = postForBody("/api/train/workouts/" + completed.getId() + "/skip",
            WorkoutSkipRequest.builder().exerciseId(exercise.getId()).build(),
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "TRAIN_WORKOUT_NOT_ACTIVE");
    }

    @Test
    void testSkipWorkoutExercise_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/workouts/" + UUID.randomUUID() + "/skip",
            WorkoutSkipRequest.builder().exerciseId(UUID.randomUUID()).build(),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testSaveExerciseNote_shouldReturn204AndSurfaceOnToday_whenOwnedExercise() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();

        putForBody("/api/train/exercises/" + exercise.getId() + "/note",
            ExerciseNoteRequest.builder().note("dropset az utolsón").build(),
            headers, HttpStatus.NO_CONTENT, Void.class);

        WorkoutTodayResponse today = getForBody("/api/train/workouts/today",
            headers, HttpStatus.OK, WorkoutTodayResponse.class);
        assertThat(today.getExercises())
            .filteredOn(e -> exercise.getId().equals(e.getId()))
            .singleElement()
            .satisfies(e -> assertThat(e.getNote()).isEqualTo("dropset az utolsón"));
    }

    @Test
    void testSaveExerciseNote_shouldReturn400_whenNoteTooLong() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);

        String body = putForBody("/api/train/exercises/" + exercise.getId() + "/note",
            ExerciseNoteRequest.builder().note("x".repeat(501)).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "note", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testSaveExerciseNote_shouldReturn404_whenExerciseUnknown() {
        ownerId();
        String body = putForBody("/api/train/exercises/" + UUID.randomUUID() + "/note",
            ExerciseNoteRequest.builder().note("nem létezik").build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testSaveExerciseNote_shouldReturn401_whenUnauthenticated() {
        putForBody("/api/train/exercises/" + UUID.randomUUID() + "/note",
            ExerciseNoteRequest.builder().note("akármi").build(),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testWorkoutFlow_shouldPersistSetsFeedbackAndComplete_whenDrivenOverHttp() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();

        WorkoutInstanceResponse started = postForBody("/api/train/workouts",
            start(template), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);
        SetLogRequest set = SetLogRequest.builder().exerciseId(exercise.getId()).setIndex(0)
            .weightKg(new BigDecimal("102.5")).reps(9).rir(2).build();
        set.setSide("B");
        set.setNote("kontrakt teszt");
        postForBody("/api/train/workouts/" + started.getId() + "/sets",
            set, headers, HttpStatus.CREATED, String.class);
        postForBody("/api/train/workouts/" + started.getId() + "/feedback",
            List.of(WorkoutFeedbackInput.builder().exerciseId(exercise.getId())
                .pump(3).jointPain(1).workload(2).build()),
            headers, HttpStatus.NO_CONTENT, Void.class);
        WorkoutInstanceResponse finished = postForBody(
            "/api/train/workouts/" + started.getId() + "/finish",
            null, headers, HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(finished.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        assertThat(finished.getSets()).hasSize(1);
        assertThat(finished.getSets().get(0).getSide()).isEqualTo("B");
        assertThat(finished.getSets().get(0).getNote()).isEqualTo("kontrakt teszt");
    }
}
