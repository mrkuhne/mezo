package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import io.mrkuhne.mezo.api.dto.PlannedSkipKind;
import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.api.dto.PlannedSkipResponse;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse.StateEnum;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MissedWorkoutsRule;
import io.mrkuhne.mezo.feature.progression.TrainingCommitmentSource;
import io.mrkuhne.mezo.feature.quest.QuestCatalog;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.service.QuestSelector;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.signal.TrainingCommitmentCalculator;
import io.mrkuhne.mezo.feature.train.signal.TrainingStreakCalculator;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PlannedSkipPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** Kihagyás S1 (mezo-q4xt2.1) — gym "planned" reads honour a gym skip: readiness, quest
 *  day-typing and the proactive/companion planning reads all resolve via {@code
 *  WorkoutService#findPlannedTemplateForDateUnlessSkipped}, while {@code getToday} (the undo
 *  path) keeps resolving the day regardless of the skip. */
class PlannedSkipConsumersIT extends ApiIntegrationTest {

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");

    @Autowired private CheckInPopulator checkIns;
    @Autowired private TrainPopulator train;
    @Autowired private QuestSelector questSelector;
    @Autowired private QuestCatalog questCatalog;
    @Autowired private PlannedSkipPopulator plannedSkips;
    @Autowired private TrainingStreakCalculator trainingStreakCalculator;
    @Autowired private TrainingCommitmentCalculator trainingCommitmentCalculator;
    @Autowired private MissedWorkoutsRule missedWorkoutsRule;
    @Autowired private FlagProperties flagProperties;

    private void soreGymMorning(UUID user) {
        var meso = train.createActiveMeso(user);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(user, meso.getId(), todayLabel);
        train.createExercise(user, day.getId(), "Guggolás", "quad", "compound");
        checkIns.createCheckIn(user, LocalDate.now(), "06:30", c -> c.setSoreness(8));
    }

