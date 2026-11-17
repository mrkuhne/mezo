package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.LegacySetDistribution;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateService;
import io.mrkuhne.mezo.feature.train.service.VolumeLedger;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * The one-time conversion of runs in flight to the amount model (volume engine v2, spec §6.8): old-model
 * state is built straight through the repositories ({@code volume_model = 1}, hand-written volume-log
 * rows), then the runner bean's {@code run()} is invoked explicitly — it also fires once at context
 * start, on an empty database, which is harmless. What must hold: the numbers the old engine showed
 * become the stored amounts, nothing else moves, and a second start changes nothing.
 */
class VolumeAmountMigrationRunnerIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired VolumeAmountMigrationRunner runner;
    @Autowired WorkoutService workoutService;
    @Autowired MesoTemplateService mesoTemplateService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @MockitoSpyBean VolumeLedger ledger;

    @Test
    void effectiveSetsBecomeAmounts() {
        UUID owner = databasePopulator.populateUser("migrate-a@test.local");
        MesocycleEntity meso = pinnedActiveMeso(owner);
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity legPress = exercise(owner, day, "Leg Press", "quad", 3);
        train.createVolumeLog(owner, meso.getId(), "quad", 8); // what the old engine showed him

        runner.run();

        assertThat(sets(legPress)).isEqualTo(8);
        WorkoutTodayResponse res = workoutService.getToday(owner, null);
        assertThat(byId(res, legPress.getId()).getWorkingSets()).isEqualTo(8);
        assertThat(ledgerRow(owner, meso, "quad").getCurrentSets()).isEqualTo(8);
        assertThat(reload(meso).getVolumeModel()).isEqualTo((short) 2);
    }

    @Test
    void aGroupSplitsExactlyAsTheOldEngineDid() {
        UUID owner = databasePopulator.populateUser("migrate-b@test.local");
        MesocycleEntity meso = pinnedActiveMeso(owner);
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        int[] own = {3, 2, 3, 2};
        List<ExerciseEntity> rows = new java.util.ArrayList<>();
        for (int i = 0; i < own.length; i++) {
            rows.add(exercise(owner, day, "Curl " + i, "biceps", own[i]));
        }
        List<MuscleGroupVolumeLogEntity> logs = List.of(train.createVolumeLog(owner, meso.getId(), "biceps", 6));
        Map<UUID, Integer> expected = LegacySetDistribution.effective(
            exerciseRepository.findAllById(rows.stream().map(ExerciseEntity::getId).toList()), logs);

        runner.run();

        int[] want = {2, 1, 2, 1}; // 6 = 4 floors + 2 leftover to the two 3-set rows
        for (int i = 0; i < own.length; i++) {
            assertThat(sets(rows.get(i))).isEqualTo(want[i]).isEqualTo(expected.get(rows.get(i).getId()));
        }
        assertThat(rows.stream().mapToInt(this::sets).sum()).isEqualTo(6);
    }

    @Test
    void runAlreadyRolledOverIsNotSteppedAgain() {
        WeekThree w = weekThree("migrate-c@test.local", new VolumeRecomputeJson("W3", "W4", "weekly-rollover", List.of()));

        runner.run();
        workoutService.getToday(w.owner(), null);

        assertThat(proposalRepository.findWeekly(w.owner(), w.meso().getId(), 3)).isEmpty();
        assertThat(w.amounts()).containsExactly(4, 2, 3, 2).isEqualTo(currentAmounts(w));
        assertThat(reload(w.meso()).getVolumeRecompute().lastRun()).isEqualTo("W3");
    }

    @Test
    void aRunWithNoUsableLastRunIsStampedForThisWeek() {
        for (VolumeRecomputeJson broken : new VolumeRecomputeJson[] {
            null, new VolumeRecomputeJson("Vasárnap", "Vasárnap", "batch", List.of())}) {
            String mail = "migrate-d-" + (broken == null ? "null" : "text") + "@test.local";
            WeekThree w = weekThree(mail, broken);

            runner.run();

            VolumeRecomputeJson audit = reload(w.meso()).getVolumeRecompute();
            assertThat(audit.lastRun()).isEqualTo("W3");
            assertThat(audit.nextRun()).isEqualTo(broken == null ? "W4" : "Vasárnap");
            workoutService.getToday(w.owner(), null);
            assertThat(proposalRepository.findWeekly(w.owner(), w.meso().getId(), 3)).isEmpty();
            assertThat(currentAmounts(w)).containsExactly(4, 2, 3, 2);
        }
    }

    @Test
    void aLastRunAheadOfThisWeekIsLeftAlone() {
        VolumeRecomputeJson ahead = new VolumeRecomputeJson("W5", "W6", "batch", List.of());
        WeekThree w = weekThree("migrate-e@test.local", ahead);

        runner.run();

        assertThat(reload(w.meso()).getVolumeRecompute()).isEqualTo(ahead);
    }

    @Test
    void secondRunIsANoOp() {
        UUID owner = databasePopulator.populateUser("migrate-f@test.local");
        MesocycleEntity meso = pinnedActiveMeso(owner);
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity legPress = exercise(owner, day, "Leg Press", "quad", 3);
        train.createVolumeLog(owner, meso.getId(), "quad", 8);
        runner.run();
        assertThat(sets(legPress)).isEqualTo(8);
        ExerciseEntity edited = exerciseRepository.findById(legPress.getId()).orElseThrow();
        edited.setWorkingSets(4); // the owner edits the plan after the conversion
        exerciseRepository.saveAndFlush(edited);

        int again = runner.run();

        assertThat(again).isZero();
        assertThat(sets(legPress)).isEqualTo(4); // never re-distributed
        assertThat(reload(meso).getVolumeModel()).isEqualTo((short) 2);
    }

    @Test
    void archivedRunsAreUntouched() {
        UUID owner = databasePopulator.populateUser("migrate-g@test.local");
        MesocycleEntity meso = train.createMesocycle(owner, "Régi", "archived");
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity row = exercise(owner, day, "Leg Press", "quad", 3);
        train.createVolumeLog(owner, meso.getId(), "quad", 8);

        runner.run();

        assertThat(sets(row)).isEqualTo(3);
        assertThat(reload(meso).getVolumeModel()).isEqualTo((short) 1);
    }

    @Test
    void plannedRunsAreMarkedButKeepTheirSets() {
        UUID owner = databasePopulator.populateUser("migrate-h@test.local");
        MesocycleEntity meso = train.createMesocycle(owner, "Tervezett", "planned");
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity row = exercise(owner, day, "Leg Press", "quad", 3);

        runner.run();

        assertThat(sets(row)).isEqualTo(3);
        assertThat(reload(meso).getVolumeModel()).isEqualTo((short) 2);
        assertThat(volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(meso.getId()))).isEmpty();
    }

    @Test
    void anActiveRunWithoutLedgerRowsKeepsItsAmountsAndGetsALedger() {
        UUID owner = databasePopulator.populateUser("migrate-i@test.local");
        MesocycleEntity meso = pinnedActiveMeso(owner);
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity row = exercise(owner, day, "Leg Press", "quad", 3);

        runner.run();

        assertThat(sets(row)).isEqualTo(3);
        assertThat(ledgerRow(owner, meso, "quad").getCurrentSets()).isEqualTo(3);
        assertThat(reload(meso).getVolumeModel()).isEqualTo((short) 2);
    }

    @Test
    void anExemptExerciseKeepsItsSets() {
        UUID owner = databasePopulator.populateUser("migrate-j@test.local");
        MesocycleEntity meso = pinnedActiveMeso(owner);
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity row = exercise(owner, day, "Csónakázás", "back-mid", 3);
        ExerciseEntity hang = exercise(owner, day, "Dead Hang", "back-wide", 2);
        hang.setCountsTowardVolume(false);
        train.save(hang);
        train.createVolumeLog(owner, meso.getId(), "back", 10);

        runner.run();

        assertThat(sets(hang)).isEqualTo(2);
        assertThat(sets(row)).isEqualTo(10); // the one counting back exercise takes the whole target
    }

    @Test
    void newRunsAreStampedTwo() {
        UUID owner = databasePopulator.populateUser("migrate-k@test.local");
        UUID templateId = mesoTemplateService.create(owner, MesoTemplateUpsertRequest.builder()
            .title("Új futás").weeks(6).split("PPL").style("RP")
            .phaseCurve(List.of(MesoTemplateUpsertRequest.PhaseCurveEnum.MEV))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Legs").muscle("quad")
                .exercises(List.of(GymExerciseInput.builder().name("Squat").muscle("quad")
                    .warmupSets(2).workingSets(4).repMin(6).repMax(8).targetRIR(2)
                    .type(GymExerciseInput.TypeEnum.COMPOUND).build()))
                .build()))
            .build()).getId();

        MesocycleResponse planned = mesoTemplateService.start(owner, templateId,
            MesoTemplateStartRequest.builder().startDate(LocalDate.now().plusWeeks(2))
                .status(MesoTemplateStartRequest.StatusEnum.PLANNED).build());
        MesocycleResponse active = mesoTemplateService.start(owner, templateId,
            MesoTemplateStartRequest.builder().startDate(LocalDate.now())
                .status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build());

        assertThat(reload(planned.getId()).getVolumeModel()).isEqualTo((short) 2);
        assertThat(reload(active.getId()).getVolumeModel()).isEqualTo((short) 2);
    }

    @Test
    void oneFailingRunDoesNotStopTheOthers() {
        UUID ownerA = databasePopulator.populateUser("migrate-l1@test.local");
        UUID ownerB = databasePopulator.populateUser("migrate-l2@test.local");
        MesocycleEntity bad = pinnedActiveMeso(ownerA);
        ExerciseEntity badRow = exercise(ownerA, train.createTemplateDay(ownerA, bad.getId(), todayLabel()),
            "Leg Press", "quad", 3);
        train.createVolumeLog(ownerA, bad.getId(), "quad", 8);
        MesocycleEntity good = pinnedActiveMeso(ownerB);
        ExerciseEntity goodRow = exercise(ownerB, train.createTemplateDay(ownerB, good.getId(), todayLabel()),
            "Leg Press", "quad", 3);
        train.createVolumeLog(ownerB, good.getId(), "quad", 8);
        doThrow(new IllegalStateException("boom")).when(ledger).sync(eq(ownerA), eq(bad.getId()));

        runner.run();

        // the failing run rolled back completely: still old model, its write undone
        assertThat(reload(bad).getVolumeModel()).isEqualTo((short) 1);
        assertThat(sets(badRow)).isEqualTo(3);
        assertThat(reload(good).getVolumeModel()).isEqualTo((short) 2);
        assertThat(sets(goodRow)).isEqualTo(8);
        org.mockito.Mockito.reset(ledger);
        runner.run(); // the next start retries it
        assertThat(reload(bad).getVolumeModel()).isEqualTo((short) 2);
        assertThat(sets(badRow)).isEqualTo(8);
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    private record WeekThree(UUID owner, MesocycleEntity meso, List<ExerciseEntity> rows) {
        List<Integer> amounts() {
            return List.of(4, 2, 3, 2);
        }
    }

    /** Old-model back run in calendar week 3: Mon 4 + 2, Thu 3 + 2 = 11, emphasized, last week fully logged. */
    private WeekThree weekThree(String email, VolumeRecomputeJson lastRun) {
        UUID owner = databasePopulator.populateUser(email);
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 2, 6, NO_DELOAD);
        meso.setMusclePriorities(Map.of("back", "emphasize"));
        meso.setVolumeRecompute(lastRun);
        meso.setCurrentWeek(3);
        meso = mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(owner, meso.getId(), "Csütörtök", "gym", 3, "active");
        List<ExerciseEntity> rows = List.of(
            exercise(owner, mon, "Evezés", "back-mid", 4), exercise(owner, mon, "Lehúzás", "back-wide", 2),
            exercise(owner, thu, "Kábeles evezés", "back-mid", 3), exercise(owner, thu, "Húzódzkodás", "back-wide", 2));
        logWeek(owner, meso, 2, mon, 0, rows.get(0), rows.get(1));
        logWeek(owner, meso, 2, thu, 3, rows.get(2), rows.get(3));
        train.createVolumeLog(owner, meso.getId(), "back", 11);
        return new WeekThree(owner, meso, rows);
    }

    private void logWeek(UUID owner, MesocycleEntity meso, int week, WorkoutSessionEntity day, int dayOffset,
                         ExerciseEntity... exercises) {
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day,
            meso.getStartDate().plusDays(7L * (week - 1) + dayOffset), "completed");
        int i = 0;
        for (ExerciseEntity e : exercises) {
            for (int s = 0; s < e.getWorkingSets(); s++) {
                train.createLoggedSet(owner, e.getId(), instance.getId(), i++, "60", 8, 0);
            }
        }
    }

    private List<Integer> currentAmounts(WeekThree w) {
        return w.rows().stream().map(e -> sets(e)).toList();
    }

    private MesocycleEntity pinnedActiveMeso(UUID owner) {
        MesocycleEntity meso = train.createActiveMeso(owner);
        meso.setVolumeRecompute(new VolumeRecomputeJson("W999", "W1000", "batch", List.of()));
        return mesocycleRepository.saveAndFlush(meso);
    }

    private ExerciseEntity exercise(UUID owner, WorkoutSessionEntity day, String name, String muscle, int sets) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        return train.save(e);
    }

    private static String todayLabel() {
        return WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    private int sets(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow().getWorkingSets();
    }

    private MuscleGroupVolumeLogEntity ledgerRow(UUID owner, MesocycleEntity meso, String group) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(meso.getId())).stream()
            .filter(r -> r.getMuscle().equals(group)).findFirst().orElseThrow();
    }

    private MesocycleEntity reload(MesocycleEntity meso) {
        return reload(meso.getId());
    }

    private MesocycleEntity reload(UUID id) {
        return mesocycleRepository.findById(id).orElseThrow();
    }

    private TodayExercise byId(WorkoutTodayResponse res, UUID exerciseId) {
        return res.getExercises().stream().filter(e -> exerciseId.equals(e.getId())).findFirst()
            .orElseThrow(() -> new AssertionError("exercise " + exerciseId + " not in getToday response"));
    }
}
