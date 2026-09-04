package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MissedWorkoutsRule;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S2 missed_workouts (spec 2026-09-03 §4 row 3): two PLANNED gym days in a row with nothing
 * completed. Consecutive in the sequence of planned days, not in calendar days.
 *
 * <p><b>Weekday independence (bd mezo-2iki).</b> {@link MissedWorkoutsRule} scans a window that
 * ends YESTERDAY and is clamped to the schedule's creation date, so how many Mon/Wed/Fri days
 * fall inside it depends on what weekday "today" is. Fixtures anchored on {@code LocalDate.now()}
 * therefore produced a test that was green only on Thursday and Saturday. Every scenario here is
 * instead driven through {@link MissedWorkoutsRule#evaluate(UUID, LocalDate)} — the rule already
 * takes "today" as a parameter — with a fixed reference week, so each one runs against all seven
 * possible weekdays on every execution. {@link #missed_workouts_is_wired_into_the_evaluator()} is
 * the one live-clock case; it stays weekday-independent by construction.
 */
class FlagEvaluatorMissedWorkoutsIT extends AbstractIntegrationTest {

    /** 2026-06-01 is a Monday — pinned by {@link #the_reference_week_starts_on_a_monday()}. */
    private static final LocalDate REFERENCE_WEEK_START = LocalDate.of(2026, 6, 1);
    private static final ZoneId ZONE = ZoneId.systemDefault();

    @Autowired private FlagEvaluator evaluator;
    @Autowired private MissedWorkoutsRule rule;
    @Autowired private FlagProperties properties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;

    /** Every weekday as a candidate "today" — Monday through Sunday of one fixed week. */
    private static Stream<LocalDate> everyWeekday() {
        return IntStream.range(0, 7).mapToObj(REFERENCE_WEEK_START::plusDays);
    }

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private Optional<FlagPayloadEnvelope.MissedWorkouts> payload(UUID owner, LocalDate today) {
        return rule.evaluate(owner, today).map(r -> r.payload().missedWorkouts());
    }

    /** A Mon/Wed/Fri gym schedule — 0=Monday, so 0/2/4. Backdated well before the scan window so
     *  these long-standing-schedule fixtures are not affected by the schedule-creation clamp
     *  (Fix B, bd mezo-d58h.2) — a plain {@code createGymSlot} would stamp {@code created_at} as
     *  "now" and the clamp would then swallow the whole window, since the window ends yesterday. */
    private void monWedFriSchedule(UUID owner, LocalDate today) {
        scheduleCreatedAt(owner, today.minusDays(365).atStartOfDay(ZONE).toInstant());
    }

    private void scheduleCreatedAt(UUID owner, Instant createdAt) {
        trainPopulator.createGymSlotAt(owner, 0, "07:00", createdAt);
        trainPopulator.createGymSlotAt(owner, 2, "07:00", createdAt);
        trainPopulator.createGymSlotAt(owner, 4, "07:00", createdAt);
    }

    private static boolean isPlanned(LocalDate day) {
        // gym_schedule_slot.day_of_week is 0=Monday..6=Sunday, so Mon/Wed/Fri is 0/2/4.
        int dow = day.getDayOfWeek().getValue() - 1;
        return dow == 0 || dow == 2 || dow == 4;
    }

    /** The Mon/Wed/Fri days the rule will scan for {@code today}, oldest first. The window is
     *  windowDays() long and ends YESTERDAY (today is still in progress), so it spans
     *  today-windowDays()..today-1 — today itself is out of scope. */
    private List<LocalDate> plannedDaysInWindow(LocalDate today) {
        List<LocalDate> days = new ArrayList<>();
        for (int i = windowDays(); i >= 1; i--) {
            LocalDate day = today.minusDays(i);
            if (isPlanned(day)) {
                days.add(day);
            }
        }
        return days;
    }

    @Test
    void the_reference_week_starts_on_a_monday() {
        // The fixture week must cover Mon..Sun for the parameterised cases below to exercise
        // every weekday; pin the anchor so a careless edit cannot silently skew it.
        assertThat(REFERENCE_WEEK_START.getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
        assertThat(everyWeekday().map(LocalDate::getDayOfWeek).toList())
            .containsExactly(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY);
    }

    @Test
    void missed_workouts_is_wired_into_the_evaluator() {
        // The one case that runs on the LIVE clock: it proves FlagEvaluator actually calls
        // MissedWorkoutsRule. A year-old schedule with nothing completed fills the whole window
        // on every weekday, so the outcome does not depend on what day this executes.
        UUID owner = ownerId();
        monWedFriSchedule(owner, LocalDate.now());

        assertThat(evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList())
            .contains(FlagKey.MISSED_WORKOUTS);
    }

    @ParameterizedTest(name = "today={0}")
    @MethodSource("everyWeekday")
    void missed_workouts_raises_after_two_consecutive_planned_days_with_nothing_completed(
        LocalDate today) {
        UUID owner = ownerId();
        monWedFriSchedule(owner, today);
        // No workout instances at all inside the window ⇒ every planned day is a miss, so the
        // longest run is well past min-consecutive-missed=2.

        assertThat(payload(owner, today).orElseThrow().longestMissedRun())
            .isGreaterThanOrEqualTo(2);
    }

    @ParameterizedTest(name = "today={0}")
    @MethodSource("everyWeekday")
    void missed_workouts_stays_quiet_without_a_gym_schedule(LocalDate today) {
        UUID owner = ownerId();
        // Nothing planned ⇒ nothing missed. An empty schedule must never raise.

        assertThat(payload(owner, today)).isEmpty();
    }

    @ParameterizedTest(name = "today={0}")
    @MethodSource("everyWeekday")
    void missed_workouts_stays_quiet_when_every_planned_day_was_trained(LocalDate today) {
        UUID owner = ownerId();
        monWedFriSchedule(owner, today);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        for (LocalDate day : plannedDaysInWindow(today)) {
            trainPopulator.createWorkoutInstance(owner, template, day, "completed");
        }

        assertThat(payload(owner, today)).isEmpty();
    }

    @ParameterizedTest(name = "today={0}")
    @MethodSource("everyWeekday")
    void missed_workouts_stays_quiet_when_a_completed_day_breaks_the_run(LocalDate today) {
        // Single missed planned days on either side of a completed one never form a run of 2.
        // Training every OTHER planned day, starting from the oldest one in the window, leaves a
        // longest miss-run of exactly 1 whatever weekday the window happens to start on.
        UUID owner = ownerId();
        monWedFriSchedule(owner, today);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        List<LocalDate> planned = plannedDaysInWindow(today);
        for (int i = 0; i < planned.size(); i += 2) {
            trainPopulator.createWorkoutInstance(owner, template, planned.get(i), "completed");
        }

        assertThat(payload(owner, today).map(FlagPayloadEnvelope.MissedWorkouts::longestMissedRun)
            .orElse(0)).isLessThan(2);
    }

    @ParameterizedTest(name = "today={0}")
    @MethodSource("everyWeekday")
    void missed_workouts_does_not_count_a_started_but_unfinished_instance_as_trained(
        LocalDate today) {
        // status='active' is not 'completed' — findDoneInstanceDates filters on the string, and
        // a half-finished session must not silence the flag.
        UUID owner = ownerId();
        monWedFriSchedule(owner, today);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        for (LocalDate day : plannedDaysInWindow(today)) {
            trainPopulator.createWorkoutInstance(owner, template, day, "active");
        }

        assertThat(payload(owner, today)).isPresent();
    }

    @ParameterizedTest(name = "today={0}")
    @MethodSource("everyWeekday")
    void missed_workouts_raises_when_the_run_is_still_open_at_the_window_end(LocalDate today) {
        // The most recent planned days are missed right up to the window's last day (yesterday)
        // and nothing after them closes the run — an "open" run at the boundary must still raise,
        // not be silently dropped because there is no later trained day to confirm it ended.
        UUID owner = ownerId();
        monWedFriSchedule(owner, today);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        List<LocalDate> plannedDaysAsc = plannedDaysInWindow(today);
        assertThat(plannedDaysAsc).hasSizeGreaterThan(2);
        // Train every planned day except the last two (closest to yesterday), which stay missed
        // clear through to the window's end.
        for (int i = 0; i < plannedDaysAsc.size() - 2; i++) {
            trainPopulator.createWorkoutInstance(owner, template, plannedDaysAsc.get(i), "completed");
        }

        assertThat(payload(owner, today).orElseThrow().longestMissedRun()).isEqualTo(2);
    }

    @ParameterizedTest(name = "today={0}")
    @MethodSource("everyWeekday")
    void missed_workouts_stays_quiet_for_a_schedule_created_moments_ago(LocalDate today) {
        // The schedule was created today, so NONE of its planned weekdays existed as a plan
        // during the scan window — a day before the schedule existed cannot be a violation of it
        // (review fix, bd mezo-d58h.2). Without the createdAt clamp this would raise: 14 days of
        // "nothing completed" against a Mon/Wed/Fri schedule is well past min-consecutive-missed.
        UUID owner = ownerId();
        scheduleCreatedAt(owner, today.atStartOfDay(ZONE).toInstant());

        assertThat(payload(owner, today)).isEmpty();
    }

    @ParameterizedTest(name = "today={0}")
    @MethodSource("everyWeekday")
    void missed_workouts_only_counts_planned_days_from_the_schedule_creation_date_onward(
        LocalDate today) {
        // Anchor the schedule's creation to the SECOND-most-recent planned day inside the window
        // (bd mezo-2iki): whatever weekday "today" is, exactly TWO planned days then survive the
        // clamp, while the earlier ones — all equally untrained — must be discarded because the
        // schedule did not exist yet. The old fixed "3 days ago" backdate instead left 1 or 2
        // planned days depending on the weekday, so the rule only raised on Thu/Sat.
        UUID owner = ownerId();
        List<LocalDate> planned = plannedDaysInWindow(today);
        assertThat(planned).hasSizeGreaterThan(2);
        LocalDate createdDate = planned.get(planned.size() - 2);
        LocalDate lastPlanned = planned.getLast();
        scheduleCreatedAt(owner, createdDate.atStartOfDay(ZONE).toInstant());
        // Nothing completed at all: every planned day the rule scans is a miss, so the payload's
        // planned-day list is exactly the window the clamp left behind.

        FlagPayloadEnvelope.MissedWorkouts payload = payload(owner, today).orElseThrow();
        // Ignoring created_at would list all of the window's planned days here; the clamp cuts it
        // to the two from the creation date onward.
        assertThat(payload.plannedDays())
            .containsExactly(createdDate.toString(), lastPlanned.toString());
        assertThat(payload.missedDays())
            .containsExactly(createdDate.toString(), lastPlanned.toString());
        assertThat(payload.longestMissedRun()).isEqualTo(2);
    }

    /** The configured window — read from config so the fixtures and the rule cannot drift. */
    private int windowDays() {
        return properties.missedWorkouts().windowDays();
    }
}
