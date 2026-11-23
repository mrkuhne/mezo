package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
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
 * The running-day guard of a day save (mezo-r36n9.116, relaxed by mezo-r36n9.147): logged sets point at the
 * template rows, so a save that would re-mint them (add / remove / swap) is refused while that day's workout
 * runs. A save that keeps the same exercises — the same order, or a pure reorder (owner decision 2026-11-23)
 * — updates the rows in place, ids kept, and stays allowed. The day is fully editable again once the
 * instance is finished.
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

    private List<ExerciseEntity> rows() {
        return exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(user, List.of(day.getId()));
    }

    private List<UUID> ids() {
        return rows().stream().map(ExerciseEntity::getId).toList();
    }

    private void assertRefusedWhileRunning(List<GymExerciseInput> inputs, List<UUID> before) {
        assertThatThrownBy(() -> trainService.replaceDayExercises(user, meso.getId(), day.getId(), inputs))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(e.getMessages().get(0).getCode()).isEqualTo("TRAIN_DAY_WORKOUT_RUNNING");
            });
        assertThat(ids()).isEqualTo(before);
    }

    @Test
    void aReorderWhileTheDaysWorkoutRunsIsSavedInPlace_theIdsAreKept() {
        trainPopulator.startInstance(user, day.getId());
        List<UUID> before = ids();

        MesoDay edited = trainService.replaceDayExercises(
            user, meso.getId(), day.getId(), List.of(row("Lehúzás", 8), row("Evezés", 8)));

        // the same two rows, swapped: the ids survive, only orderIndex moved
        assertThat(ids()).isEqualTo(before.reversed());
        assertThat(rows()).extracting(ExerciseEntity::getName).containsExactly("Lehúzás", "Evezés");
        assertThat(rows()).extracting(ExerciseEntity::getOrderIndex).containsExactly(0, 1);
        // the response follows the new order, not the stored rows' old one
        assertThat(edited.getExercises()).extracting(GymExercise::getName).containsExactly("Lehúzás", "Evezés");
    }

    @Test
    void aChangedRepRangeWithANewOrderWhileRunningIsSavedInPlace() {
        trainPopulator.startInstance(user, day.getId());
        List<UUID> before = ids();
        UUID evezes = before.get(0);

        trainService.replaceDayExercises(
            user, meso.getId(), day.getId(), List.of(row("Lehúzás", 10), row("Evezés", 12)));

        assertThat(ids()).isEqualTo(before.reversed());
        ExerciseEntity moved = exerciseRepository.findById(evezes).orElseThrow();
        assertThat(moved.getName()).isEqualTo("Evezés");
        assertThat(moved.getRepMax()).isEqualTo(12);
        assertThat(moved.getOrderIndex()).isEqualTo(1);
    }

    @Test
    void aSwapAnAddAndARemoveAreStillRefusedWhileTheDaysWorkoutRuns() {
        trainPopulator.startInstance(user, day.getId());
        List<UUID> before = ids();

        // swap: a different exercise in the second slot
        assertRefusedWhileRunning(List.of(row("Evezés", 8), row("Tolódzkodás", 8)), before);
        // add: a third row
        assertRefusedWhileRunning(List.of(row("Evezés", 8), row("Lehúzás", 8), row("Tolódzkodás", 8)), before);
        // remove: one row left
        assertRefusedWhileRunning(List.of(row("Evezés", 8)), before);
        // a same-order edit is still fine meanwhile
        trainService.replaceDayExercises(user, meso.getId(), day.getId(), List.of(row("Evezés", 10), row("Lehúzás", 10)));
        assertThat(ids()).isEqualTo(before);
    }

    @Test
    void afterTheInstanceIsCompleted_aReorderKeepsTheIds_andASwapReMintsThem() {
        WorkoutSessionEntity instance = trainPopulator.startInstance(user, day.getId());
        List<UUID> before = ids();
        instance.setStatus("completed");
        trainPopulator.save(instance);

        // Before mezo-r36n9.147 a reorder re-minted the ids once the workout was over; a pure permutation
        // now takes the in-place path always, so the history keeps pointing at the same rows.
        trainService.replaceDayExercises(user, meso.getId(), day.getId(), List.of(row("Lehúzás", 8), row("Evezés", 8)));
        assertThat(ids()).isEqualTo(before.reversed());

        // a swap is structural: no running workout, so it goes through — with new ids
        trainService.replaceDayExercises(
            user, meso.getId(), day.getId(), List.of(row("Lehúzás", 8), row("Tolódzkodás", 8)));
        assertThat(ids()).doesNotContainAnyElementsOf(before).hasSize(2);
        assertThat(rows()).extracting(ExerciseEntity::getName).containsExactly("Lehúzás", "Tolódzkodás");
    }

    @Test
    void aWorkoutOfAnotherDayDoesNotBlock() {
        WorkoutSessionEntity other = trainPopulator.createWorkoutSession(user, meso.getId(), "Kedd", "Push", 1, "planned");
        trainPopulator.createWorkoutInstance(user, other, LocalDate.now(), "active");
        trainService.replaceDayExercises(
            user, meso.getId(), day.getId(), List.of(row("Lehúzás", 8), row("Tolódzkodás", 8)));
        assertThat(ids()).hasSize(2);
    }
}
