package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Check-in 2.0 follow-up C: the muscle groups tomorrow's PLANNED template loads (a pure read). */
@Transactional
class WorkoutPlannedMuscleGroupsIT extends AbstractIntegrationTest {

    @Autowired private WorkoutService workoutService;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testPlannedMuscleGroups_shouldUnionSessionAndExerciseGroups_whenDayPlanned() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        String dayLabel = WorkoutService.HU_DAY_LABELS.get(tomorrow.getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity session = trainPopulator.createWorkoutSession(owner, meso.getId(), dayLabel, "gym", 0, "active");
        session.setMuscle("shoulder-lateral");
        trainPopulator.save(session);
        trainPopulator.createExercise(owner, session.getId(), "Guggolás", "quad", "compound");
        trainPopulator.createExercise(owner, session.getId(), "Fekvenyomás", "chest-upper", "compound");

        assertThat(workoutService.plannedMuscleGroups(owner, tomorrow))
            .containsExactlyInAnyOrder("shoulder", "quad", "chest");
    }

    @Test
    void testPlannedMuscleGroups_shouldBeEmpty_whenNothingPlanned() {
        UUID owner = userPopulator.createUser().getId();
        assertThat(workoutService.plannedMuscleGroups(owner, LocalDate.now().plusDays(1))).isEmpty();
    }
}
