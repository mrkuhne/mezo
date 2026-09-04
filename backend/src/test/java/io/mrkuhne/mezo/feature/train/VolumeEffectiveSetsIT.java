package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CustomWorkoutResponse;
import io.mrkuhne.mezo.api.dto.CustomWorkoutUpsertRequest;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WorkoutDayAdjustmentPopulator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Task A5 (mezo-hi9m): getToday's volume rollover + phase-index fix (DA1) + effective
 * per-exercise set distribution (DA6). Volume switch is ON by default
 * (mezo.feature.volume-progression.enabled=true) — every test here runs against the default
 * Spring context; the switch-OFF parity case lives in {@link VolumeEffectiveSetsSwitchOffIT}
 * (a separate class, since a {@code @ConditionalOnProperty} bean's presence is fixed per context).
 *
 * <p>Each meso here pins {@code volumeRecompute.lastRun} far ahead of any calendar week its
 * fixture {@code startDate} could clamp to, so {@code rolloverIfDue}'s idempotent bail-out (DA3)
 * makes the call a guaranteed no-op — the seeded {@code currentSets}/{@code currentWeek} stick
 * exactly as set up, so the test exercises ONLY the distribution + phase-index math (Task A5),
 * not the rollover recompute itself (already covered by {@code VolumeProgressionServiceIT}).
 */
class VolumeEffectiveSetsIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired TrainService trainService;
    @Autowired WorkoutDayAdjustmentPopulator workoutDayAdjustmentPopulator;

    @Test
    void testGetToday_shouldDistributeEffectiveSets_whenChestVolumeLogExceedsTemplateSum() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        // Two chest exercises, template workingSets 3 + 2 (sum 5) — well under the volume log's
        // currentSets(14), so the effective distribution must exceed each template count.
        ExerciseEntity benchPress = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        benchPress.setWorkingSets(3);
        train.save(benchPress);
        ExerciseEntity flye = train.createExercise(owner, day.getId(), "Cable Flye", 1, "chest", "isolation", null);
        flye.setWorkingSets(2);
        train.save(flye);
        train.createVolumeLog(owner, meso.getId(), "chest", 14);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        // Base-1 + largest-remainder: base 1/1 (remaining 12), shares 12*3/5=7.2, 12*2/5=4.8 ->
        // floors 7/4 (sum 11, leftover 1) -> leftover to the larger fraction (flye 0.8) ->
        // extra 7/5 -> effective 8/6 (sum 14).
        TodayExercise benchTe = byId(res, benchPress.getId());
        TodayExercise flyeTe = byId(res, flye.getId());
        assertThat(benchTe.getWorkingSets()).isEqualTo(8);
        assertThat(flyeTe.getWorkingSets()).isEqualTo(6);
        assertThat(benchTe.getWorkingSets() + flyeTe.getWorkingSets()).isEqualTo(14);
        // Both template counts (3 and 2) are exceeded by the effective distribution.
        assertThat(benchTe.getWorkingSets()).isGreaterThan(3);
        assertThat(flyeTe.getWorkingSets()).isGreaterThan(2);
        // Prescribed working-set rows follow the effective count, not the template one.
        long workingRows = benchTe.getPrescribedSets().stream()
            .filter(p -> p.getKind() == io.mrkuhne.mezo.api.dto.PrescribedSet.KindEnum.WORKING)
            .count();
        assertThat(workingRows).isEqualTo(8);
        // The closing-block's back exercises carry no "back" volume-log row -> untouched (DA5).
        assertThat(res.getExercises()).anySatisfy(e -> assertThat(e.getMuscle()).contains("back"));
    }

    @Test
    void testGetToday_shouldPreserveGroupTargetSum_whenThreeExercisesShareTheGroup() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        // Three chest exercises, template workingSets 5 + 4 + 1 (sum 10), group currentSets(9) —
        // below the template sum, so a naive floor-then-clamp-to->=1 distribution overshoots
        // (regression case for mezo-hi9m: 6/3/1 = 10 != 9). Base-1 + largest-remainder must land
        // on exactly 9: base 1/1/1 (remaining 6), shares 6*5/10=3.0, 6*4/10=2.4, 6*1/10=0.6 ->
        // floors 3/2/0 (sum 5, leftover 1) -> leftover goes to the largest fraction (0.6) ->
        // extra 3/2/1 -> effective 4/3/2.
        ExerciseEntity benchPress = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        benchPress.setWorkingSets(5);
        train.save(benchPress);
        ExerciseEntity inclinePress = train.createExercise(owner, day.getId(), "Ferde nyomás", "chest", "compound");
        inclinePress.setWorkingSets(4);
        train.save(inclinePress);
        ExerciseEntity flye = train.createExercise(owner, day.getId(), "Cable Flye", "chest", "isolation");
        flye.setWorkingSets(1);
        train.save(flye);
        train.createVolumeLog(owner, meso.getId(), "chest", 9);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        TodayExercise benchTe = byId(res, benchPress.getId());
        TodayExercise inclineTe = byId(res, inclinePress.getId());
        TodayExercise flyeTe = byId(res, flye.getId());
        assertThat(benchTe.getWorkingSets()).isEqualTo(4);
        assertThat(inclineTe.getWorkingSets()).isEqualTo(3);
        assertThat(flyeTe.getWorkingSets()).isEqualTo(2);
        // The invariant that actually matters: the group must sum to exactly its target, not
        // overshoot it — this is what mezo-hi9m's clamp-after-remainder bug violated.
        assertThat(benchTe.getWorkingSets() + inclineTe.getWorkingSets() + flyeTe.getWorkingSets())
            .isEqualTo(9);
        assertThat(benchTe.getWorkingSets()).isGreaterThanOrEqualTo(1);
        assertThat(inclineTe.getWorkingSets()).isGreaterThanOrEqualTo(1);
        assertThat(flyeTe.getWorkingSets()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void testGetToday_shouldKeepTemplateCount_whenNoVolumeLogRowsExist() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setWorkingSets(3);
        train.save(ex);
        // No createVolumeLog call at all — the meso has zero volume-log rows.

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(byId(res, ex.getId()).getWorkingSets()).isEqualTo(3);
    }

    @Test
    void testGetToday_shouldDetectDeload_whenCurrentWeekMinusOneIndexesDeloadPhase() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        meso.setPhaseCurve(List.of("MEV", "Deload", "MRV"));
        meso.setCurrentWeek(2); // 1-based: phaseCurve.get(currentWeek - 1) = index 1 = "Deload"
        mesocycleRepository.saveAndFlush(meso);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var instance = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        train.createLoggedSet(owner, ex.getId(), instance.getId(), 0, "60", 8, 0);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        TodayExercise te = byId(res, ex.getId());
        assertThat(te.getProgression()).isNotNull();
        assertThat(te.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.DELOAD);
    }

    @Test
    void testGetToday_shouldSpreadTargetAcrossTheWeek_whenGroupIsTrainedOnTwoDays() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        String otherLabel = "Hét".equals(todayLabel) ? "Kedd" : "Hét";

        var today = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity press = train.createExercise(owner, today.getId(), "Fekvenyomás", "chest", "compound");
        press.setWorkingSets(3);
        train.save(press);

        var other = train.createTemplateDay(owner, meso.getId(), otherLabel);
        ExerciseEntity flye = train.createExercise(owner, other.getId(), "Cable Flye", 1, "chest", "isolation", null);
        flye.setWorkingSets(3);
        train.save(flye);

        train.createVolumeLog(owner, meso.getId(), "chest", 10);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        // The WEEK's two chest exercises share currentSets(10): base 1/1, remaining 8 split 4/4.
        // Before mezo-gbo7 today's lone exercise absorbed all 10 and the week totalled 20.
        assertThat(byId(res, press.getId()).getWorkingSets()).isEqualTo(5);
    }

    @Test
    void testGetToday_shouldKeepTemplateSets_whenExerciseIsExemptFromVolume() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);

        ExerciseEntity row = train.createExercise(owner, day.getId(), "Csónakázás", "back-mid", "compound");
        row.setWorkingSets(3);
        train.save(row);
        ExerciseEntity hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setWorkingSets(2);
        hang.setCountsTowardVolume(false);
        train.save(hang);

        train.createVolumeLog(owner, meso.getId(), "back", 10);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        // The exempt hang keeps its template 2 and is absent from the distribution, so the whole
        // back target lands on the one counting exercise.
        assertThat(byId(res, hang.getId()).getWorkingSets()).isEqualTo(2);
        assertThat(byId(res, row.getId()).getWorkingSets()).isEqualTo(10);
    }

    @Test
    void testGetToday_shouldKeepTemplateSets_whenDayIsCustomNotMeso() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var mesoDay = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity mesoChest = train.createExercise(owner, mesoDay.getId(), "Fekvenyomás", "chest", "compound");
        mesoChest.setWorkingSets(3);
        train.save(mesoChest);
        train.createVolumeLog(owner, meso.getId(), "chest", 10);

        // A custom (saját) template — mesocycleId stays null (TrainService.createCustomWorkout never
        // sets it), so it never enters weekTemplateExercises' candidate pool for ANY meso, even though
        // it happens to share the same muscle group as a logged one.
        CustomWorkoutResponse custom = trainService.createCustomWorkout(owner, CustomWorkoutUpsertRequest.builder()
            .name("Pihenőnapi mell")
            .exercises(List.of(GymExerciseInput.builder()
                .name("Cable Flye").muscle("chest")
                .warmupSets(1).workingSets(2).repMin(8).repMax(10).targetRIR(1)
                .type(GymExerciseInput.TypeEnum.ISOLATION)
                .build()))
            .build());

        // The meso day still absorbs the whole weekly target (unchanged Plan-1/2 behavior)...
        WorkoutTodayResponse mesoRes = workoutService.getToday(owner, null);
        assertThat(byId(mesoRes, mesoChest.getId()).getWorkingSets()).isEqualTo(10);

        // ...while the custom day, resolved explicitly by templateSessionId (meso-independent —
        // WorkoutService.getToday's day-resolution javadoc), keeps its OWN template count: it is
        // never distributed across because it does not belong to the active meso (mezo-dz9c item 1).
        WorkoutTodayResponse customRes = workoutService.getToday(owner, custom.getId());
        assertThat(customRes.getExercises()).hasSize(1);
        assertThat(customRes.getExercises().get(0).getWorkingSets()).isEqualTo(2);
    }

    @Test
    void testGetToday_shouldOvershootWeeklyTarget_whenBase1FloorExceedsCurrentSets() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        // 5 counted chest exercises, each template workingSets(1) — the group's currentSets(4) sits
        // BELOW the exercise count(5), so effectiveWorkingSets' degenerate branch
        // (targetSets <= exerciseCount) hands every exercise its >=1 floor regardless: the weekly
        // sum overshoots the target (5 != 4) rather than falling short of it (mezo-dz9c item 3).
        List<ExerciseEntity> exercises = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            ExerciseEntity ex = train.createExercise(owner, day.getId(), "Chest " + i, "chest", "isolation");
            ex.setWorkingSets(1);
            train.save(ex);
            exercises.add(ex);
        }
        train.createVolumeLog(owner, meso.getId(), "chest", 4);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        exercises.forEach(e -> assertThat(byId(res, e.getId()).getWorkingSets()).isEqualTo(1));
        int total = exercises.stream().mapToInt(e -> byId(res, e.getId()).getWorkingSets()).sum();
        assertThat(total).isEqualTo(5); // one each — the floor overshoots the weekly target(4)
    }

    @Test
    void testGetToday_shouldApplyDeltaAfterDistribution_whenDayIsLightened() {
        // Same fixture as testGetToday_shouldPreserveGroupTargetSum_whenThreeExercisesShareTheGroup:
        // template workingSets 5/4/1 (sum 10), group currentSets(9) -> baseline effective 4/3/2 (a
        // non-trivial largest-remainder distribution, not a flat pass-through).
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity benchPress = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        benchPress.setWorkingSets(5);
        train.save(benchPress);
        ExerciseEntity inclinePress = train.createExercise(owner, day.getId(), "Ferde nyomás", "chest", "compound");
        inclinePress.setWorkingSets(4);
        train.save(inclinePress);
        ExerciseEntity flye = train.createExercise(owner, day.getId(), "Cable Flye", "chest", "isolation");
        flye.setWorkingSets(1);
        train.save(flye);
        train.createVolumeLog(owner, meso.getId(), "chest", 9);

        // Baseline call — no adjustment row yet. Confirms the known 4/3/2 distribution before any
        // delta enters the picture, and gives the exact "no leak" reference point below.
        WorkoutTodayResponse baseline = workoutService.getToday(owner, null);
        int benchBaseline = byId(baseline, benchPress.getId()).getWorkingSets();
        int inclineBaseline = byId(baseline, inclinePress.getId()).getWorkingSets();
        int flyeBaseline = byId(baseline, flye.getId()).getWorkingSets();
        assertThat(benchBaseline).isEqualTo(4);
        assertThat(inclineBaseline).isEqualTo(3);
        assertThat(flyeBaseline).isEqualTo(2);

        workoutDayAdjustmentPopulator.createAdjustment(owner, LocalDate.now(), (short) -1);

        WorkoutTodayResponse lightened = workoutService.getToday(owner, null);

        // ORDERING PROOF: if the delta had leaked into effectiveWorkingSets' input (e.g. by
        // mutating the template workingSets before the distribution ran), the group's weights
        // would become 4/3/0 instead of 5/4/1, and the largest-remainder distribution over the
        // SAME group target (9) would land on different numbers than "baseline - 1" per exercise —
        // it would NOT simply be a uniform per-exercise shift. Asserting the lightened result is
        // exactly the baseline distribution minus one (floored at 1) proves the delta was applied
        // strictly AFTER effectiveWorkingSets returned, on the final per-exercise number.
        assertThat(byId(lightened, benchPress.getId()).getWorkingSets()).isEqualTo(benchBaseline - 1);
        assertThat(byId(lightened, inclinePress.getId()).getWorkingSets()).isEqualTo(inclineBaseline - 1);
        assertThat(byId(lightened, flye.getId()).getWorkingSets()).isEqualTo(flyeBaseline - 1);
        // The muscle-group volume distribution itself (the weighting) is unchanged: recomputing
        // with the SAME inputs (template workingSets, volume log) minus a uniform per-exercise -1
        // reproduces the lightened numbers exactly — proving no leak.
        assertThat(byId(lightened, benchPress.getId()).getWorkingSets()).isEqualTo(3);
        assertThat(byId(lightened, inclinePress.getId()).getWorkingSets()).isEqualTo(2);
        assertThat(byId(lightened, flye.getId()).getWorkingSets()).isEqualTo(1); // floored at 1 (2-1=1, no floor needed)

        // The prescription reflects the LIGHTENED count, not the baseline one (must run after the
        // delta, per the task's ordering requirement).
        long benchWorkingRows = byId(lightened, benchPress.getId()).getPrescribedSets().stream()
            .filter(p -> p.getKind() == io.mrkuhne.mezo.api.dto.PrescribedSet.KindEnum.WORKING)
            .count();
        assertThat(benchWorkingRows).isEqualTo(3);
    }

    @Test
    void testGetToday_shouldFloorAtOneWorkingSet_whenDeltaWouldGoBelowOne() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setWorkingSets(1);
        train.save(ex);
        // No volume log row -> effective == template workingSets == 1 (the pass-through branch).
        workoutDayAdjustmentPopulator.createAdjustment(owner, LocalDate.now(), (short) -3);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(byId(res, ex.getId()).getWorkingSets()).isEqualTo(1);
    }

    @Test
    void testGetToday_shouldKeepEffectiveSets_whenNoAdjustmentExistsForToday() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setWorkingSets(3);
        train.save(ex);
        // An adjustment exists, but for a DIFFERENT date — must not affect today.
        workoutDayAdjustmentPopulator.createAdjustment(owner, LocalDate.now().plusDays(1), (short) -2);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(byId(res, ex.getId()).getWorkingSets()).isEqualTo(3);
    }

    /** An active meso whose rollover is a guaranteed no-op — see class javadoc. */
    private MesocycleEntity pinnedActiveMeso(UUID owner) {
        MesocycleEntity meso = train.createActiveMeso(owner);
        meso.setVolumeRecompute(new VolumeRecomputeJson("W999", "W1000", "batch", List.of()));
        return mesocycleRepository.saveAndFlush(meso);
    }

    private TodayExercise byId(WorkoutTodayResponse res, UUID exerciseId) {
        return res.getExercises().stream()
            .filter(e -> exerciseId.equals(e.getId()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("exercise " + exerciseId + " not found in getToday response"));
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
