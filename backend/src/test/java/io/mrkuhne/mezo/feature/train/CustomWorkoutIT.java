package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.CustomWorkoutResponse;
import io.mrkuhne.mezo.api.dto.CustomWorkoutUpsertRequest;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Saját edzés (mezo-ws2x): custom workout template CRUD — meso-less workout_session
 * template rows (origin='custom') with ordinary exercise recipe rows.
 */
@Transactional
class CustomWorkoutIT extends AbstractIntegrationTest {

    @Autowired private TrainService trainService;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.train.service.WorkoutService workoutService;
    @Autowired private io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository workoutSessionRepository;

    private static CustomWorkoutUpsertRequest upsert(String name, String... exerciseNames) {
        List<GymExerciseInput> exercises = java.util.Arrays.stream(exerciseNames)
            .map(n -> GymExerciseInput.builder()
                .name(n).muscle("chest")
                .warmupSets(1).workingSets(3).repMin(8).repMax(10).targetRIR(1)
                .type(GymExerciseInput.TypeEnum.COMPOUND)
                .build())
            .toList();
        return CustomWorkoutUpsertRequest.builder().name(name).exercises(exercises).build();
    }

    @Test
    void testCreateCustomWorkout_shouldPersistMesoLessTemplate_whenValid() {
        UUID user = databasePopulator.populateUser("custom-create@test.local");
        CustomWorkoutResponse r = trainService.createCustomWorkout(user, upsert("Pihenőnapi felső", "Incline DB Press"));
        assertThat(r.getId()).isNotNull();
        assertThat(r.getName()).isEqualTo("Pihenőnapi felső");
        assertThat(r.getExercises()).hasSize(1);
        assertThat(r.getExercises().get(0).getName()).isEqualTo("Incline DB Press");
    }

    @Test
    void testListCustomWorkouts_shouldReturnOwnRowsOnly_whenTwoUsers() {
        UUID a = databasePopulator.populateUser("custom-a@test.local");
        UUID b = databasePopulator.populateUser("custom-b@test.local");
        trainService.createCustomWorkout(a, upsert("A edzése", "Row"));
        assertThat(trainService.listCustomWorkouts(b)).isEmpty();
        assertThat(trainService.listCustomWorkouts(a)).hasSize(1);
    }

    @Test
    void testUpdateCustomWorkout_shouldRenameAndReplaceExercises_whenOwned() {
        UUID user = databasePopulator.populateUser("custom-update@test.local");
        CustomWorkoutResponse created = trainService.createCustomWorkout(user, upsert("V1", "Row"));
        CustomWorkoutResponse updated = trainService.updateCustomWorkout(
            user, created.getId(), upsert("V2", "Bench", "Curl"));
        assertThat(updated.getName()).isEqualTo("V2");
        assertThat(updated.getExercises()).hasSize(2);
        assertThat(trainService.listCustomWorkouts(user)).hasSize(1);
    }

    @Test
    void testDeleteCustomWorkout_shouldSoftDelete_whenOwned() {
        UUID user = databasePopulator.populateUser("custom-delete@test.local");
        CustomWorkoutResponse created = trainService.createCustomWorkout(user, upsert("Törlendő", "Row"));
        trainService.deleteCustomWorkout(user, created.getId());
        assertThat(trainService.listCustomWorkouts(user)).isEmpty();
    }

    @Test
    void testUpdateCustomWorkout_shouldThrowNotFound_whenForeignRow() {
        UUID a = databasePopulator.populateUser("custom-foreign-a@test.local");
        UUID b = databasePopulator.populateUser("custom-foreign-b@test.local");
        CustomWorkoutResponse created = trainService.createCustomWorkout(a, upsert("A-é", "Row"));
        assertThatThrownBy(() -> trainService.updateCustomWorkout(b, created.getId(), upsert("Hijack", "Row")))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    private static io.mrkuhne.mezo.api.dto.WorkoutStartRequest startRequest(UUID templateId) {
        return io.mrkuhne.mezo.api.dto.WorkoutStartRequest.builder().templateSessionId(templateId).build();
    }

    @Test
    void testStartWorkout_shouldCopyCustomOrigin_whenCustomTemplate() {
        UUID user = databasePopulator.populateUser("custom-origin@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Saját", "Row"));
        var instance = workoutService.startWorkout(user, startRequest(cw.getId()));
        assertThat(workoutSessionRepository.findById(instance.getId()).orElseThrow().getOrigin())
            .isEqualTo("custom");
    }

