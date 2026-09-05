package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
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
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return raisedKeys(evaluator.evaluate(owner));
    }

    /** The keys that actually RAISED — the old evaluate() return, reconstructed. */
    private static List<String> raisedKeys(List<FlagVerdict> verdicts) {
        return verdicts.stream()
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(FlagVerdict::flagKey)
            .toList();
    }

    private static FlagVerdict verdictFor(List<FlagVerdict> verdicts, String flagKey) {
        return verdicts.stream().filter(v -> flagKey.equals(v.flagKey())).findFirst().orElseThrow();
    }

    /**
     * A meal row logged just now, so the meal domain is not stale for S2's {@code logging_gap}
     * rule. Needed only by the all_healthy fixtures below, which otherwise never log a meal and
     * would spuriously raise {@code logging_gap} alongside (or instead of) {@code all_healthy} —
     * see {@code MealPopulator.newMeal}'s hardcoded ancient default {@code loggedAt}.
     */
    private void freshMeal(UUID owner, LocalDate date) {
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "csirke");
        mealPopulator.createPantryMeal(owner, item, date, Instant.now());
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

    /**
     * Tight companion to the coarse case above. windowDays=2 ⇒ the TRUE window is
     * [today-1, today]; RPE at today-2 sits exactly one day past that edge. Dropping the
     * "- 1L" in {@code from = today.minusDays(cfg.windowDays() - 1L)} would widen the window to
     * [today-2, today] and pull this RPE row in, wrongly raising — this assertion is
     * load-bearing on that exact off-by-one. The other half of the pair (RPE at today-1,
     * inside the true edge, DOES raise) is already pinned by
     * {@link #recovery_needed_raises_on_poor_sleep_plus_high_rpe_plus_high_stress_in_48h}.
     */
    @Test
    void recovery_needed_stays_quiet_when_the_rpe_leg_lands_one_day_past_the_true_edge() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("5.5"), 2);
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 7, null);
        trainPopulator.createSportSessionWithRpe(owner, today.minusDays(2), 9);

        assertThat(keys(owner)).doesNotContain(FlagKey.RECOVERY_NEEDED);
    }

    @Test
    void all_healthy_raises_after_a_quiet_week_with_actual_data() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, null);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("8.0"), 4);
        freshMeal(owner, today); // else meal reads as stale (S2 logging_gap) and preempts all_healthy

        assertThat(keys(owner)).containsExactly(FlagKey.ALL_HEALTHY);
    }

    @Test
    void an_empty_log_raises_logging_gap_not_all_healthy() {
        // A genuinely empty account is exactly what S2's logging_gap now exists to name — every
        // domain (meal/checkin/sleep) is stale by never having a row at all, so it legitimately
        // raises instead of all_healthy, which only evaluates once every other rule is silent.
        UUID owner = ownerId();

        assertThat(keys(owner)).containsExactly(FlagKey.LOGGING_GAP);
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
        freshMeal(owner, today); // else meal reads as stale (S2 logging_gap) and preempts all_healthy
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(8 * 24, ChronoUnit.HOURS));

        assertThat(keys(owner)).contains(FlagKey.ALL_HEALTHY);
    }

    @Test
    void all_healthy_ignores_a_logging_gap_raise_inside_the_quiet_window() {
        // logging_gap names a data-availability gap (a domain went stale), not a health problem —
        // it must not block all_healthy for a full quiet-days window the way a genuine problem
        // flag does (review fix, bd mezo-d58h.2).
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, null);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("8.0"), 4);
        freshMeal(owner, today); // else meal reads as stale (S2 logging_gap) and preempts all_healthy
        flagLogPopulator.raiseAt(owner, FlagKey.LOGGING_GAP, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(48, ChronoUnit.HOURS));

        assertThat(keys(owner)).contains(FlagKey.ALL_HEALTHY);
        // A genuine problem flag in the same window still blocks all_healthy — see
        // all_healthy_stays_quiet_while_a_problem_flag_is_inside_the_quiet_window above (sleep_debt),
        // which pins that the general suppression is unchanged.
    }

    @Test
    void momentum_at_risk_is_unavailable_when_the_baseline_is_just_under_the_floor() {
        UUID owner = ownerId();
        gymPlannedEveryDay(owner);
        LocalDate today = LocalDate.now();
        // 13 of the 14 baseline days log one habit ⇒ avg ≈ 0.93, just under the 1.0 floor.
        for (int back = 4; back <= 16; back++) {
            habitPopulator.row(owner, today.minusDays(back), "water", "done");
        }

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.MOMENTUM_AT_RISK);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NO_HABIT_BASELINE);
    }

    @Test
    void momentum_at_risk_is_clear_when_recent_average_is_just_above_the_drop_floor() {
        UUID owner = ownerId();
        gymPlannedEveryDay(owner);
        LocalDate today = LocalDate.now();
        // Baseline: 2 habits/day for 14 days ⇒ avg 2.0; drop-ratio 0.5 ⇒ floor 1.0.
        for (int back = 4; back <= 17; back++) {
            habitPopulator.row(owner, today.minusDays(back), "water", "done");
            habitPopulator.row(owner, today.minusDays(back), "steps", "done");
        }
        // Recent (3 days): 4 completions total ⇒ avg 1.33, just above the 1.0 floor.
        habitPopulator.row(owner, today.minusDays(1), "water", "done");
        habitPopulator.row(owner, today.minusDays(1), "steps", "done");
        habitPopulator.row(owner, today.minusDays(2), "water", "done");
        habitPopulator.row(owner, today.minusDays(3), "water", "done");

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.MOMENTUM_AT_RISK);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("habits_recent_avg");
        assertThat(verdict.clear().observed()).isGreaterThan(verdict.clear().threshold());
    }

    @Test
    void momentum_at_risk_is_clear_when_every_planned_gym_day_was_trained() {
        UUID owner = ownerId();
        collapsedHabitMomentum(owner);
        gymPlannedEveryDay(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Push");
        LocalDate today = LocalDate.now();
        for (int back = 1; back <= 3; back++) {
            trainPopulator.createWorkoutInstance(owner, template, today.minusDays(back), "completed");
        }

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.MOMENTUM_AT_RISK);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("missed_gym_days");
    }

    @Test
    void recovery_needed_is_clear_when_one_leg_is_missing() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("5.5"), 2);
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 7, null);
        // no training load at all ⇒ the RPE leg is missing

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.RECOVERY_NEEDED);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("signals_matched");
        assertThat(verdict.clear().observed()).isEqualTo(2.0);
        assertThat(verdict.clear().detail()).isEqualTo("rpe");
    }

    @Test
    void all_healthy_is_clear_while_a_problem_flag_is_inside_the_quiet_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, null);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("8.0"), 4);
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(48, ChronoUnit.HOURS));

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.ALL_HEALTHY);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("quiet_days");
    }

    @Test
    void all_healthy_is_unavailable_with_no_data_in_window() {
        UUID owner = ownerId();

        // An empty account raises logging_gap, which forces all_healthy's outcome... but it is
        // still evaluated on its own honesty gate: no observations in the quiet window at all.
        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.ALL_HEALTHY);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NO_DATA_IN_WINDOW);
    }

    @Test
    void evaluate_returns_exactly_thirteen_verdicts() {
        UUID owner = ownerId();

        assertThat(evaluator.evaluate(owner)).hasSize(13);
    }

    /**
     * Pins {@code FlagEvaluator}'s own forced-CLEAR override (evaluate() lines ~80-87): on a
     * fresh user with no flag_log rows at all, {@code AllHealthyRule} would independently RAISE
     * off its own quiet-window data (the checkin/sleep rows this fixture seeds satisfy its
     * honesty gate) — but with {@code recovery_needed} also genuinely raising from the same
     * fixture, the composite must not report both a problem AND "all healthy" in the same pass,
     * so the evaluator forces {@code all_healthy} to CLEAR with metric {@code other_flags_raised}.
     */
    @Test
    void all_healthy_is_forced_clear_when_another_rule_raises_on_a_fresh_user() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("5.5"), 2);
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 7, null);
        trainPopulator.createSportSessionWithRpe(owner, today.minusDays(1), 8);

        List<FlagVerdict> verdicts = evaluator.evaluate(owner);

        assertThat(raisedKeys(verdicts)).contains(FlagKey.RECOVERY_NEEDED);
        FlagVerdict allHealthy = verdictFor(verdicts, FlagKey.ALL_HEALTHY);
        assertThat(allHealthy.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(allHealthy.clear().metric()).isEqualTo("other_flags_raised");
    }
}
