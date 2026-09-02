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

    @Test
    void testSeed_shouldHalveTheValueAsDeviation_whenSeededFromAStaticConstant() {
        assertThat(EwmaEstimator.seed(180)).isEqualTo(new Estimate(180, 90, 0));
    }

    @Test
    void testUpdate_shouldMoveTowardsTheObservation_whenTheObservationIsAccepted() {
        Estimate next = EwmaEstimator.update(EwmaEstimator.seed(180), 220, A, B, K, MIN);
        // deviation: 0.75*90 + 0.25*40 = 77.5 ; value: 0.875*180 + 0.125*220 = 185
        assertThat(next.deviation()).isCloseTo(77.5, within(1e-9));
        assertThat(next.value()).isCloseTo(185.0, within(1e-9));
        assertThat(next.samples()).isEqualTo(1);
    }

    @Test
    void testUpdate_shouldAcceptAnyObservation_whenSampleCountIsBelowTheMinimum() {
        Estimate next = EwmaEstimator.update(EwmaEstimator.seed(180), 5000, A, B, K, MIN);
        assertThat(next.samples()).isEqualTo(1);
        assertThat(next.value()).isGreaterThan(180);
    }

    @Test
    void testUpdate_shouldRejectTheObservation_whenItLiesBeyondKDeviations() {
        Estimate warm = new Estimate(180, 10, 5);           // gate half-width 4*10 = 40
        Estimate next = EwmaEstimator.update(warm, 400, A, B, K, MIN);
        assertThat(next).isEqualTo(warm);                   // dropped, NOT clipped
    }

    @Test
    void testUpdate_shouldAcceptTheObservation_whenItLiesInsideKDeviations() {
        Estimate warm = new Estimate(180, 10, 5);
        assertThat(EwmaEstimator.update(warm, 210, A, B, K, MIN).samples()).isEqualTo(6);
    }

    @Test
    void testUpdate_shouldConverge_whenTheSameObservationRepeats() {
        Estimate e = EwmaEstimator.seed(180);
        for (int i = 0; i < 40; i++) {
            e = EwmaEstimator.update(e, 200, A, B, K, MIN);
        }
        assertThat(e.value()).isCloseTo(200, within(1.0));
    }
}
