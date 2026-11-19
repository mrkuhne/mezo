package io.mrkuhne.mezo.feature.penz.service.money;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * Mirrors the old app's {@code src/domain/money.test.ts} ("converts to HUF minor, rounding half
 * away from zero" — {@code toHufMinor}) plus the booking-rate rules of the L4 brief: HALF_UP to a
 * whole minor unit, HUF→HUF is rate 1 with no fx data, the rate and its date are kept.
 */
class PenzFxConversionTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 6);

    // money.test.ts > converts to HUF minor, rounding half away from zero
    @Test
    void convertsToHufMinorRoundingHalfAwayFromZero() {
        assertThat(FxConversion.toHufMinor(1_000, new BigDecimal("395.5"))).isEqualTo(395_500L);
        assertThat(FxConversion.toHufMinor(-1_000, new BigDecimal("395.5"))).isEqualTo(-395_500L);
        assertThat(FxConversion.toHufMinor(1, new BigDecimal("0.5"))).isEqualTo(1L);
        assertThat(FxConversion.toHufMinor(-1, new BigDecimal("0.5"))).isEqualTo(-1L);
    }

    @Test
    void book_foreignAmount_keepsOriginalAndRateAndRoundsTheTwin() {
        Money eur = Money.of(2_53, "EUR");
        BookedAmount b = FxConversion.book(eur, new BigDecimal("395.12345678"), DAY);
        assertThat(b.amount()).isEqualTo(eur);
        // 253 × 395.12345678 = 99 966.23456… → 99 966
        assertThat(b.hufMinor()).isEqualTo(99_966L);
        assertThat(b.rate()).isEqualByComparingTo("395.12345678");
        assertThat(b.rateDate()).isEqualTo(DAY);
        assertThat(b.converted()).isTrue();
    }

    @Test
    void book_hufIsRateOneWithoutFxData() {
        BookedAmount b = FxConversion.book(Money.huf(1_550_000), BigDecimal.ONE, DAY);
        assertThat(b.hufMinor()).isEqualTo(1_550_000L);
        assertThat(b.rate()).isNull();
        assertThat(b.rateDate()).isNull();
        assertThat(b.converted()).isFalse();
        assertThat(FxConversion.huf(Money.huf(42))).isEqualTo(new BookedAmount(Money.huf(42), 42, null, null));
    }

    @Test
    void book_rejectsMissingOrNonPositiveRateAndMissingDate() {
        Money usd = Money.of(1_000, "USD");
        assertThatThrownBy(() -> FxConversion.book(usd, null, DAY)).isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> FxConversion.book(usd, BigDecimal.ZERO, DAY)).isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> FxConversion.book(usd, new BigDecimal("-1"), DAY)).isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> FxConversion.book(usd, BigDecimal.TEN, null)).isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> FxConversion.book(Money.huf(1), new BigDecimal("2"), DAY))
            .isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> FxConversion.huf(usd)).isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void bookedAmount_rejectsAnInconsistentHufTwin() {
        assertThatThrownBy(() -> new BookedAmount(Money.huf(100), 99, null, null))
            .isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> new BookedAmount(Money.of(100, "EUR"), 40_000, null, null))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
