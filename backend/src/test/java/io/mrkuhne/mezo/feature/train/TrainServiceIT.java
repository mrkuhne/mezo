package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesocycleCreateRequest;
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
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
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

    @Test
    void testCreateMesocycle_shouldPersistNestedDaysAndComputeDerivedFields_whenValid() {
        UUID user = databasePopulator.populateUser("create-a@test.local");
        LocalDate start = LocalDate.now().minusDays(7);
        MesocycleCreateRequest req = MesocycleCreateRequest.builder()
            .title("Strength 02 · Nyár")
            .status(MesocycleCreateRequest.StatusEnum.PLANNED)
            .goal("Maximális erő")
            .startDate(start)
            .weeks(6)
            .split("Upper / Lower · 4×/hét")
            .style("Linear · 6 hét")
            .phaseCurve(List.of(
                MesocycleCreateRequest.PhaseCurveEnum.MEV,
                MesocycleCreateRequest.PhaseCurveEnum.MAV,
                MesocycleCreateRequest.PhaseCurveEnum.DELOAD))
            .days(List.of(
                MesoDayInput.builder().day("Hét").type("Upper").muscle("chest+back")
                    .exercises(List.of(
                        GymExerciseInput.builder().name("Bench Press").muscle("chest").sets(4)
                            .targetReps("6-8").targetRIR(2)
                            .type(GymExerciseInput.TypeEnum.COMPOUND).build(),
                        GymExerciseInput.builder().name("Chest Supported Row").muscle("back-mid").sets(3)
                            .targetReps("8-10").targetRIR(1)
                            .type(GymExerciseInput.TypeEnum.COMPOUND).build()))
                    .build(),
                MesoDayInput.builder().day("Kedd").type("Rest").build()))
            .build();

        MesocycleResponse created = trainService.createMesocycle(user, req);
        entityManager.clear();

        assertThat(created.getId()).isNotNull();
        assertThat(created.getEndDate()).isEqualTo(start.plusWeeks(6));
        assertThat(created.getCurrentWeek()).isZero();
        assertThat(created.getShortTitle()).isEqualTo("Strength 02 · Nyár"); // defaults to title
        assertThat(created.getDays()).hasSize(2);
        assertThat(created.getDays().get(0).getExercises())
            .extracting(e -> e.getName()).containsExactly("Bench Press", "Chest Supported Row");

        // DB state: template rows ordered by array order, owned, status planned / date null.
        List<WorkoutSessionEntity> sessions = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(user, List.of(created.getId()));
        assertThat(sessions).hasSize(2);
        assertThat(sessions).extracting(WorkoutSessionEntity::getDayLabel).containsExactly("Hét", "Kedd");
        assertThat(sessions).extracting(WorkoutSessionEntity::getOrderIndex).containsExactly(0, 1);
        assertThat(sessions).allSatisfy(s -> {
            assertThat(s.getCreatedBy()).isEqualTo(user);
            assertThat(s.getStatus()).isEqualTo("planned");
            assertThat(s.getDate()).isNull();
        });
        List<ExerciseEntity> exercises = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(user, List.of(sessions.get(0).getId()));
        assertThat(exercises).extracting(ExerciseEntity::getOrderIndex).containsExactly(0, 1);
        assertThat(exercises).allSatisfy(e -> assertThat(e.getCreatedBy()).isEqualTo(user));
    }

    @Test
    void testCreateMesocycle_shouldComputeCurrentWeek_whenActive() {
        UUID user = databasePopulator.populateUser("create-b@test.local");
        MesocycleCreateRequest base = MesocycleCreateRequest.builder()
            .title("Aktív teszt").status(MesocycleCreateRequest.StatusEnum.ACTIVE)
            .startDate(LocalDate.now().minusDays(8)).weeks(6)
            .split("PPL").style("RP")
            .phaseCurve(List.of(MesocycleCreateRequest.PhaseCurveEnum.MEV))
            .build();
        assertThat(trainService.createMesocycle(user, base).getCurrentWeek()).isEqualTo(2);

        MesocycleCreateRequest future = MesocycleCreateRequest.builder()
            .title("Jövőbeli aktív").status(MesocycleCreateRequest.StatusEnum.ACTIVE)
            .startDate(LocalDate.now().plusDays(7)).weeks(6)
            .split("PPL").style("RP")
            .phaseCurve(List.of(MesocycleCreateRequest.PhaseCurveEnum.MEV))
            .build();
        assertThat(trainService.createMesocycle(user, future).getCurrentWeek()).isEqualTo(1);
    }

    @Test
    void testCreateMesocycle_shouldArchivePreviousActive_whenCreatedAsActive() {
        UUID user = databasePopulator.populateUser("create-c@test.local");
        MesocycleEntity previous = trainPopulator.createMesocycle(user, "Régi aktív", "active");

        MesocycleCreateRequest req = MesocycleCreateRequest.builder()
            .title("Azonnal aktív").status(MesocycleCreateRequest.StatusEnum.ACTIVE)
            .startDate(LocalDate.now()).weeks(4)
            .split("PPL").style("RP")
            .phaseCurve(List.of(MesocycleCreateRequest.PhaseCurveEnum.MEV))
            .build();
        trainService.createMesocycle(user, req);
        entityManager.flush();
        entityManager.clear();

        // The single-active invariant must hold on the create-as-active path too,
        // not only on the explicit activate endpoint (live-smoke regression).
        assertThat(mesocycleRepository.findById(previous.getId()).orElseThrow().getStatus())
            .isEqualTo("archived");
    }

    @Test
    void testActivateMesocycle_shouldArchivePreviousActive_whenAnotherActiveExists() {
        UUID user = databasePopulator.populateUser("lifecycle-a@test.local");
        MesocycleEntity previous = trainPopulator.createMesocycle(user, "Régi aktív", "active");
        MesocycleEntity target = trainPopulator.createMesocycle(user, "Új blokk", "planned");

        MesocycleResponse activated = trainService.activateMesocycle(user, target.getId());
        // The service relies on dirty-checking (commit-time flush in production); inside the
        // test transaction we must flush before clearing or the pending UPDATE is discarded.
        entityManager.flush();
        entityManager.clear();

        assertThat(activated.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
        // Populator meso: 2026-05-01 + 6 weeks -> today is past week 6, clamped to the last week.
        assertThat(activated.getCurrentWeek()).isEqualTo(6);
        assertThat(mesocycleRepository.findById(previous.getId()).orElseThrow().getStatus())
            .isEqualTo("archived"); // single-active invariant
        assertThat(mesocycleRepository.findById(target.getId()).orElseThrow().getStatus())
            .isEqualTo("active");
    }

    @Test
    void testActivateMesocycle_shouldBeIdempotent_whenAlreadyActive() {
        UUID user = databasePopulator.populateUser("lifecycle-b@test.local");
        MesocycleEntity active = trainPopulator.createMesocycle(user, "Aktív marad", "active");

        MesocycleResponse result = trainService.activateMesocycle(user, active.getId());

        assertThat(result.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
        // Idempotent no-op: the populator's currentWeek (3) is untouched, no recompute fired.
        assertThat(result.getCurrentWeek()).isEqualTo(3);
    }

    @Test
    void testCloseMesocycle_shouldArchive_whenActive() {
        UUID user = databasePopulator.populateUser("lifecycle-c@test.local");
        MesocycleEntity active = trainPopulator.createMesocycle(user, "Lezárandó", "active");

        MesocycleResponse closed = trainService.closeMesocycle(user, active.getId());
        entityManager.flush(); // see activate test — dirty-checked UPDATE needs a flush pre-clear
        entityManager.clear();

        assertThat(closed.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ARCHIVED);
        assertThat(mesocycleRepository.findById(active.getId()).orElseThrow().getStatus())
            .isEqualTo("archived");
    }

    @Test
    void testActivateMesocycle_shouldThrowNotFound_whenForeignOwner() {
        UUID owner = databasePopulator.populateUser("lifecycle-d@test.local");
        UUID intruder = databasePopulator.populateUser("lifecycle-e@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Másé", "planned");

        assertThatThrownBy(() -> trainService.activateMesocycle(intruder, meso.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testReplaceDayExercises_shouldSoftDeleteOldAndInsertOrdered_whenValid() {
        UUID user = databasePopulator.populateUser("replace-a@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Szerkesztett", "active");
        WorkoutSessionEntity day =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Hét", "Pull", 0, "planned");
        trainPopulator.createExercise(user, day.getId(), "Régi A", 0);
        trainPopulator.createExercise(user, day.getId(), "Régi B", 1);

        MesoDay updated = trainService.replaceDayExercises(user, meso.getId(), day.getId(), List.of(
            GymExerciseInput.builder().name("Új 1").sets(3).targetReps("8-10").targetRIR(1)
                .type(GymExerciseInput.TypeEnum.COMPOUND).build(),
            GymExerciseInput.builder().name("Új 2").sets(3).targetReps("10-12").targetRIR(2)
                .type(GymExerciseInput.TypeEnum.ISOLATION).build(),
            GymExerciseInput.builder().name("Új 3").sets(2).targetReps("12-15").targetRIR(1)
                .type(GymExerciseInput.TypeEnum.ISOLATION).build()));
        entityManager.flush();
        entityManager.clear();

        assertThat(updated.getId()).isEqualTo(day.getId());
        assertThat(updated.getExercises()).extracting(e -> e.getName())
            .containsExactly("Új 1", "Új 2", "Új 3");
        assertThat(updated.getExerciseCount()).isEqualTo(3);

        List<ExerciseEntity> fresh = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(user, List.of(day.getId()));
        assertThat(fresh).extracting(ExerciseEntity::getName).containsExactly("Új 1", "Új 2", "Új 3");
        assertThat(fresh).extracting(ExerciseEntity::getOrderIndex).containsExactly(0, 1, 2);

        // The old rows are soft-deleted, not physically removed (house rule).
        Number softDeleted = (Number) entityManager.createNativeQuery(
                "select count(*) from exercise where workout_session_id = ?1 and is_deleted = true")
            .setParameter(1, day.getId())
            .getSingleResult();
        assertThat(softDeleted.longValue()).isEqualTo(2);
    }

    @Test
    void testReplaceDayExercises_shouldThrowNotFound_whenDayBelongsToOtherMeso() {
        UUID user = databasePopulator.populateUser("replace-b@test.local");
        MesocycleEntity mesoA = trainPopulator.createMesocycle(user, "A blokk", "active");
        MesocycleEntity mesoB = trainPopulator.createMesocycle(user, "B blokk", "planned");
        WorkoutSessionEntity dayOfB =
            trainPopulator.createWorkoutSession(user, mesoB.getId(), "Hét", "Pull", 0, "planned");

        assertThatThrownBy(() -> trainService.replaceDayExercises(user, mesoA.getId(), dayOfB.getId(), List.of()))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testListMesocycles_shouldExposeDayIds_whenDaysExist() {
        UUID user = databasePopulator.populateUser("dayid@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Id-s napok", "active");
        WorkoutSessionEntity day =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Hét", "Pull", 0, "planned");

        List<MesocycleResponse> responses = trainService.listMesocycles(user);

        assertThat(responses.get(0).getDays()).singleElement()
            .satisfies(d -> assertThat(d.getId()).isEqualTo(day.getId()));
    }

    @Test
    void testListMesocycles_shouldExcludeInstanceRows_whenInstancesExist() {
        UUID user = databasePopulator.populateUser("train@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Csü", "Pull Day", 0, "planned");
        trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");

        List<MesocycleResponse> mesos = trainService.listMesocycles(user);

        assertThat(mesos).hasSize(1);
        // only the template day appears — the started instance must not duplicate it
        assertThat(mesos.get(0).getDays()).hasSize(1);
        assertThat(mesos.get(0).getDays().get(0).getId()).isEqualTo(template.getId());
    }
}
