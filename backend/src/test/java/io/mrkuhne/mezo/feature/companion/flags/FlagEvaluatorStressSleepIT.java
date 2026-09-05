package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagEvaluatorStressSleepIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private UserPopulator userPopulator;

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

    @Test
    void sustained_stress_raises_at_three_of_the_last_four_days() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 7, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 9, null);

        assertThat(keys(owner)).contains(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void sustained_stress_does_not_raise_at_two_of_four() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 7, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 3, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void sustained_stress_ignores_the_day_just_outside_the_window() {
        // window-days=4 ⇒ window is [today-3, today]; today-4 is one day OUTSIDE it. With only
        // today and today-1 counted, over=2 < minDays(3) — a window widened by one day (from =
        // today.minusDays(windowDays) instead of windowDays - 1) would pull today-4 in, make
        // over=3, and wrongly raise: this assertion is load-bearing on that exact boundary.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(4), "08:00", 4, 9, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void sustained_stress_includes_the_day_just_inside_the_window() {
        // Same shape as the "just outside" case, but the third stressed day is moved one day
        // later, to today-3 — the earliest day still INSIDE the [today-3, today] window. Now
        // over=3 meets minDays(3) and the flag raises. A window narrowed by one day (from =
        // today.minusDays(windowDays - 2)) would drop today-3, leave over=2, and wrongly stay
        // quiet: this assertion is load-bearing on that same boundary from the other side.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(3), "08:00", 4, 9, null);

        assertThat(keys(owner)).contains(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void sustained_stress_averages_the_days_check_ins() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // 9 + 3 = avg 6.0, below the 7.0 threshold — one spike does not make a stressed day
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today, "20:00", 4, 3, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void sleep_debt_raises_when_the_three_night_deficit_reaches_the_threshold() {
        // sleep_log.date is the wake morning, so the window [today-2, today] IS the last three
        // nights (last night's row is dated today).
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15); // 8.0 h
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("6.0"), 3);
        // deficit = 1.5 + 1.5 + 2.0 = 5.0 >= 3.0

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_stays_quiet_just_below_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15);
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("7.1"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.1"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("7.1"), 3);
        // deficit = 0.9 * 3 = 2.7 < 3.0

        assertThat(keys(owner)).doesNotContain(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_never_credits_a_long_night_against_a_short_one() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("4.0"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("11.0"), 3);
        // per-night max(0, deficit): 4.0 + 0.0 = 4.0 >= 3.0 (a surplus night does not repay debt)

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_stays_quiet_below_the_min_nights_gate() {
        UUID owner = ownerId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("3.0"), 3);
        // one logged night only: the other two are UNKNOWN, not zero

        assertThat(keys(owner)).doesNotContain(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_falls_back_to_the_default_goal_without_a_sleep_goal_row() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("6.0"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("6.0"), 3);
        // 8.0 default goal ⇒ deficit 2.0 + 2.0 = 4.0 >= 3.0

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_counts_last_nights_sleep_which_is_logged_this_morning() {
        // sleep_log.date is the WAKE-UP MORNING, not the evening the night began (see
        // HabitEvaluator's sleep_wake_window/bedtime_next_day metrics and SleepLogSheet, which
        // posts date=today on wake) — so the row dated today IS last night, and must count in the
        // window. today's row alone pushes the deficit well past the 3.0 threshold; today-1 and
        // today-2 alone sit far below it. If this raises, today's night was counted.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15); // 8.0 h
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("1.0"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.9"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("7.9"), 3);
        // deficit = 7.0 (today) + 0.1 + 0.1 = 7.2 >= 3.0 — without today's row it would be
        // 0.1 + 0.1 = 0.2 < 3.0, so this assertion is load-bearing on today's row counting.

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_raises_when_the_deficit_lands_exactly_on_the_threshold() {
        // Pins >= rather than > : the cumulative deficit is exactly deficit-hours (3.0), not a
        // hair above it.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15); // 8.0 h
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("7.0"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.0"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("7.0"), 3);
        // deficit = 1.0 + 1.0 + 1.0 = 3.0 == 3.0

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
    }

    @Test
    void the_payload_freezes_the_stress_inputs() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);

        FlagVerdict verdict = evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.SUSTAINED_STRESS.equals(v.flagKey())).findFirst().orElseThrow();

        assertThat(verdict.payload().sustainedStress().threshold()).isEqualTo(7.0);
        assertThat(verdict.payload().sustainedStress().daysOverThreshold()).isEqualTo(3);
        assertThat(verdict.payload().sustainedStress().stressByDay())
            .containsEntry(today.toString(), 8.0)
            .hasSize(3);
    }

    @Test
    void sustained_stress_is_unavailable_with_no_checkin_data() {
        UUID owner = ownerId();

        FlagVerdict verdict = evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.SUSTAINED_STRESS.equals(v.flagKey())).findFirst().orElseThrow();

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason())
            .isEqualTo(io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason.NO_CHECKIN_DATA);
    }

    @Test
    void sustained_stress_is_clear_when_days_over_threshold_is_just_under_min_days() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // minDays=3: only 2 days over threshold — clear, one below the boundary.
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 3, null);

        FlagVerdict verdict = evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.SUSTAINED_STRESS.equals(v.flagKey())).findFirst().orElseThrow();

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("stress_days_over");
        assertThat(verdict.clear().observed()).isLessThan(verdict.clear().threshold());
    }

    @Test
    void sleep_debt_is_clear_when_deficit_is_just_under_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15); // 8.0 h
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("7.1"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.1"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("7.1"), 3);
        // deficit = 0.9 * 3 = 2.7, just under the 3.0 threshold.

        FlagVerdict verdict = evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.SLEEP_DEBT.equals(v.flagKey())).findFirst().orElseThrow();

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("deficit_hours");
        assertThat(verdict.clear().observed()).isLessThan(verdict.clear().threshold());
    }

    @Test
    void sleep_debt_is_unavailable_when_too_few_nights_logged() {
        UUID owner = ownerId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("3.0"), 3);
        // one logged night only, below min-nights.

        FlagVerdict verdict = evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.SLEEP_DEBT.equals(v.flagKey())).findFirst().orElseThrow();

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason())
            .isEqualTo(io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason.NOT_ENOUGH_LOGGED_NIGHTS);
    }
}
