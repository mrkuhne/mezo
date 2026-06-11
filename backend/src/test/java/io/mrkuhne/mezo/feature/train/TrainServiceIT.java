package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service/repository-level tests for the Train aggregate. Starts here by pinning the two
 * non-trivial column mappings on {@code mesocycle}: the {@code text[]} phase curve and the
 * typed-jsonb {@code volume_recompute} audit (grows with the service in Tasks 5–7).
 */
@Transactional
class TrainServiceIT extends AbstractIntegrationTest {

    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private ExerciseSetRepository exerciseSetRepository;
    @Autowired private SportSessionRepository sportSessionRepository;
    @Autowired private TrainService trainService;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testSaveMesocycle_shouldRoundTripArrayAndRecomputeJson_whenPersisted() {
        UUID user = databasePopulator.populateUser("train@test.local");
        MesocycleEntity saved = trainPopulator.createMesocycle(user, "Hypertrophy 04", "active");

        // Force a REAL round-trip: drop the persistence context so findById must hydrate from the
        // DB row rather than return the still-managed L1-cache instance.
        entityManager.clear();

        MesocycleEntity reloaded = mesocycleRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getPhaseCurve()).containsExactly("MEV", "MAV", "Deload");
        assertThat(reloaded.getVolumeRecompute()).isNotNull();
        assertThat(reloaded.getVolumeRecompute().changes()).hasSize(1);
        assertThat(reloaded.getVolumeRecompute().changes().get(0).muscle()).isEqualTo("back");
    }

    @Test
    void testWorkoutDays_shouldReturnExercisesInOrder_whenOrderIndexSet() {
        UUID user = databasePopulator.populateUser("days@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Hypertrophy 04", "active");

        WorkoutSessionEntity day0 =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Hétfő", "push", 0, "planned");
        trainPopulator.createWorkoutSession(user, meso.getId(), "Szerda", "pull", 1, "active");

        // Insert exercises OUT of order (index 1 first, then index 0) to prove the ORDER BY.
        trainPopulator.createExercise(user, day0.getId(), "Fekvenyomás", 1);
        trainPopulator.createExercise(user, day0.getId(), "Guggolás", 0);

        entityManager.clear();

        List<WorkoutSessionEntity> sessions =
            workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(
                user, List.of(meso.getId()));
        assertThat(sessions).extracting(WorkoutSessionEntity::getOrderIndex)
            .containsExactly(0, 1);

        List<ExerciseEntity> exercises =
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                user, List.of(day0.getId()));
        assertThat(exercises).extracting(ExerciseEntity::getOrderIndex)
            .containsExactly(0, 1);
        // Ordered finder reverses the insertion order: "Guggolás" (index 0) comes first.
        assertThat(exercises).extracting(ExerciseEntity::getName)
            .containsExactly("Guggolás", "Fekvenyomás");
    }

    @Test
    void testSaveExerciseSet_shouldRoundTripWeightKg_whenReloaded() {
        UUID user = databasePopulator.populateUser("set@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Hypertrophy 04", "active");
        WorkoutSessionEntity day =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, day.getId(), "Guggolás", 0);
        ExerciseSetEntity saved = trainPopulator.createExerciseSet(user, exercise.getId(), 0);

        // Force a REAL round-trip so the numeric(6,2) value is rehydrated from the DB row.
        entityManager.clear();

        ExerciseSetEntity reloaded = exerciseSetRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getWeightKg()).isEqualByComparingTo(new BigDecimal("82.50"));
        assertThat(reloaded.getReps()).isEqualTo(8);
        assertThat(reloaded.getSetIndex()).isZero();
    }

    @Test
    void testSportSessions_shouldReturnDateDescending_whenListed() {
        UUID user = databasePopulator.populateUser("sport@test.local");

        // Insert in NON-sorted order so the finder's ORDER BY date DESC must do the work.
        trainPopulator.createSportSession(user, LocalDate.parse("2026-05-11"));
        trainPopulator.createSportSession(user, LocalDate.parse("2026-05-20"));
        trainPopulator.createSportSession(user, LocalDate.parse("2026-05-15"));

        entityManager.clear();

        List<SportSessionEntity> sessions =
            sportSessionRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(user);
        assertThat(sessions).extracting(SportSessionEntity::getDate)
            .containsExactly(
                LocalDate.parse("2026-05-20"),
                LocalDate.parse("2026-05-15"),
                LocalDate.parse("2026-05-11"));

        // Ownership isolation: a second user sees none of the first user's sessions.
        UUID otherUser = databasePopulator.populateUser("sport-b@test.local");
        assertThat(sportSessionRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(otherUser))
            .isEmpty();
    }

    @Test
    void testListMesocycles_shouldAssembleNestedResponse_whenVolumeAndDaysExist() {
        UUID userA = databasePopulator.populateUser("meso-a@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(userA, "Hypertrophy 04", "active");
        trainPopulator.createVolumeLog(userA, meso.getId(), "chest");
        trainPopulator.createVolumeLog(userA, meso.getId(), "back");

        WorkoutSessionEntity day0 =
            trainPopulator.createWorkoutSession(userA, meso.getId(), "Hétfő", "push", 0, "planned");
        // Second session is the active/current one and carries the muscle accent flag.
        trainPopulator.createWorkoutSession(userA, meso.getId(), "Szerda", "pull", 1, "active", true);
        trainPopulator.createExercise(userA, day0.getId(), "Guggolás", 0);
        trainPopulator.createExercise(userA, day0.getId(), "Fekvenyomás", 1);

        // User B owns an unrelated mesocycle that must NOT leak into user A's view.
        UUID userB = databasePopulator.populateUser("meso-b@test.local");
        trainPopulator.createMesocycle(userB, "Strength B", "planned");

        List<MesocycleResponse> responses = trainService.listMesocycles(userA);

        assertThat(responses).hasSize(1);
        MesocycleResponse r = responses.get(0);
        assertThat(r.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
        assertThat(r.getVolumePerMuscle()).containsOnlyKeys("chest", "back");
        assertThat(r.getVolumePerMuscle().get("chest").getCurrent()).isEqualTo(14);
        assertThat(r.getVolumePerMuscle().get("chest").getSource().getBaseline().getName())
            .isEqualTo("RP guidelines · intermediate");
        assertThat(r.getPhaseCurve()).containsExactly(
            MesocycleResponse.PhaseCurveEnum.MEV,
            MesocycleResponse.PhaseCurveEnum.MAV,
            MesocycleResponse.PhaseCurveEnum.DELOAD);

        assertThat(r.getDays()).hasSize(2);
        assertThat(r.getDays().get(0).getExerciseCount()).isEqualTo(2);
        assertThat(r.getDays().get(0).getCurrent()).isNull();
        assertThat(r.getDays().get(1).getCurrent()).isTrue();
        assertThat(r.getDays().get(1).getMuscleAccent()).isTrue();

        // Ownership isolation: user B sees only their own (empty volume/days) mesocycle.
        List<MesocycleResponse> bResponses = trainService.listMesocycles(userB);
        assertThat(bResponses).hasSize(1);
        assertThat(bResponses.get(0).getTitle()).isEqualTo("Strength B");
    }
}
