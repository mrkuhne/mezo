package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
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
        return evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList();
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
    void sustained_stress_ignores_days_outside_the_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(4), "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(5), "08:00", 4, 9, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.SUSTAINED_STRESS);
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
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15); // 8.0 h
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(3), new BigDecimal("6.0"), 3);
        // deficit = 1.5 + 1.5 + 2.0 = 5.0 >= 3.0

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_stays_quiet_just_below_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.1"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("7.1"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(3), new BigDecimal("7.1"), 3);
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
    void the_payload_freezes_the_stress_inputs() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);

        FlagRaise raise = evaluator.evaluate(owner).stream()
            .filter(r -> FlagKey.SUSTAINED_STRESS.equals(r.flagKey())).findFirst().orElseThrow();

        assertThat(raise.payload().sustainedStress().threshold()).isEqualTo(7.0);
        assertThat(raise.payload().sustainedStress().daysOverThreshold()).isEqualTo(3);
        assertThat(raise.payload().sustainedStress().stressByDay())
            .containsEntry(today.toString(), 8.0)
            .hasSize(3);
    }
}
