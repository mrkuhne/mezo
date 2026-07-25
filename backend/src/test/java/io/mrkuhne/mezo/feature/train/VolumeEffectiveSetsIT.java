package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
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

        // 14 distributed proportionally to template share (3:2), remainder to the largest:
        // floor(14*3/5)=8, floor(14*2/5)=5 -> 13 distributed, +1 remainder to benchPress (ws=3).
        TodayExercise benchTe = byId(res, benchPress.getId());
        TodayExercise flyeTe = byId(res, flye.getId());
        assertThat(benchTe.getWorkingSets()).isEqualTo(9);
        assertThat(flyeTe.getWorkingSets()).isEqualTo(5);
        assertThat(benchTe.getWorkingSets() + flyeTe.getWorkingSets()).isEqualTo(14);
        // Both template counts (3 and 2) are exceeded by the effective distribution.
        assertThat(benchTe.getWorkingSets()).isGreaterThan(3);
        assertThat(flyeTe.getWorkingSets()).isGreaterThan(2);
        // Prescribed working-set rows follow the effective count, not the template one.
        long workingRows = benchTe.getPrescribedSets().stream()
            .filter(p -> p.getKind() == io.mrkuhne.mezo.api.dto.PrescribedSet.KindEnum.WORKING)
            .count();
        assertThat(workingRows).isEqualTo(9);
        // The closing-block's back exercises carry no "back" volume-log row -> untouched (DA5).
        assertThat(res.getExercises()).anySatisfy(e -> assertThat(e.getMuscle()).contains("back"));
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
