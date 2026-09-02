package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.VolumeProgressionService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Baseline seeding of {@code muscle_group_volume_log} on the mesocycle start/activate path
 * (mezo-xlmp; template-started since mezo-meyc.1): a run STARTED as ACTIVE from a template that
 * carries no explicit landmarks gets one row per trained coarse muscle group from the fixed
 * {@code mezo.volume.baselines} RP table ({@code currentSets = MEV}), a planned start gets none,
 * activation seeds/backfills idempotently (existing rows are never overwritten), and groups
 * absent from the config table (core, sport rows) never get a row (DA5 — skip, don't fabricate).
 */
class VolumeBaselineSeedIT extends AbstractIntegrationTest {

    @Autowired MesoTemplateService mesoTemplateService;
    @Autowired TrainService trainService;
    @Autowired WorkoutService workoutService;
    @Autowired VolumeProgressionService volumeProgressionService;
    @Autowired TrainPopulator train;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testStartTemplate_shouldSeedBaselinesForTrainedGroupsOnly_whenStartedAsActive() {
        UUID user = databasePopulator.populateUser("seed-a@test.local");

        MesocycleResponse created = startWizardTemplate(user, MesoTemplateStartRequest.StatusEnum.ACTIVE);

        List<MuscleGroupVolumeLogEntity> rows = rows(user, created.getId());
        // chest (Bench Press) + back (Chest Supported Row, back-mid collapsed) — core (Plank) has
        // no baselines entry, so it must NOT get a row.
        assertThat(rows).extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("back", "chest");
        MuscleGroupVolumeLogEntity chest = byMuscle(rows, "chest");
        assertThat(chest.getMev()).isEqualTo(8);
        assertThat(chest.getMav()).isEqualTo(14);
        assertThat(chest.getMrv()).isEqualTo(20);
        assertThat(chest.getCurrentSets()).isEqualTo(8); // W1 start = MEV
        assertThat(chest.getSource()).isNotNull();
        assertThat(chest.getSource().baseline().mev()).isEqualTo(8);
        assertThat(chest.getSource().confidence()).isNotNull(); // contract: VolumeSource.confidence required
        MuscleGroupVolumeLogEntity back = byMuscle(rows, "back");
        assertThat(back.getMev()).isEqualTo(10);
        assertThat(back.getMav()).isEqualTo(16);
        assertThat(back.getMrv()).isEqualTo(22);
        assertThat(back.getCurrentSets()).isEqualTo(10);
        // The create response itself already carries the seeded profile.
        assertThat(created.getVolumePerMuscle()).containsKeys("back", "chest");
    }

    @Test
    void testStartTemplate_shouldSeedNothing_whenPlanned() {
        UUID user = databasePopulator.populateUser("seed-b@test.local");

        MesocycleResponse created = startWizardTemplate(user, MesoTemplateStartRequest.StatusEnum.PLANNED);

        assertThat(rows(user, created.getId())).isEmpty();
        // The generated DTO materializes the map as {} rather than null — either is "no profile".
        assertThat(created.getVolumePerMuscle()).isNullOrEmpty();
    }

    @Test
    void testActivateMesocycle_shouldSeedBaselines_whenPlannedMesoActivated() {
        UUID user = databasePopulator.populateUser("seed-c@test.local");
        MesocycleResponse created = startWizardTemplate(user, MesoTemplateStartRequest.StatusEnum.PLANNED);

        trainService.activateMesocycle(user, created.getId());

        assertThat(rows(user, created.getId()))
            .extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("back", "chest");
    }

    @Test
    void testActivateMesocycle_shouldBackfillMissingGroupsAndKeepExistingRows_whenAlreadyActive() {
        UUID user = databasePopulator.populateUser("seed-d@test.local");
        // A pre-existing active meso with NO seeded rows except a hand-written chest row whose
        // currentSets has already advanced — the pre-mezo-xlmp state of a user-created meso.
        MesocycleEntity meso = train.createMesocycle(user, "Backfill meso", "active");
        var day = train.createTemplateDay(user, meso.getId(), "Hét");
        train.createExercise(user, day.getId(), "Bench Press", "chest", "compound");
        train.createExercise(user, day.getId(), "Chest Supported Row", 1, "back-mid", "compound", null);
        train.createVolumeLog(user, meso.getId(), "chest", 12);

        trainService.activateMesocycle(user, meso.getId());

        List<MuscleGroupVolumeLogEntity> rows = rows(user, meso.getId());
        assertThat(rows).extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("back", "chest"); // back backfilled, chest NOT duplicated
        assertThat(byMuscle(rows, "chest").getCurrentSets()).isEqualTo(12); // untouched
        assertThat(byMuscle(rows, "back").getCurrentSets()).isEqualTo(10); // seeded at MEV
    }

    @Test
    void testGetToday_shouldDistributeMevAcrossChestExercises_whenFreshWizardMesoInWeekOne() {
        UUID user = databasePopulator.populateUser("seed-e@test.local");
        MesocycleResponse created = startWizardTemplate(user, MesoTemplateStartRequest.StatusEnum.ACTIVE);
        UUID templateDayId = created.getDays().get(0).getId();

        // Full chain: seeded chest row (MEV 8) → W1 rollover (START, stays 8) → DA6 distribution
        // across the day's chest exercises. Bench Press is the day's only chest exercise, so its
        // effective count must be the group MEV itself, not the template workingSets (4).
        var today = workoutService.getToday(user, templateDayId);

        int chestSets = today.getExercises().stream()
            .filter(e -> "chest".equals(e.getMuscle()))
            .mapToInt(e -> e.getWorkingSets())
            .sum();
        assertThat(chestSets).isEqualTo(8);
    }

    /**
     * The wizard plan document (no explicit {@code volumePerMuscle}) saved as a template and
     * started — the only way a run is born since mezo-meyc.1, so this is what used to be the
     * "create-as-active/planned" path.
     */
    private MesocycleResponse startWizardTemplate(UUID user, MesoTemplateStartRequest.StatusEnum status) {
        UUID templateId = mesoTemplateService.create(user, wizardTemplate()).getId();
        return mesoTemplateService.start(user, templateId, MesoTemplateStartRequest.builder()
            .startDate(LocalDate.now()).status(status).build());
    }

    private MesoTemplateUpsertRequest wizardTemplate() {
        return MesoTemplateUpsertRequest.builder()
            .title("Seed teszt")
            .goal("Hipertrófia")
            .weeks(6)
            .split("Upper / Lower · 4×/hét")
            .style("RP · 6 hét")
            .phaseCurve(List.of(
                MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .days(List.of(
                MesoDayInput.builder().day("Hét").type("Upper").muscle("chest+back")
                    .exercises(List.of(
                        GymExerciseInput.builder().name("Bench Press").muscle("chest").warmupSets(2)
                            .workingSets(4).repMin(6).repMax(8).targetRIR(2)
                            .type(GymExerciseInput.TypeEnum.COMPOUND).build(),
                        GymExerciseInput.builder().name("Chest Supported Row").muscle("back-mid")
                            .warmupSets(2).workingSets(3).repMin(8).repMax(10).targetRIR(1)
                            .type(GymExerciseInput.TypeEnum.COMPOUND).build(),
                        GymExerciseInput.builder().name("Plank").muscle("core").warmupSets(0)
                            .workingSets(3).repMin(30).repMax(60).targetRIR(2)
                            .type(GymExerciseInput.TypeEnum.ISOLATION).build()))
                    .build(),
                MesoDayInput.builder().day("Kedd").type("Rest").build()))
            .build();
    }

    @Test
    void testSeedBaselines_shouldSkipGroup_whenAllItsExercisesAreExemptFromVolume() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setCountsTowardVolume(false);
        train.save(hang);
        train.createExercise(owner, day.getId(), "Fekvenyomás", "chest-mid", "compound");

        volumeProgressionService.seedBaselines(owner, meso.getId(), null);

        assertThat(rows(owner, meso.getId()))
            .extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("chest");
    }

    @Test
    void testSeedBaselines_shouldSeedGroup_whenItHasBothACountingAndAnExemptExercise() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setCountsTowardVolume(false);
        train.save(hang);
        train.createExercise(owner, day.getId(), "Pull-Up", "back-wide", "compound");
        train.createExercise(owner, day.getId(), "Fekvenyomás", "chest-mid", "compound");

        volumeProgressionService.seedBaselines(owner, meso.getId(), null);

        assertThat(rows(owner, meso.getId()))
            .extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactlyInAnyOrder("back", "chest");
    }

    private List<MuscleGroupVolumeLogEntity> rows(UUID user, UUID mesoId) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(user, List.of(mesoId));
    }

    private MuscleGroupVolumeLogEntity byMuscle(List<MuscleGroupVolumeLogEntity> rows, String muscle) {
        return rows.stream().filter(r -> r.getMuscle().equals(muscle)).findFirst().orElseThrow();
    }
}
