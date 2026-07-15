package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutAutoCloseService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Lazy settle of abandoned instances: past active + sets -> completed; past empty -> skipped. */
class WorkoutAutoCloseIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private WorkoutAutoCloseService workoutAutoCloseService;

    private record Fixture(UUID owner, WorkoutSessionEntity template, ExerciseEntity exercise) {}

    private Fixture fixture() {
        UUID owner = databasePopulator.populateUser("auto-close@test.hu");
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        return new Fixture(owner, template, exercise);
    }

    @Test
    void testAutoCloseStale_shouldComplete_whenPastActiveInstanceHasLoggedSet() {
        Fixture f = fixture();
        WorkoutSessionEntity stale = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now().minusDays(1), "active");
        trainPopulator.createLoggedSet(f.owner(), f.exercise().getId(), stale.getId(), 0, "80", 8, 1);

        workoutAutoCloseService.autoCloseStale(f.owner());

        assertThat(workoutSessionRepository.findById(stale.getId()).orElseThrow().getStatus())
            .isEqualTo("completed");
        // the retroactively completed day now counts as done on ITS date
        assertThat(workoutSessionRepository.findDoneInstanceDates(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now()))
            .containsExactly(LocalDate.now().minusDays(1));
    }

    @Test
    void testAutoCloseStale_shouldSkip_whenPastActiveInstanceHasOnlySkipMarkerOrNothing() {
        Fixture f = fixture();
        WorkoutSessionEntity empty = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now().minusDays(2), "active");

        workoutAutoCloseService.autoCloseStale(f.owner());

        assertThat(workoutSessionRepository.findById(empty.getId()).orElseThrow().getStatus())
            .isEqualTo("skipped");
        assertThat(workoutSessionRepository.findDoneInstanceDates(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now())).isEmpty();
    }

    @Test
    void testAutoCloseStale_shouldLeaveUntouched_whenActiveInstanceIsToday() {
        Fixture f = fixture();
        WorkoutSessionEntity today = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now(), "active");

        workoutAutoCloseService.autoCloseStale(f.owner());

        assertThat(workoutSessionRepository.findById(today.getId()).orElseThrow().getStatus())
            .isEqualTo("active");
    }
}
