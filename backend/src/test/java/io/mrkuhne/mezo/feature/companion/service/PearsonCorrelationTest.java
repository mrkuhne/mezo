package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

/** Pure math fixtures — known r/p values, degenerate inputs (no Spring, no DB). */
class PearsonCorrelationTest {

    @Test
    void testCorrelate_shouldReturnPerfectCorrelation_whenLinear() {
        var result = PearsonCorrelation.correlate(
                new double[] {1, 2, 3, 4, 5}, new double[] {2, 4, 6, 8, 10}).orElseThrow();

        assertThat(result.r()).isCloseTo(1.0, within(1e-9));
        assertThat(result.n()).isEqualTo(5);
        assertThat(result.p()).isLessThan(1e-6);
    }

    @Test
    void testCorrelate_shouldMatchKnownFixture_whenModeratelyCorrelated() {
        // scipy.stats.pearsonr([1,2,3,4,5],[2,1,4,3,6]) → r=0.8221, p=0.0885
        var result = PearsonCorrelation.correlate(
                new double[] {1, 2, 3, 4, 5}, new double[] {2, 1, 4, 3, 6}).orElseThrow();

        assertThat(result.r()).isCloseTo(0.8221, within(1e-3));
        assertThat(result.p()).isCloseTo(0.0885, within(5e-3));
    }

    @Test
    void testCorrelate_shouldReturnNegativeR_whenInverse() {
        var result = PearsonCorrelation.correlate(
                new double[] {1, 2, 3, 4, 5, 6}, new double[] {9, 8, 6, 5, 3, 1}).orElseThrow();

        assertThat(result.r()).isLessThan(-0.9);
    }

    @Test
    void testCorrelate_shouldBeEmpty_whenSeriesConstant() {
        assertThat(PearsonCorrelation.correlate(
                new double[] {3, 3, 3, 3}, new double[] {1, 2, 3, 4})).isEmpty();
    }

    @Test
    void testCorrelate_shouldBeEmpty_whenTooFewSamples() {
        assertThat(PearsonCorrelation.correlate(new double[] {1, 2}, new double[] {2, 1})).isEmpty();
    }
}
