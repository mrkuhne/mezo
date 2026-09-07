package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties;
import io.mrkuhne.mezo.feature.companion.reflection.service.HypothesisLifecycle;
import io.mrkuhne.mezo.feature.companion.service.PatternGate;
import org.junit.jupiter.api.Test;

/**
 * Reflexió S2 (mezo-eq85.2): the lifecycle is a PURE function — no Spring, no DB, no LLM. Every
 * transition the nightly pass can make is decided here, so the state machine is testable as
 * arithmetic (the {@code PearsonCorrelation} precedent).
 */
class HypothesisLifecycleTest {

    private final ReflectionProperties.Lifecycle cfg =
            new ReflectionProperties.Lifecycle(3, 3, 30, 0.3, 0.15);

    @Test
    void proposedBecomesMonitoring_onStrongHit() {
        assertThat(HypothesisLifecycle.decide("proposed", PatternGate.Verdict.LIVE, true, 1, 0, 0, 0, 0, cfg))
                .isEqualTo(new HypothesisLifecycle.Decision("monitoring", "monitoring"));
    }

    @Test
    void monitoringBecomesConfirmed_onStreakAndPositiveReply() {
        assertThat(HypothesisLifecycle.decide("monitoring", PatternGate.Verdict.LIVE, true, 3, 0, 1, 0, 0, cfg)
                .newStatus()).isEqualTo("confirmed");
    }

    @Test
    void monitoringStaysMonitoring_onStreakWithoutReply() {
        assertThat(HypothesisLifecycle.decide("monitoring", PatternGate.Verdict.LIVE, true, 3, 0, 0, 0, 0, cfg))
                .isEqualTo(HypothesisLifecycle.Decision.NONE);
    }

    @Test
    void refutedAfterMissStreak() {
        assertThat(HypothesisLifecycle.decide("monitoring", PatternGate.Verdict.LIVE, false, 0, 3, 0, 0, 0, cfg)
                .newStatus()).isEqualTo("refuted");
    }

    @Test
    void refutedAfterTwoNegativeReplies() {
        assertThat(HypothesisLifecycle.decide("proposed", PatternGate.Verdict.FEW_DAYS, false, 0, 0, 0, 2, 0, cfg)
                .newStatus()).isEqualTo("refuted");
    }

    @Test
    void dormantAfterThirtyDaysWithoutData() {
        assertThat(HypothesisLifecycle.decide("monitoring", PatternGate.Verdict.NO_DATA, false, 0, 0, 0, 0, 31, cfg)
                .newStatus()).isEqualTo("dormant");
    }

    @Test
    void dormantRevivesOnData() {
        assertThat(HypothesisLifecycle.decide("dormant", PatternGate.Verdict.FEW_DAYS, false, 0, 0, 0, 0, 0, cfg)
                .newStatus()).isEqualTo("proposed");
    }

    @Test
    void userFrozenNeverMoves() {
        assertThat(HypothesisLifecycle.decide("confirmed", PatternGate.Verdict.LIVE, false, 0, 5, 0, 5, 0, cfg))
                .isEqualTo(HypothesisLifecycle.Decision.NONE);
        assertThat(HypothesisLifecycle.decide("rejected", PatternGate.Verdict.LIVE, true, 5, 0, 5, 0, 0, cfg))
                .isEqualTo(HypothesisLifecycle.Decision.NONE);
    }

    @Test
    void belief_isBoundedAndMonotone() {
        double weak = HypothesisLifecycle.belief(0.1, 0.6, 0, 0, 0, 0, cfg);
        double strong = HypothesisLifecycle.belief(0.6, 0.01, 2, 0, 5, 0, cfg);
        assertThat(weak).isBetween(0.0, 1.0);
        assertThat(strong).isBetween(0.0, 1.0);
        assertThat(strong).isGreaterThan(weak);
        assertThat(HypothesisLifecycle.belief(null, null, 0, 0, 0, 0, cfg)).isEqualTo(0.0);
    }

    @Test
    void keyIsStableAcrossRewording() {
        TestPlanEnvelope a = new TestPlanEnvelope("people:Anna", "sleep-duration-h", 1, "positive", 8, 3, 60);
        TestPlanEnvelope b = new TestPlanEnvelope("people:anna", "sleep-duration-h", 1, "positive", 8, 3, 60);
        assertThat(TestPlanEnvelope.key(a)).isEqualTo(TestPlanEnvelope.key(b)).startsWith("ref-");
    }

    @Test
    void directionMatches_readsTheExpectedSign() {
        TestPlanEnvelope positive = new TestPlanEnvelope("a", "b", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);
        TestPlanEnvelope negative = new TestPlanEnvelope("a", "b", 1, TestPlanEnvelope.DIRECTION_NEGATIVE, 8, 3, 60);
        assertThat(positive.directionMatches(0.5)).isTrue();
        assertThat(positive.directionMatches(-0.5)).isFalse();
        assertThat(negative.directionMatches(-0.5)).isTrue();
        assertThat(negative.directionMatches(0.5)).isFalse();
    }
}
