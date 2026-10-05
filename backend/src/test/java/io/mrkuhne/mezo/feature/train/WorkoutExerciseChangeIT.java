package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutDetailExercise;
import io.mrkuhne.mezo.api.dto.WorkoutExerciseChangeRequest;
import io.mrkuhne.mezo.api.dto.WorkoutExerciseChangeRequest.ScopeEnum;
import io.mrkuhne.mezo.api.dto.WorkoutExerciseChangeResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutExerciseChangeService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mid-workout exercise swap / add (mezo-mobji): "Csak ma" lives on the instance only,
 * "Mezociklusra is" also writes the template day id-stably and takes effect from the next session;
 * a swapped-out exercise keeps the sets it already has.
 */
@Transactional
class WorkoutExerciseChangeIT extends AbstractIntegrationTest {

    @Autowired private WorkoutService workoutService;
    @Autowired private WorkoutExerciseChangeService changeService;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID user;
    private WorkoutSessionEntity day;
    private ExerciseEntity rowA;
    private ExerciseEntity rowB;
    private WorkoutSessionEntity instance;

    @BeforeEach
    void setUp() {
        user = databasePopulator.populateUser("swap@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        day = trainPopulator.createTemplateDay(user, meso.getId(), "Szo");
        rowA = trainPopulator.createExercise(user, day.getId(), "Chest Supported Row", 0);
        rowB = trainPopulator.createExercise(user, day.getId(), "Face Pull", 1);
        instance = trainPopulator.createWorkoutInstance(user, day, LocalDate.now(), "active");
    }

    private static WorkoutExerciseChangeRequest req(String name, ScopeEnum scope, UUID replaces, int workingSets) {
        return WorkoutExerciseChangeRequest.builder()
            .name(name).muscle("back-mid").type(WorkoutExerciseChangeRequest.TypeEnum.COMPOUND)
            .warmupSets(1).workingSets(workingSets).repMin(8).repMax(10).targetRIR(1)
            .scope(scope).replacesExerciseId(replaces)
            .build();
    }

    private void log(UUID exerciseId, int setIndex) {
        workoutService.logSet(user, instance.getId(), SetLogRequest.builder()
            .exerciseId(exerciseId).setIndex(setIndex).weightKg(new BigDecimal("100")).reps(9).rir(1)
            .kind("working").build());
    }

    /** The fixed closing block (on in tests) ends every day — adds must land before it. */
    private static String[] withClosing(String... names) {
        String[] out = java.util.Arrays.copyOf(names, names.length + 2);
        out[names.length] = "Dead Hang";
        out[names.length + 1] = "45° Back Extension";
        return out;
    }

    private static List<String> names(WorkoutTodayResponse r) {
        return r.getExercises().stream().map(TodayExercise::getName).toList();
    }

    private static TodayExercise named(WorkoutTodayResponse r, String name) {
        return r.getExercises().stream().filter(e -> e.getName().equals(name)).findFirst().orElseThrow();
    }

    @Test
    void testChange_shouldAddForTodayOnly_whenScopeToday() {
        WorkoutExerciseChangeResponse res =
            changeService.change(user, instance.getId(), req("Lateral Raise", ScopeEnum.TODAY, null, 3));

        assertThat(names(res.getToday())).containsExactly(withClosing("Chest Supported Row", "Face Pull", "Lateral Raise"));
        TodayExercise added = named(res.getToday(), "Lateral Raise");
        assertThat(added.getId()).isEqualTo(res.getExerciseId());
        assertThat(added.getChangeScope()).isEqualTo(TodayExercise.ChangeScopeEnum.TODAY);
        assertThat(added.getPlanSlot()).isFalse();
        assertThat(added.getWorkingSets()).isEqualTo(3);
        assertThat(named(res.getToday(), "Face Pull").getPlanSlot()).isTrue();

        log(res.getExerciseId(), 0); // an instance row is a loggable target
        WorkoutTodayResponse reload = workoutService.getToday(user, null);
        assertThat(names(reload)).containsExactly(withClosing("Chest Supported Row", "Face Pull", "Lateral Raise"));
        assertThat(workoutService.getWorkoutDetail(user, instance.getId()).getExercises())
            .extracting(WorkoutDetailExercise::getName).contains("Lateral Raise");
        // the plan itself is untouched
        assertThat(exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(user, List.of(day.getId())))
            .extracting(ExerciseEntity::getName).containsExactly(withClosing("Chest Supported Row", "Face Pull"));
    }

    @Test
    void testChange_shouldTakeTheSlot_whenSwappingAnExerciseWithNoSets() {
        WorkoutExerciseChangeResponse res = changeService.change(
            user, instance.getId(), req("Seated Cable Row", ScopeEnum.TODAY, rowA.getId(), 3));

        assertThat(names(res.getToday())).containsExactly(withClosing("Seated Cable Row", "Face Pull"));
        assertThat(named(res.getToday(), "Seated Cable Row").getReplacesName()).isEqualTo("Chest Supported Row");
    }

    @Test
    void testChange_shouldKeepTheLoggedSets_whenSwappingMidExercise() {
        log(rowA.getId(), 0);
        log(rowA.getId(), 1);

        WorkoutExerciseChangeResponse res = changeService.change(
            user, instance.getId(), req("Seated Cable Row", ScopeEnum.TODAY, rowA.getId(), 1));

        assertThat(names(res.getToday())).containsExactly(withClosing("Chest Supported Row", "Seated Cable Row", "Face Pull"));
        TodayExercise old = named(res.getToday(), "Chest Supported Row");
        assertThat(old.getWorkingSets()).isEqualTo(2);
        assertThat(old.getReplacedByName()).isEqualTo("Seated Cable Row");
        assertThat(old.getPlanSlot()).isFalse();
        assertThat(named(res.getToday(), "Seated Cable Row").getWorkingSets()).isEqualTo(1);
    }

    @Test
    void testChange_shouldWriteThePlanFromTheNextSession_whenScopeMeso() {
        log(rowA.getId(), 0);

        WorkoutExerciseChangeResponse res = changeService.change(
            user, instance.getId(), req("Seated Cable Row", ScopeEnum.MESO, rowA.getId(), 2));

        // today: the swapped-out row with its set, the instance row once, no duplicate template row
        assertThat(names(res.getToday())).containsExactly(withClosing("Chest Supported Row", "Seated Cable Row", "Face Pull"));
        assertThat(named(res.getToday(), "Seated Cable Row").getChangeScope())
            .isEqualTo(TodayExercise.ChangeScopeEnum.MESO);
        // the plan: the new movement in the slot with the slot's shape; the untouched row keeps its id
        List<ExerciseEntity> plan =
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(user, List.of(day.getId()));
        assertThat(plan).extracting(ExerciseEntity::getName).containsExactly(withClosing("Seated Cable Row", "Face Pull"));
        assertThat(plan.get(0).getWorkingSets()).isEqualTo(rowA.getWorkingSets());
        assertThat(plan.get(1).getId()).isEqualTo(rowB.getId());

        // the review of this workout still lists the swapped-out exercise with its set
        WorkoutDetailExercise reviewed = workoutService.getWorkoutDetail(user, instance.getId()).getExercises()
            .stream().filter(e -> e.getName().equals("Chest Supported Row")).findFirst().orElseThrow();
        assertThat(reviewed.getSets()).hasSize(1);

        // the next session runs the new plan
        instance.setStatus("completed");
        trainPopulator.save(instance);
        trainPopulator.createWorkoutInstance(user, day, LocalDate.now(), "active");
        WorkoutTodayResponse next = workoutService.getToday(user, null);
        assertThat(names(next)).containsExactly(withClosing("Seated Cable Row", "Face Pull"));
        assertThat(named(next, "Seated Cable Row").getChangeScope()).isNull();
        assertThat(named(next, "Seated Cable Row").getPlanSlot()).isTrue();
    }

    @Test
    void testChange_shouldAppendToThePlanHiddenToday_whenAddingForTheMeso() {
        WorkoutExerciseChangeResponse res =
            changeService.change(user, instance.getId(), req("Lateral Raise", ScopeEnum.MESO, null, 3));

        assertThat(names(res.getToday())).containsExactly(withClosing("Chest Supported Row", "Face Pull", "Lateral Raise"));
        List<ExerciseEntity> plan =
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(user, List.of(day.getId()));
        assertThat(plan).extracting(ExerciseEntity::getId).startsWith(rowA.getId(), rowB.getId());
        // the closing block stays last: the add takes its place and the block shifts down
        assertThat(plan).extracting(ExerciseEntity::getName)
            .containsExactly(withClosing("Chest Supported Row", "Face Pull", "Lateral Raise"));
        assertThat(plan.get(2).getAddedInWorkoutId()).isEqualTo(instance.getId());
    }

    @Test
    void testChange_shouldRejectMeso_whenTheExerciseHasNoPlanSlot() {
        WorkoutExerciseChangeResponse added =
            changeService.change(user, instance.getId(), req("Lateral Raise", ScopeEnum.TODAY, null, 3));

        assertThatThrownBy(() -> changeService.change(
                user, instance.getId(), req("Cable Fly", ScopeEnum.MESO, added.getExerciseId(), 3)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_EXERCISE_NO_PLAN_SLOT");
    }

    @Test
    void testChange_shouldNotFind_whenTheWorkoutIsForeign() {
        UUID stranger = databasePopulator.populateUser("stranger@test.local");

        assertThatThrownBy(() -> changeService.change(
                stranger, instance.getId(), req("Lateral Raise", ScopeEnum.TODAY, null, 3)))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testChange_shouldConflict_whenTheWorkoutIsFinished() {
        instance.setStatus("completed");
        trainPopulator.save(instance);

        assertThatThrownBy(() -> changeService.change(
                user, instance.getId(), req("Lateral Raise", ScopeEnum.TODAY, null, 3)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_WORKOUT_NOT_ACTIVE");
    }

    @Test
    void testAddPlanWorkingSets_shouldKeepEveryId_whenAddingASetForEveryWeek() {
        changeService.addPlanWorkingSets(user, instance.getId(), rowA.getId(), 1);

        List<ExerciseEntity> plan =
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(user, List.of(day.getId()));
        assertThat(plan).extracting(ExerciseEntity::getId).startsWith(rowA.getId(), rowB.getId());
        assertThat(plan.get(0).getWorkingSets()).isEqualTo(4);
    }

    @Test
    void testAddPlanWorkingSets_shouldRejectAnInstanceRow_whenAddedForTodayOnly() {
        WorkoutExerciseChangeResponse added =
            changeService.change(user, instance.getId(), req("Lateral Raise", ScopeEnum.TODAY, null, 3));

        assertThatThrownBy(() -> changeService.addPlanWorkingSets(user, instance.getId(), added.getExerciseId(), 1))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_EXERCISE_NO_PLAN_SLOT");
    }
}
