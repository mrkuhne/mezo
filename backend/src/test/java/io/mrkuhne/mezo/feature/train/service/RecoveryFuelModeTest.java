package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;

class RecoveryFuelModeTest {

    @Test
    void testOf_shouldMapEachRecoveryCategory() {
        assertThat(RecoveryFuelMode.of(Reason.ILLNESS)).isEqualTo(RecoveryFuelMode.GUIDANCE);
        assertThat(RecoveryFuelMode.of(Reason.STOMACH)).isEqualTo(RecoveryFuelMode.GUIDANCE);
        assertThat(RecoveryFuelMode.of(Reason.INJURY)).isEqualTo(RecoveryFuelMode.MAINTENANCE);
        assertThat(RecoveryFuelMode.of(Reason.TRAVEL)).isEqualTo(RecoveryFuelMode.ESTIMATE);
        assertThatThrownBy(() -> RecoveryFuelMode.of(Reason.TIRED)).isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testUnjudged_shouldBeTrueOnlyForGuidanceAndEstimate() {
        assertThat(RecoveryFuelMode.GUIDANCE.unjudged()).isTrue();
        assertThat(RecoveryFuelMode.ESTIMATE.unjudged()).isTrue();
        assertThat(RecoveryFuelMode.MAINTENANCE.unjudged()).isFalse();
    }
}
