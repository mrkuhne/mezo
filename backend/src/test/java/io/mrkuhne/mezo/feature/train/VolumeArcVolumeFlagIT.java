package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleReportResponse;
import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.service.MesocycleReportService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.VolumeArcService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-gbo7: the arc's actual bars must aggregate hypertrophy volume only.
 *
 * <p>Companion switch off (mirrors {@code MesocycleCloseReportIT}): the second test drives a real
 * {@code closeMesocycle} commit, which publishes {@code MesocycleClosed} AFTER_COMMIT — with the
 * companion enabled that would fire the AI-review listener (a real smart-tier call outside any
 * {@code companion-fake} profile here) racing these assertions for nothing this test cares about.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class VolumeArcVolumeFlagIT extends AbstractIntegrationTest {

    @Autowired VolumeArcService volumeArcService;
    @Autowired TrainService trainService;
    @Autowired MesocycleReportService reportService;
    @Autowired TrainPopulator train;

    @Test
    void testArc_shouldCountOnlyVolumeBearingSets_whenTheWeekIncludesClosingBlockWork() {
        UUID owner = ownerId();
        MesocycleEntity meso = seedMesoWithMixedVolumeWork(owner);

        MuscleVolumeArc back = volumeArcService.arc(owner, meso.getId()).getMuscles().stream()
            .filter(m -> "back".equals(m.getMuscle())).findFirst().orElseThrow();

        // 3 counting sets, not 5 — the hang's two sets are posture work.
        assertThat(back.getWeeks().get(0).getActual()).isEqualTo(3);
    }

    /**
     * Same fixture, but driven through the report-freeze path: {@code MesocycleReportService}
     * calls the package-private 3-arg {@code VolumeArcService.arc(createdBy, mesoId,
     * effectiveCurrentWeek)} overload, not the public 2-arg one the test above covers. Without this
     * the query fix could regress that overload's caller without any test noticing.
     */
    @Test
    void testCloseMesocycle_shouldFreezeOnlyVolumeBearingSets_whenTheWeekIncludesClosingBlockWork() {
        UUID owner = ownerId();
        MesocycleEntity meso = seedMesoWithMixedVolumeWork(owner);

        trainService.closeMesocycle(owner, meso.getId(), null);
        MesocycleReportResponse report = reportService.getReport(owner, meso.getId());

        MuscleVolumeArc back = report.getVolume().getMuscles().stream()
            .filter(m -> "back".equals(m.getMuscle())).findFirst().orElseThrow();

        // 3 counting sets, not 5 — same discrimination as above, but through the frozen report.
        assertThat(back.getWeeks().get(0).getActual()).isEqualTo(3);
    }

    /**
     * A 1-week-elapsed active meso with a "back" volume log, one counting compound exercise logging
     * 3 working sets and one {@code countsTowardVolume=false} exercise (posture/plyo) logging 2 more
     * in the same session — the minimal fixture that discriminates the query predicate (5 sets total
     * vs 3 volume-bearing ones).
     */
    private MesocycleEntity seedMesoWithMixedVolumeWork(UUID owner) {
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
        return meso;
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
