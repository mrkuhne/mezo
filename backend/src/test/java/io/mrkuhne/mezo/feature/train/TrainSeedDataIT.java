package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Verifies the opt-in {@code demofixtures} Train seed ports {@code frontend/src/data/train.ts} 1:1
 * so that real mode renders exactly what mock mode renders. {@code @ActiveProfiles({"demodata",
 * "demofixtures"})} spins a separate context whose {@code OwnerSeedData} (demodata) +
 * {@code TrainSeedData} (demofixtures) CommandLineRunners fire at startup;
 * {@link AbstractIntegrationTest}'s {@code @BeforeEach} ResetDatabase then TRUNCATEs the Train
 * tables (master-data owner survives), so each test re-seeds into a clean DB via the explicit
 * {@code trainSeedData.run()} — which still finds the preserved owner. The {@code demodata}-only
 * contract (Train seed bean absent without {@code demofixtures}) is pinned by {@code OwnerSeedDataIT}.
 */
@ActiveProfiles({"demodata", "demofixtures"})
class TrainSeedDataIT extends AbstractIntegrationTest {

    @Autowired private TrainSeedData trainSeedData;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private MuscleGroupVolumeLogRepository volumeLogRepository;
    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private SportSessionRepository sportSessionRepository;

    @Test
    void testSeed_shouldPortAllTrainFixtures_whenRun() {
        trainSeedData.run(); // ResetDatabase wiped the startup seed -> run inside the test
        assertThat(mesocycleRepository.count()).isEqualTo(4);   // hyp-04, str-02, maint-01, rec-03
        assertThat(volumeLogRepository.count()).isEqualTo(8);   // 8 muscles on the active meso
        assertThat(workoutSessionRepository.count()).isEqualTo(7); // Hét..Vas template days
        assertThat(sportSessionRepository.count()).isEqualTo(5);
    }

    @Test
    void testSeed_shouldStaySame_whenRunTwice() {
        trainSeedData.run();
        trainSeedData.run();
        assertThat(mesocycleRepository.count()).isEqualTo(4);
    }
}
