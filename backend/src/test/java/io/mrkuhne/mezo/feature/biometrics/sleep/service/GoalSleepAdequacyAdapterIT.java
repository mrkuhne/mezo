package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Same deficit math as companion's {@code FlagEvaluator.sleepDebt} (see that method's comments),
 * reimplemented independently over the adaptive-review's 7-night window (mezo.goal.adaptive),
 * with no dependency on companion (which may be switched off).
 */
@Transactional
class GoalSleepAdequacyAdapterIT extends AbstractIntegrationTest {

    @Autowired private GoalSleepAdequacyAdapter adapter;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    private UUID userId;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        userId = databasePopulator.populateUser("sleep-adequacy@test.local");
        today = LocalDate.of(2026, 6, 24);
    }

    @Test
    void debtAccumulatesAgainstTheSleepGoal() {
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15); // 8.0 h target
        // 5 logged nights of 6.5 h over the last 7 → deficit 5×1.5 = 7.5 h ≥ 5.0 → debted.
        for (int i = 0; i < 5; i++) {
            sleepLogPopulator.createSleepLog(userId, today.minusDays(i), new BigDecimal("6.5"), 7);
        }

        assertThat(adapter.sleepDebted(userId, today)).isTrue();
    }

    @Test
    void smallSampleNeverFlags() {
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15);
        sleepLogPopulator.createSleepLog(userId, today, new BigDecimal("4.0"), 5); // huge deficit but only 1 night < minNights 4

        assertThat(adapter.sleepDebted(userId, today)).isFalse();
    }

    @Test
    void adequateSleepIsNotDebt() {
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15);
        for (int i = 0; i < 7; i++) {
            sleepLogPopulator.createSleepLog(userId, today.minusDays(i), new BigDecimal("8.0"), 8);
        }

        assertThat(adapter.sleepDebted(userId, today)).isFalse();
    }

    @Test
    void noSleepGoalFallsBackToDefaultEightHours() {
        // No sleep_goal row → DEFAULT_GOAL_HOURS 8.0. 5 nights of 6.5h → same 7.5h deficit as above.
        for (int i = 0; i < 5; i++) {
            sleepLogPopulator.createSleepLog(userId, today.minusDays(i), new BigDecimal("6.5"), 7);
        }

        assertThat(adapter.sleepDebted(userId, today)).isTrue();
    }

    @Test
    void scopesToOwner() {
        UUID other = databasePopulator.populateUser("sleep-adequacy-other@test.local");
        sleepGoalPopulator.goal(other, 480, "WAKE", "06:45", 15);
        for (int i = 0; i < 5; i++) {
            sleepLogPopulator.createSleepLog(other, today.minusDays(i), new BigDecimal("6.5"), 7);
        }

        assertThat(adapter.sleepDebted(userId, today)).isFalse();
    }
}
