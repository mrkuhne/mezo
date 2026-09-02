package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.WorkoutDetailResponse;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutAutoCloseService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Actual-duration measurement (mezo-1jm8): startWorkout stamps {@code startedAt} exactly once
 * (never on resume), finishWorkout stamps {@code finishedAt} idempotently and derives
 * {@code activeSeconds} from the logged sets' {@code doneAt} via SessionTimingCalculator, and an
 * auto-closed (abandoned) session deliberately leaves {@code finishedAt} null.
 */
@Transactional
class WorkoutTimingIT extends AbstractIntegrationTest {

    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private WorkoutService workoutService;
    @Autowired private WorkoutAutoCloseService workoutAutoCloseService;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private static String todayLabel() {
        return List.of("Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas")
            .get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    private static WorkoutStartRequest startRequest(WorkoutSessionEntity template) {
        return WorkoutStartRequest.builder().templateSessionId(template.getId()).build();
    }

    private static SetLogRequest setRequest(ExerciseEntity exercise, int setIndex, String weightKg,
        int reps, int rir) {
        return SetLogRequest.builder().exerciseId(exercise.getId()).setIndex(setIndex)
            .weightKg(new BigDecimal(weightKg)).reps(reps).rir(rir).build();
    }

    @Test
    void testStartWorkout_shouldStampStartedAt_whenTheInstanceIsCreated() {
        UUID user = databasePopulator.populateUser("timing-start@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T3 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");

        WorkoutInstanceResponse started = workoutService.startWorkout(user, startRequest(template));

        WorkoutSessionEntity reloaded = workoutSessionRepository.findById(started.getId()).orElseThrow();
        assertThat(reloaded.getStartedAt()).isNotNull();
    }

    @Test
    void testStartWorkout_shouldNotRestampStartedAt_whenAnOpenInstanceIsResumed() {
        UUID user = databasePopulator.populateUser("timing-resume@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T3 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");
        Instant original = Instant.now().minusSeconds(600);
        instance.setStartedAt(original);
        trainPopulator.save(instance);

        WorkoutInstanceResponse resumed = workoutService.startWorkout(user, startRequest(template));

        assertThat(resumed.getId()).isEqualTo(instance.getId());
        WorkoutSessionEntity reloaded = workoutSessionRepository.findById(instance.getId()).orElseThrow();
        assertThat(reloaded.getStartedAt()).isEqualTo(original);
    }

    @Test
    void testFinishWorkout_shouldStampFinishedAtAndActiveSeconds_whenSetsWereLogged() {
        UUID user = databasePopulator.populateUser("timing-finish@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T3 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutInstanceResponse started = workoutService.startWorkout(user, startRequest(template));
        workoutService.logSet(user, started.getId(), setRequest(exercise, 0, "60.0", 8, 1));
        workoutService.logSet(user, started.getId(), setRequest(exercise, 1, "60.0", 8, 1));

        workoutService.finishWorkout(user, started.getId(), null);

        WorkoutSessionEntity reloaded = workoutSessionRepository.findById(started.getId()).orElseThrow();
        assertThat(reloaded.getFinishedAt()).isNotNull();
        assertThat(reloaded.getActiveSeconds()).isNotNull();
        assertThat(reloaded.getActiveSeconds()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void testFinishWorkout_shouldNotOverwriteFinishedAt_whenFinishIsCalledTwice() {
        UUID user = databasePopulator.populateUser("timing-refinish@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T3 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        WorkoutInstanceResponse started = workoutService.startWorkout(user, startRequest(template));
        workoutService.finishWorkout(user, started.getId(), null);
        WorkoutSessionEntity afterFirst = workoutSessionRepository.findById(started.getId()).orElseThrow();
        Instant firstFinishedAt = afterFirst.getFinishedAt();
        assertThat(firstFinishedAt).isNotNull();

        workoutService.finishWorkout(user, started.getId(), null);

        WorkoutSessionEntity afterSecond = workoutSessionRepository.findById(started.getId()).orElseThrow();
        assertThat(afterSecond.getFinishedAt()).isEqualTo(firstFinishedAt);
    }

    @Test
    void testFinishWorkout_shouldLeaveActiveSecondsNull_whenNoSetWasLogged() {
        UUID user = databasePopulator.populateUser("timing-noset@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T3 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        WorkoutInstanceResponse started = workoutService.startWorkout(user, startRequest(template));

        workoutService.finishWorkout(user, started.getId(), null);

        WorkoutSessionEntity reloaded = workoutSessionRepository.findById(started.getId()).orElseThrow();
        assertThat(reloaded.getFinishedAt()).isNotNull();
        assertThat(reloaded.getActiveSeconds()).isNull();
    }

    @Test
    void testAutoCloseStale_shouldLeaveFinishedAtNull_whenAnAbandonedSessionIsClosed() {
        UUID user = databasePopulator.populateUser("timing-autoclose@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T3 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        WorkoutSessionEntity abandoned = trainPopulator.createWorkoutInstance(
            user, template, LocalDate.now().minusDays(2), "active");

        workoutAutoCloseService.autoCloseStale(user);

        WorkoutSessionEntity reloaded = workoutSessionRepository.findById(abandoned.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isIn("completed", "skipped");
        assertThat(reloaded.getFinishedAt()).isNull();
    }

    @Test
    void testFinishWorkout_shouldReturnTimingInTheResponse_whenTheSessionIsClosed() {
        UUID user = databasePopulator.populateUser("timing-response@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T3 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutInstanceResponse started = workoutService.startWorkout(user, startRequest(template));
        workoutService.logSet(user, started.getId(), setRequest(exercise, 0, "60.0", 8, 1));
        workoutService.logSet(user, started.getId(), setRequest(exercise, 1, "60.0", 8, 1));

        WorkoutInstanceResponse finished = workoutService.finishWorkout(user, started.getId(), null);

        assertThat(finished.getStartedAt()).isNotNull();
        assertThat(finished.getFinishedAt()).isNotNull();
        assertThat(finished.getActiveSeconds()).isNotNull();
        assertThat(finished.getActiveSeconds()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void testGetWorkoutDetail_shouldReturnDoneAtOnEverySet_whenSetsWereLogged() {
        UUID user = databasePopulator.populateUser("timing-detail@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T3 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutInstanceResponse started = workoutService.startWorkout(user, startRequest(template));
        workoutService.logSet(user, started.getId(), setRequest(exercise, 0, "60.0", 8, 1));
        workoutService.logSet(user, started.getId(), setRequest(exercise, 1, "60.0", 8, 1));
        workoutService.finishWorkout(user, started.getId(), null);

        WorkoutDetailResponse detail = workoutService.getWorkoutDetail(user, started.getId());

        assertThat(detail.getStartedAt()).isNotNull();
        assertThat(detail.getFinishedAt()).isNotNull();
        assertThat(detail.getExercises()).isNotEmpty();
        assertThat(detail.getExercises().get(0).getSets()).hasSize(2)
            .allSatisfy(set -> assertThat(set.getDoneAt()).isNotNull());
    }
}
