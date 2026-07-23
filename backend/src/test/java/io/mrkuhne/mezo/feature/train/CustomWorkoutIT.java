package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.CustomWorkoutResponse;
import io.mrkuhne.mezo.api.dto.CustomWorkoutUpsertRequest;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
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
}
