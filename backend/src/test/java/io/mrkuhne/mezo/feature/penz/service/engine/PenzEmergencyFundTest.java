package io.mrkuhne.mezo.feature.penz.service.engine;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Mirrors the emergency-fund part of the old app's {@code src/domain/savings.test.ts}
 * ("months covered", "months to reach") 1:1, plus {@code emergencyTargetMinor} (untested in the
 * old suite). The four {@code allocateGoals} cases are NOT ported: savings goals are out of L4.
 */
class PenzEmergencyFundTest {

    @Test
    void emergencyTargetIsMonthsTimesAverageExpenses() {
        assertThat(EmergencyFund.targetMinor(6, 38_000_000)).isEqualTo(228_000_000L);
        assertThat(EmergencyFund.targetMinor(0, 38_000_000)).isZero();
    }

    // savings.test.ts > monthsCovered / monthsToReach > months covered
    @Test
    void monthsCovered() {
        assertThat(EmergencyFund.monthsCovered(124_000_000, 38_000_000)).hasValue(3.3);
        assertThat(EmergencyFund.monthsCovered(1, 0)).isEmpty();
    }

    // savings.test.ts > monthsCovered / monthsToReach > months to reach
    @Test
    void monthsToReach() {
        assertThat(EmergencyFund.monthsToReach(104_000_000, 10_000_000)).hasValue(11);
        assertThat(EmergencyFund.monthsToReach(0, 1)).hasValue(0);
        assertThat(EmergencyFund.monthsToReach(5, 0)).isEmpty();
    }
}
