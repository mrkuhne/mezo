package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Verifies the opt-in {@code demofixtures} life-goal seed. Mirrors {@code TrainSeedDataIT}'s
 * {@code @ActiveProfiles({"demodata", "demofixtures"})}: a separate context whose
 * {@code OwnerSeedData} (demodata) + {@code LifeGoalSeedData} (demofixtures) CommandLineRunners
 * fire at startup; {@link AbstractIntegrationTest}'s {@code @BeforeEach} ResetDatabase then wipes
 * the life-goal tables (the owner survives as master data), so each test re-seeds explicitly via
 * {@code seed.run()} — which still finds the preserved owner.
 */
@ActiveProfiles({"demodata", "demofixtures"})
class LifeGoalSeedDataIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalSeedData seed;
    @Autowired private LifeGoalRepository goals;
    @Autowired private LifeGoalPillarRepository pillars;

    @Test
    void testRun_shouldSeedFourGoalsElevenPillars_whenEmpty() {
        seed.run(); // ResetDatabase wiped the startup seed -> run inside the test
        assertThat(goals.count()).isEqualTo(4);
        assertThat(pillars.count()).isEqualTo(11);
        seed.run();
        assertThat(goals.count()).isEqualTo(4);
        assertThat(pillars.count()).isEqualTo(11);
    }
}
