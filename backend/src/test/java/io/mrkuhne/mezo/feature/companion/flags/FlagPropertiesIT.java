package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagPropertiesIT extends AbstractIntegrationTest {

    @Autowired private FlagProperties properties;

    @Test
    void binds_every_rule_threshold_from_application_yml() {
        assertThat(properties.sweepCron()).isEqualTo("0 5 * * * *");
        assertThat(properties.sustainedStress().threshold()).isEqualTo(7.0);
        assertThat(properties.sustainedStress().windowDays()).isEqualTo(4);
        assertThat(properties.sustainedStress().minDays()).isEqualTo(3);
        assertThat(properties.sleepDebt().nights()).isEqualTo(3);
        assertThat(properties.sleepDebt().minNights()).isEqualTo(2);
        assertThat(properties.sleepDebt().deficitHours()).isEqualTo(3.0);
        assertThat(properties.sleepDebt().defaultGoalHours()).isEqualTo(8.0);
        assertThat(properties.momentum().windowDays()).isEqualTo(3);
        assertThat(properties.momentum().baselineDays()).isEqualTo(14);
        assertThat(properties.momentum().dropRatio()).isEqualTo(0.5);
        assertThat(properties.momentum().minBaseline()).isEqualTo(1.0);
        assertThat(properties.recovery().windowDays()).isEqualTo(2);
        assertThat(properties.recovery().sleepFloorHours()).isEqualTo(6.0);
        assertThat(properties.recovery().rpeThreshold()).isEqualTo(7.0);
        assertThat(properties.recovery().stressThreshold()).isEqualTo(6.0);
        assertThat(properties.allHealthy().quietDays()).isEqualTo(7);
        assertThat(properties.cooldownHours().sustainedStress()).isEqualTo(24);
        assertThat(properties.cooldownHours().sleepDebt()).isEqualTo(24);
        assertThat(properties.cooldownHours().momentumAtRisk()).isEqualTo(48);
        assertThat(properties.cooldownHours().recoveryNeeded()).isEqualTo(24);
        assertThat(properties.cooldownHours().allHealthy()).isEqualTo(168);
    }
}
