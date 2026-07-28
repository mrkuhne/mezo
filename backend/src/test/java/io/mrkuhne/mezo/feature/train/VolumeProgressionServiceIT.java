package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.VolumeProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The weekly volume-rollover engine (spec DA3/DA4): calendar week ahead of {@code
 * volumeRecompute.lastRun} → per-muscle ramp/hold/deload from last week's logged performance, and
 * a no-op when called again inside the same calendar week (idempotency).
 */
class VolumeProgressionServiceIT extends AbstractIntegrationTest {

    @Autowired VolumeProgressionService svc;
    @Autowired TrainPopulator train;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired MesocycleRepository mesocycleRepository;

    @Test
    void testRollover_shouldRampMuscleAndAdvanceWeek_whenCalendarWeekIsAhead() {
        UUID owner = ownerId();
        // Active meso: startDate = 14 days ago, weeks=6 → calWeek=3; lastRun null; chest currentSets=14 (mev8/mav14/mrv20).
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        train.createVolumeLog(owner, meso.getId(), "chest", 14);
        // A completed instance in week 2's window logging 14 chest working sets (targetHit, no grind: rir 1, targetRir 1).
        train.completedChestSetsInWeek(owner, meso, 2, 14, 1, 1);

        svc.rolloverIfDue(owner, reload(meso));

        MuscleGroupVolumeLogEntity chest = chestLog(owner, meso.getId());
        assertThat(chest.getCurrentSets()).isEqualTo(16); // 14 + step(2)
        var after = reload(meso);
        assertThat(after.getCurrentWeek()).isEqualTo(3);
        assertThat(after.getVolumeRecompute().lastRun()).isEqualTo("W3");
        assertThat(after.getVolumeRecompute().changes())
            .anyMatch(c -> c.muscle().equals("chest") && !Boolean.TRUE.equals(c.warning()));

        // idempotent: a second rollover in the same calendar week does nothing.
        svc.rolloverIfDue(owner, reload(meso));
        MuscleGroupVolumeLogEntity chest2 = chestLog(owner, meso.getId());
        assertThat(chest2.getCurrentSets()).isEqualTo(16);
        assertThat(reload(meso).getVolumeRecompute().lastRun()).isEqualTo("W3");
    }

    @Test
    void testRollover_shouldStartAtMevThenNoop_whenFirstCalendarWeek() {
        UUID owner = ownerId();
        // Meso just started (calWeek == 1); volumeRecompute is null (never recomputed) so week 1
        // still triggers a first-ever rollover — VolumeDecider.decide's week<=1 branch starts at MEV.
        var meso = train.activeMesoStartedWeeksAgo(owner, 0, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        train.createVolumeLog(owner, meso.getId(), "chest", 14);

        svc.rolloverIfDue(owner, reload(meso));

        var after = reload(meso);
        assertThat(after.getCurrentWeek()).isEqualTo(1);
        assertThat(after.getVolumeRecompute().lastRun()).isEqualTo("W1");
        assertThat(chestLog(owner, meso.getId()).getCurrentSets()).isEqualTo(8); // MEV start, not the seeded 14

        // A second call inside the same calendar week is a no-op (DA3).
        svc.rolloverIfDue(owner, reload(meso));
        assertThat(chestLog(owner, meso.getId()).getCurrentSets()).isEqualTo(8);
    }

    private MuscleGroupVolumeLogEntity chestLog(UUID owner, UUID mesoId) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(mesoId)).stream()
            .filter(v -> v.getMuscle().equals("chest"))
            .findFirst()
            .orElseThrow();
    }

    private MesocycleEntity reload(MesocycleEntity meso) {
        return mesocycleRepository.findById(meso.getId()).orElseThrow();
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
