package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Proves the two challenge-driving finders on the Train repositories: the instance finder used by
 * the challenge gather step (template session on a given day) and the set-level finder used by the
 * outcome evaluator (the logged sets of one exercise inside one instance). Both are owner-scoped.
 */
@Transactional
class WorkoutSessionRepositoryChallengeIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-07-07");
    private static final LocalDate YESTERDAY = LocalDate.parse("2026-07-06");

    @Autowired
    private WorkoutSessionRepository workoutSessionRepository;

    @Autowired
    private ExerciseSetRepository exerciseSetRepository;

    @Autowired
    private TrainPopulator trainPopulator;

    @Autowired
    private UserPopulator userPopulator;

    @Test
    void testFindInstance_shouldReturnTodaysInstanceOfTemplate_whenTemplateHasInstancesOnSeveralDays() {
        UUID user = userPopulator.createUser("train-chl-inst@test.local").getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Teszt meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
            user, meso.getId(), "H", "gym", 0, "planned");
        WorkoutSessionEntity todayInstance = trainPopulator.createWorkoutInstance(user, template, TODAY, "completed");
        WorkoutSessionEntity yesterdayInstance =
            trainPopulator.createWorkoutInstance(user, template, YESTERDAY, "completed");

        Optional<WorkoutSessionEntity> found = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc(
                user, template.getId(), TODAY);

        assertThat(found).isPresent();
        assertThat(found.get().getId()).isEqualTo(todayInstance.getId());
        assertThat(found.get().getId()).isNotEqualTo(yesterdayInstance.getId());
        assertThat(found.get().getTemplateSessionId()).isEqualTo(template.getId());
        assertThat(found.get().getDate()).isEqualTo(TODAY);
    }

    @Test
    void testFindInstance_shouldScopeToOwner_whenAnotherUserSharesTemplateAndDate() {
        UUID user = userPopulator.createUser("train-chl-own@test.local").getId();
        UUID other = userPopulator.createUser("train-chl-other@test.local").getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Teszt meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
            user, meso.getId(), "H", "gym", 0, "planned");
        trainPopulator.createWorkoutInstance(user, template, TODAY, "completed");

        // Other user's instance sharing the same template id + date must NOT surface for `other`.
        Optional<WorkoutSessionEntity> foundForOther = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc(
                other, template.getId(), TODAY);

        assertThat(foundForOther).isEmpty();
    }

    @Test
    void testFindSets_shouldReturnOnlyTheInstanceSetsOfThatExercise_orderedBySetIndex() {
        UUID user = userPopulator.createUser("train-chl-sets@test.local").getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Teszt meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
            user, meso.getId(), "H", "gym", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Chest Supported Row", 0);
        ExerciseEntity otherExercise = trainPopulator.createExercise(user, template.getId(), "Lat Pulldown", 1);

        WorkoutSessionEntity todayInstance = trainPopulator.createWorkoutInstance(user, template, TODAY, "completed");
        WorkoutSessionEntity yesterdayInstance =
            trainPopulator.createWorkoutInstance(user, template, YESTERDAY, "completed");

        // Two logged sets of the target exercise in TODAY's instance, planted out of order.
        trainPopulator.createLoggedSet(user, exercise.getId(), todayInstance.getId(), 1, "85.00", 8, 1);
        trainPopulator.createLoggedSet(user, exercise.getId(), todayInstance.getId(), 0, "82.50", 10, 2);
        // Noise that must be excluded: another exercise in the same instance,
        // and the same exercise in a different (yesterday's) instance.
        trainPopulator.createLoggedSet(user, otherExercise.getId(), todayInstance.getId(), 0, "70.00", 12, 1);
        trainPopulator.createLoggedSet(user, exercise.getId(), yesterdayInstance.getId(), 0, "80.00", 9, 1);

        List<ExerciseSetEntity> sets = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(
                user, todayInstance.getId(), exercise.getId());

        assertThat(sets).hasSize(2);
        assertThat(sets).extracting(ExerciseSetEntity::getSetIndex).containsExactly(0, 1);
        assertThat(sets).allSatisfy(s -> {
            assertThat(s.getWorkoutSessionId()).isEqualTo(todayInstance.getId());
            assertThat(s.getExerciseId()).isEqualTo(exercise.getId());
            assertThat(s.getCreatedBy()).isEqualTo(user);
        });
    }
}
