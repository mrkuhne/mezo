package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

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
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** Kihagyás S1 (mezo-q4xt2.1) — gym "planned" reads honour a gym skip: readiness and
 *  the proactive/companion planning reads all resolve via {@code
 *  WorkoutService#findPlannedTemplateForDateUnlessSkipped}, while {@code getToday} (the undo
 *  path) keeps resolving the day regardless of the skip. */
class PlannedSkipConsumersIT extends ApiIntegrationTest {

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");

    @Autowired private CheckInPopulator checkIns;
    @Autowired private TrainPopulator train;
    @Autowired private PlannedSkipPopulator plannedSkips;
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
