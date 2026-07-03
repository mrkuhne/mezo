package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0.5 tool batch — deterministic, LLM-free render tests (the ContextSnapshotAssemblerIT idiom).
 * Tools are called directly with a hand-built ToolContext; the audit assertions prove the refs
 * each tool contributes.
 */
@Transactional
@ActiveProfiles("companion-fake")
class CompanionToolsRenderIT extends AbstractIntegrationTest {

    @Autowired private BiometricsTools biometricsTools;
    @Autowired private TrainTools trainTools;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;

    private ToolCallAudit audit;

    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void testGetWeightTrend_shouldRenderNincsAdat_whenNoWeighIns() {
        UUID owner = userPopulator.createUser().getId();
        String out = biometricsTools.getWeightTrend(4, ctx(owner));
        assertThat(out).isEqualTo("Súlytrend (4 hét): nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testGetWeightTrend_shouldRenderTrendAndWeeklyPoints_whenHistoryExists() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 0; i < 21; i++) {
            weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(20 - i),
                    BigDecimal.valueOf(88.0 - i * 0.1));
        }
        String out = biometricsTools.getWeightTrend(2, ctx(owner));
        assertThat(out).startsWith("Súlytrend (2 hét): trendsúly ").contains(" kg")
                .contains("Heti trendpontok: ");
        assertThat(audit.toRefsEnvelope().refs())
                .extracting(r -> r.kind()).containsExactly("WeightTrend");
    }

    @Test
    void testGetSleep_shouldListWindowedRowsNewestFirst_andClampDays() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("7.5"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(40), new BigDecimal("6.0"), 2);
        String out = biometricsTools.getSleep(90, ctx(owner)); // clamps to max-window-days=30
        assertThat(out).startsWith("Alvás (utolsó 30 nap):")
                .contains(LocalDate.now().minusDays(1) + ": 7.5 h, minőség 4/5")
                .doesNotContain(LocalDate.now().minusDays(40).toString());
        assertThat(audit.toRefsEnvelope().refs()).extracting(r -> r.kind()).containsExactly("Sleep");
    }

    @Test
    void testGetSleep_shouldRenderNincsAdat_whenEmpty() {
        String out = biometricsTools.getSleep(null, ctx(userPopulator.createUser().getId()));
        assertThat(out).isEqualTo("Alvás (utolsó 7 nap): nincs adat");
    }

    @Test
    void testGetRecentWorkouts_shouldRenderInstanceLinesWithVolume_whenLoggedSetsExist() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), "Pull A", "pull", 0, "planned");
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
                owner, template, LocalDate.now().minusDays(2), "completed");
        ExerciseEntity ex = trainPopulator.createExercise(owner, instance.getId(), "Húzódzkodás", 0);
        trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 0, "80", 8, 2, Instant.now());
        trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 1, "80", 6, 1, Instant.now());

        String out = trainTools.getRecentWorkouts(7, ctx(owner));

        assertThat(out).startsWith("Gym-edzések (utolsó 7 nap):")
                .contains(LocalDate.now().minusDays(2) + ": Pull A (pull) — 2 sorozat, volumen 1120 kg");
        assertThat(audit.toRefsEnvelope().refs())
                .contains(new RefsEnvelope.Ref("Workout", LocalDate.now().minusDays(2).toString()));
    }

    @Test
    void testGetRecentWorkouts_shouldRenderNincsAdat_whenWindowEmpty() {
        assertThat(trainTools.getRecentWorkouts(null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Gym-edzések (utolsó 7 nap): nincs adat");
    }

    @Test
    void testGetSportSessions_shouldRenderSportAndRunLines_whenBothExist() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSession(owner, LocalDate.now().minusDays(1), "volleyball", 5, null, "6.5");
        RunningBlockEntity block = runningPopulator.createBlock(owner, "Futás blokk", "active");
        runningPopulator.createRunLog(owner, block.getId(), 2, "int1",
                LocalDate.now().minusDays(3), 6, 7, null, null, 35);

        String out = trainTools.getSportSessions(7, ctx(owner));

        assertThat(out).startsWith("Sportalkalmak (utolsó 7 nap):")
                .contains(LocalDate.now().minusDays(1) + ": volleyball 60 perc, RPE 6.5, 5 szett")
                .contains("Futások:")
                .contains(LocalDate.now().minusDays(3) + ": 2. hét int1 — 6 kör, RPE 7, 35 perc");
        assertThat(audit.toRefsEnvelope().refs()).contains(
                new RefsEnvelope.Ref("Sport", LocalDate.now().minusDays(1).toString()),
                new RefsEnvelope.Ref("Run", LocalDate.now().minusDays(3).toString()));
    }
}
