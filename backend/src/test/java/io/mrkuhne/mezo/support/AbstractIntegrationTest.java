package io.mrkuhne.mezo.support;

import io.mrkuhne.mezo.TestcontainersConfiguration;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.LevelUpEventPopulator;
import io.mrkuhne.mezo.support.populator.ProtocolPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.SupplementIntakePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
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
    AiConversationPopulator.class, AiMessagePopulator.class,
    KnowledgeFactPopulator.class, LearnedFactPopulator.class, MemoryEmbeddingPopulator.class,
    DailySummaryPopulator.class, PatternPopulator.class,
    TrainPopulator.class, RunningPopulator.class, GoalPopulator.class, GoalPlanLinkPopulator.class,
    BiometricProfilePopulator.class, WeightLogPopulator.class, SleepLogPopulator.class,
    CheckInPopulator.class,
    PantryItemPopulator.class,
    RecipePopulator.class, MealPopulator.class, WaterLogPopulator.class,
    MedicationPopulator.class, MedicationDosePopulator.class,
    ProtocolPopulator.class, SupplementIntakePopulator.class,
    SkillProgressPopulator.class, LevelUpEventPopulator.class,
    PersonPopulator.class, MentionPopulator.class, ResetDatabase.class})
public abstract class AbstractIntegrationTest {

    @Autowired
    private ResetDatabase resetDatabase;

    @Autowired(required = false)
    private org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor applicationTaskExecutor;

    @BeforeEach
    void resetDatabaseState() {
        drainAsyncWork();
        resetDatabase.resetExceptMasterData();
    }

    /**
     * V1.2: committed chat turns trigger AFTER_COMMIT {@code @Async} work (fact extraction).
     * A leftover async task from a previous test must not race this test's DB reset or writes —
     * wait until the executor is idle before truncating (bounded, so a hung task cannot stall the suite).
     */
    private void drainAsyncWork() {
        if (applicationTaskExecutor == null) {
            return;
        }
        long deadline = System.currentTimeMillis() + 2000;
        while ((applicationTaskExecutor.getActiveCount() > 0
                || !applicationTaskExecutor.getThreadPoolExecutor().getQueue().isEmpty())
                && System.currentTimeMillis() < deadline) {
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }
}
