package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleVolumeArcResponse;
import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.VolumeArcService;
import io.mrkuhne.mezo.feature.train.service.VolumeProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Tier-targeted weekly ramp (mezo-3m5m, spec GD4): {@code rolloverIfDue} resolves each muscle's
 * {@link io.mrkuhne.mezo.feature.train.service.PriorityTier} from the meso's {@code
 * musclePriorities} map and ramps toward the TIER's ceiling (Emphasize -> MRV, Grow (default,
 * no map entry) -> MAV, Maintain -> MEV and never ramps) instead of always MRV. Modeled on {@link
 * VolumeProgressionServiceIT}'s populator/fixture style.
 */
class VolumeProgressionTierIT extends AbstractIntegrationTest {

    @Autowired VolumeProgressionService svc;
    @Autowired VolumeArcService arcService;
    @Autowired TrainPopulator train;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired MesocycleRepository mesocycleRepository;

    @Test
    void testRollover_shouldRampTowardTierCeilings() {
        UUID owner = ownerId();
        // startDate 2 weeks ago, 6-week meso -> calWeek 3 (phase MAV, not deload) — same shape as
        // VolumeProgressionServiceIT's rollover scenario.
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        meso.setMusclePriorities(Map.of("back", "emphasize", "glute", "maintain"));
        mesocycleRepository.saveAndFlush(meso);

        // back (emphasize, mev 10/mav 16/mrv 22, current 16, logged 16): ramps 16 -> 18 (past MAV, toward MRV).
        createVolumeLog(owner, meso.getId(), "back", 10, 16, 22, 16);
        completedMuscleSetsInWeek(owner, meso, "back", "Húzódzkodás", 2, 16, 1, 1);

        // chest (no entry = grow, mev 8/mav 14/mrv 20, current 14, logged 14): HOLDs at 14 (MAV ceiling).
        createVolumeLog(owner, meso.getId(), "chest", 8, 14, 20, 14);
        train.completedChestSetsInWeek(owner, meso, 2, 14, 1, 1);

        // glute (maintain, mev 8/mav 12/mrv 18, current 8, logged 8): HOLDs at 8 (never ramps).
        createVolumeLog(owner, meso.getId(), "glute", 8, 12, 18, 8);
        completedMuscleSetsInWeek(owner, meso, "glute", "Hip Thrust", 2, 8, 1, 1);

        svc.rolloverIfDue(owner, reload(meso));

        assertThat(logFor(owner, meso.getId(), "back").getCurrentSets()).isEqualTo(18);
        assertThat(logFor(owner, meso.getId(), "chest").getCurrentSets()).isEqualTo(14);
        assertThat(logFor(owner, meso.getId(), "glute").getCurrentSets()).isEqualTo(8);

        var changes = reload(meso).getVolumeRecompute().changes();
        assertThat(changes).anyMatch(c -> c.muscle().equals("back") && c.change().equals("+2 (16 → 18)"));
        assertThat(changes).anyMatch(c -> c.muscle().equals("chest") && c.change().equals("tart (14)"));
        assertThat(changes).anyMatch(c -> c.muscle().equals("glute") && c.change().equals("tart (8)"));
    }

