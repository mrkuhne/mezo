package io.mrkuhne.mezo.feature.habit.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** D3: wake_on_time / bed_on_time center on the SLEEP goal via SleepAnchorPort, not the weight goal. */
@Transactional
class HabitTargetsSleepIT extends AbstractIntegrationTest {

    @Autowired
    private HabitTargets habitTargets;

    @Autowired
    private DatabasePopulator databasePopulator;

    @Autowired
    private SleepGoalPopulator sleepGoalPopulator;

    @Test
    void testResolve_shouldDeriveFromSleepGoal_whenGoalRowExists() {
        UUID owner = databasePopulator.populateUser("habit-sleep@test.local");
        sleepGoalPopulator.goal(owner, 450, "WAKE", "06:45", 15);

        HabitTargets.Resolved resolved = habitTargets.resolve(owner);

        assertThat(resolved.wake()).isEqualTo(LocalTime.of(6, 45));
        assertThat(resolved.bed()).isEqualTo(LocalTime.of(23, 15));
    }

    @Test
    void testResolve_shouldReturnConfigGhost_whenNoSleepGoal() {
        UUID owner = databasePopulator.populateUser("habit-ghost@test.local");

        HabitTargets.Resolved resolved = habitTargets.resolve(owner);

        assertThat(resolved.wake()).isEqualTo(LocalTime.of(6, 0));
        assertThat(resolved.bed()).isEqualTo(LocalTime.of(22, 0)); // ghost WAKE 06:00 − 480
    }
}
