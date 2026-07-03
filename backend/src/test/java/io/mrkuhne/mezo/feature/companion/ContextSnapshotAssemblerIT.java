package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
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
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0.3 context snapshot — deterministic, LLM-free (spec §4). The fake profile keeps the
 * Gemini adapter out of the context; the assembler itself never touches the port.
 */
@Transactional
@ActiveProfiles("companion-fake")
class ContextSnapshotAssemblerIT extends AbstractIntegrationTest {

    @Autowired private ContextSnapshotAssembler assembler;
    @Autowired private UserPopulator userPopulator;
    @Autowired private BiometricProfilePopulator biometricProfilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private ProtocolPopulator protocolPopulator;
    @Autowired private SupplementIntakePopulator supplementIntakePopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testRender_shouldRenderAllBlocksWithNincsAdat_whenUserHasNoData() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String block = assembler.render(owner, today);

        assertThat(block).startsWith("\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — " + today + "):");
        // all six blocks present, in spec §4 order
        int profil = block.indexOf("[Profil]");
        int cel = block.indexOf("[Cél]");
        int edzes = block.indexOf("[Edzés]");
        int fuel = block.indexOf("[Mai üzemanyag]");
        int med = block.indexOf("[Gyógyszer]");
        int rege = block.indexOf("[Regeneráció]");
        assertThat(profil).isPositive();
        assertThat(cel).isGreaterThan(profil);
        assertThat(edzes).isGreaterThan(cel);
        assertThat(fuel).isGreaterThan(edzes);
        assertThat(med).isGreaterThan(fuel);
        assertThat(rege).isGreaterThan(med);
        // absences are explicit, never invented (spec §4) — a zero weight-trend would be a fabricated number
        assertThat(block)
            .contains("[Profil] nincs adat")
            .contains("súlytrend: nincs adat")
            .contains("[Cél] nincs adat")
            .contains("mezociklus: nincs adat")
            .contains("gym-rend: nincs adat")
            .contains("sport-rend: nincs adat")
            .contains("0 gym-edzés, 0 sportalkalom, 0 futás")
            .contains("protokoll: nincs adat, mai bevitel: 0")
            .contains("[Gyógyszer] nincs adat")
            .contains("alvás: nincs adat")
            .contains("check-in: nincs adat");
        // fuel targets come from config, so the fuel line renders numbers even on an empty day
        assertThat(block).contains("[Mai üzemanyag] 0/");
    }

    @Test
    void testRender_shouldRenderProfileAndTrend_whenProfileAndWeightsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        biometricProfilePopulator.create(owner);
        for (int i = 14; i >= 0; i--) {
            weightLogPopulator.createWeightLog(owner, today.minusDays(i),
                new BigDecimal("85.00").subtract(new BigDecimal("0.05").multiply(BigDecimal.valueOf(14 - i))));
        }

        String block = assembler.render(owner, today);

        assertThat(block).contains("[Profil] ").doesNotContain("[Profil] nincs adat");
        assertThat(block).contains(" cm").contains(" év");
        assertThat(block).contains("súlytrend: ").contains(" kg");
        assertThat(block).doesNotContain("súlytrend: nincs adat");
    }

    @Test
    void testRender_shouldPickCurrentWeekSegmentAndPlanner_whenActiveGoalWithPrescription() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(
                new GoalPrescriptionJson.Segment(1, 2, "bevezető", 2300, 170,
                    new BigDecimal("7.5"), List.of(5, 6), null, null),
                new GoalPrescriptionJson.Segment(3, 6, "vágás", 2100, 180,
                    new BigDecimal("7.5"), List.of(5, 6), null, null)),
            null, null);
        // started 2 weeks + 1 day ago → day 15 → week 3 → the second segment
        goalPopulator.createGoalFull(owner, today.minusWeeks(2).minusDays(1), today.plusWeeks(6),
            prescription, 4, "06:30", "22:30");

        String block = assembler.render(owner, today);

        assertThat(block).contains("[Cél] Nyári cut (cut): 84.2 → 80 kg");
        assertThat(block).contains("3. hét");
        assertThat(block).contains("e heti recept: 2100 kcal, 180 g fehérje, alvás 7.5 h, pihenőnap: Szo, V");
        assertThat(block).contains("étkezés/nap: 4, ébredés: 06:30, lefekvés: 22:30");
    }

    @Test
    void testRender_shouldRenderTrainDigestAndSchedules_whenActiveMesoAndSessions() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "upper", 0, "planned");
        var instance = trainPopulator.createWorkoutInstance(owner, template, today.minusDays(2), "completed");
        var exercise = trainPopulator.createExercise(owner, template.getId(), "Húzódzkodás", 0);
        trainPopulator.createLoggedSet(owner, exercise.getId(), instance.getId(), 0, "80", 8, 1);
        trainPopulator.createGymSlot(owner, 0, "18:00");
        trainPopulator.createScheduleSlot(owner, 1, "19:00", 90, "training");
        trainPopulator.createSportSession(owner, today.minusDays(1));
        var runBlock = runningPopulator.createBlock(owner, "Sprint blokk", "active");
        runningPopulator.createRunLog(owner, runBlock.getId(), 1, "w1-sprint", today.minusDays(3),
            6, 8, null, null, 25);

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("mezociklus: Hipertrófia blokk");
        assertThat(snapshot).contains("gym-rend: H 18:00");
        assertThat(snapshot).contains("sport-rend: K 19:00");
        assertThat(snapshot).contains("1 gym-edzés (" + today.minusDays(2) + ")");
        assertThat(snapshot).contains("1 sportalkalom").contains("1 futás");
    }

    @Test
    void testRender_shouldExcludeSessionsOutsideDigestWindow_whenOlderThanConfiguredDays() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        trainPopulator.createSportSession(owner, today.minusDays(10)); // outside the 7-day window
        trainPopulator.createSportSession(owner, today.minusDays(3));  // inside

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("1 sportalkalom");
    }

    @Test
    void testRender_shouldRenderFuelDayProtocolAndIntakes_whenLoggedToday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var pantry = pantryItemPopulator.createFood(owner, "Csirkemell", today.plusDays(3));
        mealPopulator.createPantryMeal(owner, pantry, today);
        waterLogPopulator.createWaterLog(owner, today, 500);
        var supplement = pantryItemPopulator.createSupplement(owner, "Kreatin");
        protocolPopulator.createProtocol(owner, 2, "active", List.of(supplement.getId()));
        supplementIntakePopulator.createIntake(owner, supplement.getId(), Instant.now());

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("víz 500/");
        assertThat(snapshot).contains("protokoll: v2 aktív, mai bevitel: 1");
        assertThat(snapshot).doesNotContain("[Mai üzemanyag] 0/"); // the meal's kcal landed
    }

    @Test
    void testRender_shouldRenderRetaDayAndPhase_whenActiveMedicationWithDose() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var med = medicationPopulator.createReta(owner);
        medicationDosePopulator.createDose(owner, med.getId(), today.minusDays(3), new BigDecimal("6"));

        String snapshot = assembler.render(owner, today);

        // dose 3 days ago → retaDay 4 → "Stabil" phase (3-5) of the populator's 7-day cycle
        assertThat(snapshot).contains("[Gyógyszer] Retatrutide: ciklus 4. nap (Stabil)");
    }

    @Test
    void testRender_shouldRenderSleepAndCheckIn_whenLogged() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.2"), 4);
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, "fáradtan ébredtem");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("alvás (" + today.minusDays(1) + "): 7.2 h, minőség 4/5");
        assertThat(snapshot).contains(
            "check-in (" + today + " 08:00): energia 4/5, stressz 2/5, megjegyzés: \"fáradtan ébredtem\"");
    }

    @Test
    void testRender_shouldTruncateCheckInNote_whenLongerThanConfiguredMax() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 3, "x".repeat(300));

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("megjegyzés: \"" + "x".repeat(200) + "…\"");
        assertThat(snapshot).doesNotContain("x".repeat(201));
    }

    @Test
    void testRender_shouldBeDeterministic_whenCalledTwice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        assertThat(assembler.render(owner, today)).isEqualTo(assembler.render(owner, today));
    }
}