    @Test
    void testVolumeArc_shouldPinPlannedScaffoldPerTier() {
        // mezo-3m5m final review, fix 5: the spec's testing list names "scaffold curve per tier" —
        // this pins VolumeArcService#plannedScaffold's actual week-by-week numbers for a Grow group
        // (ramps to MAV) alongside a Maintain group (flat at MEV), both through a Deload week.
        UUID owner = ownerId();
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        meso.setMusclePriorities(Map.of("glute", "maintain")); // chest carries no entry -> defaults Grow
        mesocycleRepository.saveAndFlush(meso);

        // chest (Grow, real RP baseline mev 8/mav 14/mrv 20 — mezo.volume.baselines). currentSets is
        // irrelevant to `planned` (VolumeArcService reads only mev + the tier ceiling for the
        // scaffold), so it's seeded at mev for a neutral fixture.
        createVolumeLog(owner, meso.getId(), "chest", 8, 14, 20, 8);
        // glute (Maintain -> ceiling = mev = 8, real RP baseline mev 8/mav 12/mrv 18).
        createVolumeLog(owner, meso.getId(), "glute", 8, 12, 18, 8);

        MesocycleVolumeArcResponse res = arcService.arc(owner, meso.getId());

        // Hand-computed against VolumeArcService#plannedScaffold (step = mezo.volume.step = 2,
        // deloadFraction = mezo.volume.deload-fraction = 0.5):
        //   w1 = mev (scaffold always starts at MEV, tier-independent);
        //   each later non-Deload week ramps by +step, clamped at the tier's ceiling — Grow's
        //   ceiling is MAV (14), Maintain's is MEV (8) so it never moves off its own week-1 value;
        //   the Deload week (w6, tier-independent branch) is round(ceiling * deloadFraction) — NOT
        //   round(prevWeek * deloadFraction), so it reads off the (possibly still-ramping) ceiling.
        // chest (Grow, mev 8, ceiling 14): 8 -> 10 -> 12 -> 14 -> 14 (clamped) -> round(14*0.5)=7.
        int[] expectedChest = {8, 10, 12, 14, 14, 7};
        // glute (Maintain, mev 8, ceiling 8): flat at 8 every ramp week (already at ceiling from
        // week 1) -> round(8*0.5)=4 on the Deload week.
        int[] expectedGlute = {8, 8, 8, 8, 8, 4};

        assertPlanned(res, "chest", expectedChest);
        assertPlanned(res, "glute", expectedGlute);
    }

    private void assertPlanned(MesocycleVolumeArcResponse res, String muscle, int[] expected) {
        MuscleVolumeArc arc = res.getMuscles().stream()
            .filter(m -> m.getMuscle().equals(muscle))
            .findFirst()
            .orElseThrow(() -> new AssertionError(muscle + " missing from arc response: " + res));
        assertThat(arc.getWeeks()).hasSize(expected.length);
        for (int i = 0; i < expected.length; i++) {
            assertThat(arc.getWeeks().get(i).getPlanned())
                .as("%s planned week %d", muscle, i + 1)
                .isEqualTo(expected[i]);
        }
    }

    /** Explicit-landmark volume log — TrainPopulator#createVolumeLog hardcodes 8/14/20, which only
     * matches the real "chest" baseline; back (10/16/22) and glute (8/12/18) need their own rows so
     * the tier ceilings in this scenario read against the real RP baselines (mezo.volume.baselines). */
    private MuscleGroupVolumeLogEntity createVolumeLog(
            UUID createdBy, UUID mesocycleId, String muscle, int mev, int mav, int mrv, int currentSets) {
        MuscleGroupVolumeLogEntity v = new MuscleGroupVolumeLogEntity();
        v.setCreatedBy(createdBy);
        v.setMesocycleId(mesocycleId);
        v.setMuscle(muscle);
        v.setMev(mev);
        v.setMav(mav);
        v.setMrv(mrv);
        v.setCurrentSets(currentSets);
        v.setSource(new ProvenanceEnvelope(
            new ProvenanceEnvelope.Baseline("RP guidelines · intermediate", mev, mav, mrv),
            List.of(), 0.78, null, null));
        return volumeRepo.saveAndFlush(v);
    }

    /** Copy of {@link TrainPopulator#completedChestSetsInWeek}, generalized to an arbitrary muscle. */
    private WorkoutSessionEntity completedMuscleSetsInWeek(UUID createdBy, MesocycleEntity meso,
            String muscle, String exerciseName, int week, int nSets, int rir, int targetRir) {
        var template = train.createWorkoutSession(createdBy, meso.getId(), muscle + " nap", "gym", 0, "planned");
        var exercise = train.createExercise(createdBy, template.getId(), exerciseName, muscle, "compound");
        exercise.setTargetRir(targetRir);
        train.save(exercise);

        LocalDate date = meso.getStartDate().plusWeeks(week - 1L);
        var instance = train.createWorkoutInstance(createdBy, template, date, "completed");
        for (int i = 0; i < nSets; i++) {
            train.createLoggedSet(createdBy, exercise.getId(), instance.getId(), i, "60", 8, rir);
        }
        return instance;
    }

    private MuscleGroupVolumeLogEntity logFor(UUID owner, UUID mesoId, String muscle) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(mesoId)).stream()
            .filter(r -> muscle.equals(r.getMuscle()))
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
