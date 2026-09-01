package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.GamificationPopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.IntentionPopulator;
import io.mrkuhne.mezo.support.populator.LevelUpEventPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.ProtocolPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.SupplementIntakePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
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

    @Autowired private ContextSnapshotAssembler contextSnapshotAssembler;
    @Autowired private BiometricsTools biometricsTools;
    @Autowired private TrainTools trainTools;
    @Autowired private FuelTools fuelTools;
    @Autowired private GoalTools goalTools;
    @Autowired private MedicationTools medicationTools;
    @Autowired private GrowthTools growthTools;
    @Autowired private PracticeTools practiceTools;
    @Autowired private InsightsTools insightsTools;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private IntentionPopulator intentionPopulator;
    @Autowired private RitualPopulator ritualPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalPlanLinkPopulator goalPlanLinkPopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private ProtocolPopulator protocolPopulator;
    @Autowired private SupplementIntakePopulator supplementIntakePopulator;
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private SkillProgressPopulator skillProgressPopulator;
    @Autowired private LevelUpEventPopulator levelUpEventPopulator;
    @Autowired private GamificationPopulator gamificationPopulator;
    @Autowired private PatternPopulator patternPopulator;

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
    void testGetWeightLog_shouldRenderNincsAdat_whenNoWeighInsInWindow() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(40), new BigDecimal("88.0"));
        String out = biometricsTools.getWeightLog(7, ctx(owner));
        assertThat(out).isEqualTo("Napi súlymérések (utolsó 7 nap): nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testGetWeightLog_shouldListRawDailyRowsNewestFirst_andClampDays_whenHistoryExists() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(1), new BigDecimal("85.4"));
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(2), new BigDecimal("86.1"));
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(40), new BigDecimal("88.0"));

        String out = biometricsTools.getWeightLog(90, ctx(owner)); // clamps to max-window-days=30

        assertThat(out).startsWith("Napi súlymérések (utolsó 30 nap):")
                .contains(LocalDate.now().minusDays(1) + ": 85.4 kg")
                .contains(LocalDate.now().minusDays(2) + ": 86.1 kg")
                .doesNotContain("88 kg");
        // newest first — the day-1 line precedes the day-2 line
        assertThat(out.indexOf(LocalDate.now().minusDays(1).toString()))
                .isLessThan(out.indexOf(LocalDate.now().minusDays(2).toString()));
        assertThat(audit.toRefsEnvelope().refs()).extracting(r -> r.kind()).containsOnly("Weight");
    }

    @Test
    void testGetWeightLog_shouldRenderDayOverDayDelta_whenConsecutiveDaysExist() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(1), new BigDecimal("85.4"));
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(2), new BigDecimal("86.1"));

        String out = biometricsTools.getWeightLog(7, ctx(owner));

        // the newest row's delta against the row below it: 85.4 - 86.1 = -0.7
        assertThat(out).contains("-0.7 kg");
    }

    @Test
    void testGetRecovery_shouldListWindowedRowsNewestFirst_andClampDays_whenScopeSleep() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("7.5"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(40), new BigDecimal("6.0"), 2);
        String out = biometricsTools.getRecovery("sleep", 90, null, null, null, ctx(owner));
        // clamps to max-window-days=30
        assertThat(out).startsWith("Alvás (utolsó 30 nap):")
                .contains(LocalDate.now().minusDays(1) + ": 7.5 h, minőség 4/5")
                .doesNotContain(LocalDate.now().minusDays(40).toString());
        assertThat(audit.toRefsEnvelope().refs()).extracting(r -> r.kind()).containsExactly("Sleep");
    }

    @Test
    void testGetRecovery_shouldRenderNincsAdat_whenScopeAndDaysNullAndNoSleepLogs() {
        // null scope defaults to "sleep", null days defaults to 7 — both defaults exercised at once.
        String out = biometricsTools.getRecovery(
                null, null, null, null, null, ctx(userPopulator.createUser().getId()));
        assertThat(out).isEqualTo("Alvás (utolsó 7 nap): nincs adat");
    }

    @Test
    void testGetRecovery_shouldRenderTargetAnchorAndRegularityBand_whenScopeSleepGoal() {
        UUID owner = userPopulator.createUser().getId();
        // 450 min (7h30m) target, WAKE-anchored at 06:45 -> derived bed 23:15, ±15 min regularity band.
        sleepGoalPopulator.goal(owner);

        String out = biometricsTools.getRecovery("sleep-goal", null, null, null, null, ctx(owner));

        assertThat(out).isEqualTo(
                "Alvási cél: 7ó 30p alvás, ébredés 06:45, lefekvés 23:15; szabályosság ±15 perc");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("SleepGoal", "06:45"));
    }

    @Test
    void testGetRecovery_shouldRenderWellbeingReadingsAcrossWindow_whenScopeCheckins() {
        UUID owner = userPopulator.createUser().getId();
        // CheckInPopulator#createCheckIn hardcodes body=3, mental=3.
        checkInPopulator.createCheckIn(owner, LocalDate.now().minusDays(1), "08:00", 7, 3, null);
        checkInPopulator.createCheckIn(owner, LocalDate.now().minusDays(40), "08:00", 9, 1, null);

        String out = biometricsTools.getRecovery("checkins", null, null, null, null, ctx(owner));
        // default window: 7 days

        assertThat(out).startsWith("Bejelentkezések (utolsó 7 nap):")
                .contains(LocalDate.now().minusDays(1) + " 08:00: energia 7/10, stressz 3/10, testi 3/10, mentális 3/10")
                .doesNotContain(LocalDate.now().minusDays(40).toString());
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("CheckIn", LocalDate.now().minusDays(1).toString()));
    }

    @Test
    void testGetRecovery_shouldRenderNincsAdat_whenScopeCheckinsAndEmpty() {
        assertThat(biometricsTools.getRecovery(
                "checkins", null, null, null, null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Bejelentkezések (utolsó 7 nap): nincs adat");
    }

    @Test
    void testGetTrainingLog_shouldRenderInstanceLinesWithVolume_whenScopeGym() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), "Pull A", "pull", 0, "planned");
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
                owner, template, LocalDate.now().minusDays(2), "completed");
        ExerciseEntity ex = trainPopulator.createExercise(owner, instance.getId(), "Húzódzkodás", 0);
        trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 0, "80", 8, 2, Instant.now());
        trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 1, "80", 6, 1, Instant.now());

        String out = trainTools.getTrainingLog("gym", 7, ctx(owner));

        assertThat(out).startsWith("Gym-edzések (utolsó 7 nap):")
                .contains(LocalDate.now().minusDays(2) + ": Pull A (pull) — 2 sorozat, volumen 1120 kg");
        assertThat(audit.toRefsEnvelope().refs())
                .contains(new RefsEnvelope.Ref("Workout", LocalDate.now().minusDays(2).toString()));
    }

    /**
     * The just-in-time layer (mezo-d20.13): the context snapshot carries a CLIPPED copy of the
     * closing note on every turn, but this tool — the surface a "hogy ment kedden?" question lands
     * on — gets the whole sentence, unabridged.
     */
    @Test
    void testGetTrainingLog_shouldRenderTheWholeClosingNote_whenScopeGym() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), "Pull A", "pull", 0, "planned");
        String note = "Öt órát aludtam, mégis vitt a lendület. " + "A húzódzkodás az utolsó szettnél fogyott el. ".repeat(6);
        trainPopulator.createWorkoutInstance(owner, template, LocalDate.now().minusDays(1), "completed", note);
        trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "completed", "  ");

        String out = trainTools.getTrainingLog("gym", 7, ctx(owner));

        assertThat(out).contains("jegyzet: \"" + note.strip() + '"');
        // ADR 0010: a blank note renders no line at all — never a placeholder for silence.
        assertThat(out.lines().filter(l -> l.contains("jegyzet:")).count()).isEqualTo(1);
    }

    @Test
    void testGetTrainingLog_shouldRenderNincsAdat_whenScopeGymAndWindowEmpty() {
        assertThat(trainTools.getTrainingLog(null, null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Gym-edzések (utolsó 7 nap): nincs adat");
    }

    @Test
    void testGetTrainingLog_shouldRenderSportLines_whenScopeSport() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSession(owner, LocalDate.now().minusDays(1), "volleyball", 5, null, "6.5");

        String out = trainTools.getTrainingLog("sport", 7, ctx(owner));

        assertThat(out).startsWith("Sportalkalmak (utolsó 7 nap):")
                .contains(LocalDate.now().minusDays(1) + ": volleyball 60 perc, RPE 6.5, 5 szett");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Sport", LocalDate.now().minusDays(1).toString()));
    }

    @Test
    void testGetTrainingLog_shouldRenderNincsAdat_whenScopeSportAndWindowEmpty() {
        assertThat(trainTools.getTrainingLog("sport", 7, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Sportalkalmak (utolsó 7 nap): nincs adat");
    }

    @Test
    void testGetTrainingLog_shouldRenderRunLines_whenScopeRun() {
        UUID owner = userPopulator.createUser().getId();
        RunningBlockEntity block = runningPopulator.createBlock(owner, "Futás blokk", "active");
        runningPopulator.createRunLog(owner, block.getId(), 2, "int1",
                LocalDate.now().minusDays(3), 6, 7, null, null, 35);

        String out = trainTools.getTrainingLog("run", 7, ctx(owner));

        assertThat(out).startsWith("Futások (utolsó 7 nap):")
                .contains(LocalDate.now().minusDays(3) + ": 2. hét int1 — 6 kör, RPE 7, 35 perc");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Run", LocalDate.now().minusDays(3).toString()));
    }

    @Test
    void testGetTrainingLog_shouldRenderNincsAdat_whenScopeRunAndWindowEmpty() {
        assertThat(trainTools.getTrainingLog("run", 7, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Futások (utolsó 7 nap): nincs adat");
    }

    @Test
    void testGetTrainingPlan_shouldResolvePlannedGymDayWithExercise_whenScopeToday() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel, "Pull A", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Húzódzkodás", 0);

        String out = trainTools.getTrainingPlan("today", null, ctx(owner));

        // exact rendered exercise descriptor (name + working-sets × rep-range), not just a name
        // substring — pins ToolText.exerciseLine's null-guarded formatting (TrainPopulator default
        // exercise: workingSets=3, repMin=6, repMax=8).
        assertThat(out).startsWith("Edzésterv (ma, " + LocalDate.now() + "):")
                .contains(todayLabel).contains("Húzódzkodás 3×6-8");
        assertThat(audit.toRefsEnvelope().refs())
                .contains(new RefsEnvelope.Ref("TrainingPlan", LocalDate.now().toString()));
    }

    @Test
    void testGetTrainingPlan_shouldRenderActiveMesoStructure_whenScopeMeso() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), "Hét", "Pull A", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Húzódzkodás", 0);

        String out = trainTools.getTrainingPlan("meso", null, ctx(owner));

        // same exact-descriptor pin as scope=today (TrainPopulator default: workingSets=3, repMin=6, repMax=8).
        assertThat(out).startsWith("Mezociklus terv: Blokk").contains("3/6. hét")
                .contains("Hét").contains("Pull A").contains("Húzódzkodás 3×6-8");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("TrainingPlan", "Blokk"));
    }

    @Test
    void testGetTrainingPlan_shouldRenderNincsAdat_whenNoActivePlan() {
        UUID owner = userPopulator.createUser().getId();
        assertThat(trainTools.getTrainingPlan(null, null, ctx(owner)))
                .isEqualTo("Edzésterv (ma, " + LocalDate.now() + "): nincs adat");
    }

    @Test
    void testGetTrainingPlan_shouldRenderWeekWithPlannedDayAndRestDays_whenScopeWeek() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel, "Pull A", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Húzódzkodás", 0);

        String out = trainTools.getTrainingPlan("week", null, ctx(owner));

        // the window (today..+6) covers all 7 HU weekdays exactly once: today's line resolves the
        // planned gym day, the other 6 have no matching template — genuine rest days ("pihenőnap").
        assertThat(out).startsWith("Edzésterv (" + today + " – " + today.plusDays(6) + "):")
                .contains(today + ": gym (" + todayLabel + "): Húzódzkodás 3×6-8")
                .contains("pihenőnap");
        assertThat(audit.toRefsEnvelope().refs())
                .contains(new RefsEnvelope.Ref("TrainingPlan", today + ".." + today.plusDays(6)));
    }

    @Test
    void testGetTrainingPlan_shouldResolveTomorrowGymDay_whenScopeTomorrow() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        String tomorrowLabel = WorkoutService.HU_DAY_LABELS.get(tomorrow.getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), tomorrowLabel, "Push A", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);

        String out = trainTools.getTrainingPlan("tomorrow", null, ctx(owner));

        assertThat(out).startsWith("Edzésterv (holnap, " + tomorrow + "):")
                .contains(tomorrowLabel).contains("Fekvenyomás 3×6-8");
        assertThat(audit.toRefsEnvelope().refs())
                .contains(new RefsEnvelope.Ref("TrainingPlan", tomorrow.toString()));
    }

    @Test
    void testGetTrainingPlan_shouldResolveExplicitDateParam_whenScopeDate() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate future = LocalDate.now().plusDays(10);
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        String futureLabel = WorkoutService.HU_DAY_LABELS.get(future.getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), futureLabel, "Leg A", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Guggolás", 0);

        String out = trainTools.getTrainingPlan("date", future.toString(), ctx(owner));

        assertThat(out).startsWith("Edzésterv (" + future + "):")
                .contains(futureLabel).contains("Guggolás 3×6-8");
        assertThat(audit.toRefsEnvelope().refs())
                .contains(new RefsEnvelope.Ref("TrainingPlan", future.toString()));
    }

    @Test
    void testGetTrainingPlan_shouldAppendRunningTail_whenActiveRunningBlockHasSessionForResolvedDay() {
        UUID owner = userPopulator.createUser().getId();
        // sessionsPerWeek=7 covers every weekday, so today's weekday always has a prescribed
        // session regardless of the real calendar date — the ContextSnapshotAssemblerIT idiom
        // (testTrainBlock_shouldResolveTomorrowRunSession_whenActiveRunningBlockHasSessionForTomorrowWeekday).
        runningPopulator.createBlockWithSessions(owner, "Sprint blokk", "active", 4, 7);

        String out = trainTools.getTrainingPlan("today", null, ctx(owner));

        // no active meso → "pihenőnap (gym)", but the active running block's prescribed session
        // for today's weekday still appends the "; futás: …" tail.
        assertThat(out).contains("pihenőnap (gym); futás: Sprint-intervallum");
        assertThat(audit.toRefsEnvelope().refs())
                .contains(new RefsEnvelope.Ref("TrainingPlan", LocalDate.now().toString()));
    }

    @Test
    void testGetTrainingPlan_shouldAppendSportTail_whenSportSlotScheduledForResolvedDay() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        // slot day_of_week is 0=Hét..6=Vas, so today's weekday always matches — the sport slot is
        // the ONLY plan this user has (no meso, no running block): a sport evening must never
        // render as "nincs adat" (mezo-ajp).
        trainPopulator.createScheduleSlot(owner, today.getDayOfWeek().getValue() - 1, "18:00", 120, "training");

        String out = trainTools.getTrainingPlan("today", null, ctx(owner));

        assertThat(out).startsWith("Edzésterv (ma, " + today + "):")
                .contains("pihenőnap (gym); sport: volleyball 18:00 training (120 perc)")
                .doesNotContain("nincs adat");
        assertThat(audit.toRefsEnvelope().refs())
                .contains(new RefsEnvelope.Ref("TrainingPlan", today.toString()));
    }

    @Test
    void testGetTrainingPlan_shouldRenderGymAndSportTogether_whenBothScheduledForToday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel, "Full Body", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Guggolás", 0);
        trainPopulator.createScheduleSlot(owner, today.getDayOfWeek().getValue() - 1, "18:00", 120, "training");

        String out = trainTools.getTrainingPlan("today", null, ctx(owner));

        // the reported chat's exact shape: a Full Body gym day AND an 18:00 sport session — the
        // model must see both from one call, never only the gym half.
        assertThat(out).contains("gym (" + todayLabel + "): Guggolás 3×6-8")
                .contains("sport: volleyball 18:00 training (120 perc)");
    }

    @Test
    void testGetTrainingPlan_shouldRenderSportOnItsWeekday_whenScopeWeek() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LocalDate sportDay = today.plusDays(2);
        trainPopulator.createScheduleSlot(owner, sportDay.getDayOfWeek().getValue() - 1, "19:30", 90, "match");

        String out = trainTools.getTrainingPlan("week", null, ctx(owner));

        // the week walk resolves each of the 7 dates on its own weekday — the slot lands on
        // exactly its day, and the other days stay honest rest days.
        assertThat(out).startsWith("Edzésterv (" + today + " – " + today.plusDays(6) + "):")
                .contains(sportDay + ": pihenőnap (gym); sport: volleyball 19:30 match (90 perc)");
    }

    /**
     * mezo-4qu: the tool and the chat snapshot can both land in the SAME prompt, so a day may never
     * render differently in the two. The zero-exercise template day is the shape that used to make
     * them contradict each other outright ("gym: pihenőnap" vs "gym (Push)"); both now go through
     * {@code ToolText.gymLine}, and this test is what keeps a future edit from re-splitting them.
     */
    @Test
    void testDayRender_shouldMatchSnapshotExactly_whenTemplateDayHasNoExercises() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        // the meso wizard's live shape: every weekday is a template row, rest days carry zero
        // exercises (mezo-650a) — a "Rest" row for TODAY is the divergence trigger.
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel, "Rest", 0, "planned");

        String toolOut = trainTools.getTrainingPlan("today", null, ctx(owner));
        String snapshot = contextSnapshotAssembler.render(owner, today);
        String maSegment = snapshot.substring(snapshot.indexOf("Ma (terv):"), snapshot.indexOf("Ma eddig naplózva:"));

        // one gym rendering, one rest criterion: neither side may call this day a gym day
        assertThat(toolOut).contains("pihenőnap (gym)").doesNotContain("gym (");
        assertThat(maSegment).contains("pihenőnap (gym)").doesNotContain("gym (");
    }

    /** The gym-day counterpart of the rest-day pin above — same label, same shape, both renderers. */
    @Test
    void testDayRender_shouldMatchSnapshotExactly_whenTemplateDayHasExercises() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel, "Push", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);

        String toolOut = trainTools.getTrainingPlan("today", null, ctx(owner));
        String snapshot = contextSnapshotAssembler.render(owner, today);

        String gymFragment = "gym (" + todayLabel + "): Fekvenyomás 3×6-8";
        assertThat(toolOut).contains(gymFragment);
        assertThat(snapshot).contains(gymFragment);
    }

    @Test
    void testGetExerciseRecords_shouldRenderNincsAdat_whenNoLoggedSets() {
        assertThat(trainTools.getExerciseRecords(null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Egyéni csúcsok (PR): nincs adat");
    }

    @Test
    void testGetExerciseRecords_shouldRenderTopRecordsWithComputedE1rm_whenNoExerciseArg() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), "Push A", "push", 0, "planned");
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
                owner, template, LocalDate.now().minusDays(1), "completed");
        ExerciseEntity ex = trainPopulator.createExercise(owner, instance.getId(), "Fekvenyomás", 0);
        trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 0, "100", 5, 1, Instant.now());
        trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 1, "90", 8, 2, Instant.now());

        String out = trainTools.getExerciseRecords(null, ctx(owner));

        // Epley e1RM: 100×(30+5)/30 = 116.7, which beats 90×(30+8)/30 = 114.0 — pins the REAL
        // computed record (ExerciseRecordService aggregation), not just the exercise name.
        assertThat(out).startsWith("Egyéni csúcsok (PR), legjobb becsült 1RM szerint:")
                .contains("Fekvenyomás: e1RM 116.7 kg (legjobb szett: 100 kg × 5 (" + LocalDate.now() + "))");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("ExerciseRecord", "Fekvenyomás"));
    }

    @Test
    void testGetExerciseRecords_shouldRenderDetailWithE1rmAndBestSet_whenExerciseNameGivenCaseInsensitive() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), "Push A", "push", 0, "planned");
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
                owner, template, LocalDate.now().minusDays(1), "completed");
        ExerciseEntity ex = trainPopulator.createExercise(owner, instance.getId(), "Fekvenyomás", 0);
        trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 0, "100", 5, 1, Instant.now());

        String out = trainTools.getExerciseRecords("FEKVENYOMÁS", ctx(owner)); // case-insensitive contains

        assertThat(out).startsWith("Fekvenyomás — PR:")
                .contains("legjobb szett: 100 kg × 5 (" + LocalDate.now() + ")")
                .contains("e1RM: 116.7 kg (100 kg × 5 (" + LocalDate.now() + "))");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("ExerciseRecord", "Fekvenyomás"));
    }

    @Test
    void testGetExerciseRecords_shouldRenderNincsAdat_whenNameGivenButNoMatch() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        WorkoutSessionEntity template =
                trainPopulator.createWorkoutSession(owner, meso.getId(), "Push A", "push", 0, "planned");
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
                owner, template, LocalDate.now().minusDays(1), "completed");
        ExerciseEntity ex = trainPopulator.createExercise(owner, instance.getId(), "Fekvenyomás", 0);
        trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 0, "100", 5, 1, Instant.now());

        assertThat(trainTools.getExerciseRecords("Guggolás", ctx(owner)))
                .isEqualTo("Egyéni csúcsok (PR) — \"Guggolás\": nincs adat");
    }

    @Test
    void testGetFuelLog_shouldRenderDayRollupsWithTitlesAndWater_whenRangeDay() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Csirkemell", LocalDate.now().plusDays(5));
        mealPopulator.createPantryMeal(owner, item, LocalDate.now().minusDays(1));
        waterLogPopulator.createWaterLog(owner, LocalDate.now(), 1800);

        String out = fuelTools.getFuelLog(null, null, 3, ctx(owner));

        assertThat(out).startsWith("Napi étkezés-összesítők (utolsó 3 nap):")
                .contains(LocalDate.now().minusDays(1) + ": ")
                .contains("kcal").contains("1 étkezés (Reggeli)")
                .contains(LocalDate.now() + ": ").contains("0 étkezés")
                .contains("Víz (" + LocalDate.now() + "): 1800/4000 ml");
        assertThat(audit.toRefsEnvelope().refs()).containsExactly(
                new RefsEnvelope.Ref("FuelDay", LocalDate.now().minusDays(1).toString()));
    }

    @Test
    void testGetFuelLog_shouldAnchorDayWindowOnDateParam_whenDateGiven() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate anchor = LocalDate.now().minusDays(5); // the "date" param, NOT LocalDate.now()
        LocalDate afterAnchor = anchor.plusDays(2); // still in the past, but past the anchored window's end
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Csirkemell", LocalDate.now().plusDays(30));
        mealPopulator.createPantryMeal(owner, item, anchor);
        mealPopulator.createPantryMeal(owner, item, afterAnchor);
        waterLogPopulator.createWaterLog(owner, anchor, 1500);
        waterLogPopulator.createWaterLog(owner, afterAnchor, 2500);

        String out = fuelTools.getFuelLog("day", anchor.toString(), 3, ctx(owner));

        // window is [anchor-2, anchor] (days=3) — anchor's meal/water are rendered, afterAnchor's
        // are excluded entirely, proving `date` (not "today") anchors the window end.
        assertThat(out).startsWith("Napi étkezés-összesítők (utolsó 3 nap):")
                .contains(anchor + ": 165/3100 kcal, F 35/220 g; 1 étkezés (Reggeli)")
                .contains("Víz (" + anchor + "): 1500/4000 ml")
                .doesNotContain(afterAnchor.toString());
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("FuelDay", anchor.toString()));
    }

    @Test
    void testGetFuelLog_shouldDefaultRangeToDay_whenRangeUnrecognized() {
        UUID owner = userPopulator.createUser().getId();
        assertThat(fuelTools.getFuelLog("bogus", null, 1, ctx(owner)))
                .startsWith("Napi étkezés-összesítők (utolsó 1 nap):");
    }

    @Test
    void testGetFuelLog_shouldRenderWeekRollupsWithWater_whenRangeWeek() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Zabkása", LocalDate.now().plusDays(10));
        LocalDate wednesday = LocalDate.of(2026, 7, 8); // Monday-anchored week: 2026-07-06 .. 2026-07-12
        mealPopulator.createPantryMeal(owner, item, wednesday);
        waterLogPopulator.createWaterLog(owner, wednesday, 2200);

        String out = fuelTools.getFuelLog("week", wednesday.toString(), null, ctx(owner));

        // 150g logged / 100g snapshot basis => 1.5x the pantry item's per-100g macros (110 kcal / 23 g protein).
        assertThat(out).startsWith("Heti étkezés-összesítő (2026-07-06 – 2026-07-12):")
                .contains("2026-07-08: 165/3100 kcal, F 35/220 g, víz 2200/4000 ml")
                .contains("2026-07-06: 0/3100 kcal, F 0/220 g, víz 0/4000 ml")
                .contains("2026-07-12: 0/3100 kcal, F 0/220 g, víz 0/4000 ml");
        assertThat(audit.toRefsEnvelope().refs()).containsExactly(
                new RefsEnvelope.Ref("FuelDay", "2026-07-06"),
                new RefsEnvelope.Ref("FuelDay", "2026-07-07"),
                new RefsEnvelope.Ref("FuelDay", "2026-07-08"),
                new RefsEnvelope.Ref("FuelDay", "2026-07-09"),
                new RefsEnvelope.Ref("FuelDay", "2026-07-10"));
    }

    @Test
    void testGetProtocol_shouldRenderPerDayCoverage_whenScopeAdherenceAndProtocolActive() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity a = pantryItemPopulator.createSupplement(owner, "Kreatin");
        PantryItemEntity b = pantryItemPopulator.createSupplement(owner, "D3-vitamin");
        protocolPopulator.createProtocol(owner, 3, "active", List.of(a.getId(), b.getId()));
        supplementIntakePopulator.createIntake(owner, a.getId(), Instant.now());

        String out = fuelTools.getProtocol("adherence", 1, ctx(owner));

        assertThat(out).startsWith("Protokoll-követés (utolsó 1 nap): aktív protokoll v3, 2 elem")
                .contains(LocalDate.now() + ": 1/2")
                .contains("Összesen: 1/2 (50%)");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Protocol", "v3"));
    }

    @Test
    void testGetProtocol_shouldDefaultScopeToAdherence_whenScopeNullOrUnrecognized() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity a = pantryItemPopulator.createSupplement(owner, "Kreatin");
        protocolPopulator.createProtocol(owner, 1, "active", List.of(a.getId()));

        assertThat(fuelTools.getProtocol(null, 1, ctx(owner)))
                .startsWith("Protokoll-követés (utolsó 1 nap): aktív protokoll v1, 1 elem");
        assertThat(fuelTools.getProtocol("bogus", 1, ctx(owner)))
                .startsWith("Protokoll-követés (utolsó 1 nap): aktív protokoll v1, 1 elem");
    }

    @Test
    void testGetProtocol_shouldRenderNincsAktivProtokoll_whenScopeAdherenceAndNoneActive() {
        assertThat(fuelTools.getProtocol("adherence", 7, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Protokoll-követés: nincs aktív protokoll");
    }

    @Test
    void testGetProtocol_shouldRenderTodaysIntakesByName_whenScopeIntake() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity a = pantryItemPopulator.createSupplement(owner, "Kreatin");
        supplementIntakePopulator.createIntake(owner, a.getId(), Instant.now());

        String out = fuelTools.getProtocol("intake", null, ctx(owner));

        // SupplementIntakePopulator#createIntake sets no dose, so only the resolved item name renders.
        assertThat(out).isEqualTo("Mai bevétel (" + LocalDate.now() + "): 1 tétel\nKreatin");
        assertThat(audit.toRefsEnvelope()).isNull(); // no active protocol => no Protocol ref
    }

    @Test
    void testGetProtocol_shouldAddProtocolRef_whenScopeIntakeAndActiveProtocolExists() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity a = pantryItemPopulator.createSupplement(owner, "Kreatin");
        protocolPopulator.createProtocol(owner, 2, "active", List.of(a.getId()));
        supplementIntakePopulator.createIntake(owner, a.getId(), Instant.now());

        fuelTools.getProtocol("intake", null, ctx(owner));

        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Protocol", "v2"));
    }

    @Test
    void testGetProtocol_shouldRenderNincsAdat_whenScopeIntakeAndNoIntakesToday() {
        assertThat(fuelTools.getProtocol("intake", null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Mai bevétel (" + LocalDate.now() + "): nincs adat");
    }

    @Test
    void testGetProtocol_shouldRenderActiveProtocolItemNames_whenScopeSupplements() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity a = pantryItemPopulator.createSupplement(owner, "Kreatin");
        PantryItemEntity b = pantryItemPopulator.createSupplement(owner, "D3-vitamin");
        protocolPopulator.createProtocol(owner, 4, "active", List.of(a.getId(), b.getId()));

        String out = fuelTools.getProtocol("supplements", null, ctx(owner));

        assertThat(out).isEqualTo("Protokoll szupplementjei (v4): 2 elem\nKreatin\nD3-vitamin");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Protocol", "v4"));
    }

    @Test
    void testGetProtocol_shouldRenderNincsAktivProtokoll_whenScopeSupplementsAndNoneActive() {
        assertThat(fuelTools.getProtocol("supplements", null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Protokoll szupplementjei: nincs aktív protokoll");
    }

    @Test
    void testGetGoal_shouldComposeGoalTrendAndSegment_whenScopeProgressAndActiveGoalExists() {
        UUID owner = userPopulator.createUser().getId();
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
                List.of(new GoalPrescriptionJson.Segment(1, 6, "vágás", 2100, 160,
                        new BigDecimal("7.5"), List.of(5, 6), null, null, null)),
                null, null);
        // started 2 weeks + 1 day ago → day 15 → week 3
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(2).minusDays(1),
                LocalDate.now().plusWeeks(10), prescription, 4, "06:30", "22:30");
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(8), new BigDecimal("87.1"));
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(1), new BigDecimal("86.4"));

        String out = goalTools.getGoal("progress", ctx(owner));

        assertThat(out).startsWith("Cél: Nyári cut (cut), 3. hét; 84.2 → 80 kg")
                .contains("trendsúly most ").contains("eddig ")
                .contains("e heti recept: 2100 kcal, 160 g fehérje");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Goal", "Nyári cut"));
    }

    @Test
    void testGetGoal_shouldDefaultScopeToProgress_whenScopeNullAndNoActiveGoal() {
        assertThat(goalTools.getGoal(null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Cél: nincs aktív cél");
    }

    @Test
    void testGetGoal_shouldRenderNincsAktivCel_whenNoneAndScopeProgress() {
        assertThat(goalTools.getGoal("progress", ctx(userPopulator.createUser().getId())))
                .isEqualTo("Cél: nincs aktív cél");
    }

    @Test
    void testGetGoal_shouldRenderSegmentedRecept_whenScopeReceptAndPrescriptionExists() {
        UUID owner = userPopulator.createUser().getId();
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
                List.of(new GoalPrescriptionJson.Segment(1, 6, "vágás", 2100, 160,
                        new BigDecimal("7.5"), List.of(5, 6), new BigDecimal("-0.5"), -500,
                        "kalóriahiány a cut elején")),
                null, null);
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(1), LocalDate.now().plusWeeks(10),
                prescription, 4, "06:30", "22:30");

        String out = goalTools.getGoal("recept", ctx(owner));

        assertThat(out).startsWith("Cél receptje: Nyári cut (formula)")
                .contains("1-6. hét: 2100 kcal, 160 g fehérje")
                .contains("alvás 7.5 h").contains("pihenőnapok: 5, 6")
                .contains("ütem -0.5 kg/hét").contains("kalóriahiány a cut elején");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Goal", "Nyári cut"));
    }

    @Test
    void testGetGoal_shouldRenderMegNincsKiertekelve_whenScopeReceptAndPrescriptionNull() {
        UUID owner = userPopulator.createUser().getId();
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(1), LocalDate.now().plusWeeks(10),
                null, null, null, null);

        assertThat(goalTools.getGoal("recept", ctx(owner)))
                .isEqualTo("Cél receptje: Nyári cut: még nincs kiértékelve");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Goal", "Nyári cut"));
    }

    @Test
    void testGetGoal_shouldSkipBasisLine_whenScopeReceptAndBasisNull() {
        UUID owner = userPopulator.createUser().getId();
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, null,
                List.of(new GoalPrescriptionJson.Segment(1, 6, "vágás", 2100, 160,
                        new BigDecimal("7.5"), List.of(5, 6), null, null, null)),
                null, null);
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(1), LocalDate.now().plusWeeks(10),
                prescription, null, null, null);

        String out = goalTools.getGoal("recept", ctx(owner));

        // basis()==null -> no "(...)" after the title; the segment line still renders in full.
        assertThat(out).isEqualTo(
                "Cél receptje: Nyári cut\n1-6. hét: 2100 kcal, 160 g fehérje, alvás 7.5 h, pihenőnapok: 5, 6")
                .doesNotContain("(");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Goal", "Nyári cut"));
    }

    @Test
    void testGetGoal_shouldRenderStrengthAndMuscleGuardStatus_whenScopeGuardsAndActive() {
        UUID owner = userPopulator.createUser().getId();
        GoalPrescriptionJson.GuardStatus guardStatus = new GoalPrescriptionJson.GuardStatus(
                new GoalPrescriptionJson.GuardStatus.Strength(true, new BigDecimal("-3.2"), true,
                        List.of("e1RM esik 2 hete")),
                new GoalPrescriptionJson.GuardStatus.Muscle(true, 10, List.of("láb"), true, true,
                        List.of("fehérje rendben")));
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula", List.of(), guardStatus, null);
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(1), LocalDate.now().plusWeeks(10),
                prescription, null, null, null);

        String out = goalTools.getGoal("guards", ctx(owner));

        assertThat(out).startsWith("Cél korlátai: Nyári cut")
                .contains("Erő: e1RM trend -3.2%, megsértve: igen").contains("e1RM esik 2 hete")
                .contains("Izom: heti minimum 10 szett/izomcsoport, elmaradó: láb").contains("fehérje rendben");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Goal", "Nyári cut"));
    }

    @Test
    void testGetGoal_shouldRenderMegNincsKiertekelve_whenScopeGuardsAndPrescriptionNull() {
        UUID owner = userPopulator.createUser().getId();
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(1), LocalDate.now().plusWeeks(10),
                null, null, null, null);

        assertThat(goalTools.getGoal("guards", ctx(owner)))
                .isEqualTo("Cél korlátai: Nyári cut: még nincs kiértékelve");
    }

    @Test
    void testGetGoal_shouldRenderNincsAktivKorlat_whenScopeGuardsAndNeitherGuardActive() {
        UUID owner = userPopulator.createUser().getId();
        GoalPrescriptionJson.GuardStatus guardStatus = new GoalPrescriptionJson.GuardStatus(
                new GoalPrescriptionJson.GuardStatus.Strength(false, null, null, null),
                new GoalPrescriptionJson.GuardStatus.Muscle(false, null, null, null, null, null));
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula", List.of(), guardStatus, null);
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(1), LocalDate.now().plusWeeks(10),
                prescription, null, null, null);

        // non-null GuardStatus but both strength.active and muscle.active are false -> the "any"
        // branch never flips true, so neither guard line renders — just the honest fallback.
        assertThat(goalTools.getGoal("guards", ctx(owner)))
                .isEqualTo("Cél korlátai: Nyári cut: nincs aktív korlát");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Goal", "Nyári cut"));
    }

    @Test
    void testGetGoal_shouldRenderFeasibilityVerdictAndNotes_whenScopeFeasibility() {
        UUID owner = userPopulator.createUser().getId();
        GoalPrescriptionJson.Feasibility feasibility = new GoalPrescriptionJson.Feasibility(
                "feasible-with-warnings", List.of("az ütem a felső határon van"));
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula", List.of(), null, feasibility);
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(1), LocalDate.now().plusWeeks(10),
                prescription, null, null, null);

        String out = goalTools.getGoal("feasibility", ctx(owner));

        assertThat(out).isEqualTo(
                "Cél reálissága: Nyári cut: feasible-with-warnings\naz ütem a felső határon van");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Goal", "Nyári cut"));
    }

    @Test
    void testGetGoal_shouldRenderMegNincsKiertekelve_whenScopeFeasibilityAndPrescriptionNull() {
        UUID owner = userPopulator.createUser().getId();
        goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(1), LocalDate.now().plusWeeks(10),
                null, null, null, null);

        assertThat(goalTools.getGoal("feasibility", ctx(owner)))
                .isEqualTo("Cél reálissága: Nyári cut: még nincs kiértékelve");
    }

    @Test
    void testGetGoal_shouldRenderLinksAndTailGap_whenScopeTimeline() {
        UUID owner = userPopulator.createUser().getId();
        GoalEntity goal = goalPopulator.createGoal(owner, "cut", "active"); // 8-week window
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
        goalPlanLinkPopulator.createLink(owner, goal.getId(), "mesocycle", meso.getId(), 1, 6);

        String out = goalTools.getGoal("timeline", ctx(owner));

        assertThat(out).startsWith("Cél idővonala: Nyári cut (8 hét)")
                .contains("1-6. hét: mesocycle — Blokk")
                .contains("Lefedetlen hetek: 7-8. hét");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Goal", "Nyári cut"));
    }

    @Test
    void testGetMedication_shouldRenderCyclePhaseAndDoses_whenScopeCycleAndDoseAnchored() {
        UUID owner = userPopulator.createUser().getId();
        MedicationEntity med = medicationPopulator.createMedication(owner);
        medicationDosePopulator.createDose(owner, med.getId(), LocalDate.now().minusDays(3), new BigDecimal("4"));

        String out = medicationTools.getMedication("cycle", ctx(owner));

        assertThat(out).startsWith("Gyógyszer-ciklus: Teszt gyógyszer — 4. nap (Stabil)")
                .contains("utolsó dózis: " + LocalDate.now().minusDays(3) + " (4 mg)")
                .contains("következő esedékes: " + LocalDate.now().minusDays(3).plusDays(7));
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Medication", "Teszt gyógyszer"));
    }

    @Test
    void testGetMedication_shouldRenderHonestZero_whenScopeCycleAndNoDose() {
        UUID owner = userPopulator.createUser().getId();
        medicationPopulator.createMedication(owner);
        assertThat(medicationTools.getMedication("cycle", ctx(owner)))
                .isEqualTo("Gyógyszer-ciklus: Teszt gyógyszer — nincs rögzített dózis");
    }

    @Test
    void testGetMedication_shouldDefaultToCycle_whenScopeOmitted() {
        UUID owner = userPopulator.createUser().getId();
        medicationPopulator.createMedication(owner);
        assertThat(medicationTools.getMedication(null, ctx(owner)))
                .isEqualTo("Gyógyszer-ciklus: Teszt gyógyszer — nincs rögzített dózis");
    }

    @Test
    void testGetMedication_shouldRenderGeneralOverview_whenScopeAll() {
        UUID owner = userPopulator.createUser().getId();
        MedicationEntity med = medicationPopulator.createMedication(owner);
        medicationDosePopulator.createDose(owner, med.getId(), LocalDate.now().minusDays(3), new BigDecimal("4"));

        String out = medicationTools.getMedication("all", ctx(owner));

        assertThat(out).startsWith("Gyógyszer: Teszt gyógyszer (teszthatoanyag) — weekly, 6 mg")
                .contains("ciklus: 4. nap (Stabil)")
                .contains("Utolsó dózisok: " + LocalDate.now().minusDays(3) + ": 4 mg");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Medication", "Teszt gyógyszer"));
    }

    @Test
    void testGetMedication_shouldRenderRegimenWithoutCycleLine_whenScopeAllAndNoDose() {
        UUID owner = userPopulator.createUser().getId();
        medicationPopulator.createMedication(owner);

        String out = medicationTools.getMedication("all", ctx(owner));

        assertThat(out).isEqualTo("Gyógyszer: Teszt gyógyszer (teszthatoanyag) — weekly, 6 mg");
    }

    @Test
    void testGetMedication_shouldRenderNoData_whenScopeAllAndNoActiveMedication() {
        UUID owner = userPopulator.createUser().getId();
        assertThat(medicationTools.getMedication("all", ctx(owner)))
                .isEqualTo("Gyógyszer: nincs adat");
    }

    @Test
    void testGetRecipes_shouldListNameMacrosAndFitScore_whenNoFilter() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Túró alap", LocalDate.now().plusDays(30));
        recipePopulator.createRecipe(owner, item.getId());

        String out = fuelTools.getRecipes(null, ctx(owner));

        // "Túrós tál" (breakfast, 2 lines: Méz 20g + Túró 250g @ snapshot kcal110/p13/c4/f4.5 per 100g)
        // rolls up to a PINNED whole-recipe macro total (297 kcal, 36 g protein) — real computed
        // content, not just the recipe-name substring.
        assertThat(out).startsWith("Receptek:")
                .contains("Túrós tál (breakfast): 297 kcal, 36 g fehérje")
                .contains("illeszkedés");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Recipe", "Túrós tál"));
    }

    @Test
    void testGetRecipes_shouldRenderDetailWithIngredients_whenFilterMatchesSingleRecipeByTag() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Túró alap", LocalDate.now().plusDays(30));
        recipePopulator.createRecipe(owner, item.getId()); // tags: [magas-fehérje, gyors]

        String out = fuelTools.getRecipes("gyors", ctx(owner)); // tag substring, case-insensitive

        assertThat(out).startsWith("Túrós tál (breakfast): 297 kcal, 36 g fehérje, 11 g szénhidrát, 12 g zsír")
                .contains("Összetevők: ").contains("Túró 250g").contains("Méz 20g");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Recipe", "Túrós tál"));
    }

    @Test
    void testGetRecipes_shouldRenderNincsAdat_whenNoRecipes() {
        assertThat(fuelTools.getRecipes(null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Receptek: nincs adat");
    }

    @Test
    void testGetRecipes_shouldMatchRecipeName_whenFilterIsTheName() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Túró alap", LocalDate.now().plusDays(30));
        recipePopulator.createRecipe(owner, item.getId()); // "Túrós tál"

        // The name was deliberately excluded from the filter before mezo-sxe, so asking for a
        // recipe BY NAME — the most natural way to ask — always returned "nincs adat".
        assertThat(fuelTools.getRecipes("túrós tál", ctx(owner)))
                .startsWith("Túrós tál (breakfast):").contains("Összetevők: ");
    }

    @Test
    void testGetRecipes_shouldMatchTokensInAnyOrderAndWithoutAccents_whenFilterIsMultiWord() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Túró alap", LocalDate.now().plusDays(30));
        recipePopulator.createRecipe(owner, item.getId()); // "Túrós tál"
        recipePopulator.createRecipe(owner, item.getId(), "Collagen Smoothie", "snack",
                List.of("turmix"), false);

        // The reported chat's exact miss: a two-word needle was matched as ONE substring, so
        // "smoothie collagen" could never find "Collagen Smoothie". Tokens now match in any order,
        // and accent-folding means the Hungarian name is findable without diacritics.
        assertThat(fuelTools.getRecipes("smoothie collagen", ctx(owner)))
                .startsWith("Collagen Smoothie (snack):");
        assertThat(fuelTools.getRecipes("turos tal", ctx(owner)))
                .startsWith("Túrós tál (breakfast):");
    }

    @Test
    void testGetRecipes_shouldMatchIngredientName_whenFilterNamesAnIngredient() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Túró alap", LocalDate.now().plusDays(30));
        recipePopulator.createRecipe(owner, item.getId()); // ingredients: Méz, Túró
        recipePopulator.createRecipe(owner, item.getId(), "Collagen Smoothie", "snack",
                List.of("turmix"), false); // ingredients: Banán, Zabpehely

        // "mit főzzek mézzel" — the ingredient names ride in the same RecipeResponse the tool
        // already holds, so they are matchable without a single extra read.
        assertThat(fuelTools.getRecipes("méz", ctx(owner)))
                .startsWith("Túrós tál (breakfast):");
    }

    @Test
    void testGetRecipes_shouldNotMatchEveryStarredRecipe_whenFilterIsAShortToken() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Túró alap", LocalDate.now().plusDays(30));
        recipePopulator.createRecipe(owner, item.getId(), "Collagen Smoothie", "snack",
                List.of("turmix"), true); // starred

        // Regression: the starred branch used to match BIDIRECTIONALLY (needle.contains(keyword)
        // || keyword.contains(needle)), so any short needle that is a substring of
        // "csillagos"/"kedvenc"/"starred" returned every starred recipe.
        assertThat(fuelTools.getRecipes("cs", ctx(owner)))
                .isEqualTo("Receptek — \"cs\": nincs adat");
        // the intended keyword still works — a whole token, not a fragment
        assertThat(fuelTools.getRecipes("kedvenc", ctx(owner)))
                .startsWith("Collagen Smoothie (snack):");
    }

    @Test
    void testGetRecipes_shouldRenderNincsAdat_whenFilterMatchesNothing() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Túró alap", LocalDate.now().plusDays(30));
        recipePopulator.createRecipe(owner, item.getId());

        assertThat(fuelTools.getRecipes("pizza", ctx(owner)))
                .isEqualTo("Receptek — \"pizza\": nincs adat");
    }

    @Test
    void testGetRecipes_shouldNameRunnerUps_whenFilterMatchesMultipleRecipesWithAClearBestScorer() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Recept alap", LocalDate.now().plusDays(30));
        // "leves" hits: A by NAME (weight 4) — the clear winner; B and C by TAG (weight 2) —
        // before mezo-280 these two were invisible once A outscored them by even 1 point, which
        // the name>ingredient/category/tag weighting makes the COMMON case, not the rare one.
        recipePopulator.createRecipe(owner, item.getId(), "Csirkés leves", "lunch", List.of("gyors"), false);
        recipePopulator.createRecipe(owner, item.getId(), "Zöldség tál", "dinner", List.of("leves"), false);
        recipePopulator.createRecipe(owner, item.getId(), "Saláta mix", "snack", List.of("leves"), false);

        String out = fuelTools.getRecipes("leves", ctx(owner));

        // the best scorer still earns the full detail render (unqualified — no partial marker,
        // this filter matches every token against A) ...
        assertThat(out).startsWith("Csirkés leves (lunch):").contains("Összetevők: ")
                // ... but the runner-ups are NAMED in a compact tail, not silently dropped.
                .contains("\nTovábbi találatok: Saláta mix, Zöldség tál");
        assertThat(audit.toRefsEnvelope().refs()).containsExactly(
                new RefsEnvelope.Ref("Recipe", "Csirkés leves"),
                new RefsEnvelope.Ref("Recipe", "Saláta mix"),
                new RefsEnvelope.Ref("Recipe", "Zöldség tál"));
    }

    @Test
    void testGetRecipes_shouldRenderPartialMatchMarkerOnDetail_whenOnlySomeTokensMatchAnyRecipe() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Recept alap", LocalDate.now().plusDays(30));
        recipePopulator.createRecipe(owner, item.getId(), "Csirkés saláta", "lunch", List.of("gyors"), false);

        // "csirkés pizza" — only the "csirkés" token hits (the name); "pizza" hits nothing at all.
        // No recipe matches EVERY token, so the partial fallback stands in; before mezo-280 this
        // rendered the full "Csirkés saláta" detail with NO marker, so the model could present it
        // as the pizza recipe the user actually asked for.
        String out = fuelTools.getRecipes("csirkés pizza", ctx(owner));

        assertThat(out).startsWith("Receptek — \"csirkés pizza\" (részleges egyezés):\nCsirkés saláta (lunch):")
                .contains("Összetevők: ");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Recipe", "Csirkés saláta"));
    }

    @Test
    void testGetRecipes_shouldRenderPartialMatchMarkerOnList_whenTiedPartialWinners() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Recept alap", LocalDate.now().plusDays(30));
        // Both recipes hit exactly ONE of the two tokens by NAME (tied score 4); neither hits
        // BOTH, so the partial fallback applies to a TIE this time — the list-render path of the
        // partial branch (Finding 2 explicitly requires both render paths to carry the marker).
        recipePopulator.createRecipe(owner, item.getId(), "Csirkés saláta", "lunch", List.of("gyors"), false);
        recipePopulator.createRecipe(owner, item.getId(), "Pizza wok", "dinner", List.of("gyors"), false);

        String out = fuelTools.getRecipes("csirkés pizza", ctx(owner));

        assertThat(out).startsWith("Receptek — \"csirkés pizza\" (részleges egyezés):\nCsirkés saláta (lunch):")
                .contains("Pizza wok (dinner):")
                .doesNotContain("nincs adat");
        assertThat(audit.toRefsEnvelope().refs()).containsExactly(
                new RefsEnvelope.Ref("Recipe", "Csirkés saláta"), new RefsEnvelope.Ref("Recipe", "Pizza wok"));
    }

    @Test
    void testGetPantry_shouldListFoodItemWithStockAndExpiry_whenKindFood() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate expires = LocalDate.now().plusDays(5);
        pantryItemPopulator.createFood(owner, "Csirkemell", expires);

        String out = fuelTools.getPantry("food", ctx(owner));

        // real stock content (PantryItemPopulator#createFood: stockQty=400, stockUnit=g), not just the name.
        assertThat(out).isEqualTo("Kamra:\nCsirkemell: 400 g, lejár " + expires);
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Pantry", "Csirkemell"));
    }

    @Test
    void testGetPantry_shouldListItemsAcrossKinds_whenNoKindGiven() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate expires = LocalDate.now().plusDays(5);
        pantryItemPopulator.createFood(owner, "Csirkemell", expires);
        pantryItemPopulator.createSupplement(owner, "Kreatin");

        String out = fuelTools.getPantry(null, ctx(owner));

        // PantryItemPopulator#createSupplement: stockQty=86, stockUnit=adag.
        assertThat(out).startsWith("Kamra:")
                .contains("Csirkemell: 400 g, lejár " + expires)
                .contains("Kreatin: 86 adag");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Pantry", "Csirkemell"), new RefsEnvelope.Ref("Pantry", "Kreatin"));
    }

    @Test
    void testGetPantry_shouldFilterStashByNonFoodKind_whenKindStim() {
        UUID owner = userPopulator.createUser().getId();
        pantryItemPopulator.createSupplement(owner, "Kreatin");
        pantryItemPopulator.createStim(owner, "Koffein");

        String out = fuelTools.getPantry("stim", ctx(owner));

        // stashTypeForKind("stim") -> "stimulant": only the stim row passes the shared-stash type
        // filter — the supplement row (same pantry.getStash() list) must be excluded, not just
        // "some item is present" but the REAL matching row's rendered stock, with the other type's
        // name absent.
        assertThat(out).isEqualTo("Kamra:\nKoffein: 86 adag").doesNotContain("Kreatin");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Pantry", "Koffein"));
    }

    @Test
    void testGetPantry_shouldRenderNincsAdat_whenEmpty() {
        assertThat(fuelTools.getPantry(null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Kamra: nincs adat");
    }

    @Test
    void testGetGrowth_shouldRenderAccountLevelAndSeededSkillLines_whenScopeSkills() {
        UUID owner = userPopulator.createUser().getId();
        skillProgressPopulator.createSkill(owner, "max_strength", "ATHLETIC", 1200, 3);
        skillProgressPopulator.createSkill(owner, "cooking", "LIFE", 300, 2);

        String out = growthTools.getGrowth("skills", ctx(owner));

        // totalXp=1500 walks the account curve (80,120,160,200,240,280,320,...) to level 8 —
        // the REAL GamificationService computation, not a placeholder.
        assertThat(out).startsWith("Fejlődés: 8. szint, 1500 XP")
                .contains("Athletic: max_strength: Lv 3 (1200 XP)")
                .contains("Life: cooking: Lv 2 (300 XP)")
                .doesNotContain("Izom:"); // no muscle skill seeded -> no ghost line
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Growth", "skills"));
    }

    @Test
    void testGetGrowth_shouldRenderNincsAdat_whenScopeSkillsAndNoProgressionRows() {
        assertThat(growthTools.getGrowth("skills", ctx(userPopulator.createUser().getId())))
                .isEqualTo("Fejlődés: nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testGetGrowth_shouldDefaultScopeToSkills_whenScopeNull() {
        assertThat(growthTools.getGrowth(null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Fejlődés: nincs adat");
    }

    @Test
    void testGetGrowth_shouldRenderWeeklyRollupWithLifeXp_whenScopeWeek() {
        UUID owner = userPopulator.createUser().getId();
        LevelUpResult payload = new LevelUpResult("HABIT", "Meditáció", null, null, 150,
                List.of(new LevelUpResult.Gain("cooking", "LIFE", "cooking", null, 150, 1, 2, 0, 50)),
                List.of(), List.of(), new LevelUpResult.Robustness(0, 0));
        levelUpEventPopulator.createEvent(owner, "HABIT", UUID.randomUUID(), payload);
        LocalDate weekStart = LocalDate.now().with(DayOfWeek.MONDAY);

        String out = growthTools.getGrowth("week", ctx(owner));

        assertThat(out).startsWith("Heti növekedés (" + weekStart + "):")
                .contains("LIFE XP: 150");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Growth", "week-" + weekStart));
    }

    @Test
    void testGetGrowth_shouldRenderBadgesWithRealProgress_whenScopeAchievements() {
        UUID owner = userPopulator.createUser().getId();
        skillProgressPopulator.createSkill(owner, "cooking", "LIFE", 12000, 6);

        String out = growthTools.getGrowth("achievements", ctx(owner));

        // life_lv5 (target 5) and life_xp_10k (target 10000) both cross their target from the
        // single seeded LIFE row — the REAL AchievementService derive-on-read computation.
        assertThat(out).startsWith("Eredmények:")
                .contains("LIFE Lv 5: 6/5 (elérve)")
                .contains("10 000 LIFE XP: 12000/10000 (elérve)");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Growth", "achievements"));
    }

    @Test
    void testGetGrowth_shouldRenderEquippedAndOwnedTitles_whenScopeTitles() {
        UUID owner = userPopulator.createUser().getId();
        gamificationPopulator.ownedTitle(owner, "lendulet");

        String out = growthTools.getGrowth("titles", ctx(owner));

        // display names resolved from the TitleCatalog (content/gamification-titles.json), not the
        // raw catalog keys ("ujonc"/"lendulet") — the account is born equipped with the default
        // title (TitleCatalog.DEFAULT_TITLE_KEY="ujonc" -> "Az Újonc"); "lendulet" -> "A Lendület".
        assertThat(out).isEqualTo("Címek: felszerelt — Az Újonc; birtokolt: A Lendület");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Growth", "titles"));
    }

    @Test
    void testGetGrowth_shouldFallBackToRawKey_whenScopeTitlesAndOwnedKeyMissingFromCatalog() {
        UUID owner = userPopulator.createUser().getId();
        gamificationPopulator.ownedTitle(owner, "nem-letezo-cim");

        String out = growthTools.getGrowth("titles", ctx(owner));

        // honest degrade: an owned key absent from the static TitleCatalog content renders as the
        // raw key rather than crashing or silently dropping the entry.
        assertThat(out).isEqualTo("Címek: felszerelt — Az Újonc; birtokolt: nem-letezo-cim");
    }

    @Test
    void testGetDailyPractice_shouldComposeQuestHabitIntentionRitualAndActivity_whenAllSeeded() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        intentionPopulator.creed(owner, "Mindig tartsd a szavad.");
        intentionPopulator.focus(owner, today, "Reggeli edzés befejezése");
        questPopulator.quest(owner, today, DailyQuestEntity.SLOT_BODY, "test_quest",
                "recovery", "LIFE", "manual", null, 20, DailyQuestEntity.STATUS_COMPLETED);
        habitPopulator.row(owner, today, "morning_pushups", HabitDayEntity.STATUS_DONE);
        ritualPopulator.closedDay(owner, today);
        activityPopulator.activity(owner, today, "Olvastam 20 percet", "learning", 15, ActivityLogEntity.BY_AI);

        String out = practiceTools.getDailyPractice(null, ctx(owner));

        assertThat(out).startsWith("Napi gyakorlat (" + today + "):")
                .contains("Küldetések: 1/1 lezárva")
                .contains("Szokások (ma állapot szerint): reggeli 0, esti 0 tökéletes nap (30 nap); morning_pushups: 1/28")
                .contains("Szándék: hitvallás — Mindig tartsd a szavad.; mai fókusz: Reggeli edzés befejezése")
                .contains("Napzárás: zárva")
                .contains("Tevékenységek: Olvastam 20 percet (15 XP)");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Practice", today.toString()));
    }

    @Test
    void testGetDailyPractice_shouldRenderNincsAdatAndHonestZeros_whenNothingSeeded() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String out = practiceTools.getDailyPractice(null, ctx(owner));

        assertThat(out).isEqualTo("Napi gyakorlat (" + today + "):"
                + "\nKüldetések: nincs adat"
                + "\nSzokások (ma állapot szerint): reggeli 0, esti 0 tökéletes nap (30 nap)"
                + "\nSzándék: hitvallás — nincs adat; mai fókusz: nincs adat"
                + "\nNapzárás: nyitva"
                + "\nTevékenységek: nincs adat");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Practice", today.toString()));
    }

    @Test
    void testGetDailyPractice_shouldResolveExplicitDateParam_whenDateGiven() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate past = LocalDate.now().minusDays(3);
        ritualPopulator.closedDay(owner, past);

        String out = practiceTools.getDailyPractice(past.toString(), ctx(owner));

        assertThat(out).startsWith("Napi gyakorlat (" + past + "):")
                .contains("Napzárás: zárva");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Practice", past.toString()));
    }

    @Test
    void testGetDailyPractice_shouldFallBackToToday_whenDateUnparsable() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String out = practiceTools.getDailyPractice("nem-datum", ctx(owner));

        assertThat(out).startsWith("Napi gyakorlat (" + today + "):");
    }

    @Test
    void testGetInsights_shouldRenderConfirmedPatternWithMechanismAndEvidence_whenScopePatterns() {
        UUID owner = userPopulator.createUser().getId();
        patternPopulator.statistical(owner, "sleep-quality~next-day-training-rpe", PatternEntity.STATUS_CONFIRMED);

        String out = insightsTools.getInsights("patterns", ctx(owner));

        // real rendered content: title (statement) + the deterministic mechanism prose (carries
        // direction/strength) + the evidence chips (r/n) — not just a status/count placeholder.
        assertThat(out).startsWith("Minták (megerősített):")
                .contains("Alvásminőség ↔ másnapi edzés-RPE — Közepes erősségű negatív együttjárás")
                .contains("(r=-0.55, n=12 nap)");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Insight", "Alvásminőség ↔ másnapi edzés-RPE"));
    }

    @Test
    void testGetInsights_shouldExcludeProposedMonitoringAndRejectedPatterns_whenScopePatterns() {
        UUID owner = userPopulator.createUser().getId();
        patternPopulator.statistical(owner, "pair-proposed", PatternEntity.STATUS_PROPOSED);
        patternPopulator.statistical(owner, "pair-monitoring", PatternEntity.STATUS_MONITORING);
        patternPopulator.statistical(owner, "pair-rejected", PatternEntity.STATUS_REJECTED);

        // only CONFIRMED rows are "Minták" — the inbox's proposed/monitoring/rejected states are a
        // separate L2 decision surface, not this read tool's job.
        assertThat(insightsTools.getInsights("patterns", ctx(owner)))
                .isEqualTo("Minták: " + ToolText.NO_DATA);
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testGetInsights_shouldRenderNincsAdat_whenScopePatternsAndNoConfirmedPatterns() {
        assertThat(insightsTools.getInsights("patterns", ctx(userPopulator.createUser().getId())))
                .isEqualTo("Minták: nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testGetInsights_shouldDefaultScopeToPatterns_whenScopeNull() {
        assertThat(insightsTools.getInsights(null, ctx(userPopulator.createUser().getId())))
                .isEqualTo("Minták: nincs adat");
    }

    @Test
    void testGetInsights_shouldRenderHonestDeferral_whenScopePredictionsOrExperiments() {
        UUID owner = userPopulator.createUser().getId();

        // scope=predictions/experiments are deliberately DEFERRED (proactive's read paths lazily
        // GENERATE on a miss — a write — and a direct import would close a new companion->proactive
        // package cycle); an honest "még nem elérhető", never fabricated data or a "nincs adat"
        // that would look like a real per-user absence.
        assertThat(insightsTools.getInsights("predictions", ctx(owner)))
                .isEqualTo("Előrejelzések: még nem elérhető");
        assertThat(insightsTools.getInsights("experiments", ctx(owner)))
                .isEqualTo("Kísérletek: még nem elérhető");
        assertThat(audit.toRefsEnvelope()).isNull();
    }
}
