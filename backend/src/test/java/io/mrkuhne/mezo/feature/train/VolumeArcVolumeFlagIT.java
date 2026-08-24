package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.feature.train.service.VolumeArcService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** mezo-gbo7: the arc's actual bars must aggregate hypertrophy volume only. */
class VolumeArcVolumeFlagIT extends AbstractIntegrationTest {

    @Autowired VolumeArcService volumeArcService;
    @Autowired TrainPopulator train;

    @Test
    void testArc_shouldCountOnlyVolumeBearingSets_whenTheWeekIncludesClosingBlockWork() {
        UUID owner = ownerId();
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 0, 6, 1, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        train.createVolumeLog(owner, meso.getId(), "back", 10);

        var day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "planned");
        var row = train.createExercise(owner, day.getId(), "Csónakázás", "back-mid", "compound");
        var hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setCountsTowardVolume(false);
        train.save(hang);

        var instance = train.createWorkoutInstance(owner, day, meso.getStartDate(), "completed");
        for (int i = 0; i < 3; i++) {
            train.createLoggedSet(owner, row.getId(), instance.getId(), i, "60", 8, 1);
        }
        for (int i = 0; i < 2; i++) {
            train.createLoggedSet(owner, hang.getId(), instance.getId(), 3 + i, "0", 45, 0);
        }

        MuscleVolumeArc back = volumeArcService.arc(owner, meso.getId()).getMuscles().stream()
            .filter(m -> "back".equals(m.getMuscle())).findFirst().orElseThrow();

        // 3 counting sets, not 5 — the hang's two sets are posture work.
        assertThat(back.getWeeks().get(0).getActual()).isEqualTo(3);
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
