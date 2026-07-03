package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.ProtocolPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.SupplementIntakePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
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
    @Autowired private FuelTools fuelTools;
    @Autowired private GoalTools goalTools;
    @Autowired private MedicationTools medicationTools;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private ProtocolPopulator protocolPopulator;
    @Autowired private SupplementIntakePopulator supplementIntakePopulator;

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

    @Test
    void testGetRecentMeals_shouldRenderDayRollupsWithTitles_whenMealLogged() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Csirkemell", LocalDate.now().plusDays(5));
        mealPopulator.createPantryMeal(owner, item, LocalDate.now().minusDays(1));

        String out = fuelTools.getRecentMeals(3, ctx(owner));

        assertThat(out).startsWith("Napi étkezés-összesítők (utolsó 3 nap):")
                .contains(LocalDate.now().minusDays(1) + ": ")
                .contains("kcal").contains("1 étkezés (Reggeli)")
                .contains(LocalDate.now() + ": ").contains("0 étkezés");
        assertThat(audit.toRefsEnvelope().refs()).containsExactly(
                new RefsEnvelope.Ref("FuelDay", LocalDate.now().minusDays(1).toString()));
    }

    @Test
    void testGetProtocolAdherence_shouldRenderPerDayCoverage_whenProtocolActive() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity a = pantryItemPopulator.createSupplement(owner, "Kreatin");
        PantryItemEntity b = pantryItemPopulator.createSupplement(owner, "D3-vitamin");
        protocolPopulator.createProtocol(owner, 3, "active", List.of(a.getId(), b.getId()));
        supplementIntakePopulator.createIntake(owner, a.getId(), Instant.now());

        String out = fuelTools.getProtocolAdherence(1, ctx(owner));

        assertThat(out).startsWith("Protokoll-követés (utolsó 1 nap): aktív protokoll v3, 2 elem")
                .contains(LocalDate.now() + ": 1/2")
                .contains("Összesen: 1/2 (50%)");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Protocol", "v3"));
    }

    @Test
    void testGetProtocolAdherence_shouldRenderNincsAktivProtokoll_whenNoneActive() {
        assertThat(fuelTools.getProtocolAdherence(7, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Protokoll-követés: nincs aktív protokoll");
    }

    @Test
    void testGetGoalProgress_shouldComposeGoalTrendAndSegment_whenActiveGoalExists() {
        UUID owner = userPopulator.createUser().getId();
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
                List.of(new GoalPrescriptionJson.Segment(1, 6, "vágás", 2100, 160,
                        new BigDecimal("7.5"), List.of(5, 6), null, null)),
                null, null);
        // started 2 weeks + 1 day ago → day 15 → week 3
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(2).minusDays(1),
                LocalDate.now().plusWeeks(10), prescription, 4, "06:30", "22:30");
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(8), new BigDecimal("87.1"));
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(1), new BigDecimal("86.4"));

        String out = goalTools.getGoalProgress(ctx(owner));

        assertThat(out).startsWith("Cél: Nyári cut (cut), 3. hét; 84.2 → 80 kg")
                .contains("trendsúly most ").contains("eddig ")
                .contains("e heti recept: 2100 kcal, 160 g fehérje");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Goal", "Nyári cut"));
    }

    @Test
    void testGetGoalProgress_shouldRenderNincsAktivCel_whenNone() {
        assertThat(goalTools.getGoalProgress(ctx(userPopulator.createUser().getId())))
                .isEqualTo("Cél: nincs aktív cél");
    }

    @Test
    void testGetRetaCycle_shouldRenderCyclePhaseAndDoses_whenDoseAnchored() {
        UUID owner = userPopulator.createUser().getId();
        MedicationEntity med = medicationPopulator.createReta(owner);
        medicationDosePopulator.createDose(owner, med.getId(), LocalDate.now().minusDays(3), new BigDecimal("4"));

        String out = medicationTools.getRetaCycle(ctx(owner));

        assertThat(out).startsWith("Retatrutid ciklus: Retatrutide — 4. nap (Stabil)")
                .contains("utolsó dózis: " + LocalDate.now().minusDays(3) + " (4 mg)")
                .contains("következő esedékes: " + LocalDate.now().minusDays(3).plusDays(7));
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Medication", "Retatrutide"));
    }

    @Test
    void testGetRetaCycle_shouldRenderHonestZero_whenNoDose() {
        UUID owner = userPopulator.createUser().getId();
        medicationPopulator.createReta(owner);
        assertThat(medicationTools.getRetaCycle(ctx(owner)))
                .isEqualTo("Retatrutid ciklus: Retatrutide — nincs rögzített dózis");
    }
}
