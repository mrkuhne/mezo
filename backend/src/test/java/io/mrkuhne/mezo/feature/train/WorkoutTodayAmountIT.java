package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WorkoutDayAdjustmentPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Volume engine v2 (mezo-r36n9.65, spec §6.1): the plan is the amount. Today's workout prescribes
 * the exercise row's own {@code working_sets} — never a per-muscle weekly target re-distributed
 * over the week's exercises (that turned a 3-set leg press into 8). The ledger rows here are
 * forced to the old inflated numbers, as legacy data would carry them, to prove they no longer
 * leak into the prescription. Switch-off parity: {@link WorkoutTodayAmountSwitchOffIT}.
 */
class WorkoutTodayAmountIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired WorkoutDayAdjustmentPopulator workoutDayAdjustmentPopulator;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    @Test
    void oneQuadExerciseKeepsItsThreeSets() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity legPress = train.createExercise(owner, day.getId(), "Leg Press", "quad", "compound");
        legPress.setWorkingSets(3);
        train.save(legPress);
        train.createVolumeLog(owner, meso.getId(), "quad", 8); // old data: the inflated weekly target

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        TodayExercise te = byId(res, legPress.getId());
        assertThat(te.getWorkingSets()).isEqualTo(3);
        assertThat(workingRows(te)).isEqualTo(3);
    }

    @Test
    void anEmphasizedBicepsKeepsItsTen() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        int[] own = {3, 2, 3, 2};
        List<ExerciseEntity> rows = new java.util.ArrayList<>();
        for (int i = 0; i < own.length; i++) {
            ExerciseEntity e = train.createExercise(owner, day.getId(), "Curl " + i, "biceps", "isolation");
            e.setWorkingSets(own[i]);
            train.save(e);
            rows.add(e);
        }
        train.createVolumeLog(owner, meso.getId(), "biceps", 6);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        for (int i = 0; i < own.length; i++) {
            assertThat(byId(res, rows.get(i).getId()).getWorkingSets()).isEqualTo(own[i]);
        }
    }

    @Test
    void lightenDeltaStillApplies() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity legPress = train.createExercise(owner, day.getId(), "Leg Press", "quad", "compound");
        legPress.setWorkingSets(3);
        train.save(legPress);
        train.createVolumeLog(owner, meso.getId(), "quad", 8);
        workoutDayAdjustmentPopulator.createAdjustment(owner, LocalDate.now(), (short) -1);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(byId(res, legPress.getId()).getWorkingSets()).isEqualTo(2); // 3 - 1
    }

    /** Carried over from VolumeEffectiveSetsIT: an exempt exercise keeps its own sets. */
    @Test
    void anExemptExerciseKeepsItsOwnSets() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity row = train.createExercise(owner, day.getId(), "Csónakázás", "back-mid", "compound");
        row.setWorkingSets(3);
        train.save(row);
        ExerciseEntity hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setWorkingSets(2);
        hang.setCountsTowardVolume(false);
        train.save(hang);
        train.createVolumeLog(owner, meso.getId(), "back", 10);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(byId(res, hang.getId()).getWorkingSets()).isEqualTo(2);
        assertThat(byId(res, row.getId()).getWorkingSets()).isEqualTo(3);
    }

    private static String todayLabel() {
        return WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    private static long workingRows(TodayExercise te) {
        return te.getPrescribedSets().stream()
            .filter(p -> p.getKind() == io.mrkuhne.mezo.api.dto.PrescribedSet.KindEnum.WORKING).count();
    }

    /** An active meso whose weekly rollover is a guaranteed no-op, so the seeded ledger sticks. */
    private MesocycleEntity pinnedActiveMeso(UUID owner) {
        MesocycleEntity meso = train.createActiveMeso(owner);
        meso.setVolumeRecompute(new VolumeRecomputeJson("W999", "W1000", "batch", List.of()));
        return mesocycleRepository.saveAndFlush(meso);
    }

    private TodayExercise byId(WorkoutTodayResponse res, UUID exerciseId) {
        return res.getExercises().stream().filter(e -> exerciseId.equals(e.getId())).findFirst()
            .orElseThrow(() -> new AssertionError("exercise " + exerciseId + " not in getToday response"));
    }

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }
}
