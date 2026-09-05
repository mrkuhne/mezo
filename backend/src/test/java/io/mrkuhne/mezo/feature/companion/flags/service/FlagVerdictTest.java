package io.mrkuhne.mezo.feature.companion.flags.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;

/** The verdict is the rule's ONLY return type, so its invariants are what stop a half-filled
 *  verdict (raised with no payload, clear with a reason) from reaching the trace. */
class FlagVerdictTest {

    @Test
    void testRaised_shouldCarryPayloadOnly() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.allHealthy(
            new FlagPayloadEnvelope.AllHealthy(7, 5));

        FlagVerdict v = FlagVerdict.raised(FlagKey.ALL_HEALTHY, payload);

        assertThat(v.outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(v.flagKey()).isEqualTo(FlagKey.ALL_HEALTHY);
        assertThat(v.payload()).isSameAs(payload);
        assertThat(v.reason()).isNull();
        assertThat(v.clear()).isNull();
    }

    @Test
    void testClear_shouldCarryEvidenceOnly() {
        FlagVerdict v = FlagVerdict.clear(FlagKey.SLEEP_DEBT,
            new FlagVerdict.ClearEvidence("deficit_hours", 1.2, 6.0, null));

        assertThat(v.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(v.clear().metric()).isEqualTo("deficit_hours");
        assertThat(v.clear().observed()).isEqualTo(1.2);
        assertThat(v.clear().threshold()).isEqualTo(6.0);
        assertThat(v.payload()).isNull();
        assertThat(v.reason()).isNull();
    }

    @Test
    void testClear_shouldAllowNonNumericEvidence() {
        // Not every "checked and fine" is a number: rapid_weight_loss clears because the goal
        // trajectory IS a cut, joint_overuse because tomorrow trains a different muscle.
        FlagVerdict v = FlagVerdict.clear(FlagKey.RAPID_WEIGHT_LOSS,
            new FlagVerdict.ClearEvidence("trajectory", null, null, "cut"));

        assertThat(v.clear().detail()).isEqualTo("cut");
        assertThat(v.clear().observed()).isNull();
    }

    @Test
    void testUnavailable_shouldCarryReasonOnly() {
        FlagVerdict v = FlagVerdict.unavailable(
            FlagKey.RAPID_WEIGHT_LOSS, UnavailableReason.NO_ACTIVE_GOAL);

        assertThat(v.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(v.reason()).isEqualTo(UnavailableReason.NO_ACTIVE_GOAL);
        assertThat(v.payload()).isNull();
        assertThat(v.clear()).isNull();
    }

    @Test
    void testRaised_shouldRejectNullPayload() {
        assertThatThrownBy(() -> FlagVerdict.raised(FlagKey.SLEEP_DEBT, null))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testClear_shouldRejectNullEvidence() {
        assertThatThrownBy(() -> FlagVerdict.clear(FlagKey.SLEEP_DEBT, null))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testUnavailable_shouldRejectNullReason() {
        assertThatThrownBy(() -> FlagVerdict.unavailable(FlagKey.SLEEP_DEBT, null))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
