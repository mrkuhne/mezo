package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S2 missed_workouts (spec 2026-09-03 §4 row 3): two PLANNED gym days in a row with nothing
 * completed. Consecutive in the sequence of planned days, not in calendar days.
 */
class FlagEvaluatorMissedWorkoutsIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private FlagProperties properties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList();
    }

    private Optional<FlagPayloadEnvelope.MissedWorkouts> payload(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(r -> FlagKey.MISSED_WORKOUTS.equals(r.flagKey()))
            .map(r -> r.payload().missedWorkouts())
            .findFirst();
    }

    /** A Mon/Wed/Fri gym schedule — 0=Monday, so 0/2/4. Backdated well before the scan window so
     *  these long-standing-schedule fixtures are not affected by the schedule-creation clamp
     *  (Fix B, bd mezo-d58h.2) — a plain {@code createGymSlot} would stamp {@code created_at} as
     *  "now" and the clamp would then swallow the whole window, since the window ends yesterday. */
    private void monWedFriSchedule(UUID owner) {
        Instant longAgo = Instant.now().minus(365, ChronoUnit.DAYS);
        trainPopulator.createGymSlotAt(owner, 0, "07:00", longAgo);
        trainPopulator.createGymSlotAt(owner, 2, "07:00", longAgo);
        trainPopulator.createGymSlotAt(owner, 4, "07:00", longAgo);
    }

    @Test
    void missed_workouts_raises_after_two_consecutive_planned_days_with_nothing_completed() {
        UUID owner = ownerId();
        monWedFriSchedule(owner);
        // No workout instances at all inside the window ⇒ every planned day is a miss, so the
        // longest run is well past min-consecutive-missed=2.

        assertThat(keys(owner)).contains(FlagKey.MISSED_WORKOUTS);
        assertThat(payload(owner).orElseThrow().longestMissedRun()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void missed_workouts_stays_quiet_without_a_gym_schedule() {
        UUID owner = ownerId();
        // Nothing planned ⇒ nothing missed. An empty schedule must never raise.

        assertThat(keys(owner)).doesNotContain(FlagKey.MISSED_WORKOUTS);
    }

    @Test
    void missed_workouts_stays_quiet_when_every_planned_day_was_trained() {
        UUID owner = ownerId();
        monWedFriSchedule(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        LocalDate today = LocalDate.now();
        // Window is windowDays() ending YESTERDAY (today.minusDays(1)..today.minusDays(windowDays())),
        // so i runs 1..windowDays() rather than 0..windowDays()-1 — today itself is out of scope.
        for (int i = 1; i <= windowDays(); i++) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow == 0 || dow == 2 || dow == 4) {
                trainPopulator.createWorkoutInstance(owner, template, day, "completed");
            }
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.MISSED_WORKOUTS);
    }

    @Test
    void missed_workouts_stays_quiet_when_a_completed_day_breaks_the_run() {
        // Single missed planned days on either side of a completed one never form a run of 2.
        // window-days=14 with a Mon/Wed/Fri schedule gives ~6 planned days; train every OTHER
        // planned day and the longest miss-run is 1.
        UUID owner = ownerId();
        monWedFriSchedule(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        LocalDate today = LocalDate.now();
        boolean train = true;
        // Window is windowDays() ending YESTERDAY, so i runs windowDays()..1 (oldest to newest)
        // rather than windowDays()-1..0 — today itself is out of scope.
        for (int i = windowDays(); i >= 1; i--) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow != 0 && dow != 2 && dow != 4) {
                continue;
            }
            if (train) {
                trainPopulator.createWorkoutInstance(owner, template, day, "completed");
            }
            train = !train;
        }

        assertThat(payload(owner).map(FlagPayloadEnvelope.MissedWorkouts::longestMissedRun)
            .orElse(0)).isLessThan(2);
    }

    @Test
    void missed_workouts_does_not_count_a_started_but_unfinished_instance_as_trained() {
        // status='active' is not 'completed' — findDoneInstanceDates filters on the string, and
        // a half-finished session must not silence the flag.
        UUID owner = ownerId();
        monWedFriSchedule(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        LocalDate today = LocalDate.now();
        // Window is windowDays() ending YESTERDAY, so i runs 1..windowDays() — today itself is
        // out of scope.
        for (int i = 1; i <= windowDays(); i++) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow == 0 || dow == 2 || dow == 4) {
                trainPopulator.createWorkoutInstance(owner, template, day, "active");
            }
        }

        assertThat(keys(owner)).contains(FlagKey.MISSED_WORKOUTS);
    }

    @Test
    void missed_workouts_raises_when_the_run_is_still_open_at_the_window_end() {
        // The most recent planned days are missed right up to the window's last day (yesterday)
        // and nothing after them closes the run — an "open" run at the boundary must still raise,
        // not be silently dropped because there is no later trained day to confirm it ended.
        UUID owner = ownerId();
        monWedFriSchedule(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        LocalDate today = LocalDate.now();

        List<LocalDate> plannedDaysAsc = new ArrayList<>();
        for (int i = windowDays(); i >= 1; i--) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow == 0 || dow == 2 || dow == 4) {
                plannedDaysAsc.add(day);
            }
        }
        // Train every planned day except the last two (closest to yesterday), which stay missed
        // clear through to the window's end.
        for (int i = 0; i < plannedDaysAsc.size() - 2; i++) {
            trainPopulator.createWorkoutInstance(owner, template, plannedDaysAsc.get(i), "completed");
        }

        assertThat(keys(owner)).contains(FlagKey.MISSED_WORKOUTS);
        assertThat(payload(owner).orElseThrow().longestMissedRun()).isEqualTo(2);
    }

    @Test
    void missed_workouts_stays_quiet_for_a_schedule_created_moments_ago() {
        // The schedule was created just now, so NONE of its planned weekdays existed as a plan
        // during the scan window — a day before the schedule existed cannot be a violation of it
        // (review fix, bd mezo-d58h.2). Without the createdAt clamp this would raise: 14 days of
        // "nothing completed" against a Mon/Wed/Fri schedule is well past min-consecutive-missed.
        UUID owner = ownerId();
        trainPopulator.createGymSlotAt(owner, 0, "07:00", Instant.now());
        trainPopulator.createGymSlotAt(owner, 2, "07:00", Instant.now());
        trainPopulator.createGymSlotAt(owner, 4, "07:00", Instant.now());

        assertThat(keys(owner)).doesNotContain(FlagKey.MISSED_WORKOUTS);
    }

    @Test
    void missed_workouts_only_counts_planned_days_from_the_schedule_creation_date_onward() {
        // The schedule is backdated to 3 days ago. Planned days before that (well inside the
        // 14-day window) must not count as missed even though nothing at all was completed — only
        // the handful of planned days from the schedule's creation date onward can be violations.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        Instant createdAt = today.minusDays(3).atStartOfDay(ZoneId.systemDefault()).toInstant();
        trainPopulator.createGymSlotAt(owner, 0, "07:00", createdAt);
        trainPopulator.createGymSlotAt(owner, 2, "07:00", createdAt);
        trainPopulator.createGymSlotAt(owner, 4, "07:00", createdAt);
        // Nothing completed at all — if the pre-creation window leaked in, min-consecutive-missed
        // (2) would trivially be exceeded regardless of the clamp, so this alone would not pin the
        // clamp. What it DOES pin: the clamp changes the scanned window at all rather than
        // silently ignoring created_at, verified against the payload below.

        Optional<FlagPayloadEnvelope.MissedWorkouts> payload = payload(owner);
        assertThat(payload).isPresent();
        // Only planned days from createdAt's date (inclusive) through yesterday can appear —
        // every entry must be on/after the schedule's creation date.
        assertThat(payload.orElseThrow().plannedDays())
            .allSatisfy(day -> assertThat(LocalDate.parse(day)).isAfterOrEqualTo(createdAt
                .atZone(ZoneId.systemDefault()).toLocalDate()));
    }

    /** The configured window — read from config so the fixtures and the rule cannot drift. */
    private int windowDays() {
        return properties.missedWorkouts().windowDays();
    }
}
