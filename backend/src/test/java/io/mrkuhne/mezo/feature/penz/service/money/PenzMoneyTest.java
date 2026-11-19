package io.mrkuhne.mezo.feature.penz.service.money;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * Mirrors the old app's {@code src/domain/money.test.ts} ("converts major to minor and back");
 * the formatMoney cases are display concerns of the client and are not ported. The
 * {@code toHufMinor} case lives in {@link PenzFxConversionTest}. The rest pins the new
 * {@link Money} value-type rules (currency set, same-currency arithmetic).
 */
class PenzMoneyTest {

    // money.test.ts > converts major to minor and back
    @Test
    void convertsMajorToMinorAndBack() {
        assertThat(Money.ofMajor(new BigDecimal("285000"), "HUF").minor()).isEqualTo(28_500_000L);
        assertThat(Money.huf(28_500_000L).major()).isEqualByComparingTo("285000");
    }

    @Test
    void ofMajor_roundsHalfAwayFromZeroToWholeMinorUnit() {
        assertThat(Money.ofMajor(new BigDecimal("10.505"), "EUR").minor()).isEqualTo(1051L);
        assertThat(Money.ofMajor(new BigDecimal("-10.505"), "EUR").minor()).isEqualTo(-1051L);
    }

    @Test
    void acceptsTheFiveCurrencies() {
        for (String c : new String[] {"HUF", "EUR", "USD", "GBP", "CHF"}) {
            assertThat(Money.of(100, c).currency()).isEqualTo(c);
        }
    }

    @Test
    void rejectsUnknownLowerCaseOrMissingCurrency() {
        assertThatThrownBy(() -> Money.of(100, "JPY")).isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> Money.of(100, "eur")).isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> Money.of(100, null)).isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void arithmeticWithinOneCurrency() {
        assertThat(Money.huf(1_550_000).plus(Money.huf(50_000))).isEqualTo(Money.huf(1_600_000));
        assertThat(Money.of(1_000, "EUR").minus(Money.of(250, "EUR"))).isEqualTo(Money.of(750, "EUR"));
        assertThat(Money.of(1_000, "EUR").negate()).isEqualTo(Money.of(-1_000, "EUR"));
        assertThat(Money.huf(1).isHuf()).isTrue();
        assertThat(Money.of(1, "USD").isHuf()).isFalse();
    }

    @Test
    void arithmeticAcrossCurrenciesIsRejected() {
        assertThatThrownBy(() -> Money.huf(100).plus(Money.of(100, "EUR")))
            .isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> Money.huf(100).minus(Money.of(100, "EUR")))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
