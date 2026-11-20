package io.mrkuhne.mezo.feature.penz.service.practice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.penz.service.practice.PaperTradeMath.Direction;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** L7 build notes call 4: R, risk, P/L long and short, the stop side. Figures invented. */
class PenzPaperTradeMathTest {

    private static final BigDecimal TEN = new BigDecimal("10");

    @Test
    void testDirection_shouldParseWireValue_whenKnown() {
        assertThat(Direction.of("long")).isEqualTo(Direction.LONG);
        assertThat(Direction.of("short")).isEqualTo(Direction.SHORT);
        assertThat(Direction.SHORT.wire()).isEqualTo("short");
        assertThatThrownBy(() -> Direction.of("sideways")).isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testValidStop_shouldRequireStopBelowEntryForLongAndAboveForShort() {
        assertThat(PaperTradeMath.validStop(Direction.LONG, 10_000, 9_500)).isTrue();
        assertThat(PaperTradeMath.validStop(Direction.LONG, 10_000, 10_000)).isFalse();
        assertThat(PaperTradeMath.validStop(Direction.LONG, 10_000, 10_500)).isFalse();
        assertThat(PaperTradeMath.validStop(Direction.SHORT, 10_000, 10_500)).isTrue();
        assertThat(PaperTradeMath.validStop(Direction.SHORT, 10_000, 9_500)).isFalse();
    }

    @Test
    void testRisk_shouldBeDistanceToStopTimesQuantity_whenEitherDirection() {
        assertThat(PaperTradeMath.riskMinor(10_000, 9_500, TEN)).isEqualTo(5_000);
        assertThat(PaperTradeMath.riskMinor(10_000, 10_500, TEN)).isEqualTo(5_000);
        // fractional quantity rounds HALF_UP to a whole minor unit
        assertThat(PaperTradeMath.riskMinor(10_000, 9_999, new BigDecimal("0.5"))).isEqualTo(1);
    }

    @Test
    void testCost_shouldBeEntryTimesQuantity() {
        assertThat(PaperTradeMath.costMinor(12_345, new BigDecimal("3"))).isEqualTo(37_035);
        assertThat(PaperTradeMath.costMinor(10_001, new BigDecimal("0.5"))).isEqualTo(5_001);
    }

    @Test
    void testPnl_shouldBeSignedByDirection() {
        assertThat(PaperTradeMath.pnlMinor(Direction.LONG, 10_000, 10_950, TEN)).isEqualTo(9_500);
        assertThat(PaperTradeMath.pnlMinor(Direction.LONG, 10_000, 9_500, TEN)).isEqualTo(-5_000);
        assertThat(PaperTradeMath.pnlMinor(Direction.SHORT, 10_000, 9_500, TEN)).isEqualTo(5_000);
        assertThat(PaperTradeMath.pnlMinor(Direction.SHORT, 10_000, 10_200, TEN)).isEqualTo(-2_000);
    }

    @Test
    void testRMultiple_shouldBePnlOverRisk_roundedToTwoDecimals() {
        // the spike's info text: risked 2 000, made 3 800 -> +1,9R
        assertThat(PaperTradeMath.rMultiple(Direction.LONG, 10_000, 9_800, 10_380)).isEqualByComparingTo("1.90");
        assertThat(PaperTradeMath.rMultiple(Direction.LONG, 10_000, 9_500, 9_500)).isEqualByComparingTo("-1.00");
        assertThat(PaperTradeMath.rMultiple(Direction.SHORT, 10_000, 10_300, 10_510)).isEqualByComparingTo("-1.70");
        assertThat(PaperTradeMath.rMultiple(Direction.SHORT, 10_000, 10_300, 9_900)).isEqualByComparingTo("0.33");
        // 1/3 + rounding HALF_UP: 0.335 -> 0.34
        assertThat(PaperTradeMath.rMultiple(Direction.LONG, 10_000, 9_800, 10_067)).isEqualByComparingTo("0.34");
        assertThat(PaperTradeMath.rMultiple(Direction.LONG, 10_000, 10_000, 10_100)).isNull();
    }

    @Test
    void testStopRespected_shouldBeFalseOnlyWhenExitWentBeyondTheStop() {
        assertThat(PaperTradeMath.stopRespected(Direction.LONG, 9_500, 9_500)).isTrue();
        assertThat(PaperTradeMath.stopRespected(Direction.LONG, 9_500, 9_400)).isFalse();
        assertThat(PaperTradeMath.stopRespected(Direction.LONG, 9_500, 11_000)).isTrue();
        assertThat(PaperTradeMath.stopRespected(Direction.SHORT, 10_500, 10_600)).isFalse();
        assertThat(PaperTradeMath.stopRespected(Direction.SHORT, 10_500, 10_500)).isTrue();
    }
}
