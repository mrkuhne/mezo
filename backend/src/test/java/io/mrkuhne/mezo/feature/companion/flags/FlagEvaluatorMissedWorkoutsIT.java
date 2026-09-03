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
import java.time.LocalDate;
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

    /** A Mon/Wed/Fri gym schedule — 0=Monday, so 0/2/4. */
    private void monWedFriSchedule(UUID owner) {
        trainPopulator.createGymSlot(owner, 0, "07:00");
        trainPopulator.createGymSlot(owner, 2, "07:00");
        trainPopulator.createGymSlot(owner, 4, "07:00");
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
        for (int i = 0; i < windowDays(); i++) {
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
        for (int i = windowDays() - 1; i >= 0; i--) {
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
        for (int i = 0; i < windowDays(); i++) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow == 0 || dow == 2 || dow == 4) {
                trainPopulator.createWorkoutInstance(owner, template, day, "active");
            }
        }

        assertThat(keys(owner)).contains(FlagKey.MISSED_WORKOUTS);
    }

    /** The configured window — read from config so the fixtures and the rule cannot drift. */
    private int windowDays() {
        return properties.missedWorkouts().windowDays();
    }
}
