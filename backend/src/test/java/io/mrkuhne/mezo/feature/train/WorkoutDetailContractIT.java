package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutDetailResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** HTTP round-trips of GET /api/train/workouts/{id} + WorkoutTodayResponse.completedWorkout. */
class WorkoutDetailContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testGetWorkoutDetail_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/workouts/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetWorkoutDetail_shouldReturnSetsAndSkipFlag_whenOwnedInstance() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity rowEx = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        ExerciseEntity curlEx = trainPopulator.createExercise(owner, template.getId(), "Curl", 1);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
            owner, template, LocalDate.now(), "completed");
        trainPopulator.createLoggedSet(owner, rowEx.getId(), instance.getId(), 0, "80", 8, 1);
        trainPopulator.createLoggedSet(owner, rowEx.getId(), instance.getId(), 1, "82.5", 7, 1);

        WorkoutDetailResponse detail = getForBody("/api/train/workouts/" + instance.getId(),
            ownerAuthHeaders(), HttpStatus.OK, WorkoutDetailResponse.class);

        assertThat(detail.getId()).isEqualTo(instance.getId());
        assertThat(detail.getStatus()).isEqualTo(WorkoutDetailResponse.StatusEnum.COMPLETED);
        assertThat(detail.getExercises()).hasSize(2);
        assertThat(detail.getExercises().get(0).getName()).isEqualTo("Row");
        assertThat(detail.getExercises().get(0).getSets()).hasSize(2);
        assertThat(detail.getExercises().get(0).getSets().get(0).getRir()).isEqualTo(1);
        assertThat(detail.getExercises().get(1).getSets()).isEmpty();
        assertThat(detail.getExercises().get(1).getSkipped()).isFalse();
    }

    @Test
    void testGetWorkoutDetail_shouldReturn404_whenTemplateRowOrUnknown() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");

        getForBody("/api/train/workouts/" + template.getId(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        getForBody("/api/train/workouts/" + UUID.randomUUID(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testGetTodayWorkout_shouldCarryCompletedWorkout_whenTodayInstanceCompleted() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
            owner, meso.getId(), WorkoutServiceIT.todayLabel(), "Pull Day", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        WorkoutSessionEntity done = trainPopulator.createWorkoutInstance(
            owner, template, LocalDate.now(), "completed");

        WorkoutTodayResponse today = getForBody("/api/train/workouts/today",
            ownerAuthHeaders(), HttpStatus.OK, WorkoutTodayResponse.class);

        assertThat(today.getCompletedWorkout()).isNotNull();
        assertThat(today.getCompletedWorkout().getId()).isEqualTo(done.getId());
        assertThat(today.getOpenWorkout()).isNull();
    }
}
