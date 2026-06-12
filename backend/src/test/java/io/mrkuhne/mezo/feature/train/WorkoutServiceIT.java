package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service/repository-level tests for the T2 workout-execution flows. Starts by pinning the new
 * persistence shapes (instance self-FK, set→instance FK + renamed note, feedback CHECK/UNIQUE);
 * grows with WorkoutService in Tasks 3–6.
 */
@Transactional
class WorkoutServiceIT extends AbstractIntegrationTest {

    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private ExerciseSetRepository exerciseSetRepository;
    @Autowired private ExerciseFeedbackRepository exerciseFeedbackRepository;
    @Autowired private WorkoutService workoutService;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext private EntityManager entityManager;

    /** Server-side HU day label for today — mirrors WorkoutService's mapping (Task 6). */
    static String todayLabel() {
        return List.of("Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas")
            .get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    @Test
    void testCreateWorkoutInstance_shouldRoundTripTemplateLink_whenPersisted() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");

        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");
        entityManager.clear();

        WorkoutSessionEntity reloaded = workoutSessionRepository.findById(instance.getId()).orElseThrow();
        assertThat(reloaded.getTemplateSessionId()).isEqualTo(template.getId());
        assertThat(reloaded.getDate()).isEqualTo(LocalDate.now());
        assertThat(reloaded.getStatus()).isEqualTo("active");
        assertThat(reloaded.getType()).isEqualTo("Pull Day");
    }

    @Test
    void testCreateLoggedSet_shouldRoundTripInstanceFkAndNote_whenPersisted() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");

        ExerciseSetEntity set = trainPopulator.createLoggedSet(user, exercise.getId(), instance.getId(),
            0, "102.50", 9, 2);
        set.setNote("note survives the rename");
        set.setSide("L");
        exerciseSetRepository.saveAndFlush(set);
        entityManager.clear();

        ExerciseSetEntity reloaded = exerciseSetRepository.findById(set.getId()).orElseThrow();
        assertThat(reloaded.getWorkoutSessionId()).isEqualTo(instance.getId());
        assertThat(reloaded.getNote()).isEqualTo("note survives the rename");
        assertThat(reloaded.getSide()).isEqualTo("L");
    }

    @Test
    void testCreateFeedback_shouldRejectDuplicate_whenSamePairInsertedTwice() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");

        ExerciseFeedbackEntity first = trainPopulator.createFeedback(user, instance.getId(), exercise.getId());
        assertThat(first.getId()).isNotNull();
        assertThatThrownBy(() -> trainPopulator.createFeedback(user, instance.getId(), exercise.getId()))
            .hasMessageContaining("uq_exercise_feedback");
    }

    private static WorkoutStartRequest startRequest(WorkoutSessionEntity template) {
        return WorkoutStartRequest.builder().templateSessionId(template.getId()).build();
    }

    @Test
    void testStartWorkout_shouldCreateActiveInstance_whenTemplateOwned() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");

        WorkoutInstanceResponse started = workoutService.startWorkout(user, startRequest(template));

        assertThat(started.getTemplateSessionId()).isEqualTo(template.getId());
        assertThat(started.getDate()).isEqualTo(LocalDate.now());
        assertThat(started.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.ACTIVE);
        assertThat(started.getSets()).isEmpty();
        WorkoutSessionEntity row = workoutSessionRepository.findById(started.getId()).orElseThrow();
        assertThat(row.getCreatedBy()).isEqualTo(user); // ownership stamped server-side
        assertThat(row.getType()).isEqualTo("Pull Day"); // day fields copied from the template
        assertThat(row.getMesocycleId()).isEqualTo(meso.getId());
    }

    @Test
    void testStartWorkout_shouldResumeOpenInstance_whenStartFiresAgain() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");

        WorkoutInstanceResponse first = workoutService.startWorkout(user, startRequest(template));
        WorkoutInstanceResponse second = workoutService.startWorkout(user, startRequest(template));

        assertThat(second.getId()).isEqualTo(first.getId()); // resumed, not duplicated
        long instances = workoutSessionRepository.findAll().stream()
            .filter(s -> template.getId().equals(s.getTemplateSessionId())).count();
        assertThat(instances).isEqualTo(1);
    }

    @Test
    void testStartWorkout_shouldThrowNotFound_whenTemplateForeign() {
        UUID owner = databasePopulator.populateUser("workout@test.local");
        UUID stranger = databasePopulator.populateUser("stranger@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel(), "Pull Day", 0, "planned");

        assertThatThrownBy(() -> workoutService.startWorkout(stranger, startRequest(template)))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testStartWorkout_shouldThrowNotFound_whenTargetIsInstanceRow() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");

        assertThatThrownBy(() -> workoutService.startWorkout(user, startRequest(instance)))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
