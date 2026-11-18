package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleVolumeArcResponse;
import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.api.dto.VolumeArcWeek;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.VolumeArcService;
import io.mrkuhne.mezo.feature.train.service.WeekProposalService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Read-only whole-mesocycle volume arc endpoint (Phase B, Task B2): per-muscle planned line (volume
 * engine v2 path: past weeks as prescribed, later weeks projected from the plan) + logged actuals
 * bucketed to meso-weeks, up to {@code currentWeek}; future weeks carry {@code planned} with a
 * {@code null actual}.
 */
class VolumeArcContractIT extends ApiIntegrationTest {

    @Autowired TrainPopulator train;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository volumeLogRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired WeekProposalService weekProposals;
    @Autowired VolumeArcService volumeArcService;
    @Autowired TrainService trainService;

    @Test
    void testGetMesocycleVolumeArc_shouldReturnActualsAndPlannedScaffold_whenMesoHasLoggedWeeks() {
        UUID owner = ownerId();
        // startDate 2 weeks ago, 6-week meso -> calendar week 3; currentWeek persisted explicitly (arc
        // uses the stored field, not clampWeek — activeMesoStartedWeeksAgo defaults it to 1).
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        meso.setCurrentWeek(3);
        mesocycleRepository.saveAndFlush(meso);

        train.createVolumeLog(owner, meso.getId(), "chest", 14);
        // 14 chest working sets logged in week 2's window (targetHit, no grind).
        train.completedChestSetsInWeek(owner, meso, 2, 14, 1, 1);

        MesocycleVolumeArcResponse res = getForBody(
            "/api/train/mesocycles/" + meso.getId() + "/volume-arc",
            ownerAuthHeaders(), HttpStatus.OK, MesocycleVolumeArcResponse.class);

        assertThat(res.getMesocycleId()).isEqualTo(meso.getId());
        assertThat(res.getCurrentWeek()).isEqualTo(3);
        assertThat(res.getWeeks()).isEqualTo(6);

        MuscleVolumeArc chest = res.getMuscles().stream()
            .filter(m -> m.getMuscle().equals("chest"))
            .findFirst()
            .orElseThrow(() -> new AssertionError("chest muscle missing from arc response: " + res));
        assertThat(chest.getRegion()).isEqualTo("coral");
        assertThat(chest.getMrv()).isEqualTo(20);
        assertThat(chest.getWeeks()).hasSize(6);

        VolumeArcWeek week2 = chest.getWeeks().get(1); // 1-based week 2 -> index 1
        assertThat(week2.getWeek()).isEqualTo(2);
        assertThat(week2.getActual()).isEqualTo(14);
        assertThat(week2.getIsCurrent()).isFalse();

        VolumeArcWeek week3 = chest.getWeeks().get(2); // current week
        assertThat(week3.getWeek()).isEqualTo(3);
        assertThat(week3.getIsCurrent()).isTrue();

        VolumeArcWeek week6 = chest.getWeeks().get(5); // future week: planned only
        assertThat(week6.getWeek()).isEqualTo(6);
        assertThat(week6.getActual()).isNull();
        assertThat(week6.getPlanned()).isNotNull();
        assertThat(week6.getIsCurrent()).isFalse();
    }

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");
    private static final List<String> DELOAD_IN_WEEK_3 = List.of("MEV", "MAV", "Deload", "MEV", "MAV", "MRV");

    /**
     * A derived ledger row on a run in its first week, with the plan's exercises: {@code daySets} is
     * one array per template day (Mon, Thu, …), each entry one exercise's working sets.
     */
    private List<Integer> plannedOf(String muscle, String tier, Integer bandLow, Integer bandHigh, int[]... daySets) {
        UUID owner = ownerId();
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 0, 6, NO_DELOAD);
        meso.setMusclePriorities(Map.of(muscle, tier));
        mesocycleRepository.saveAndFlush(meso);
        int total = 0;
        for (int d = 0; d < daySets.length; d++) {
            WorkoutSessionEntity day = train.createWorkoutSession(owner, meso.getId(), "Nap " + d, "gym", d * 3, "active");
            for (int i = 0; i < daySets[d].length; i++) {
                exercise(owner, day, muscle + "-" + d + "-" + i, muscle, daySets[d][i], i);
                total += daySets[d][i];
            }
        }
        var row = train.createVolumeLog(owner, meso.getId(), muscle, total);
        row.setBandLow(bandLow);
        row.setBandHigh(bandHigh);
        volumeLogRepository.saveAndFlush(row);

