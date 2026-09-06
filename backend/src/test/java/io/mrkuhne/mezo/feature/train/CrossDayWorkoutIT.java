package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cross-day workout start (mezo-p7rp, spec 2026-07-17): getToday's day resolution is
 * open instance > templateSessionId param > today's weekday label; completedWorkout is
 * week-scoped (D5); startWorkout enforces one-open-workout (D6) and once-per-week (D5).
 */
@Transactional
class CrossDayWorkoutIT extends AbstractIntegrationTest {

    @Autowired private WorkoutService workoutService;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /**
     * The test's own reading of "today", taken ONCE. Every date and weekday label below is derived
     * from it, so the fixture can never be built from two different days: a second
     * {@code LocalDate.now()} taken later in the test names tomorrow whenever midnight falls in
     * between, and the labels/dates would then disagree with each other.
     */
    private static final LocalDate TODAY = LocalDate.now();

    /**
     * A weekday label that is neither today's nor tomorrow's — offset rotates over the HU label
     * ring from {@code TODAY + 1}. Skipping tomorrow as well is what keeps the "no template day
     * carries today's label" expectation true even if the SERVER's own clock has meanwhile rolled
     * over to the next day (it reads its own {@code LocalDate.now()}, which this test cannot pin).
     */
    private static String otherDayLabel(int offset) {
        int todayIdx = TODAY.getDayOfWeek().getValue() - 1;
        return WorkoutService.HU_DAY_LABELS.get((todayIdx + 1 + offset) % 7);
    }

    /** Monday of the current Mon–Sun week — always inside getToday's completed window. */
    private static LocalDate monday() {
        return TODAY.minusDays(TODAY.getDayOfWeek().getValue() - 1L);
    }

    private static WorkoutStartRequest startRequest(WorkoutSessionEntity template) {
        return WorkoutStartRequest.builder().templateSessionId(template.getId()).build();
    }

    /** A gym template day on a not-today/not-tomorrow label, with one exercise so it is not a rest day. */
    private WorkoutSessionEntity gymDay(UUID user, UUID mesoId, int labelOffset, int orderIndex) {
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(
            user, mesoId, otherDayLabel(labelOffset), "Pull Day", orderIndex, "planned");
        trainPopulator.createExercise(user, day.getId(), "Row " + labelOffset, 0);
        return day;
    }

    @Test
    void testGetToday_shouldResolveParamDay_whenNoOpenInstance() {
        UUID user = databasePopulator.populateUser("crossday@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        WorkoutSessionEntity otherDay = gymDay(user, meso.getId(), 1, 0);

        WorkoutTodayResponse byParam = workoutService.getToday(user, otherDay.getId());
        WorkoutTodayResponse byLabel = workoutService.getToday(user, null);

        assertThat(byParam.getTemplateSessionId()).isEqualTo(otherDay.getId());
        assertThat(byParam.getExercises()).isNotEmpty();
        // no template day carries today's label -> the param-less call stays empty
        assertThat(byLabel.getTemplateSessionId()).isNull();
    }

    @Test
    void testGetToday_shouldPreferOpenInstance_whenAnotherDayRequested() {
        UUID user = databasePopulator.populateUser("crossday@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        WorkoutSessionEntity openDay = gymDay(user, meso.getId(), 1, 0);
        WorkoutSessionEntity requestedDay = gymDay(user, meso.getId(), 2, 1);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, openDay, TODAY, "active");

        WorkoutTodayResponse r = workoutService.getToday(user, requestedDay.getId());

        // the open workout always wins day resolution (D6) — deep links resume, never fork
        assertThat(r.getTemplateSessionId()).isEqualTo(openDay.getId());
        assertThat(r.getOpenWorkout()).isNotNull();
        assertThat(r.getOpenWorkout().getId()).isEqualTo(instance.getId());
    }

    @Test
    void testGetToday_shouldReturnWeekScopedCompleted_whenDayDoneEarlierThisWeek() {
        UUID user = databasePopulator.populateUser("crossday@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        WorkoutSessionEntity day = gymDay(user, meso.getId(), 1, 0);
        WorkoutSessionEntity done =
            trainPopulator.createWorkoutInstance(user, day, monday(), "completed");

        WorkoutTodayResponse r = workoutService.getToday(user, day.getId());

        // completed ANY day of the current Mon–Sun week reviews instead of restarting (D5)
        assertThat(r.getCompletedWorkout()).isNotNull();
        assertThat(r.getCompletedWorkout().getId()).isEqualTo(done.getId());
    }

    @Test
    void testGetToday_shouldRejectParam_whenTemplateNotOwned() {
        UUID user = databasePopulator.populateUser("crossday@test.local");
        UUID stranger = databasePopulator.populateUser("stranger@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        WorkoutSessionEntity day = gymDay(user, meso.getId(), 1, 0);
        trainPopulator.createMesocycle(stranger, "meso", "active");

        assertThatThrownBy(() -> workoutService.getToday(stranger, day.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testStartWorkout_shouldConflict_whenAnotherWorkoutOpen() {
        UUID user = databasePopulator.populateUser("crossday@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        WorkoutSessionEntity openDay = gymDay(user, meso.getId(), 1, 0);
        WorkoutSessionEntity otherDay = gymDay(user, meso.getId(), 2, 1);
        trainPopulator.createWorkoutInstance(user, openDay, TODAY, "active");

        assertThatThrownBy(() -> workoutService.startWorkout(user, startRequest(otherDay)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_WORKOUT_OPEN_ELSEWHERE");
    }

    @Test
    void testStartWorkout_shouldConflict_whenDayDoneThisWeek() {
        UUID user = databasePopulator.populateUser("crossday@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        WorkoutSessionEntity day = gymDay(user, meso.getId(), 1, 0);
        trainPopulator.createWorkoutInstance(user, day, monday(), "completed");

        assertThatThrownBy(() -> workoutService.startWorkout(user, startRequest(day)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_DAY_DONE_THIS_WEEK");
    }

    @Test
    void testStartWorkout_shouldResumeOpenInstance_whenSameTemplateRequested() {
        UUID user = databasePopulator.populateUser("crossday@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        WorkoutSessionEntity day = gymDay(user, meso.getId(), 1, 0);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, day, TODAY, "active");

        // the resume branch must stay BEFORE the D5/D6 guards — same-template start never 409s
        WorkoutInstanceResponse r = workoutService.startWorkout(user, startRequest(day));

        assertThat(r.getId()).isEqualTo(instance.getId());
    }
}
