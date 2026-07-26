package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleVolumeArcResponse;
import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.api.dto.VolumeArcWeek;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Read-only whole-mesocycle volume arc endpoint (Phase B, Task B2): per-muscle planned scaffold
 * (DA7) + logged actuals bucketed to meso-weeks, up to {@code currentWeek}; future weeks carry
 * {@code planned} with a {@code null actual}.
 */
class VolumeArcContractIT extends ApiIntegrationTest {

    @Autowired TrainPopulator train;
    @Autowired MesocycleRepository mesocycleRepository;

    @Test
    void testGetMesocycleVolumeArc_shouldReturnActualsAndPlannedScaffold_whenMesoHasLoggedWeeks() {
        UUID owner = ownerId();
        // startDate 2 weeks ago, 6-week meso -> calendar week 3; currentWeek persisted explicitly (arc
        // uses the stored field, not clampWeek — activeMesoStartedWeeksAgo defaults it to 1).
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        meso.setCurrentWeek(3);
        mesocycleRepository.saveAndFlush(meso);

        train.createVolumeLog(owner, meso.getId(), "chest", 14);
        // 14 chest working sets logged in week 2's window (targetHit, no grind).
        train.completedChestSetsInWeek(owner, meso, 2, 14, 1, 1);

        MesocycleVolumeArcResponse res = getForBody(
            "/api/train/mesocycles/" + meso.getId() + "/volume-arc",
            ownerAuthHeaders(), HttpStatus.OK, MesocycleVolumeArcResponse.class);

        assertThat(res.getMesocycleId()).isEqualTo(meso.getId());
        assertThat(res.getCurrentWeek()).isEqualTo(3);
        assertThat(res.getWeeks()).isEqualTo(6);

        MuscleVolumeArc chest = res.getMuscles().stream()
            .filter(m -> m.getMuscle().equals("chest"))
            .findFirst()
            .orElseThrow(() -> new AssertionError("chest muscle missing from arc response: " + res));
        assertThat(chest.getRegion()).isEqualTo("coral");
        assertThat(chest.getMrv()).isEqualTo(20);
        assertThat(chest.getWeeks()).hasSize(6);

        VolumeArcWeek week2 = chest.getWeeks().get(1); // 1-based week 2 -> index 1
        assertThat(week2.getWeek()).isEqualTo(2);
        assertThat(week2.getActual()).isEqualTo(14);
        assertThat(week2.getIsCurrent()).isFalse();

        VolumeArcWeek week3 = chest.getWeeks().get(2); // current week
        assertThat(week3.getWeek()).isEqualTo(3);
        assertThat(week3.getIsCurrent()).isTrue();

        VolumeArcWeek week6 = chest.getWeeks().get(5); // future week: planned only
        assertThat(week6.getWeek()).isEqualTo(6);
        assertThat(week6.getActual()).isNull();
        assertThat(week6.getPlanned()).isNotNull();
        assertThat(week6.getIsCurrent()).isFalse();
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
