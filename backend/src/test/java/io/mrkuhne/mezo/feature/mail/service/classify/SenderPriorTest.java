package io.mrkuhne.mezo.feature.mail.service.classify;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** The per-sender prior is pure: smoothed share of "interest" taps, decayed by age, always within -2..+2. */
class SenderPriorTest {

    @Test
    void noTapsMeansNoShift() {
        assertThat(SenderPrior.shift(0, 0, 0.0)).isZero();
    }

    @Test
    void shiftStaysWithinTwoInEitherDirection() {
        assertThat(SenderPrior.shift(10_000, 0, 10_000.0)).isBetween(1.9, 2.0);
        assertThat(SenderPrior.shift(0, 10_000, 10_000.0)).isBetween(-2.0, -1.9);
        assertThat(SenderPrior.shift(1_000_000, 0, 5_000_000.0)).isLessThanOrEqualTo(2.0);
        assertThat(SenderPrior.shift(0, 7, 99.0)).isGreaterThanOrEqualTo(-2.0);
    }

    @Test
    void interestPushesUpAndNopePushesDown() {
        assertThat(SenderPrior.shift(3, 0, 3.0)).isPositive();
        assertThat(SenderPrior.shift(0, 3, 3.0)).isNegative();
        assertThat(SenderPrior.shift(2, 2, 4.0)).isZero();
    }

    @Test
    void smoothingKeepsAFirstTapSmall() {
        // Laplace: one tap is not a verdict
        assertThat(SenderPrior.shift(1, 0, 1.0)).isLessThan(1.0);
        assertThat(SenderPrior.shift(1, 0, 1.0)).isLessThan(SenderPrior.shift(5, 0, 5.0));
    }

    @Test
    void oldTapsDecayTowardZero() {
        double fresh = SenderPrior.shift(4, 0, 4.0);
        double halfAged = SenderPrior.shift(4, 0, 2.0);
        double ancient = SenderPrior.shift(4, 0, 0.01);
        assertThat(halfAged).isLessThan(fresh).isPositive();
        assertThat(ancient).isLessThan(halfAged).isGreaterThanOrEqualTo(0.0);
        assertThat(SenderPrior.shift(0, 4, 2.0)).isGreaterThan(SenderPrior.shift(0, 4, 4.0)).isNegative();
    }

    @Test
    void weightHalvesEveryHalfLife() {
        assertThat(SenderPrior.weight(0, 90)).isEqualTo(1.0);
        assertThat(SenderPrior.weight(90, 90)).isBetween(0.499, 0.501);
        assertThat(SenderPrior.weight(180, 90)).isBetween(0.249, 0.251);
        assertThat(SenderPrior.weight(-5, 90)).isEqualTo(1.0); // a tap "from the future" counts in full
    }
}
