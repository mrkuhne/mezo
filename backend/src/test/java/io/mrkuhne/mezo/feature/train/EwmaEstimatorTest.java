package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.train.service.EwmaEstimator;
import io.mrkuhne.mezo.feature.train.service.EwmaEstimator.Estimate;
import org.junit.jupiter.api.Test;

class EwmaEstimatorTest {

    private static final double A = 0.125;
    private static final double B = 0.25;
    private static final double K = 4;
    private static final int MIN = 3;
    // Below every deviation this test file constructs by hand (10, seed-halves) so it never
    // engages unless a test EXPLICITLY drives deviation down near/below it.
    private static final double FLOOR = 1.0;

    @Test
    void testSeed_shouldHalveTheValueAsDeviation_whenSeededFromAStaticConstant() {
        assertThat(EwmaEstimator.seed(180)).isEqualTo(new Estimate(180, 90, 0));
    }

    @Test
    void testUpdate_shouldMoveTowardsTheObservation_whenTheObservationIsAccepted() {
        Estimate next = EwmaEstimator.update(EwmaEstimator.seed(180), 220, A, B, K, MIN, FLOOR);
        // deviation: 0.75*90 + 0.25*40 = 77.5 ; value: 0.875*180 + 0.125*220 = 185
        assertThat(next.deviation()).isCloseTo(77.5, within(1e-9));
        assertThat(next.value()).isCloseTo(185.0, within(1e-9));
        assertThat(next.samples()).isEqualTo(1);
    }

    @Test
    void testUpdate_shouldAcceptAnyObservation_whenSampleCountIsBelowTheMinimum() {
        Estimate next = EwmaEstimator.update(EwmaEstimator.seed(180), 5000, A, B, K, MIN, FLOOR);
        assertThat(next.samples()).isEqualTo(1);
        assertThat(next.value()).isGreaterThan(180);
    }

    @Test
    void testUpdate_shouldRejectTheObservation_whenItLiesBeyondKDeviations() {
        Estimate warm = new Estimate(180, 10, 5);           // gate half-width 4*10 = 40
        Estimate next = EwmaEstimator.update(warm, 400, A, B, K, MIN, FLOOR);
        assertThat(next).isEqualTo(warm);                   // dropped, NOT clipped
    }

    @Test
    void testUpdate_shouldAcceptTheObservation_whenItLiesInsideKDeviations() {
        Estimate warm = new Estimate(180, 10, 5);
        assertThat(EwmaEstimator.update(warm, 210, A, B, K, MIN, FLOOR).samples()).isEqualTo(6);
    }

    @Test
    void testUpdate_shouldConverge_whenTheSameObservationRepeats() {
        Estimate e = EwmaEstimator.seed(180);
        for (int i = 0; i < 40; i++) {
            e = EwmaEstimator.update(e, 200, A, B, K, MIN, FLOOR);
        }
        assertThat(e.value()).isCloseTo(200, within(1.0));
    }

    /**
     * The regression the granularity floor exists to prevent (spec 2026-09-02, mezo-dzbm review
     * of Task 8): without a floor, a user with very consistent pacing converges {@code deviation}
     * toward 0, and once {@code samples >= minSamples} the gate {@code outlierK * deviation}
     * collapses to ~0 too — rejecting EVERY subsequent observation and silently freezing the
     * estimate forever, even a genuine, small, real shift in pacing. Here deviation is driven far
     * below the 20s floor (down to ~0.0000...), and an observation 15s off (inside
     * {@code outlierK * floor} = 4*20 = 80, but WAY outside {@code outlierK * 0.0000...}) must
     * still be accepted.
     */
    @Test
    void testUpdate_shouldAcceptAnObservationInsideTheFloor_whenDeviationHasConvergedNearZero() {
        double minDeviationSeconds = 20;
        Estimate e = EwmaEstimator.seed(180);
        // Converge hard on 180 with the SAME value every time: deviation -> ~0.
        for (int i = 0; i < 200; i++) {
            e = EwmaEstimator.update(e, 180, A, B, K, MIN, minDeviationSeconds);
        }
        assertThat(e.deviation()).isLessThan(0.01); // converged, unfloored deviation is near-zero
        assertThat(e.samples()).isGreaterThanOrEqualTo(MIN);

        // 15s off from 180: inside outlierK * floor (4*20=80), but would be rejected by an
        // unfloored gate (outlierK * ~0 ~= 0) — this is exactly the freeze the floor prevents.
        Estimate next = EwmaEstimator.update(e, 195, A, B, K, MIN, minDeviationSeconds);
        assertThat(next.samples()).isEqualTo(e.samples() + 1); // accepted, not dropped
        assertThat(next.value()).isNotEqualTo(e.value());      // the estimate actually moved
    }

    /**
     * The floor widens the gate but does not remove it: an observation far outside
     * {@code outlierK * minDeviationSeconds} is still a genuine outlier and must still be
     * dropped, even from a converged (near-zero deviation) estimate.
     */
    @Test
    void testUpdate_shouldStillRejectAFarOutlier_whenDeviationHasConvergedNearZero() {
        double minDeviationSeconds = 20;
        Estimate e = EwmaEstimator.seed(180);
        for (int i = 0; i < 200; i++) {
            e = EwmaEstimator.update(e, 180, A, B, K, MIN, minDeviationSeconds);
        }
        assertThat(e.deviation()).isLessThan(0.01);

        // outlierK * floor = 4*20 = 80 -> gate window is [100, 260]; 400 is far outside it.
        Estimate next = EwmaEstimator.update(e, 400, A, B, K, MIN, minDeviationSeconds);
        assertThat(next).isEqualTo(e); // dropped, not accepted
    }
}
