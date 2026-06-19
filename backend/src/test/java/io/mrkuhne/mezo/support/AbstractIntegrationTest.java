package io.mrkuhne.mezo.support;

import io.mrkuhne.mezo.TestcontainersConfiguration;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Base class for all integration tests — see
 * docs/references/integration_test_framework.md.
 *
 * <p>Boots the full Spring context against a real Postgres (the fixed {@code mezo_test}
 * compose DB by default; Testcontainers via {@code -Dmezo.test.use-testcontainers=true},
 * wired by {@link TestcontainersConfiguration}).
 *
 * <p>Every test starts from a clean database: {@link ResetDatabase} removes all rows
 * except master data (the demodata-seeded owner) before each test, which keeps test
 * classes independent of what earlier classes committed. Service-level subclasses
 * additionally annotate themselves {@code @Transactional} so their own writes roll back.
 *
 * <p>Test data comes from the {@code *Populator} factories ({@link DatabasePopulator}
 * facade or the per-aggregate populators in {@code support/populator/}).
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, DatabasePopulator.class, UserPopulator.class,
    TrainPopulator.class, RunningPopulator.class, GoalPopulator.class, GoalPlanLinkPopulator.class,
    BiometricProfilePopulator.class, WeightLogPopulator.class, ResetDatabase.class})
public abstract class AbstractIntegrationTest {

    @Autowired
    private ResetDatabase resetDatabase;

    @BeforeEach
    void resetDatabaseState() {
        resetDatabase.resetExceptMasterData();
    }
}