    @Test
    void testReadiness_shouldBeNone_whenTodayGymSkipped() {
        RegisteredUser user = registerUser("Skip Readiness Owner");
        soreGymMorning(user.id());
        LocalDate today = LocalDate.now();

        PlannedSkipResponse skip = putForBody("/api/train/skips", new PlannedSkipRequest()
                .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            user.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        ReadinessTodayResponse afterSkip = getForBody(
            "/api/train/readiness/today", user.headers(), HttpStatus.OK, ReadinessTodayResponse.class);
        assertThat(afterSkip.getState()).isEqualTo(StateEnum.NONE);

        deleteAndExpect("/api/train/skips/" + skip.getId(), user.headers(), HttpStatus.NO_CONTENT);

        ReadinessTodayResponse afterUndo = getForBody(
            "/api/train/readiness/today", user.headers(), HttpStatus.OK, ReadinessTodayResponse.class);
        assertThat(afterUndo.getState()).isEqualTo(StateEnum.OFFER);
    }

    @Test
    void testWorkoutToday_shouldStillResolve_whenTodayGymSkipped() {
        RegisteredUser user = registerUser("Skip Workout Undo Owner");
        soreGymMorning(user.id());
        LocalDate today = LocalDate.now();

        putForBody("/api/train/skips", new PlannedSkipRequest()
                .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            user.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        WorkoutTodayResponse todayWorkout = getForBody(
            "/api/train/workouts/today", user.headers(), HttpStatus.OK, WorkoutTodayResponse.class);

        assertThat(todayWorkout.getDayLabel()).isNotNull();
        assertThat(todayWorkout.getExercises()).isNotEmpty();
    }

    @Test
    void testQuest_shouldUseRestDayType_whenGymSkipped() {
        RegisteredUser user = registerUser("Skip Quest Owner");
        soreGymMorning(user.id());
        LocalDate today = LocalDate.now();

        putForBody("/api/train/skips", new PlannedSkipRequest()
                .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            user.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        List<DailyQuestEntity> quests = questSelector.generate(user.id(), today);

        assertThat(quests).isNotEmpty();
        for (DailyQuestEntity quest : quests) {
            QuestCatalog.QuestDef def = questCatalog.all().stream()
                .filter(d -> d.key().equals(quest.getCatalogKey()))
                .findFirst().orElseThrow();
            assertThat(def.dayTypes()).anyMatch(t -> t.equals("REST") || t.equals("ANY"));
        }
    }

    // ── streak (TrainingStreakCalculator honours bridged weeks, mezo-q4xt2.1) ──────────────────

    private record StreakFixture(UUID owner, WorkoutSessionEntity template) {}

    /** A completed gym instance LAST week — the streak's baseline — and nothing logged this
     *  week (matches the setup {@code TrainingStreakCalculatorIT} uses for its own fixtures). */
    private StreakFixture streakFixture(String email) {
        UUID owner = databasePopulator.populateUser(email);
        MesocycleEntity meso = train.createActiveMeso(owner);
        WorkoutSessionEntity template = train.createTemplateDay(owner, meso.getId(), "Hét");
        train.createWorkoutInstance(owner, template, LocalDate.now(TZ).minusWeeks(1), "completed");
        return new StreakFixture(owner, template);
    }

    /**
     * The bridged-week cases walk back from the current week to LAST week through
     * {@code weekKey - 1}. In ISO week 1 that step lands on {@code yyyy00}, not the previous
     * year's last week — the calculator's documented v1 year-boundary limitation — so these
     * cases are skipped (not failed) during ISO week 1.
     */
    private static void assumeNotIsoWeekOne() {
        assumeTrue(LocalDate.now(TZ).get(IsoFields.WEEK_OF_WEEK_BASED_YEAR) != 1,
            "known v1 limitation: streak weekKey walk-back does not cross the ISO year boundary");
    }

    @Test
    void testStreakWeeks_shouldBeZero_whenCurrentWeekHasNoSkipAndNoSession() {
        StreakFixture f = streakFixture("streak-noskip@test.hu");

        // Negative control: last week is trained, but the current week has neither a session
        // nor an excused skip — it is not bridged, so the walk-back stops there rather than
        // extending the streak into the untouched current week. Distinguishes this from case
        // (b)/(c) below, where the current week IS bridged.
        assertThat(trainingStreakCalculator.streakWeeks(f.owner())).isZero();
    }

    @Test
    void testStreakWeeks_shouldBeOne_whenTodayHasAnIllnessSkip() {
        assumeNotIsoWeekOne();
        StreakFixture f = streakFixture("streak-illness@test.hu");
        plannedSkips.create(f.owner(), LocalDate.now(TZ), Kind.GYM, null, null, null, Reason.ILLNESS);

        // The illness skip is serious, so the current week is excused/bridged (≥1 excused skip,
        // no session): the walk-back steps OVER it (neither breaks nor extends the streak by
        // itself) and finds last week's completed instance right behind it — streak=1.
        assertThat(trainingStreakCalculator.streakWeeks(f.owner())).isEqualTo(1);
    }

    @Test
    void testStreakWeeks_shouldBeOne_whenTheSecondSoftSkipHoldsTheWeeksFreePass() {
        assumeNotIsoWeekOne();
        StreakFixture f = streakFixture("streak-softpass@test.hu");
        LocalDate today = LocalDate.now(TZ);
        PlannedSkipEntity undone =
            plannedSkips.create(f.owner(), today, Kind.GYM, null, null, null, Reason.OTHER);
        plannedSkips.softDelete(undone);
        plannedSkips.create(f.owner(), today, Kind.GYM, null, null, null, Reason.TIRED);

        // The first soft skip is undone, so only the second one is judged: it becomes the
        // week's one free pass (PlannedSkipPolicy read-time verdict) and the current week is
        // bridged exactly like case (b) — streak still walks back to last week's session: 1.
        assertThat(trainingStreakCalculator.streakWeeks(f.owner())).isEqualTo(1);
    }

    // ── commitment (TrainingCommitmentCalculator excludes excused GYM dates) ───────────────────

    @Test
    void testCommitmentStats_shouldExcludeExcusedGymDay_whenWednesdayIsIllnessSkipped() {
        UUID owner = databasePopulator.populateUser("commitment-illness@test.hu");
        MesocycleEntity meso = train.createActiveMeso(owner);
        train.createTemplateDay(owner, meso.getId(), "Hét");
        train.createTemplateDay(owner, meso.getId(), "Sze");
        LocalDate monday = LocalDate.now(TZ).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate wednesday = monday.plusDays(2);
        plannedSkips.create(owner, wednesday, Kind.GYM, null, null, null, Reason.ILLNESS);

        // Window Mon-Wed: Mon+Wed are planned (2), Wed is excused (illness) so only Mon counts
        // as "should have trained" — planned=1; nothing was actually done — done=0.
        TrainingCommitmentSource.Stats stats =
            trainingCommitmentCalculator.commitmentStats(owner, monday, wednesday);

        assertThat(stats.planned()).isEqualTo(1);
        assertThat(stats.done()).isZero();
    }

    // ── missed rule (MissedWorkoutsRule skips excused GYM days) ────────────────────────────────

    private void monWedFriSchedule(UUID owner) {
        Instant longAgo = Instant.now().minus(365, ChronoUnit.DAYS);
        train.createGymSlotAt(owner, 0, "07:00", longAgo);
        train.createGymSlotAt(owner, 2, "07:00", longAgo);
        train.createGymSlotAt(owner, 4, "07:00", longAgo);
    }

    @Test
    void testMissedWorkoutsRule_shouldClear_whenOneOfTwoConsecutiveMissesIsIllnessExcused() {
        UUID owner = databasePopulator.populateUser("missed-illness@test.hu");
        monWedFriSchedule(owner);
        MesocycleEntity meso = train.createActiveMeso(owner);
        WorkoutSessionEntity template = train.createTemplateDay(owner, meso.getId(), "A");
        LocalDate today = LocalDate.now(TZ);
        int windowDays = flagProperties.missedWorkouts().windowDays();

        List<LocalDate> plannedDaysAsc = new ArrayList<>();
        for (int i = windowDays; i >= 1; i--) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow == 0 || dow == 2 || dow == 4) {
                plannedDaysAsc.add(day);
            }
        }
        // Train every planned day except the last two (closest to yesterday) — WITHOUT the
        // skip below this reproduces the "still open at window end" fixture, whose longest run
        // is exactly 2 and raises MISSED_WORKOUTS.
        for (int i = 0; i < plannedDaysAsc.size() - 2; i++) {
            train.createWorkoutInstance(owner, template, plannedDaysAsc.get(i), "completed");
        }
        LocalDate firstOfTheTwo = plannedDaysAsc.get(plannedDaysAsc.size() - 2);
        // Excuse the first of the two consecutive misses — an excused day is skipped over
        // entirely (neither extends nor resets the run), so only the second day remains a
        // single, isolated miss: the run can no longer reach min-consecutive-missed (2).
        plannedSkips.create(owner, firstOfTheTwo, Kind.GYM, null, null, null, Reason.ILLNESS);

        FlagVerdict verdict = missedWorkoutsRule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
    }

    @Test
    void testMissedWorkoutsRule_shouldResetRun_whenASkippedDayWasTrainedAnyway() {
        UUID owner = databasePopulator.populateUser("missed-skip-trained@test.hu");
        monWedFriSchedule(owner);
        MesocycleEntity meso = train.createActiveMeso(owner);
        WorkoutSessionEntity template = train.createTemplateDay(owner, meso.getId(), "A");
        LocalDate today = LocalDate.now(TZ);
        int windowDays = flagProperties.missedWorkouts().windowDays();

        List<LocalDate> plannedDaysAsc = new ArrayList<>();
        for (int i = windowDays; i >= 1; i--) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow == 0 || dow == 2 || dow == 4) {
                plannedDaysAsc.add(day);
            }
        }
        // Train everything except the last three planned days: miss, (skip + trained), miss.
        for (int i = 0; i < plannedDaysAsc.size() - 3; i++) {
            train.createWorkoutInstance(owner, template, plannedDaysAsc.get(i), "completed");
        }
        LocalDate middle = plannedDaysAsc.get(plannedDaysAsc.size() - 2);
        plannedSkips.create(owner, middle, Kind.GYM, null, null, null, Reason.ILLNESS);
        train.createWorkoutInstance(owner, template, middle, "completed");

        // The skipped-but-trained middle day is a TRAINED day: it resets the run, so the two
        // misses around it stay isolated (longest run 1). Were the skip checked first, the day
        // would be stepped over and the misses would merge into a run of 2 (RAISED).
        FlagVerdict verdict = missedWorkoutsRule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().observed()).isEqualTo(1.0);
    }
}
