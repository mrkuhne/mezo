package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.VolumeLedger;
import io.mrkuhne.mezo.feature.train.service.WorkoutExerciseChangeService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The volume log is derived from the plan (volume engine v2, spec §6.1): one row per trained
 * counting group of an ACTIVE run, {@code currentSets} = Σ plan working sets, the group's
 * landmarks from config and its tier band.
 */
class VolumeLedgerIT extends AbstractIntegrationTest {

    @Autowired VolumeLedger ledger;
    @Autowired TrainService trainService;
    @Autowired MesoTemplateService mesoTemplateService;
    @Autowired WorkoutExerciseChangeService changeService;
    @Autowired TrainPopulator train;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired PlatformTransactionManager transactionManager;

    @Test
    void rowsAreTheSumOfThePlan() {
        UUID user = databasePopulator.populateUser("ledger-a@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        exercise(user, day, "Row", "back-mid", 4);
        exercise(user, day, "Pulldown", "back-wide", 2);
        WorkoutSessionEntity day2 = train.createTemplateDay(user, meso.getId(), "Csü");
        exercise(user, day2, "Cable Row", "back-mid", 3);
        exercise(user, day2, "Pull-Up", "back-wide", 2);

        ledger.sync(user, meso.getId());

        MuscleGroupVolumeLogEntity back = byMuscle(rows(user, meso.getId()), "back");
        assertThat(back.getCurrentSets()).isEqualTo(11);
        assertThat(back.getMev()).isEqualTo(10);
        assertThat(back.getMav()).isEqualTo(16);
        assertThat(back.getMrv()).isEqualTo(22);
        assertThat(back.getSource().baseline().name()).isEqualTo("A terv szerint");
        assertThat(back.getSource().confidence()).isNotNull();
    }

    @Test
    void tierSetsTheBand() {
        UUID user = databasePopulator.populateUser("ledger-b@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        meso.setMusclePriorities(Map.of("back", "emphasize", "quad", "maintain"));
        mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        exercise(user, day, "Row", "back-mid", 4);
        exercise(user, day, "Squat", "quad", 4);

        ledger.sync(user, meso.getId());

        List<MuscleGroupVolumeLogEntity> rows = rows(user, meso.getId());
        assertThat(byMuscle(rows, "back").getBandLow()).isEqualTo(14);
        assertThat(byMuscle(rows, "back").getBandHigh()).isEqualTo(22);
        assertThat(byMuscle(rows, "quad").getBandLow()).isEqualTo(3);
        assertThat(byMuscle(rows, "quad").getBandHigh()).isEqualTo(7);
    }

    @Test
    void coreGetsNoRow() {
        UUID user = databasePopulator.populateUser("ledger-c@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        exercise(user, day, "Plank", "core", 3);
        exercise(user, day, "Bench", "chest-mid", 3);

        ledger.sync(user, meso.getId());

        assertThat(rows(user, meso.getId())).extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("chest");
    }

    @Test
    void rowOfAnUntrainedGroupIsRemoved() {
        UUID user = databasePopulator.populateUser("ledger-d@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        ExerciseEntity bench = exercise(user, day, "Bench", "chest-mid", 3);
        exercise(user, day, "Row", "back-mid", 3);
        ledger.sync(user, meso.getId());
        assertThat(rows(user, meso.getId())).extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("back", "chest");

        exerciseRepository.delete(bench);
        exerciseRepository.flush();
        ledger.sync(user, meso.getId());

        assertThat(rows(user, meso.getId())).extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("back");
    }

    @Test
    void aGroupDroppedAndTrainedAgainGetsItsRowBack() {
        UUID user = databasePopulator.populateUser("ledger-j@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        ExerciseEntity bench = exercise(user, day, "Bench", "chest-mid", 3);
        exercise(user, day, "Row", "back-mid", 3);
        ledger.sync(user, meso.getId());
        exerciseRepository.delete(bench);
        exerciseRepository.flush();
        ledger.sync(user, meso.getId());
        assertThat(rows(user, meso.getId())).extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("back");

        exercise(user, day, "Incline", "chest-upper", 5);
        ledger.sync(user, meso.getId());

        List<MuscleGroupVolumeLogEntity> rows = rows(user, meso.getId());
        assertThat(rows).filteredOn(r -> r.getMuscle().equals("chest")).hasSize(1);
        assertThat(byMuscle(rows, "chest").getCurrentSets()).isEqualTo(5);
    }

    /**
     * A caller that changes a managed entity AFTER {@code sync} inside its own transaction keeps
     * that write: the removal of an untrained group's row must not clear the caller's persistence
     * context (which would detach the meso and silently drop the change at commit).
     */
    @Test
    void aCallersManagedEntitySurvivesTheRowRemoval() {
        UUID user = databasePopulator.populateUser("ledger-k@test.local");
        MesocycleEntity created = train.createActiveMeso(user);
        WorkoutSessionEntity day = train.createTemplateDay(user, created.getId(), "Hét");
        ExerciseEntity bench = exercise(user, day, "Bench", "chest-mid", 3);
        exercise(user, day, "Row", "back-mid", 3);
        ledger.sync(user, created.getId());

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            MesocycleEntity meso = mesocycleRepository.findById(created.getId()).orElseThrow();
            exerciseRepository.delete(exerciseRepository.findById(bench.getId()).orElseThrow());
            ledger.sync(user, meso.getId());
            meso.setNotes("a hívó írása megmarad"); // managed: no explicit save
        });

        assertThat(mesocycleRepository.findById(created.getId()).orElseThrow().getNotes())
            .isEqualTo("a hívó írása megmarad");
        assertThat(rows(user, created.getId())).extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("back");
    }

    @Test
    void exemptExercisesAreNotSummed() {
        UUID user = databasePopulator.populateUser("ledger-e@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        exercise(user, day, "Pull-Up", "back-wide", 4);
        ExerciseEntity hang = exercise(user, day, "Dead Hang", "back-wide", 5);
        hang.setCountsTowardVolume(false);
        train.save(hang);

        ledger.sync(user, meso.getId());

        assertThat(byMuscle(rows(user, meso.getId()), "back").getCurrentSets()).isEqualTo(4);
    }

    @Test
    void plannedRunHasNoRows() {
        UUID user = databasePopulator.populateUser("ledger-f@test.local");
        MesocycleEntity meso = train.createMesocycle(user, "Tervezett", "planned");
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        exercise(user, day, "Bench", "chest-mid", 3);

        ledger.sync(user, meso.getId());

        assertThat(rows(user, meso.getId())).isEmpty();
    }

    @Test
    void activatingAPlannedRunWritesTheRows() {
        UUID user = databasePopulator.populateUser("ledger-g@test.local");
        MesocycleEntity meso = train.createMesocycle(user, "Tervezett", "planned");
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        exercise(user, day, "Bench", "chest-mid", 3);

        trainService.activateMesocycle(user, meso.getId());

        assertThat(byMuscle(rows(user, meso.getId()), "chest").getCurrentSets()).isEqualTo(3);
    }

    @Test
    void addingAPlanSetMovesTheRow() {
        UUID user = databasePopulator.populateUser("ledger-h@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        ExerciseEntity row = exercise(user, day, "Row", "back-mid", 4);
        exercise(user, day, "Pulldown", "back-wide", 2);
        exercise(user, day, "Cable Row", "back-mid", 3);
        exercise(user, day, "Pull-Up", "back-wide", 2);
        ledger.sync(user, meso.getId());
        assertThat(byMuscle(rows(user, meso.getId()), "back").getCurrentSets()).isEqualTo(11);
        WorkoutSessionEntity instance = train.startInstance(user, day.getId());

        changeService.addPlanWorkingSets(user, instance.getId(), row.getId(), 1);

        assertThat(byMuscle(rows(user, meso.getId()), "back").getCurrentSets()).isEqualTo(12);
    }

    @Test
    void aTemplatesOwnLandmarksAreIgnored() {
        UUID user = databasePopulator.populateUser("ledger-i@test.local");
        UUID templateId = mesoTemplateService.create(user, MesoTemplateUpsertRequest.builder()
            .title("Saját mérföldkövek").weeks(6).split("PPL").style("RP")
            .phaseCurve(List.of(MesoTemplateUpsertRequest.PhaseCurveEnum.MEV))
            .volumePerMuscle(Map.of("quad", VolumeBaseline.builder()
                .name("sablon").mev(3).mav(5).mrv(7).build()))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Legs").muscle("quad")
                .exercises(List.of(GymExerciseInput.builder().name("Squat").muscle("quad")
                    .warmupSets(2).workingSets(4).repMin(6).repMax(8).targetRIR(2)
                    .type(GymExerciseInput.TypeEnum.COMPOUND).build()))
                .build()))
            .build()).getId();

        MesocycleResponse run = mesoTemplateService.start(user, templateId,
            MesoTemplateStartRequest.builder().startDate(LocalDate.now())
                .status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build());

        MuscleGroupVolumeLogEntity quad = byMuscle(rows(user, run.getId()), "quad");
        assertThat(quad.getMev()).isEqualTo(8);
        assertThat(quad.getCurrentSets()).isEqualTo(4);
    }

    @Test
    void anUnconvertedRunIsNotSynced() {
        UUID user = databasePopulator.populateUser("ledger-unconverted@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        meso.setVolumeModel((short) 1);
        mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        exercise(user, day, "Squat", "quad", 3);
        train.createVolumeLog(user, meso.getId(), "quad", 8); // the old target the migration reads

        ledger.sync(user, meso.getId());

        assertThat(rows(user, meso.getId())).singleElement()
            .satisfies(r -> assertThat(r.getCurrentSets()).isEqualTo(8));
    }

    @Test
    void activatingAnArchivedLegacyRunConvertsIt() {
        UUID user = databasePopulator.populateUser("ledger-archived-legacy@test.local");
        MesocycleEntity meso = train.createMesocycle(user, "Régi", "archived");
        meso.setVolumeModel((short) 1);
        mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        exercise(user, day, "Row", "back-mid", 4);
        exercise(user, day, "Pulldown", "back-wide", 3);

        trainService.activateMesocycle(user, meso.getId());

        assertThat(mesocycleRepository.findById(meso.getId()).orElseThrow().getVolumeModel()).isEqualTo((short) 2);
        MuscleGroupVolumeLogEntity back = byMuscle(rows(user, meso.getId()), "back");
        assertThat(back.getCurrentSets()).isEqualTo(7);
        assertThat(back.getBandLow()).isNotNull();
        assertThat(back.getBandHigh()).isNotNull();
    }

    private ExerciseEntity exercise(UUID user, WorkoutSessionEntity day, String name, String muscle, int sets) {
        ExerciseEntity e = train.createExercise(user, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        return train.save(e);
    }

    private List<MuscleGroupVolumeLogEntity> rows(UUID user, UUID mesoId) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(user, List.of(mesoId));
    }

    private MuscleGroupVolumeLogEntity byMuscle(List<MuscleGroupVolumeLogEntity> rows, String muscle) {
        return rows.stream().filter(r -> r.getMuscle().equals(muscle)).findFirst().orElseThrow();
    }
}
