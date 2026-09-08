package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.intention.entity.DailyIntentionEntity;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.GamificationPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.IntentionPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.ProtocolPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.SportSlotSkipPopulator;
import io.mrkuhne.mezo.support.populator.SupplementIntakePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.support.populator.WorkoutDayAdjustmentPopulator;
import java.math.BigDecimal;
import java.time.Duration;
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
    @Autowired private WorkoutDayAdjustmentPopulator workoutDayAdjustmentPopulator;
    @Autowired private SportSlotSkipPopulator sportSlotSkipPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private ProtocolPopulator protocolPopulator;
    @Autowired private SupplementIntakePopulator supplementIntakePopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private GamificationPopulator gamificationPopulator;
    @Autowired private SkillProgressPopulator skillProgressPopulator;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private IntentionPopulator intentionPopulator;
    @Autowired private RitualPopulator ritualPopulator;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private io.mrkuhne.mezo.support.populator.LifeGoalPopulator lifeGoalPopulator;

    @Test
    void testRender_shouldRenderAllBlocksWithNincsAdat_whenUserHasNoData() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String block = assembler.render(owner, today);

        assertThat(block).startsWith("\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — " + today + "):");
        // all ten blocks present, in render() order
        int profil = block.indexOf("[Profil]");
        int cel = block.indexOf("[Cél]");
        int celok = block.indexOf("[Célok]");
        int edzes = block.indexOf("[Edzés]");
        int novekedes = block.indexOf("[Növekedés]");
        int gyakorlat = block.indexOf("[Napi gyakorlat]");
        int emberek = block.indexOf("[Emberek]");
        int fuel = block.indexOf("[Mai üzemanyag]");
        int med = block.indexOf("[Gyógyszer]");
        int rege = block.indexOf("[Regeneráció]");
        assertThat(profil).isPositive();
        assertThat(cel).isGreaterThan(profil);
        assertThat(celok).isGreaterThan(cel);
        assertThat(edzes).isGreaterThan(celok);
        assertThat(novekedes).isGreaterThan(edzes);
        assertThat(gyakorlat).isGreaterThan(novekedes);
        assertThat(emberek).isGreaterThan(gyakorlat);
        assertThat(fuel).isGreaterThan(emberek);
        assertThat(med).isGreaterThan(fuel);
        assertThat(rege).isGreaterThan(med);
        // absences are explicit, never invented (spec §4) — a zero weight-trend would be a fabricated number
        assertThat(block)
            .contains("[Profil] nincs adat")
            .contains("súlytrend: nincs adat")
            .contains("[Cél] nincs adat")
            .contains("[Célok] nincs aktív életcél")
            .contains("mezociklus: nincs adat")
            .contains("gym-rend: nincs adat")
            .contains("sport-rend: nincs adat")
            .contains("0 gym-edzés, 0 sportalkalom, 0 futás")
            .contains("top skill: nincs adat")
            .contains("[Napi gyakorlat] küldetés: nincs adat")
            .contains("hitvallás: nincs adat")
            .contains("mai fókusz: nincs adat")
            .contains("napzárás: nyitva")
            .contains("[Emberek] nincs adat")
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
    void testRender_shouldShowLatestMeasurementBesideTrend_whenWeighInsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        weightLogPopulator.createWeightLog(owner, today.minusDays(3), new BigDecimal("97.5"));
        weightLogPopulator.createWeightLog(owner, today, new BigDecimal("96.4"));

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("mérés: 96,4 kg (" + today + ")");
        assertThat(snapshot).contains("súlytrend:");
    }

    @Test
    void testRender_shouldShowTheLastLoggedMeasurement_whenTwoWeighInsShareTheDay() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        // A same-day correction: identical date, so only created_at orders them. The finder's
        // tie-break must surface the LATER entry, not whichever the DB happens to return first.
        weightLogPopulator.createWeightLogAt(owner, today, new BigDecimal("96.4"),
            Instant.now().minusSeconds(3600));
        weightLogPopulator.createWeightLogAt(owner, today, new BigDecimal("95.8"),
            Instant.now().minusSeconds(60));

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("mérés: 95,8 kg (" + today + ")");
        assertThat(snapshot).doesNotContain("mérés: 96,4 kg");
    }

    @Test
    void testRender_shouldShowNoDataMeasurement_whenNoWeighIns() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("mérés: nincs adat");
    }

    /**
     * mezo-a64t: the production weight card read "83.3 kg … 83.694 kg … heti -0.244 kg" — decimal
     * POINTS inside Hungarian prose, at gram precision, one card above a "4,5 óra". Every figure on
     * this line is quoted back to the user, so all of them go through the Hungarian display
     * formatter at the precision of the QUANTITY: a body weight one decimal, a weekly rate two.
     * The whole line is asserted free of "." — a single missed call site is the entire defect.
     */
    @Test
    void testRender_shouldRenderWeightFiguresWithHungarianDecimals_whenWeighInsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        biometricProfilePopulator.create(owner);
        // a full week of daily weigh-ins so the trend has a defined slope (2+ distinct days), and a
        // gram-precision last entry — the exact shape that produced "83.694 kg" in production
        for (int i = 6; i >= 1; i--) {
            weightLogPopulator.createWeightLog(owner, today.minusDays(i),
                new BigDecimal("84.10").subtract(new BigDecimal("0.07").multiply(BigDecimal.valueOf(6 - i))));
        }
        weightLogPopulator.createWeightLog(owner, today, new BigDecimal("83.694"));

        String profileLine = assembler.render(owner, today).lines()
            .filter(l -> l.startsWith("[Profil]")).findFirst().orElseThrow();

        assertThat(profileLine).contains("mérés: 83,7 kg (" + today + ")");
        // the ISO dates on this line use dashes, so a "." here can only be a mis-rendered figure
        assertThat(profileLine).contains("súlytrend: ").doesNotContain(".");
        // a week of weigh-ins ⇒ a defined slope, rendered at RATE precision (two decimals)
        assertThat(profileLine).matches(".*heti -?\\d+,\\d{2} kg.*");
    }

    @Test
    void testRender_shouldPickCurrentWeekSegmentAndPlanner_whenActiveGoalWithPrescription() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(
                new GoalPrescriptionJson.Segment(1, 2, "bevezető", 2300, 170, null, null,
                    new BigDecimal("7.5"), List.of(5, 6), null, null, null, null, null),
                new GoalPrescriptionJson.Segment(3, 6, "vágás", 2100, 180, null, null,
                    new BigDecimal("7.5"), List.of(5, 6), null, null, null, null, null)),
            null, null);
        // started 2 weeks + 1 day ago → day 15 → week 3 → the second segment
        goalPopulator.createGoalFull(owner, today.minusWeeks(2).minusDays(1), today.plusWeeks(6),
            prescription, 4, "06:30", "22:30");

        String block = assembler.render(owner, today);

        assertThat(block).contains("[Cél] Nyári cut (fogyás): 84,2 → 80,0 kg");
        assertThat(block).contains("3. hét");
        assertThat(block).contains("e heti recept: 2100 kcal, 180 g fehérje, alvás 7,5 h, pihenőnap: Szo, V");
        // The day anchor now comes from the sleep goal, not the retired goal wake/bed columns
        // (createGoalFull passed 06:30/22:30). With no sleep_goal row the config ghost renders.
        assertThat(block).contains("étkezés/nap: 4, ébredés: 06:00, lefekvés: 22:00");
        assertThat(block).doesNotContain("06:30").doesNotContain("22:30");
    }

    /**
     * mezo-padz: {@code GoalEntity.trajectory} stores the raw {@code cut|bulk|maintain}, and the
     * block used to emit it verbatim — the ONE non-Hungarian label in an otherwise fully Hungarian
     * snapshot, so the model wrote its own Hungarian for it. Each value is pinned, and the raw
     * token is asserted GONE: a partial translation would leave the same gap.
     */
    @Test
    void testRender_shouldRenderTheTrajectoryInHungarian_whenGoalIsCut() {
        UUID owner = userPopulator.createUser().getId();
        goalPopulator.createGoal(owner, "cut", "active");

        String block = assembler.render(owner, LocalDate.now());

        assertThat(block).contains("[Cél] Nyári cut (fogyás):").doesNotContain("(cut):");
    }

    @Test
    void testRender_shouldRenderTheTrajectoryInHungarian_whenGoalIsBulk() {
        UUID owner = userPopulator.createUser().getId();
        goalPopulator.createGoal(owner, "bulk", "active");

        String block = assembler.render(owner, LocalDate.now());

        assertThat(block).contains("[Cél] Nyári cut (tömegelés): 84,2 → 90,0 kg")
            .doesNotContain("(bulk)");
    }

    /**
     * {@code maintain} is RECOMP on the repo owner's own definition — hold body weight while
     * strength and muscle go UP. A bare "súlytartás" reads as "do nothing", the opposite of the
     * prescription, so the parenthetical is part of the contract, not decoration. The populator's
     * maintain goal carries no target weight, which also pins huNum's "?" for a null figure.
     */
    @Test
    void testRender_shouldSpellOutRecomp_whenGoalTrajectoryIsMaintain() {
        UUID owner = userPopulator.createUser().getId();
        goalPopulator.createGoal(owner, "maintain", "active");

        String block = assembler.render(owner, LocalDate.now());

        assertThat(block).contains("[Cél] Nyári cut (súlytartás (recomp: testsúly tartása mellett "
            + "erő- és izomgyarapodás, hízás nélkül)): 84,2 → ? kg");
        assertThat(block).doesNotContain("(maintain)");
    }

    @Test
    void testRender_shouldRenderSleepGoalAnchor_whenSleepGoalRowExists() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoalFull(owner, today.minusWeeks(1), today.plusWeeks(6), null, 4, "06:30", "22:30");
        // 7.5 h target anchored to a 06:45 wake → derived bed 23:15
        sleepGoalPopulator.goal(owner, 450, "WAKE", "06:45", 15);

        String block = assembler.render(owner, today);

        assertThat(block).contains("ébredés: 06:45, lefekvés: 23:15");
    }

    @Test
    void testRender_shouldRenderGhostAnchor_whenNoSleepGoalRow() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoalFull(owner, today.minusWeeks(1), today.plusWeeks(6), null, 4, "06:30", "22:30");

        String block = assembler.render(owner, today);

        // no sleep_goal row → config ghost (WAKE 06:00, 8 h target → bed 22:00); goal columns ignored
        assertThat(block).contains("ébredés: 06:00, lefekvés: 22:00");
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

    /**
     * mezo-f1x1: the digest window is TRAILING (today - digestDays + 1 .. today), and an
     * unlabelled "elmúlt 7 nap" was re-attributed by the model to the CALENDAR week — on a Tuesday
     * the morning card reported last week's sessions as "a héten eddig". The label must state the
     * period it really covers, so nothing is left to re-attribute. The bare "elmúlt N nap:" form is
     * asserted absent: that exact string is what the hallucination fed on.
     */
    @Test
    void testRender_shouldLabelTheDigestWindowWithItsInclusiveBounds_whenRenderingTheTrainBlock() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String snapshot = assembler.render(owner, today);

        // digest-days: 7 → a 7-day window whose first day is today - 6, both ends inclusive
        assertThat(snapshot).contains("elmúlt 7 nap (gördülő ablak, " + today.minusDays(6)
            + " – " + today + ", nem a naptári hét): 0 gym-edzés");
        assertThat(snapshot).doesNotContain("elmúlt 7 nap:");
        // the morning message is the surface that shipped the false claim, so it must carry it too
        assertThat(assembler.renderWithoutBiometrics(owner, today))
            .contains("gördülő ablak, " + today.minusDays(6) + " – " + today);
    }

    /**
     * The workout closing note (mezo-d20.13) — the user's own sentence about how the session went,
     * carried VERBATIM into both the digest and today's logged line. It is the one thing in the
     * train block that no number can convey, so summarizing it is what would destroy it.
     */
    @Test
    void testRender_shouldCarryClosingNotesVerbatim_whenWorkoutsHaveThem() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "upper", 0, "planned");
        trainPopulator.createWorkoutInstance(owner, template, today.minusDays(2), "completed",
            "Öt órát aludtam, mégis vitt a lendület.");
        trainPopulator.createWorkoutInstance(owner, template, today, "completed",
            "Ma könnyűnek érződött a lehúzás.");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains(today.minusDays(2) + " — \"Öt órát aludtam, mégis vitt a lendület.\"");
        assertThat(snapshot).contains("gym: elvégezve — \"Ma könnyűnek érződött a lehúzás.\"");
        // The morning message strips data generated later in the day but NOT the train block —
        // the two assembly points must not silently diverge on a new field.
        assertThat(assembler.renderWithoutBiometrics(owner, today))
            .contains("Ma könnyűnek érződött a lehúzás.");
    }

    /** ADR 0010: an absent note is not remarked on. Nothing is rendered where nothing was written. */
    @Test
    void testRender_shouldRenderNoNoteMarker_whenWorkoutHasNone() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "upper", 0, "planned");
        trainPopulator.createWorkoutInstance(owner, template, today, "completed", "   ");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("gym: elvégezve;");
        assertThat(snapshot).doesNotContain("—  \"").doesNotContain("nincs jegyzet");
    }

    /**
     * The snapshot rides EVERY chat turn and the contract lets a note be 1000 chars, so the clip
     * is load-bearing, not cosmetic. Truncation is honestly lossy; an LLM rewrite would fabricate.
     */
    @Test
    void testRender_shouldTruncateClosingNote_whenLongerThanTheConfiguredCap() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "upper", 0, "planned");
        String longNote = "x".repeat(600);
        trainPopulator.createWorkoutInstance(owner, template, today, "completed", longNote);

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).doesNotContain(longNote);
        assertThat(snapshot).contains("…\"");
    }

    @Test
    void testTrainBlock_shouldResolveTomorrowGymAndSport_whenScheduledForTomorrowWeekday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);
        int tomorrowDow = tomorrow.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas (schedule-slot convention)
        String tomorrowLabel = WorkoutService.HU_DAY_LABELS.get(tomorrowDow);

        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), tomorrowLabel, "upper", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        trainPopulator.createScheduleSlot(owner, tomorrowDow, "19:00", 90, "training");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("[Edzés]").contains("Holnap (terv):");
        String tail = snapshot.substring(snapshot.indexOf("Holnap (terv):"));
        // exact rendered exercise line (name + working-sets × rep-range), not just a name
        // substring — pins exerciseLine's null-guarded formatting (TrainPopulator default
        // exercise: workingSets=3, repMin=6, repMax=8).
        assertThat(tail).contains(tomorrowLabel).contains("Fekvenyomás 3×6-8").contains("volleyball");
    }

    @Test
    void testTrainBlock_shouldApplyLightenDelta_whenTomorrowIsAdjusted() {
        // mezo-d58h.5: dayLine renders "Holnap (terv)" straight from the template's raw
        // workingSets — it must fold in the per-date lighten overlay itself, or the AI would
        // contradict the "lighten tomorrow" card the user just tapped (TrainTools' twin site).
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);
        String tomorrowLabel = WorkoutService.HU_DAY_LABELS.get(tomorrow.getDayOfWeek().getValue() - 1);
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), tomorrowLabel, "upper", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        workoutDayAdjustmentPopulator.createAdjustment(owner, tomorrow, (short) -1);

        String snapshot = assembler.render(owner, today);

        String tail = snapshot.substring(snapshot.indexOf("Holnap (terv):"));
        assertThat(tail).contains("Fekvenyomás 2×6-8").doesNotContain("Fekvenyomás 3×6-8");
    }

    @Test
    void testTrainBlock_shouldKeepTemplateCount_whenTomorrowHasNoAdjustment() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);
        String tomorrowLabel = WorkoutService.HU_DAY_LABELS.get(tomorrow.getDayOfWeek().getValue() - 1);
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), tomorrowLabel, "upper", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        // An adjustment exists, but for a different date — must not leak into tomorrow's line.
        workoutDayAdjustmentPopulator.createAdjustment(owner, tomorrow.plusDays(3), (short) -2);

        String snapshot = assembler.render(owner, today);

        String tail = snapshot.substring(snapshot.indexOf("Holnap (terv):"));
        assertThat(tail).contains("Fekvenyomás 3×6-8");
    }

    @Test
    void testTrainBlock_shouldRenderRestDay_whenNoTemplateMatchesTodayOrTomorrowWeekday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        String tomorrowLabel = WorkoutService.HU_DAY_LABELS.get(tomorrow.getDayOfWeek().getValue() - 1);
        String restLabel = WorkoutService.HU_DAY_LABELS.stream()
            .filter(label -> !label.equals(todayLabel) && !label.equals(tomorrowLabel))
            .findFirst().orElseThrow();
        // an active meso exists, but its only template day is neither today's nor tomorrow's HU
        // weekday — a genuine rest day within a mesocycle (findPlannedTemplateForDate → empty).
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        trainPopulator.createWorkoutSession(owner, meso.getId(), restLabel, "upper", 0, "planned");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("Ma (terv): pihenőnap");
        assertThat(snapshot).contains("Holnap (terv): pihenőnap (gym)");
    }

    @Test
    void testTrainBlock_shouldRenderRestDay_whenTodayTemplateExistsWithoutExercises() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        // The meso wizard stores ALL 7 days as template rows — weekend rest days are real rows
        // with type "Rest" and zero exercises (mezo-650a live-data shape). A present-but-empty
        // template is a rest day, exactly as TrainTools.dayContentLine already renders it.
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel, "Rest", 0, "planned");

        String snapshot = assembler.render(owner, today);

        String maSegment = snapshot.substring(snapshot.indexOf("Ma (terv):"), snapshot.indexOf("Holnap (terv):"));
        assertThat(maSegment).contains("pihenőnap (gym)").doesNotContain("gym (");
    }

    @Test
    void testTrainBlock_shouldRenderTodayGymAsNotDone_whenNoCompletedInstanceExistsForToday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel, "upper", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);

        String snapshot = assembler.render(owner, today);

        // mezo-xrhd: "Ma" used to render the PLAN alone — the midday companion note read the
        // planned exercise list as history ("a reggeli edzéseden már túl vagy") on a day with no
        // logged workout at all. The plan is now labelled a plan and carries today's REAL state.
        assertThat(snapshot).contains("Ma (terv): gym (" + todayLabel + ")");
        assertThat(snapshot).contains(
            "Ma eddig naplózva: gym: nincs elvégzett edzés; sport: 0 alkalom; futás: 0 alkalom");
    }

    @Test
    void testTrainBlock_shouldRenderTodayGymAsDone_whenCompletedInstanceExistsForToday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel, "upper", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        trainPopulator.createWorkoutInstance(owner, template, today, "completed");
        trainPopulator.createSportSession(owner, today);

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains(
            "Ma eddig naplózva: gym: elvégezve; sport: 1 alkalom; futás: 0 alkalom");
    }

    @Test
    void testTrainBlock_shouldResolveTodayGymAndSport_whenScheduledForTodayWeekday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        int todayDow = today.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas (schedule-slot convention)
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(todayDow);

        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel, "upper", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        trainPopulator.createScheduleSlot(owner, todayDow, "18:00", 120, "training");

        String snapshot = assembler.render(owner, today);

        // "Ma:" must carry the same dated resolution as "Holnap:" (mezo-ajp) — the asymmetry was
        // why today's sport was only inferable from the trailing raw weekly "sport-rend" pattern.
        String maSegment = snapshot.substring(snapshot.indexOf("Ma (terv):"), snapshot.indexOf("Holnap (terv):"));
        assertThat(maSegment).contains(todayLabel).contains("Fekvenyomás 3×6-8")
            .contains("sport: volleyball 18:00 training (120 perc)");
    }

    @Test
    void testTrainBlock_shouldOmitSkippedSportSlot_whenSkippedForTodaysDate() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        int todayDow = today.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas (schedule-slot convention)
        trainPopulator.createScheduleSlot(owner, todayDow, "18:00", 120, "training");
        sportSlotSkipPopulator.createSkip(owner, todayDow, "18:00", today);

        String snapshot = assembler.render(owner, today);

        String maSegment = snapshot.substring(snapshot.indexOf("Ma (terv):"), snapshot.indexOf("Holnap (terv):"));
        assertThat(maSegment).doesNotContain("sport: volleyball");
    }

    @Test
    void testTrainBlock_shouldStillRenderSportSlot_whenSkipAppliesToADifferentDate() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        int todayDow = today.getDayOfWeek().getValue() - 1;
        trainPopulator.createScheduleSlot(owner, todayDow, "18:00", 120, "training");
        // a skip for a DIFFERENT dated occurrence of the same recurring slot must not hide today's.
        sportSlotSkipPopulator.createSkip(owner, todayDow, "18:00", today.minusDays(7));

        String snapshot = assembler.render(owner, today);

        String maSegment = snapshot.substring(snapshot.indexOf("Ma (terv):"), snapshot.indexOf("Holnap (terv):"));
        assertThat(maSegment).contains("sport: volleyball 18:00 training (120 perc)");
    }

    @Test
    void testTrainBlock_shouldResolveTodayRunSession_whenActiveRunningBlockHasSessionForTodayWeekday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        runningPopulator.createBlockWithSessions(owner, "Sprint blokk", "active", 4, 7);

        String snapshot = assembler.render(owner, today);

        String maSegment = snapshot.substring(snapshot.indexOf("Ma (terv):"), snapshot.indexOf("Holnap (terv):"));
        assertThat(maSegment).contains("futás: Sprint-intervallum");
    }

    @Test
    void testTrainBlock_shouldResolveTomorrowRunSession_whenActiveRunningBlockHasSessionForTomorrowWeekday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        // sessionsPerWeek=7 covers every weekday, so tomorrow's weekday always has a prescribed
        // session regardless of the real calendar date — the derived week always clamps into
        // [1, weeks] and every week in this structure covers all 7 weekdays.
        runningPopulator.createBlockWithSessions(owner, "Sprint blokk", "active", 4, 7);

        String snapshot = assembler.render(owner, today);

        String tail = snapshot.substring(snapshot.indexOf("Holnap (terv):"));
        assertThat(tail).contains("futás: Sprint-intervallum");
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
    void testRender_shouldRenderAccountLevelAndTopSkill_whenGamificationAndSkillProfileSeeded() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        gamificationPopulator.profile(owner, 40, 5, 1, today);
        // 500 cumulative XP -> account level 4 on the AccountLevelCurve (80/120/160/200 thresholds)
        skillProgressPopulator.createSkill(owner, "sprint_speed", "ATHLETIC", 500, 4);

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains(
            "[Növekedés] szint 4 (500 XP), 40 érme, 5 napos sorozat");
        assertThat(snapshot).contains("top skill: sprint_speed L4");
        // no quest/level-up activity this week -> honest zero, not fabricated
        assertThat(snapshot).contains("e heti XP: 0 (küldetés 0/0 zárva)");
    }

    @Test
    void testRender_shouldRenderQuestCountCreedFocusAndRitual_whenSeeded() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        intentionPopulator.creed(owner, "Kitartás mindenben.");
        intentionPopulator.focus(owner, today, "Reggeli edzés végigcsinálása");
        intentionPopulator.reflection(owner, today, DailyIntentionEntity.REFLECTION_PARTIAL);
        questPopulator.quest(owner, today, DailyQuestEntity.SLOT_BODY, "test_quest", "max_strength",
            "ATHLETIC", "sets", new BigDecimal("1"), 30, DailyQuestEntity.STATUS_OFFERED);
        ritualPopulator.closedDay(owner, today);
        // all 9 MORNING keys done on one past day -> one perfect morning; no EVENING day is perfect
        LocalDate perfectMorningDay = today.minusDays(1);
        habitPopulator.row(owner, perfectMorningDay, "wake_on_time", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, perfectMorningDay, "morning_sunlight", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, perfectMorningDay, "morning_pushups", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, perfectMorningDay, "morning_video", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, perfectMorningDay, "morning_weigh_in", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, perfectMorningDay, "morning_coffee", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, perfectMorningDay, "morning_workout", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, perfectMorningDay, "protein_breakfast", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, perfectMorningDay, "daily_intention", HabitDayEntity.STATUS_DONE);

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("[Napi gyakorlat] küldetés: 0/1");
        assertThat(snapshot).contains("szokás-lánc: reggeli 1, esti 0 tökéletes nap (30 nap)");
        assertThat(snapshot).contains("hitvallás: Kitartás mindenben.");
        assertThat(snapshot).contains("mai fókusz: Reggeli edzés végigcsinálása");
        // HU-mapped reflection, never the raw English enum value ("partial") leaking into the block
        assertThat(snapshot).contains("esti reflexió: részben");
        assertThat(snapshot).doesNotContain("esti reflexió: partial");
        assertThat(snapshot).contains("napzárás: zárva");
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
        assertThat(snapshot).contains(
            "protokoll: v2 aktív (nincs neve — csak a verziószám azonosítja), mai bevitel: 1");
        assertThat(snapshot).doesNotContain("[Mai üzemanyag] 0/"); // the meal's kcal landed
    }

    /**
     * mezo-padz: ProtocolResponse (api/feature/fuel/fuel.yml) carries id/version/builtAt/status/items
     * and nothing name-like, so "v3 aktív" was the entire label — and the model filled the gap by
     * borrowing the GOAL's title, writing "a Lean Gain protokollod szerint" about a protocol with no
     * such name. With a named goal present, the fuel block must state the absence outright and must
     * NOT carry the goal's title.
     */
    @Test
    void testRender_shouldStateTheProtocolHasNoName_whenAnActiveGoalCouldLendItsTitle() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "cut", "active");
        var supplement = pantryItemPopulator.createSupplement(owner, "Kreatin");
        protocolPopulator.createProtocol(owner, 3, "active", List.of(supplement.getId()));

        String fuelLine = assembler.render(owner, today).lines()
            .filter(l -> l.startsWith("[Mai üzemanyag]")).findFirst().orElseThrow();

        assertThat(fuelLine).contains("protokoll: v3 aktív (nincs neve — csak a verziószám azonosítja)");
        assertThat(fuelLine).doesNotContain("Nyári cut");
    }

    @Test
    void testRender_shouldRenderCycleDayAndPhase_whenActiveMedicationWithDose() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var med = medicationPopulator.createMedication(owner);
        medicationDosePopulator.createDose(owner, med.getId(), today.minusDays(3), new BigDecimal("6"));

        String snapshot = assembler.render(owner, today);

        // dose 3 days ago → cycleDay 4 → "Stabil" phase (3-5) of the populator's 7-day cycle
        assertThat(snapshot).contains("[Gyógyszer] Teszt gyógyszer: ciklus 4. nap (Stabil)");
    }

    @Test
    void testRender_shouldRenderSleepAndCheckIn_whenLogged() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.2"), 4);
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, "fáradtan ébredtem");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("alvás (" + today.minusDays(1) + "): 7,2 h, minőség 4/10");
        assertThat(snapshot).contains(
            "check-in (" + today + " 08:00): energia 4/10, stressz 2/10, megjegyzés: \"fáradtan ébredtem\"");
    }

    /**
     * mezo-b6zt: the quality scale is 1..10 (sleep.yml SleepLogRequest.quality; the FE offers a
     * 1..10 selector), but this block hardcoded "/5" — so a 9 reached the prompt as the impossible
     * "9/5" and the model judged sleep against half the real ceiling. 9 is the pinning value
     * precisely because it cannot exist on the old denominator.
     *
     * <p>mezo-a64t: the duration on the same line is quoted back to the user, so it renders with a
     * Hungarian comma at one decimal — never the unrounded, locale-independent form that put
     * "7.25 h" one card above a "4,5 óra".
     */
    @Test
    void testRender_shouldRenderSleepQualityAgainstTen_whenSleepIsRatedAboveFive() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.25"), 9);

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("alvás (" + today.minusDays(1) + "): 7,3 h, minőség 9/10");
        assertThat(snapshot).doesNotContain("minőség 9/5");
    }

    /** An unrated row must still emit NOTHING for quality — the shared fragment is null there, and
     *  "null/10" or a fabricated default in a prompt is worse than silence (ADR 0010). */
    @Test
    void testRender_shouldOmitTheQualityFragment_whenSleepIsUnrated() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("6.0"), null);

        String snapshot = assembler.render(owner, today);

        String recoveryLine = snapshot.lines()
            .filter(l -> l.startsWith("[Regeneráció]")).findFirst().orElseThrow();
        assertThat(recoveryLine).contains("alvás (" + today.minusDays(1) + "): 6,0 h;")
            .doesNotContain("minőség");
    }

    /**
     * mezo-b6zt siblings: the two check-in figures were already /10 but as LITERALS, and this test
     * pins them against {@link ToolText#RATING_MAX} rather than re-spelling the ceiling — the day
     * narrative disagreed with this block precisely because each renderer owned its own copy.
     */
    @Test
    void testRender_shouldRenderCheckInRatingsAgainstTheSharedCeiling_whenRatedAboveFive() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 8, 7, null);

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains(
            "energia 8/" + ToolText.RATING_MAX + ", stressz 7/" + ToolText.RATING_MAX);
        assertThat(snapshot).doesNotContain("8/5").doesNotContain("7/5");
    }

    /**
     * {@code check_in.energy} and {@code .stress} are both nullable, and this block used to append
     * them unguarded — so an unanswered slider reached the prompt as the literal "energia null/10",
     * a fabricated-looking figure in a block whose whole contract is honest absence (ADR 0010).
     * A slot with neither reading now renders "nincs adat", the BiometricsTools idiom.
     */
    @Test
    void testRender_shouldRenderNoDataForCheckIn_whenBothSlidersUnanswered() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", null, null, null);

        String snapshot = assembler.render(owner, today);

        String recoveryLine = snapshot.lines()
            .filter(l -> l.startsWith("[Regeneráció]")).findFirst().orElseThrow();
        assertThat(recoveryLine).contains("check-in (" + today + " 08:00): nincs adat")
            .doesNotContain("null");
    }

    @Test
    void testRender_shouldMarkCheckInMissingForToday_whenLatestCheckInIsFromAnEarlierDay() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 2, "tegnapi");

        String snapshot = assembler.render(owner, today);

        // mezo-xrhd: the block rendered the latest check-in EVER, dated but with no today-status,
        // so a day without one read as "nothing to say" and the midday note silently skipped it.
        assertThat(snapshot).contains("check-in: MA MÉG NINCS (utolsó: " + today.minusDays(1)
            + " 08:00 — energia 4/10, stressz 2/10, megjegyzés: \"tegnapi\")");
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
        var goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.sleepPillar(goal);

        assertThat(assembler.render(owner, today)).isEqualTo(assembler.render(owner, today));
    }

    @Test
    void testRender_shouldRenderCelokBlock_whenActiveLifeGoalExists() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var goal = lifeGoalPopulator.goal(owner, "active");
        var pillar = lifeGoalPopulator.sleepPillar(goal);
        lifeGoalPopulator.pillarDay(pillar, today.minusDays(1), "hit");

        String block = assembler.render(owner, today);

        assertThat(block).contains("Kockahas [Egészség]").contains("Leggyengébb pillér: Alvás");
    }

    @Test
    void testRenderWithoutBiometrics_shouldIncludeCelokBlock_whenActiveLifeGoalExists() {
        // user-döntés (2026-09-05): a reggeli variáns IS látja a célokat — pozitív nudge
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        lifeGoalPopulator.goal(owner, "active");

        String block = assembler.renderWithoutBiometrics(owner, today);

        assertThat(block).contains("Kockahas [Egészség]");
    }

    @Test
    void testRenderWithoutBiometrics_shouldOmitWeightAndSleep_whenDataExists() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        biometricProfilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, today, new BigDecimal("85.0"));
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.2"), 4);
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, "fáradtan ébredtem");

        String snapshot = assembler.renderWithoutBiometrics(owner, today);

        assertThat(snapshot)
            .doesNotContain("súlytrend")
            .doesNotContain("mérés:")
            .doesNotContain("alvás (");
        assertThat(snapshot).contains("[Cél]").contains("[Edzés]").contains("check-in");
    }

    /** mezo-x6oa: the chat variant carries the active circle, one line per person, newest mention first. */
    @Test
    void testRender_shouldRenderEmberekBlock_whenActivePersonsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var anna = personPopulator.createPerson(owner, "Anna");
        var zita = personPopulator.createPerson(owner, "Zita");
        personPopulator.createCandidate(owner, "Jelölt Jenő", "extractor");
        Instant now = Instant.now();
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(2)), "positive");
        mentionPopulator.createMention(owner, zita.getId(), now.minus(Duration.ofHours(1)), "positive");
        mentionPopulator.createMention(owner, zita.getId(), now.minus(Duration.ofDays(1)), "positive");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("[Emberek] (aktív kör, utolsó említés szerint, max 12)\n"
            + "Zita — Mentee · teszt · 2× e héten · még kevés hét az irányhoz\n"
            + "Anna — Mentee · teszt · 1× e héten · még kevés hét az irányhoz");
        // mezo-x6oa final-review (finding E): locks the privacy boundary the spec names — none of
        // PersonPopulator's other seeded free-text fields (notes, knownFacts, contactCadenceLabel,
        // aliases) may ever ride along in the chat snapshot, only the flat spec-format line.
        assertThat(snapshot).doesNotContain("Jelölt Jenő").doesNotContain("Teszt említés.")
            .doesNotContain("Teszt személy.").doesNotContain("Teszt fact")
            .doesNotContain("Havi 1:1").doesNotContain("Marcika");
        assertThat(snapshot.indexOf("[Emberek]")).isGreaterThan(snapshot.indexOf("[Napi gyakorlat]"))
            .isLessThan(snapshot.indexOf("[Mai üzemanyag]"));
    }

    /** The morning message must NOT know the circle — that would be the companion bringing people up unprompted. */
    @Test
    void testRenderWithoutBiometrics_shouldOmitEmberekBlock_evenWhenActivePersonsExist() {
        UUID owner = userPopulator.createUser().getId();
        var anna = personPopulator.createPerson(owner, "Anna");
        mentionPopulator.createMention(owner, anna.getId(), Instant.now(), "positive");

        String morning = assembler.renderWithoutBiometrics(owner, LocalDate.now());

        assertThat(morning).doesNotContain("[Emberek]").doesNotContain("Anna");
    }
}
