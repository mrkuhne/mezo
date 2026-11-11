package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram;
import io.mrkuhne.mezo.feature.boop.service.BoopDay;
import io.mrkuhne.mezo.feature.boop.service.BoopDayAssembler;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailyMetricPopulator;
import io.mrkuhne.mezo.support.populator.IntentionPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WearableWorkoutPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.support.populator.WorkoutTimeOverridePopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.TimeZone;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Boop S3 Task 3 (mezo-r36n9.7): the read-only day assembler behind the morning brief. */
@Transactional
class BoopDayAssemblerIT extends AbstractIntegrationTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");
    /** A Tuesday ("Kedd", schedule dayOfWeek 1). */
    private static final LocalDate DAY = LocalDate.parse("2026-11-10");

    @Autowired private BoopDayAssembler assembler;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogs;
    @Autowired private SleepGoalPopulator sleepGoals;
    @Autowired private DailyMetricPopulator metricPopulator;
    @Autowired private DailyMetricRepository metrics;
    @Autowired private WearableWorkoutPopulator workoutPopulator;
    @Autowired private WearableWorkoutRepository wearableWorkouts;
    @Autowired private CalendarEventPopulator calendar;
    @Autowired private io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository calendarEvents;
    @Autowired private io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository workoutSessionRepository;
    @Autowired private MealPopulator meals;
    @Autowired private TrainPopulator train;
    @Autowired private WorkoutTimeOverridePopulator overrides;
    @Autowired private CheckInPopulator checkIns;
    @Autowired private IntentionPopulator intentions;
    @Autowired private PatternPopulator patterns;
    @Autowired private WeightLogPopulator weights;
    @Autowired private RecoveryPeriodPopulator recoveries;

    @Test
    void assemblesEveryFieldOfTheDay() {
        UUID user = databasePopulator.populateUser("boopday@test.local");

        // Last night (wake day = DAY) with stages + hypnogram; 14 nights of history before it.
        sleepLogs.createTrackerSleepLog(user, DAY, "23:10", "06:40", new BigDecimal("7.50"), 8, 1, 470,
            20, 230, 100, 90, null, "apple_health", new SleepHypnogram(10, "LLDDDRA"), null);
        for (int i = 1; i <= 14; i++) {
            sleepLogs.createTrackerSleepLog(user, DAY.minusDays(i), "23:00", "07:00", new BigDecimal("8.00"), 7, 1,
                480, 20, 240, 100, 60, null, "apple_health", null, null);
        }
        sleepGoals.goal(user, 480, "WAKE", "06:30", 15);

        // Resting HR 58 on the 14 days before, except a gap on DAY-3; today 55 with the full HR spread.
        for (int i = 1; i <= 14; i++) {
            if (i != 3) {
                metricPopulator.createDay(user, DAY.minusDays(i), 8000, 58);
            }
        }
        DailyMetricEntity today = metricPopulator.createDay(user, DAY, 4200, 55);
        today.setAvgHr(70);
        today.setMinHr(50);
        today.setMaxHr(140);
        today.setActiveKcal(300);
        metrics.saveAndFlush(today);

        // Yesterday's workout: 45 min, 350 kcal.
        var w = workoutPopulator.createWorkout(user, "hk-1", DAY.minusDays(1), "running",
            local(DAY.minusDays(1), 18, 0), local(DAY.minusDays(1), 18, 45));
        w.setKcal(350);
        wearableWorkouts.saveAndFlush(w);

        // Calendar: 09:00–09:30 and 12:00–13:00 local.
        calendar.createEvent(user, DAY, "Standup", local(DAY, 9, 0), local(DAY, 9, 30));
        calendar.createEvent(user, DAY, "Ebéd Annával", local(DAY, 12, 0), local(DAY, 13, 0));

        // A lunch logged at 12:15 local.
        meals.createMealWithItems(user, DAY, "lunch", local(DAY, 12, 15),
            List.of(new MealPopulator.Line("Csirkés rizs boopday", "650", "45", "70", "15", (short) 1)));

        // Planned session: active meso, Kedd template with two exercises; gym slot 18:00, moved to 18:30.
        var meso = train.createActiveMeso(user);
        var kedd = train.createWorkoutSession(user, meso.getId(), "Kedd", "Legs 1", 1, "active");
        train.createExercise(user, kedd.getId(), "Guggolás", 0);
        train.createExercise(user, kedd.getId(), "Lábtolás", 1);
        train.createGymSlot(user, 1, "18:00");
        overrides.createOverride(user, DAY, LocalTime.of(18, 30));

        // Morning check-in done; intention; four proposed patterns + one confirmed.
        checkIns.createCheckIn(user, DAY, "06:30", 4, 2, null);
        intentions.creed(user, "Lassan, de biztosan");
        intentions.focus(user, DAY, "Séta ebéd után");
        for (int i = 0; i < 4; i++) {
            PatternEntity p = patterns.createPattern(user, "pair-" + i, "Minta " + i);
            p.setLastDetectedAt(Instant.parse("2026-11-0" + (i + 1) + "T08:00:00Z"));
            patterns.save(p);
        }
        PatternEntity confirmed = patterns.createPattern(user, "pair-c", "Megerősített");
        confirmed.setStatus(PatternEntity.STATUS_CONFIRMED);
        confirmed.setLastDetectedAt(Instant.parse("2026-11-09T08:00:00Z"));
        patterns.save(confirmed);

        // Weight: the latest weigh-in on/before DAY counts; a later one is ignored.
        weights.createWeightLog(user, DAY.minusDays(2), new BigDecimal("80.0"));
        weights.createWeightLog(user, DAY.minusDays(1), new BigDecimal("79.6"));
        weights.createWeightLog(user, DAY.plusDays(1), new BigDecimal("70.0"));

        BoopDay d = assembler.assemble(user, DAY);

        assertThat(d.date()).isEqualTo(DAY);

        // Sleep
        assertThat(d.sleep()).isNotNull();
        assertThat(d.sleep().bedtime()).isEqualTo("23:10");
        assertThat(d.sleep().wakeup()).isEqualTo("06:40");
        assertThat(d.sleep().totalMin()).isEqualTo(450);
        assertThat(d.sleep().deepMin()).isEqualTo(90);
        assertThat(d.sleep().remMin()).isEqualTo(100);
        assertThat(d.sleep().lightMin()).isEqualTo(230);
        assertThat(d.sleep().awakeMin()).isEqualTo(20);
        assertThat(d.sleep().quality()).isEqualTo(8);
        assertThat(d.sleep().hypnogram()).containsExactly(
            new BoopDay.Segment(2, 20), new BoopDay.Segment(3, 30),
            new BoopDay.Segment(1, 10), new BoopDay.Segment(0, 10));
        assertThat(d.sleepTargetMin()).isEqualTo(480);
        assertThat(d.bedtimeTarget()).isEqualTo(LocalTime.of(22, 30));
        assertThat(d.nightsKnown()).isEqualTo(15);
        assertThat(d.deepSleepWeek()).containsExactly(60, 60, 60, 60, 60, 60, 90);
        assertThat(d.baselineDeepMin()).isEqualTo(60.0);

        // Heart + movement
        assertThat(d.restingHrWeek()).containsExactly(58, 58, 58, null, 58, 58, 55);
        assertThat(d.baselineRestingHr()).isEqualTo(58.0);
        assertThat(d.restingHr()).isEqualTo(55);
        assertThat(d.hrToday()).isEqualTo(new BoopDay.HrToday(50, 70, 140));
        assertThat(d.steps()).isEqualTo(4200);
        assertThat(d.activeKcal()).isEqualTo(300);
        assertThat(d.yesterdayLoad()).isEqualTo(new BoopDay.WorkoutLoad(45, 350));

        // Session: override wins, planned time = the schedule's
        assertThat(d.session()).isNotNull();
        assertThat(d.session().title()).isEqualTo("Legs 1");
        assertThat(d.session().time()).isEqualTo(LocalTime.of(18, 30));
        assertThat(d.session().plannedTime()).isEqualTo(LocalTime.of(18, 0));
        assertThat(d.session().exercises()).containsExactly(
            new BoopDay.Exercise("Guggolás", 3), new BoopDay.Exercise("Lábtolás", 3));

        // Fuel
        assertThat(d.meals()).hasSize(1);
        assertThat(d.meals().get(0).time()).isEqualTo(LocalTime.of(12, 15));
        assertThat(d.meals().get(0).kcal()).isEqualTo(650);
        assertThat(d.meals().get(0).proteinG()).isEqualTo(45);
        assertThat(d.meals().get(0).logged()).isTrue();
        assertThat(d.kcalSoFar()).isEqualTo(650);
        assertThat(d.proteinG()).isEqualTo(45);
        assertThat(d.carbsG()).isEqualTo(70);
        assertThat(d.fatG()).isEqualTo(15);
        assertThat(d.kcalTarget()).isPositive();
        assertThat(d.proteinTarget()).isPositive();

        // Check-ins: the four configured slots, morning done with a summary
        assertThat(d.checkins()).extracting(BoopDay.Checkin::slot)
            .containsExactly("morning", "midday", "afternoon", "evening");
        assertThat(d.checkins()).extracting(BoopDay.Checkin::time).containsExactly(
            LocalTime.of(6, 30), LocalTime.of(10, 0), LocalTime.of(14, 0), LocalTime.of(20, 0));
        assertThat(d.checkins().get(0).done()).isTrue();
        assertThat(d.checkins().get(0).summary()).contains("energia 4");
        assertThat(d.checkins().get(1).done()).isFalse();
        assertThat(d.checkins().get(1).summary()).isNull();

        // Intention + observations (newest three proposed, decidable ids)
        assertThat(d.intention().creed()).isEqualTo("Lassan, de biztosan");
        assertThat(d.intention().foci()).containsExactly("Séta ebéd után");
        assertThat(d.observations()).extracting(BoopDay.Observation::lead)
            .containsExactly("Minta 3", "Minta 2", "Minta 1");
        assertThat(d.observations()).allSatisfy(o -> {
            assertThat(o.id()).isNotNull();
            assertThat(o.strength()).isBetween(0, 5);
        });
        assertThat(d.observations().get(0).strength()).isEqualTo(3); // |r| 0.55 → 2.75 → 3

        // Calendar: 72 quarter-hour slots from 06:00
        assertThat(d.calendar().count()).isEqualTo(2);
        assertThat(d.calendar().busySlots()).hasSize(72);
        assertThat(busyIndexes(d)).containsExactly(12, 13, 24, 25, 26, 27);
        assertThat(d.calendar().events()).extracting(BoopDay.CalendarItem::start)
            .containsExactly(LocalTime.of(9, 0), LocalTime.of(12, 0));

        // Weight as of DAY; no recovery
        assertThat(d.weight()).isNotNull();
        assertThat(d.weight().kg()).isEqualTo(79.6);
        assertThat(d.weight().trendKg()).isBetween(79.6, 80.0);
        assertThat(d.recovery()).isNull();
    }

    @Test
    void nightsKnownCountsDatesAndTheDbRefusesASecondLiveNightOnADate() {
        UUID user = databasePopulator.populateUser("onenight@test.local");
        sleepLogs.createTrackerSleepLog(user, DAY, "23:10", "06:40", new BigDecimal("7.50"), 8, 1, 470,
            20, 230, 100, 90, null, "apple_health", null, null);
        sleepLogs.createTrackerSleepLog(user, DAY.minusDays(1), "23:00", "07:00", new BigDecimal("8.00"), 7, 1,
            480, 20, 240, 100, 60, null, "apple_health", null, null);
        assertThatThrownBy(() -> sleepLogs.createTrackerSleepLog(user, DAY, "22:00", "06:00",
            new BigDecimal("8.00"), 5, 1, null, null, null, null, null, null, "manual", null, null))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void requestAt0030LocalPicksTheNewDay() {
        TimeZone original = TimeZone.getDefault();
        TimeZone.setDefault(TimeZone.getTimeZone("UTC")); // the server runs in UTC
        try {
            UUID user = databasePopulator.populateUser("midnight@test.local");
            // 00:30 local on DAY is still DAY-1 in UTC; the client sends its local date (DAY).
            sleepLogs.createTrackerSleepLog(user, DAY.minusDays(1), "23:00", "07:00", new BigDecimal("8.00"), 7, 1,
                480, 20, 240, 100, 80, null, "apple_health", null, null);
            calendar.createEvent(user, DAY.minusDays(1), "Késő esti hívás",
                local(DAY.minusDays(1), 23, 0), local(DAY.minusDays(1), 23, 45));
            calendar.createEvent(user, DAY, "Reggeli futás", local(DAY, 6, 0), local(DAY, 7, 0));
            var meso = train.createActiveMeso(user);
            var hetfo = train.createWorkoutSession(user, meso.getId(), "Hét", "Push", 0, "active");
            train.createExercise(user, hetfo.getId(), "Fekvenyomás", 0);
            var kedd = train.createWorkoutSession(user, meso.getId(), "Kedd", "Legs 1", 1, "active");
            train.createExercise(user, kedd.getId(), "Guggolás", 0);
            train.createGymSlot(user, 0, "07:00");
            train.createGymSlot(user, 1, "17:00");

            BoopDay d = assembler.assemble(user, DAY);

            assertThat(d.date()).isEqualTo(DAY);
            assertThat(d.sleep()).as("the night ending on the new day has not happened yet").isNull();
            assertThat(d.deepSleepWeek().get(5)).isEqualTo(80);
            assertThat(d.deepSleepWeek().get(6)).isNull();
            assertThat(d.calendar().count()).isEqualTo(1);
            assertThat(busyIndexes(d)).as("06:00 local, not 05:00 UTC").containsExactly(0, 1, 2, 3);
            assertThat(d.session().title()).isEqualTo("Legs 1");
            assertThat(d.session().time()).isEqualTo(LocalTime.of(17, 0));
            assertThat(d.session().plannedTime()).isEqualTo(LocalTime.of(17, 0));
        } finally {
            TimeZone.setDefault(original);
        }
    }

    @Test
    void emptyAccountStillAssemblesAHonestDay() {
        UUID user = databasePopulator.populateUser("empty@test.local");

        BoopDay d = assembler.assemble(user, DAY);

        assertThat(d.sleep()).isNull();
        assertThat(d.nightsKnown()).isZero();
        assertThat(d.deepSleepWeek()).hasSize(7).containsOnlyNulls();
        assertThat(d.restingHrWeek()).hasSize(7).containsOnlyNulls();
        assertThat(d.baselineRestingHr()).isNull();
        assertThat(d.baselineDeepMin()).isNull();
        assertThat(d.hrToday()).isNull();
        assertThat(d.steps()).isNull();
        assertThat(d.session()).isNull();
        assertThat(d.yesterdayLoad()).isEqualTo(new BoopDay.WorkoutLoad(0, 0));
        assertThat(d.meals()).isEmpty();
        assertThat(d.kcalSoFar()).isZero();
        assertThat(d.checkins()).hasSize(4).noneMatch(BoopDay.Checkin::done);
        assertThat(d.intention().foci()).isEmpty();
        assertThat(d.observations()).isEmpty();
        assertThat(d.calendar().count()).isZero();
        assertThat(d.calendar().busySlots()).hasSize(72).containsOnly(false);
        assertThat(d.weight()).isNull();
        assertThat(d.recovery()).isNull();
        assertThat(d.bedtimeTarget()).isNotNull(); // config ghost, never empty
    }

    @Test
    void openRecoveryPeriodGivesReasonAndDayAndDropsTheSession() {
        UUID user = databasePopulator.populateUser("kimelo@test.local");
        var meso = train.createActiveMeso(user);
        var kedd = train.createWorkoutSession(user, meso.getId(), "Kedd", "Legs 1", 1, "active");
        train.createExercise(user, kedd.getId(), "Guggolás", 0);
        recoveries.open(user, PlannedSkipEntity.Reason.ILLNESS, DAY.minusDays(1), RecoveryPeriodEntity.Estimate.FEW_DAYS);

        BoopDay d = assembler.assemble(user, DAY);

        assertThat(d.recovery()).isEqualTo(new BoopDay.Recovery("Beteg", 2));
        assertThat(d.session()).isNull();
    }

    @Test
    void otherUsersRowsStayOut() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        sleepLogs.createTrackerSleepLog(other, DAY, "23:00", "07:00", new BigDecimal("8.00"), 7, 1,
            480, 20, 240, 100, 90, null, "apple_health", new SleepHypnogram(10, "LLDD"), null);
        metricPopulator.createDay(other, DAY, 9000, 50);
        meals.createMealWithItems(other, DAY, "lunch", local(DAY, 12, 0),
            List.of(new MealPopulator.Line("Idegen ebéd boopday", "700", "40", "80", "20", (short) 1)));
        checkIns.createCheckIn(other, DAY, "06:30", 5, 1, null);
        patterns.createPattern(other, "pair-other", "Idegen minta");

        BoopDay d = assembler.assemble(me, DAY);

        assertThat(d.sleep()).isNull();
        assertThat(d.nightsKnown()).isZero();
        assertThat(d.deepSleepWeek()).containsOnlyNulls();
        assertThat(d.steps()).isNull();
        assertThat(d.restingHrWeek()).containsOnlyNulls();
        assertThat(d.meals()).isEmpty();
        assertThat(d.kcalSoFar()).isZero();
        assertThat(d.checkins()).noneMatch(BoopDay.Checkin::done);
        assertThat(d.observations()).isEmpty();
    }

    @Test
    void healthStrengthWorkoutOverlappingALoggedGymSessionIsCountedOnce() {
        UUID user = databasePopulator.populateUser("boopmatch@test.local");
        LocalDate yesterday = DAY.minusDays(1);
        var meso = train.createActiveMeso(user);
        var template = train.createWorkoutSession(user, meso.getId(), "Hétfő", "gym", 0, "planned");
        // Auto-closed: no finished_at, 50 active minutes.
        var gym = train.createWorkoutInstance(user, template, yesterday, "completed");
        gym.setStartedAt(local(yesterday, 18, 0));
        gym.setFinishedAt(null);
        gym.setActiveSeconds(50 * 60);
        workoutSessionRepository.saveAndFlush(gym);
        // The Watch recorded the same session 5 min later, 60 min, 420 kcal.
        var w = workoutPopulator.createWorkout(user, "hk-strength", yesterday, "strength",
            local(yesterday, 18, 5), local(yesterday, 19, 5));
        w.setKcal(420);
        wearableWorkouts.saveAndFlush(w);
        // And an unrelated run the log knows nothing about: 30 min, 300 kcal.
        var run = workoutPopulator.createWorkout(user, "hk-run", yesterday, "running",
            local(yesterday, 8, 0), local(yesterday, 8, 30));
        run.setKcal(300);
        wearableWorkouts.saveAndFlush(run);

        // Gym once (its own 50 min, kcal lent by the Health workout) + the run; the strength workout is not added.
        assertThat(assembler.assemble(user, DAY).yesterdayLoad()).isEqualTo(new BoopDay.WorkoutLoad(80, 720));
    }

    @Test
    void softDeletedHealthWorkoutAndCalendarEventAreIgnored() {
        UUID user = databasePopulator.populateUser("boopdeleted@test.local");
        LocalDate yesterday = DAY.minusDays(1);
        var w = workoutPopulator.createWorkout(user, "hk-gone", yesterday, "running",
            local(yesterday, 18, 0), local(yesterday, 18, 45));
        w.setKcal(350);
        w.setDeleted(true);
        wearableWorkouts.saveAndFlush(w);
        var e = calendar.createEvent(user, DAY, "Törölt", local(DAY, 9, 0), local(DAY, 10, 0));
        e.setDeleted(true);
        calendarEvents.saveAndFlush(e);
        var m = metricPopulator.createDay(user, DAY, 9000, 50);
        m.setDeleted(true);
        metrics.saveAndFlush(m);

        BoopDay d = assembler.assemble(user, DAY);

        assertThat(d.yesterdayLoad()).isEqualTo(new BoopDay.WorkoutLoad(0, 0));
        assertThat(d.calendar().count()).isZero();
        assertThat(d.steps()).isNull();
        assertThat(d.restingHr()).isNull();
    }

    private static Instant local(LocalDate date, int hour, int minute) {
        return LocalDateTime.of(date, LocalTime.of(hour, minute)).atZone(BUDAPEST).toInstant();
    }

    private static List<Integer> busyIndexes(BoopDay d) {
        return IntStream.range(0, d.calendar().busySlots().size())
            .filter(i -> d.calendar().busySlots().get(i))
            .boxed().toList();
    }
}
