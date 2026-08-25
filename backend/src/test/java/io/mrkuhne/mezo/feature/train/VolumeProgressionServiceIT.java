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
        // Active meso: startDate = 14 days ago, weeks=6 → calWeek=3; lastRun null; chest currentSets=10
        // (mev8/mav14/mrv20) — below the MAV ceiling so a no-priority (Grow) ramp is observable
        // (mezo-3m5m, GD4: Grow's ceiling is MAV, not MRV — a row already sat AT MAV would HOLD).
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        train.createVolumeLog(owner, meso.getId(), "chest", 10);
        // A completed instance in week 2's window logging 14 chest working sets (targetHit, no grind: rir 1, targetRir 1).
        train.completedChestSetsInWeek(owner, meso, 2, 14, 1, 1);

        svc.rolloverIfDue(owner, reload(meso));

        MuscleGroupVolumeLogEntity chest = chestLog(owner, meso.getId());
        assertThat(chest.getCurrentSets()).isEqualTo(12); // 10 + step(2)
        var after = reload(meso);
        assertThat(after.getCurrentWeek()).isEqualTo(3);
        assertThat(after.getVolumeRecompute().lastRun()).isEqualTo("W3");
        assertThat(after.getVolumeRecompute().changes())
            .anyMatch(c -> c.muscle().equals("chest") && !Boolean.TRUE.equals(c.warning()));

        // idempotent: a second rollover in the same calendar week does nothing.
        svc.rolloverIfDue(owner, reload(meso));
        MuscleGroupVolumeLogEntity chest2 = chestLog(owner, meso.getId());
        assertThat(chest2.getCurrentSets()).isEqualTo(12);
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

    @Test
    void testRollover_shouldIgnoreExemptExercises_whenCountingLastWeeksVolume() {
        UUID owner = ownerId();
        // calWeek 3 (started 2 weeks ago); back target sits at 10 with MRV headroom.
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        train.createVolumeLog(owner, meso.getId(), "back", 10);

        // Week 2 logs 10 working sets — but ONLY on an exempt exercise (the fix-zárás hang).
        var day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "planned");
        var hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setTargetRir(0);
        hang.setCountsTowardVolume(false);
        train.save(hang);
        var instance = train.createWorkoutInstance(
            owner, day, meso.getStartDate().plusWeeks(1), "completed");
        for (int i = 0; i < 10; i++) {
            train.createLoggedSet(owner, hang.getId(), instance.getId(), i, "0", 45, 0);
        }

        svc.rolloverIfDue(owner, reload(meso));

        // No COUNTING volume last week -> target not hit -> HOLD at 10.
        // Before mezo-gbo7 the hang's 10 sets read as a hit target and ramped to 12.
        assertThat(backLog(owner, meso.getId()).getCurrentSets()).isEqualTo(10);
    }

    @Test
    void testRollover_shouldHoldInsteadOfRamp_whenLastWeekGrindsBelowTargetRir() {
        UUID owner = ownerId();
        // calWeek 3 (started 2 weeks ago), chest currentSets=10, well under mrv(20) so this isn't
        // the early-deload branch — isolates the decider's plain `!grind` ramp gate (DA4's other
        // half; the existing rollover fixtures only ever pin targetRir 0 / rir 0 -> gap 0, which
        // never fires grind).
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        train.createVolumeLog(owner, meso.getId(), "chest", 10);
        // Week 2: 10 chest working sets hit the target(10), but the logged RIR(0) lands 3 below the
        // exercise's targetRir(3) — >= grindRirGap(2) — so the group's `grind` fires.
        train.completedChestSetsInWeek(owner, meso, 2, 10, 0, 3);

        svc.rolloverIfDue(owner, reload(meso));

        // Target hit but grinding -> the decider's `!grind` gate blocks the ramp -> HOLD at 10,
        // not RAMP to 12 (10 + step(2)).
        assertThat(chestLog(owner, meso.getId()).getCurrentSets()).isEqualTo(10);
    }

    @Test
    void testRollover_shouldIgnoreExemptExerciseGrind_whenCountingExerciseHitsTargetCleanly() {
        UUID owner = ownerId();
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        train.createVolumeLog(owner, meso.getId(), "back", 10);

        var day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "planned");
        // Counting exercise: hits the target(10) cleanly — logged RIR equals its own targetRir, no
        // grind of its own.
        var row = train.createExercise(owner, day.getId(), "Behúzás", "back", "compound");
        row.setTargetRir(1);
        train.save(row);
        // Exempt exercise, same coarse group ("back-wide" -> MuscleGroup.of -> "back"), grinding
        // hard (rir 0 vs targetRir 3, gap 3 >= grindRirGap 2). This is the regression the issue
        // names: if this ever leaked back into latestRirByExercise (instead of being filtered by
        // countsTowardVolume BEFORE that map is populated), the group would wrongly HOLD instead
        // of ramping.
        var hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setTargetRir(3);
        hang.setCountsTowardVolume(false);
        train.save(hang);

        var instance = train.createWorkoutInstance(owner, day, meso.getStartDate().plusWeeks(1), "completed");
        for (int i = 0; i < 10; i++) {
            train.createLoggedSet(owner, row.getId(), instance.getId(), i, "60", 8, 1); // rir == targetRir -> no grind
        }
        for (int i = 10; i < 15; i++) {
            train.createLoggedSet(owner, hang.getId(), instance.getId(), i, "0", 45, 0); // deep grind, but exempt
        }

        svc.rolloverIfDue(owner, reload(meso));

        // Target hit, no grind leak from the exempt exercise -> RAMP to 12 (10 + step(2)), not
        // HOLD at 10.
        assertThat(backLog(owner, meso.getId()).getCurrentSets()).isEqualTo(12);
    }

    private MuscleGroupVolumeLogEntity backLog(UUID owner, UUID mesoId) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(mesoId))
            .stream().filter(r -> "back".equals(r.getMuscle())).findFirst().orElseThrow();
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
