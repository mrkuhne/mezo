package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Done = explicitly completed (spec 2026-07-15): ≥1-set active instances no longer count. */
class WorkoutDoneSemanticsIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WorkoutSessionRepository workoutSessionRepository;

    private record Fixture(UUID owner, WorkoutSessionEntity template, ExerciseEntity exercise) {}

    private Fixture fixture() {
        UUID owner = databasePopulator.populateUser("done-semantics@test.hu");
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        return new Fixture(owner, template, exercise);
    }

    @Test
    void testFindDoneInstanceDates_shouldExcludeInstance_whenActiveWithLoggedSet() {
        Fixture f = fixture();
        WorkoutSessionEntity active = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now(), "active");
        trainPopulator.createLoggedSet(f.owner(), f.exercise().getId(), active.getId(), 0, "80", 8, 1);

        assertThat(workoutSessionRepository.findDoneInstanceDates(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now())).isEmpty();
    }

    @Test
    void testFindDoneInstanceDates_shouldIncludeInstance_whenCompleted() {
        Fixture f = fixture();
        trainPopulator.createWorkoutInstance(f.owner(), f.template(), LocalDate.now(), "completed");

        assertThat(workoutSessionRepository.findDoneInstanceDates(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now()))
            .containsExactly(LocalDate.now());
    }

    @Test
    void testFindDoneInstancesBetween_shouldReturnOnlyCompleted_whenMixedStatuses() {
        Fixture f = fixture();
        WorkoutSessionEntity active = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now().minusDays(1), "active");
        trainPopulator.createLoggedSet(f.owner(), f.exercise().getId(), active.getId(), 0, "80", 8, 1);
        WorkoutSessionEntity completed = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now(), "completed");
        trainPopulator.createWorkoutInstance(f.owner(), f.template(), LocalDate.now(), "skipped");

        assertThat(workoutSessionRepository.findDoneInstancesBetween(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now()))
            .extracting(WorkoutSessionEntity::getId)
            .containsExactly(completed.getId());
    }
}
