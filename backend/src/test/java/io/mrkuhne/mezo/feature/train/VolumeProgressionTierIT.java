package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleVolumeArcResponse;
import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.VolumeArcService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The volume arc's planned scaffold per tier (mezo-3m5m, spec GD4): a Grow group ramps by its tier step, a
 * Maintain group stays flat, both through a Deload week. The weekly ROLLOVER cases that
 * used to live here moved to {@code service.WeekProposalTierIT} with volume engine v2 (the weekly
 * step now moves the plan's exercise sets, not a ledger target).
 */
class VolumeProgressionTierIT extends AbstractIntegrationTest {

    @Autowired VolumeArcService arcService;
    @Autowired TrainPopulator train;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired MesocycleRepository mesocycleRepository;

    @Test
    void testVolumeArc_shouldPinPlannedScaffoldPerTier() {
        // mezo-3m5m final review, fix 5: the spec's testing list names "scaffold curve per tier" —
        // this pins VolumeArcService#plannedPath's week-by-week numbers for a Grow group
        // (ramps) alongside a Maintain group (flat), both through a Deload week.
        UUID owner = ownerId();
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        meso.setMusclePriorities(Map.of("glute", "maintain")); // chest carries no entry -> defaults Grow
        mesocycleRepository.saveAndFlush(meso);

        // chest (Grow, real RP baseline mev 8/mav 14/mrv 20 — mezo.volume.baselines; band 8..14).
        // The seeded log rows carry no bandHigh, so they are LEGACY rows: VolumeArcService#plannedPath
        // takes the synthetic-exercise path from the row's MEV (currentSets plays no part).
        createVolumeLog(owner, meso.getId(), "chest", 8, 14, 20, 8);
        // glute (Maintain, real RP baseline mev 8/mav 12/mrv 18).
        createVolumeLog(owner, meso.getId(), "glute", 8, 12, 18, 8);

        MesocycleVolumeArcResponse res = arcService.arc(owner, meso.getId());

        // Hand-computed against VolumeArcService#legacyScaffold -> VolumePath#project (one synthetic
        // exercise at MEV, caps off, no deficit, deloadFraction = mezo.volume.deload-fraction = 0.5):
        //   w1 = mev; each later non-Deload week steps by the tier step (Hangsúly 2, Építés/Grow 1,
        //   Tartás 0), capped at band.high; the Deload week halves with ceil; the week after restores.
        // chest (Grow, step 1, band high 14): 8 -> 9 -> 10 -> 11 -> 12 (MRV week) -> ceil(12*0.5)=6.
        int[] expectedChest = {8, 9, 10, 11, 12, 6};
        // glute (Maintain, step 0): flat at 8 every ramp week -> ceil(8*0.5)=4 on the Deload week.
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

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
