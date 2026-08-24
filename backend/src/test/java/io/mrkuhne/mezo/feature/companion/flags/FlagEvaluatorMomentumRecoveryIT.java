package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagEvaluatorMomentumRecoveryIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList();
    }

    /** Two done habits/day across the baseline window (days -17..-4), nothing in the last 3 days. */
    private void collapsedHabitMomentum(UUID owner) {
        LocalDate today = LocalDate.now();
        for (int back = 4; back <= 17; back++) {
            LocalDate day = today.minusDays(back);
            habitPopulator.row(owner, day, "water", "done");
            habitPopulator.row(owner, day, "steps", "done");
        }
    }

    /** A gym slot on every weekday, so every day in the recent window is a PLANNED gym day. */
    private void gymPlannedEveryDay(UUID owner) {
        for (int dow = 0; dow <= 6; dow++) {
            trainPopulator.createGymSlot(owner, dow, "18:00");
        }
    }

    @Test
    void momentum_at_risk_raises_on_a_habit_collapse_plus_a_missed_planned_gym_day() {
        UUID owner = ownerId();
        collapsedHabitMomentum(owner);
        gymPlannedEveryDay(owner);

        assertThat(keys(owner)).contains(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void momentum_at_risk_stays_quiet_when_every_planned_gym_day_was_trained() {
        UUID owner = ownerId();
        collapsedHabitMomentum(owner);
        gymPlannedEveryDay(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Push");
        LocalDate today = LocalDate.now();
        for (int back = 1; back <= 3; back++) {
            trainPopulator.createWorkoutInstance(owner, template, today.minusDays(back), "completed");
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void momentum_at_risk_stays_quiet_without_a_planned_gym_day() {
        UUID owner = ownerId();
        collapsedHabitMomentum(owner); // no gym_schedule_slot at all ⇒ nothing was missed

        assertThat(keys(owner)).doesNotContain(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void momentum_at_risk_stays_quiet_below_the_baseline_floor() {
        UUID owner = ownerId();
        gymPlannedEveryDay(owner);
        LocalDate today = LocalDate.now();
        habitPopulator.row(owner, today.minusDays(9), "water", "done"); // baseline avg ≈ 0.07

        assertThat(keys(owner)).doesNotContain(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void momentum_at_risk_stays_quiet_when_the_habits_held_up() {
        UUID owner = ownerId();
        gymPlannedEveryDay(owner);
        LocalDate today = LocalDate.now();
        for (int back = 1; back <= 17; back++) {
            habitPopulator.row(owner, today.minusDays(back), "water", "done");
            habitPopulator.row(owner, today.minusDays(back), "steps", "done");
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void recovery_needed_raises_on_poor_sleep_plus_high_rpe_plus_high_stress_in_48h() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("5.5"), 2);
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 7, null);
        trainPopulator.createSportSessionWithRpe(owner, today.minusDays(1), 8);

        assertThat(keys(owner)).contains(FlagKey.RECOVERY_NEEDED);
    }

    @Test
    void recovery_needed_stays_quiet_when_one_leg_is_missing() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("5.5"), 2);
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 7, null);
        // no training load at all

        assertThat(keys(owner)).doesNotContain(FlagKey.RECOVERY_NEEDED);
    }

    @Test
    void recovery_needed_stays_quiet_when_a_leg_falls_outside_the_48h_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("5.5"), 2);
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 7, null);
        trainPopulator.createSportSessionWithRpe(owner, today.minusDays(3), 9);

        assertThat(keys(owner)).doesNotContain(FlagKey.RECOVERY_NEEDED);
    }

    @Test
    void all_healthy_raises_after_a_quiet_week_with_actual_data() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, null);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("8.0"), 4);

        assertThat(keys(owner)).containsExactly(FlagKey.ALL_HEALTHY);
    }

    @Test
    void all_healthy_stays_quiet_on_an_empty_log() {
        UUID owner = ownerId();

        assertThat(keys(owner)).isEmpty();
    }

    @Test
    void all_healthy_stays_quiet_while_a_problem_flag_is_inside_the_quiet_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, null);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("8.0"), 4);
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(48, ChronoUnit.HOURS));

        assertThat(keys(owner)).doesNotContain(FlagKey.ALL_HEALTHY);
    }

    @Test
    void all_healthy_returns_once_the_problem_flag_ages_out_of_the_quiet_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, null);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("8.0"), 4);
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(8 * 24, ChronoUnit.HOURS));

        assertThat(keys(owner)).contains(FlagKey.ALL_HEALTHY);
    }
}
