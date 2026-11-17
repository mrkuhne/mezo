package io.mrkuhne.mezo.feature.goal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.EnergyBalancePort;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Train's deficit question, answered from the active goal's direction (volume engine v2, spec §6.4). */
class EnergyBalanceAdapterIT extends AbstractIntegrationTest {

    @Autowired EnergyBalancePort port;
    @Autowired GoalPopulator goals;
    @Autowired DatabasePopulator databasePopulator;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("energy@test.local");
    }

    @Test
    void aCuttingGoalIsADeficit() {
        goals.createGoal(owner, "cut", "active");

        assertThat(port.isInDeficit(owner, LocalDate.now())).isTrue();
    }

    @Test
    void noGoalIsNotADeficit() {
        assertThat(port.isInDeficit(owner, LocalDate.now())).isFalse();
    }

    @Test
    void aGainingGoalIsNotADeficit() {
        goals.createGoal(owner, "bulk", "active");

        assertThat(port.isInDeficit(owner, LocalDate.now())).isFalse();
    }

    @Test
    void aMaintainGoalIsNotADeficit() {
        goals.createGoal(owner, "maintain", "active");

        assertThat(port.isInDeficit(owner, LocalDate.now())).isFalse();
    }

    @Test
    void aCuttingGoalThatIsNotActiveIsNotADeficit() {
        goals.createGoal(owner, "cut", "planned");
        goals.createGoal(owner, "cut", "archived");

        assertThat(port.isInDeficit(owner, LocalDate.now())).isFalse();
    }
}