        MesocycleVolumeArcResponse res = getForBody(
            "/api/train/mesocycles/" + meso.getId() + "/volume-arc",
            ownerAuthHeaders(), HttpStatus.OK, MesocycleVolumeArcResponse.class);
        return planned(res, muscle);
    }

    @Test
    void aMaintainedGroupPlansItsOwnSetsEveryWeek() {
        assertThat(plannedOf("chest", "maintain", 3, 7, new int[] {2})).containsExactly(2, 2, 2, 2, 2, 1);
    }

    @Test
    void aGrowGroupRampsFromThePlanToItsBandTop() {
        // Mon 4 + 2, Thu 3 + 2: +1 a week into the lightest slot; the deload halves each exercise (⌈4/2⌉ × 4)
        assertThat(plannedOf("back", "grow", 10, 16, new int[] {4, 2}, new int[] {3, 2}))
            .containsExactly(11, 12, 13, 14, 15, 8);
    }

    @Test
    void legacyRowKeepsAScaffold() {
        // archived model-1 shape (no band): week 1 = the row's MEV (8), +1 a week (grow step) toward its MAV,
        // the deload week halves (⌈12/2⌉)
        assertThat(plannedOf("chest", "grow", null, null)).containsExactly(8, 9, 10, 11, 12, 6);
    }

    /**
     * The run sits in its deload week: the weeks before it show the pre-deload plan, the week itself the
     * halved one, and the weeks after it start from the restored amounts — not from the halved ones.
     */
    @Test
    void deloadMidRunPlansFromTheRestoredAmounts() {
        UUID user = databasePopulator.populateUser("arc-deload@test.local");
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(user, 2, 6, DELOAD_IN_WEEK_3);
        meso.setMusclePriorities(Map.of("quad", "grow"));
        mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(user, meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(user, meso.getId(), "Csütörtök", "gym", 3, "active");
        exercise(user, mon, "Guggolás", "quad", 4, 0);
        exercise(user, thu, "Lábnyújtás", "quad", 4, 0);

        weekProposals.generateIfDue(user, reload(meso)); // week 3 = deload: 4 + 4 → 2 + 2
        assertThat(reload(meso).getCurrentWeek()).isEqualTo(3);

        // weeks 1–2: the plan before the deload (8); week 3: halved (4); week 4: restored to 8, +1 (grow)
        // = 9; week 5: 10; week 6: both exercises at the 5-set cap = 10
        assertThat(planned(volumeArcService.arc(user, meso.getId()), "quad"))
            .containsExactly(8, 8, 4, 9, 10, 10);
    }

    /**
     * The owner edits a row during the deload week: his number stands for the week after (the weekly
     * proposal keeps it), so the projection does not plan from the pre-deload amount for that row.
     */
    @Test
    void anOwnerEditDuringTheDeloadWeekStandsInTheProjection() {
        UUID user = databasePopulator.populateUser("arc-deload-edit@test.local");
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(user, 2, 6, DELOAD_IN_WEEK_3);
        meso.setMusclePriorities(Map.of("quad", "grow"));
        mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(user, meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(user, meso.getId(), "Csütörtök", "gym", 3, "active");
        ExerciseEntity squat = exercise(user, mon, "Guggolás", "quad", 4, 0);
        exercise(user, thu, "Lábnyújtás", "quad", 4, 0);
        weekProposals.generateIfDue(user, reload(meso)); // week 3 = deload: 4 + 4 → 2 + 2

        ExerciseEntity edited = fresh(squat);
        edited.setWorkingSets(1); // the owner pushes the squat from 2 to 1 during the deload week
        train.save(edited);

        // weeks 1–2: 8; week 3: 1 + 2 = 3; week 4: the squat keeps his 1, the extension restores to 4 = 5,
        // +1 (grow) = 6; then 7, 8
        assertThat(planned(volumeArcService.arc(user, meso.getId()), "quad"))
            .containsExactly(8, 8, 3, 6, 7, 8);
    }

    /**
     * The Monday is re-saved during the deload week (new rows): the projected week after still restores
     * the re-minted squat, found by identity on the same day — as the weekly proposal will.
     */
    @Test
    void aDayReMintedDuringTheDeloadStillProjectsTheRestore() {
        UUID user = databasePopulator.populateUser("arc-deload-remint@test.local");
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(user, 2, 6, DELOAD_IN_WEEK_3);
        meso.setMusclePriorities(Map.of("quad", "grow"));
        mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(user, meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(user, meso.getId(), "Csütörtök", "gym", 3, "active");
        ExerciseEntity squat = exercise(user, mon, "Guggolás", "quad", 4, 0);
        exercise(user, thu, "Lábnyújtás", "quad", 4, 0);
        weekProposals.generateIfDue(user, reload(meso)); // week 3 = deload: 4 + 4 → 2 + 2

        trainService.replaceDayExercises(user, meso.getId(), mon.getId(), List.of(
            input("Guggolás", "quad", fresh(squat).getWorkingSets())));

        // same line as without the edit: weeks 1–2 = 8 (the old rows resolve), week 3 = 4, week 4 restored
        // to 8 and +1 = 9, then 10, then both at the 5-set cap
        assertThat(planned(volumeArcService.arc(user, meso.getId()), "quad"))
            .containsExactly(8, 8, 4, 9, 10, 10);
    }

    /**
     * Two weekly proposals applied, then a day edit re-mints the Monday rows: the past weeks still show
     * what each week prescribed (the soft-deleted rows resolve), the current week the plan as it stands.
     */
    @Test
    void pastWeeksShowWhatWasPrescribed() {
        UUID user = databasePopulator.populateUser("arc-past@test.local");
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(user, 1, 6, NO_DELOAD);
        meso.setMusclePriorities(Map.of("back", "grow"));
        mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(user, meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(user, meso.getId(), "Csütörtök", "gym", 3, "active");
        ExerciseEntity mon4 = exercise(user, mon, "Evezés", "back-mid", 4, 0);
        ExerciseEntity mon2 = exercise(user, mon, "Lehúzás", "back-wide", 2, 1);
        ExerciseEntity thu3 = exercise(user, thu, "Kábeles evezés", "back-mid", 3, 0);
        ExerciseEntity thu2 = exercise(user, thu, "Húzódzkodás", "back-wide", 2, 1);

        logWeek(user, meso, 1, mon, 0, mon4, mon2);
        logWeek(user, meso, 1, thu, 3, thu3, thu2);
        weekProposals.generateIfDue(user, reload(meso)); // week 2: 11 → 12 (Thu 2 → 3)

        nextWeek(meso);
        logWeek(user, meso, 2, mon, 0, fresh(mon4), fresh(mon2));
        logWeek(user, meso, 2, thu, 3, fresh(thu3), fresh(thu2));
        weekProposals.generateIfDue(user, reload(meso)); // week 3: 12 → 13 (Mon 2 → 3)
        assertThat(reload(meso).getCurrentWeek()).isEqualTo(3);

        // the Monday re-saved through the real day edit: new rows, same sets
        trainService.replaceDayExercises(user, meso.getId(), mon.getId(), List.of(
            input("Evezés", "back-mid", fresh(mon4).getWorkingSets()),
            input("Lehúzás", "back-wide", fresh(mon2).getWorkingSets())));

        // week 1: 11, week 2: 12, week 3 (current): 13; then +1 a week (14, 15); the deload halves each = 8
        assertThat(planned(volumeArcService.arc(user, meso.getId()), "back"))
            .containsExactly(11, 12, 13, 14, 15, 8);
    }

    private static List<Integer> planned(MesocycleVolumeArcResponse res, String muscle) {
        return res.getMuscles().stream().filter(m -> m.getMuscle().equals(muscle)).findFirst().orElseThrow()
            .getWeeks().stream().map(VolumeArcWeek::getPlanned).toList();
    }

    private ExerciseEntity exercise(UUID user, WorkoutSessionEntity day, String name, String muscle, int sets,
                                    int order) {
        ExerciseEntity e = train.createExercise(user, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        e.setOrderIndex(order);
        return train.save(e);
    }

    /** One completed instance of {@code day} in {@code week}, every planned set of {@code exercises} logged. */
    private void logWeek(UUID user, MesocycleEntity meso, int week, WorkoutSessionEntity day, int dayOffset,
                         ExerciseEntity... exercises) {
        WorkoutSessionEntity instance = train.createWorkoutInstance(user, day,
            reload(meso).getStartDate().plusDays(7L * (week - 1) + dayOffset), "completed");
        int i = 0;
        for (ExerciseEntity e : exercises) {
            for (int s = 0; s < e.getWorkingSets(); s++) {
                train.createLoggedSet(user, e.getId(), instance.getId(), i++, "60", 8, 0);
            }
        }
    }

    /** "A week later": the run started one more week ago. */
    private void nextWeek(MesocycleEntity meso) {
        MesocycleEntity later = reload(meso);
        later.setStartDate(later.getStartDate().minusWeeks(1));
        later.setEndDate(later.getEndDate().minusWeeks(1));
        mesocycleRepository.saveAndFlush(later);
    }

    private ExerciseEntity fresh(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow();
    }

    private MesocycleEntity reload(MesocycleEntity meso) {
        return mesocycleRepository.findById(meso.getId()).orElseThrow();
    }

    private static GymExerciseInput input(String name, String muscle, int sets) {
        return GymExerciseInput.builder().name(name).muscle(muscle).warmupSets(2).workingSets(sets)
            .repMin(6).repMax(8).targetRIR(1).type(GymExerciseInput.TypeEnum.COMPOUND).build();
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
