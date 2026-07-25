package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * getToday's progression wiring (mezo-5pfe): per-exercise {@link ProgressionSignal} attachment +
 * the day-level overloadSummary tally, including real deload-week detection off the active meso's
 * phaseCurve[currentWeek].
 */
class WorkoutTodayProgressionIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired MesocycleRepository mesocycleRepository;

    @Test
    void testGetToday_shouldAttachWeightProgressionAndSummary_whenHistoryHitsRepMax() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var instance = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        train.createLoggedSet(owner, ex.getId(), instance.getId(), 0, "60", 8, 0);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        var te = res.getExercises().get(0);
        assertThat(te.getProgression()).isNotNull();
        assertThat(te.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(te.getProgression().getTargetWeightKg()).isEqualByComparingTo("65");
        assertThat(te.getProgression().getDeltaKg()).isEqualByComparingTo("5");
        assertThat(res.getOverloadSummary()).isNotNull();
        assertThat(res.getOverloadSummary().getWeightUp()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void testGetToday_shouldEmitDeloadProgression_whenCurrentWeekIsDeload() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createActiveMeso(owner);
        meso.setPhaseCurve(List.of("Deload"));
        // 1-based currentWeek (calendar week, DA1): index 0 of a 1-element curve == week 1.
        meso.setCurrentWeek(1);
        // Volume rollover (mezo-hi9m) runs at the top of getToday whenever the switch is on
        // (default) — pin lastRun far ahead of any calendar week this fixture's startDate could
        // ever clamp to, so the rollover is a guaranteed no-op and this currentWeek sticks.
        meso.setVolumeRecompute(new io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson(
            "W999", "W1000", "batch", List.of()));
        mesocycleRepository.saveAndFlush(meso);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var instance = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        train.createLoggedSet(owner, ex.getId(), instance.getId(), 0, "60", 8, 0);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        var te = res.getExercises().get(0);
        assertThat(te.getProgression()).isNotNull();
        assertThat(te.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.DELOAD);
        assertThat(te.getProgression().getTargetWeightKg()).isEqualByComparingTo("55");
        assertThat(te.getProgression().getDeltaKg().signum()).isNegative();
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
