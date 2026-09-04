package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
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

    @Test
    void testRender_shouldRenderAllBlocksWithNincsAdat_whenUserHasNoData() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String block = assembler.render(owner, today);

        assertThat(block).startsWith("\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — " + today + "):");
        // all nine blocks present, in render() order
        int profil = block.indexOf("[Profil]");
        int cel = block.indexOf("[Cél]");
        int edzes = block.indexOf("[Edzés]");
        int novekedes = block.indexOf("[Növekedés]");
        int gyakorlat = block.indexOf("[Napi gyakorlat]");
        int emberek = block.indexOf("[Emberek]");
        int fuel = block.indexOf("[Mai üzemanyag]");
        int med = block.indexOf("[Gyógyszer]");
        int rege = block.indexOf("[Regeneráció]");
        assertThat(profil).isPositive();
        assertThat(cel).isGreaterThan(profil);
        assertThat(edzes).isGreaterThan(cel);
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

        assertThat(snapshot).contains("mérés: 96.4 kg (" + today + ")");
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

        assertThat(snapshot).contains("mérés: 95.8 kg (" + today + ")");
        assertThat(snapshot).doesNotContain("mérés: 96.4 kg");
    }

    @Test
    void testRender_shouldShowNoDataMeasurement_whenNoWeighIns() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("mérés: nincs adat");
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

        assertThat(block).contains("[Cél] Nyári cut (cut): 84.2 → 80 kg");
        assertThat(block).contains("3. hét");
        assertThat(block).contains("e heti recept: 2100 kcal, 180 g fehérje, alvás 7.5 h, pihenőnap: Szo, V");
        // The day anchor now comes from the sleep goal, not the retired goal wake/bed columns
        // (createGoalFull passed 06:30/22:30). With no sleep_goal row the config ghost renders.
        assertThat(block).contains("étkezés/nap: 4, ébredés: 06:00, lefekvés: 22:00");
        assertThat(block).doesNotContain("06:30").doesNotContain("22:30");
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
        assertThat(snapshot).contains("protokoll: v2 aktív, mai bevitel: 1");
        assertThat(snapshot).doesNotContain("[Mai üzemanyag] 0/"); // the meal's kcal landed
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

        assertThat(snapshot).contains("alvás (" + today.minusDays(1) + "): 7.2 h, minőség 4/5");
        assertThat(snapshot).contains(
            "check-in (" + today + " 08:00): energia 4/10, stressz 2/10, megjegyzés: \"fáradtan ébredtem\"");
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

        assertThat(assembler.render(owner, today)).isEqualTo(assembler.render(owner, today));
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
