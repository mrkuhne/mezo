package io.mrkuhne.mezo.support;

import io.mrkuhne.mezo.TestcontainersConfiguration;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.AppNotificationPopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.ChallengePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.FuelSettingsPopulator;
import io.mrkuhne.mezo.support.populator.GamificationPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.DayReviewPopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.GoalSuggestionPopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.IntentionPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.MealSlotTemplatePopulator;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.MesoTemplatePopulator;
import io.mrkuhne.mezo.support.populator.NeedsPopulator;
import io.mrkuhne.mezo.support.populator.NotificationPopulator;
import io.mrkuhne.mezo.support.populator.PantryCatalogPopulator;
import io.mrkuhne.mezo.support.populator.PantryImportPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.LevelUpEventPopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.ProtocolPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.SportSlotSkipPopulator;
import io.mrkuhne.mezo.support.populator.SupplementIntakePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WorkoutDayAdjustmentPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import io.mrkuhne.mezo.support.populator.DiagnosisPopulator;
import io.mrkuhne.mezo.support.populator.WeeklyReviewPopulator;
import io.mrkuhne.mezo.support.populator.WeeklyScorePopulator;
import io.mrkuhne.mezo.support.populator.WeeklySuggestionPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

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
    MemoryItemPopulator.class,
    DailySummaryPopulator.class, PeriodSummaryPopulator.class, PatternPopulator.class, PatternEventPopulator.class,
    CompanionMessagePopulator.class, FeedbackPopulator.class, FlagLogPopulator.class,
    WeeklySuggestionPopulator.class, MemoirPopulator.class, WeeklyReviewPopulator.class,
    DiagnosisPopulator.class, WeeklyScorePopulator.class, DayReviewPopulator.class,
    PredictionPopulator.class, ExperimentPopulator.class, ChallengePopulator.class,
    QuestPopulator.class, ActivityPopulator.class, HabitPopulator.class,
    IntentionPopulator.class, RitualPopulator.class, NeedsPopulator.class, JournalPopulator.class,
    TrainPopulator.class, SportSlotSkipPopulator.class, WorkoutDayAdjustmentPopulator.class, MesoTemplatePopulator.class, RunningPopulator.class, GoalPopulator.class,
    GoalPlanLinkPopulator.class, GoalSuggestionPopulator.class, GraphPopulator.class,
    BiometricProfilePopulator.class, WeightLogPopulator.class, SleepLogPopulator.class,
    SleepGoalPopulator.class,
    CheckInPopulator.class,
    PantryCatalogPopulator.class, PantryItemPopulator.class, PantryImportPopulator.class,
    RecipePopulator.class, MealPopulator.class, WaterLogPopulator.class,
    FuelSettingsPopulator.class, MealSlotTemplatePopulator.class,
    MedicationPopulator.class, MedicationDosePopulator.class,
    ProtocolPopulator.class, SupplementIntakePopulator.class,
    SkillProgressPopulator.class, LevelUpEventPopulator.class,
    PersonPopulator.class, MentionPopulator.class, GamificationPopulator.class,
    LlmLogPopulator.class, NotificationPopulator.class, AppNotificationPopulator.class, LifeGoalPopulator.class,
    ResetDatabase.class})
public abstract class AbstractIntegrationTest {

    @Autowired
    private ResetDatabase resetDatabase;

    @Autowired(required = false)
    private ThreadPoolTaskExecutor applicationTaskExecutor;

    /**
     * {@code LlmLogWriter#onLlmCall} runs its {@code REQUIRES_NEW} audit write on this SEPARATE
     * bounded pool (mezo-2zyu) rather than {@code applicationTaskExecutor} — see
     * {@code LlmLogAsyncConfig}. It is just as capable of holding a read/write transaction across
     * the next test's {@code ResetDatabase} TRUNCATE, so it must drain on the same schedule
     * (mezo-oou9).
     */
    @Autowired(required = false)
    @Qualifier("llmLogExecutor")
    private ThreadPoolTaskExecutor llmLogExecutor;

    @BeforeEach
    void resetDatabaseState() {
        drainAsyncWork();
        resetDatabase.resetExceptMasterData();
    }

    /**
     * V1.2 → mezo-oou9: committed writes trigger AFTER_COMMIT {@code @Async} work (fact extraction,
     * embedding/graph writers, the LLM-log audit write). A leftover async task must not race the
     * next test's TRUNCATE — PR #306 hit a real 'deadlock detected' when a reader outlived the old
     * silent 2 s cap. The drain now waits up to 30 s per pool and FAILS the test loudly instead of
     * proceeding into a likely deadlock: a deterministic failure naming the cause beats a flaky
     * PessimisticLockException.
     */
    private void drainAsyncWork() {
        if (applicationTaskExecutor == null && llmLogExecutor == null) {
            return;
        }
        long deadline = System.currentTimeMillis() + 30_000;
        while (isBusy(applicationTaskExecutor) || isBusy(llmLogExecutor)) {
            if (System.currentTimeMillis() > deadline) {
                throw new IllegalStateException(
                    "Async work did not drain within 30s before DB reset ("
                        + describe("applicationTaskExecutor", applicationTaskExecutor)
                        + ", " + describe("llmLogExecutor", llmLogExecutor)
                        + ") — a hung AFTER_COMMIT listener would deadlock the TRUNCATE (mezo-oou9)");
            }
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    private static boolean isBusy(ThreadPoolTaskExecutor executor) {
        return executor != null
            && (executor.getActiveCount() > 0
                || !executor.getThreadPoolExecutor().getQueue().isEmpty());
    }

    private static String describe(String name, ThreadPoolTaskExecutor executor) {
        if (executor == null) {
            return name + "=absent";
        }
        return name + "(active=" + executor.getActiveCount()
            + ", queued=" + executor.getThreadPoolExecutor().getQueue().size() + ")";
    }
}
