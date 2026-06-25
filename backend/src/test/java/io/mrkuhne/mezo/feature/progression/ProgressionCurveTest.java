package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
import org.junit.jupiter.api.Test;

class ProgressionCurveTest {

    // Pure logic: no Spring context. Defaults base=100, exp=1.6.
    private final ProgressionCurve curve =
        new ProgressionCurve(new ProgressionProperties(new ProgressionProperties.Curve(100, 1.6)));

    @Test
    void testXpThreshold_shouldFollowGrowingCurve_whenComputedPerLevel() {
        assertThat(curve.xpThreshold(1)).isZero();
        assertThat(curve.xpThreshold(2)).isEqualTo(100L);
        assertThat(curve.xpThreshold(3)).isEqualTo(303L);
        assertThat(curve.xpThreshold(4)).isEqualTo(580L);
        assertThat(curve.xpThreshold(5)).isEqualTo(919L);
    }

    @Test
    void testLevelFor_shouldReturnHighestReachedLevel_whenGivenCumulativeXp() {
        assertThat(curve.levelFor(0L)).isEqualTo(1);
        assertThat(curve.levelFor(99L)).isEqualTo(1);
        assertThat(curve.levelFor(100L)).isEqualTo(2);
        assertThat(curve.levelFor(302L)).isEqualTo(2);
        assertThat(curve.levelFor(303L)).isEqualTo(3);
        assertThat(curve.levelFor(1000L)).isEqualTo(5);
    }

    @Test
    void testProgressPct_shouldReturnWithinLevelFill_whenPartwayThroughBand() {
        // level 2 band is [100, 303); 200 is 100/203 of the way
        assertThat(curve.progressPct(200L, 2)).isCloseTo(49.26, within(0.1));
        assertThat(curve.progressPct(100L, 2)).isCloseTo(0.0, within(0.01));
    }

    @Test
    void testProgressPct_shouldClampToHundred_whenAtOrBeyondNextThreshold() {
        assertThat(curve.progressPct(303L, 2)).isEqualTo(100.0);
    }

    @Test
    void testProgressPct_shouldStayBounded_whenAtTheMaxLevelCeiling() {
        // At the safety cap (200) the band stays non-degenerate for this strictly-increasing
        // curve, so the divide-by-zero guard returns the normal in-band fill — exercise that the
        // ceiling level evaluates safely and the result is bounded 0..100.
        double pct = curve.progressPct(curve.xpThreshold(200), 200);
        assertThat(pct).isBetween(0.0, 100.0);
    }

    @Test
    void testLevelFor_shouldCapAtMaxLevel_whenCumulativeXpIsEffectivelyUnbounded() {
        assertThat(curve.levelFor(Long.MAX_VALUE)).isEqualTo(200);
    }

    @Test
    void testXpThreshold_shouldReturnZero_whenLevelIsOneOrBelow() {
        assertThat(curve.xpThreshold(1)).isZero();
        assertThat(curve.xpThreshold(0)).isZero();
    }
}