    @Test
    void testStartWorkout_shouldAllowRepeatSameWeek_whenCustomTemplate() {
        UUID user = databasePopulator.populateUser("custom-repeat@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Saját", "Row"));
        var first = workoutService.startWorkout(user, startRequest(cw.getId()));
        workoutService.finishWorkout(user, first.getId());
        // D5 (once per week) must NOT apply to custom templates — a second same-week start succeeds.
        var second = workoutService.startWorkout(user, startRequest(cw.getId()));
        assertThat(second.getId()).isNotEqualTo(first.getId());
    }

    @Test
    void testStartWorkout_shouldThrowOpenElsewhere_whenAnotherWorkoutOpen() {
        UUID user = databasePopulator.populateUser("custom-d6@test.local");
        CustomWorkoutResponse a = trainService.createCustomWorkout(user, upsert("A", "Row"));
        CustomWorkoutResponse b = trainService.createCustomWorkout(user, upsert("B", "Bench"));
        workoutService.startWorkout(user, startRequest(a.getId()));
        assertThatThrownBy(() -> workoutService.startWorkout(user, startRequest(b.getId())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("TRAIN_WORKOUT_OPEN_ELSEWHERE");
    }

    @Test
    void testGetToday_shouldResolveCustomTemplate_whenNoActiveMeso() {
        UUID user = databasePopulator.populateUser("custom-nomeso@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Meso nélkül", "Row"));
        var today = workoutService.getToday(user, cw.getId());
        assertThat(today.getTemplateSessionId()).isEqualTo(cw.getId());
        assertThat(today.getTitle()).isEqualTo("Meso nélkül");
        assertThat(today.getExercises()).hasSize(1);
    }

    @Test
    void testGetToday_shouldPreferOpenCustomInstance_whenNoParam() {
        UUID user = databasePopulator.populateUser("custom-openwins@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Nyitott", "Row"));
        workoutService.startWorkout(user, startRequest(cw.getId()));
        var today = workoutService.getToday(user, null);
        assertThat(today.getTemplateSessionId()).isEqualTo(cw.getId());
        assertThat(today.getOpenWorkout()).isNotNull();
    }

    @Test
    void testGetToday_shouldNotSetCompletedWorkout_whenCustomCompletedThisWeek() {
        UUID user = databasePopulator.populateUser("custom-nocompleted@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Ismételhető", "Row"));
        var instance = workoutService.startWorkout(user, startRequest(cw.getId()));
        workoutService.finishWorkout(user, instance.getId());
        var today = workoutService.getToday(user, cw.getId());
        // A custom day is repeatable — it must never flip the FE into the review redirect.
        assertThat(today.getCompletedWorkout()).isNull();
        // ...and it must not tick the plan-adherence weekly done dates (D5 semantics).
        assertThat(today.getWeekDoneDates()).isEmpty();
    }

    @Test
    void testAutoCloseStale_shouldSettleCustomInstance_whenPastActiveWithSet() {
        UUID user = databasePopulator.populateUser("custom-autoclose@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Tegnapi", "Row"));
        var instance = workoutService.startWorkout(user, startRequest(cw.getId()));
        workoutService.logSet(user, instance.getId(), io.mrkuhne.mezo.api.dto.SetLogRequest.builder()
            .exerciseId(cw.getExercises().get(0).getId()).setIndex(0).weightKg(java.math.BigDecimal.valueOf(60)).reps(8).build());
        // Age the open instance to yesterday, then any getToday lazily settles it (mezo-cd8s).
        WorkoutSessionEntity aged = workoutSessionRepository.findById(instance.getId()).orElseThrow();
        aged.setDate(java.time.LocalDate.now().minusDays(1));
        workoutSessionRepository.save(aged);
        workoutService.getToday(user, null);
        assertThat(workoutSessionRepository.findById(instance.getId()).orElseThrow().getStatus())
            .isEqualTo("completed");
    }

    @Test
    void testListWorkouts_shouldCarryOriginAndTitle_whenCustomCompleted() {
        UUID user = databasePopulator.populateUser("custom-summary@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Pihenőnapi felső", "Row"));
        var instance = workoutService.startWorkout(user, startRequest(cw.getId()));
        workoutService.finishWorkout(user, instance.getId());
        java.time.LocalDate today = java.time.LocalDate.now();
        var summaries = workoutService.listWorkouts(user, today.minusDays(1), today.plusDays(1));
        assertThat(summaries).hasSize(1);
        assertThat(summaries.get(0).getOrigin().getValue()).isEqualTo("custom");
        assertThat(summaries.get(0).getTitle()).isEqualTo("Pihenőnapi felső");
    }
}
