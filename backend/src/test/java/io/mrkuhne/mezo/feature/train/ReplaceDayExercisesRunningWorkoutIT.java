package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * A structural day save is refused while that day's workout runs (mezo-r36n9.116): logged sets point at
 * the template rows, so a reorder/add/remove/swap would orphan them. A same-order save (in-place update)
 * stays allowed, and the day is editable again once the instance is finished.
 */
class ReplaceDayExercisesRunningWorkoutIT extends AbstractIntegrationTest {

    @Autowired TrainService trainService;
    @Autowired TrainPopulator trainPopulator;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired ExerciseRepository exerciseRepository;

    private UUID user;
    private MesocycleEntity meso;
    private WorkoutSessionEntity day;

    @BeforeEach
    void setUp() {
        user = databasePopulator.populateUser("day-running@test.local");
        meso = trainPopulator.createMesocycle(user, "Futó", "active");
        day = trainPopulator.createWorkoutSession(user, meso.getId(), "Hét", "Pull", 0, "planned");
        trainPopulator.createExercise(user, day.getId(), "Evezés", 0);
        trainPopulator.createExercise(user, day.getId(), "Lehúzás", 1);
    }

    private GymExerciseInput row(String name, int repMax) {
        return GymExerciseInput.builder().name(name).muscle("hát").warmupSets(2).workingSets(3)
            .repMin(6).repMax(repMax).targetRIR(1).type(GymExerciseInput.TypeEnum.COMPOUND).build();
    }

    private List<UUID> ids() {
        return exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(user, List.of(day.getId()))
            .stream().map(ExerciseEntity::getId).toList();
    }

    @Test
    void aReorderIsRefusedWhileTheDaysWorkoutRuns_aSameOrderSaveIsNot_andTheDayReopensAfterFinish() {
        WorkoutSessionEntity instance = trainPopulator.startInstance(user, day.getId());
        List<UUID> before = ids();

        assertThatThrownBy(() -> trainService.replaceDayExercises(
            user, meso.getId(), day.getId(), List.of(row("Lehúzás", 8), row("Evezés", 8))))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(e.getMessages().get(0).getCode()).isEqualTo("DAY_WORKOUT_RUNNING");
            });
        assertThat(ids()).isEqualTo(before);

        // same order, a changed rep range: in place, still allowed
        trainService.replaceDayExercises(user, meso.getId(), day.getId(), List.of(row("Evezés", 10), row("Lehúzás", 10)));
        assertThat(ids()).isEqualTo(before);

        instance.setStatus("completed");
        trainPopulator.save(instance);
        trainService.replaceDayExercises(user, meso.getId(), day.getId(), List.of(row("Lehúzás", 8), row("Evezés", 8)));
        assertThat(ids()).doesNotContainAnyElementsOf(before).hasSize(2);
    }

    @Test
    void aWorkoutOfAnotherDayDoesNotBlock() {
        WorkoutSessionEntity other = trainPopulator.createWorkoutSession(user, meso.getId(), "Kedd", "Push", 1, "planned");
        trainPopulator.createWorkoutInstance(user, other, LocalDate.now(), "active");
        trainService.replaceDayExercises(user, meso.getId(), day.getId(), List.of(row("Lehúzás", 8), row("Evezés", 8)));
        assertThat(ids()).hasSize(2);
    }
}
