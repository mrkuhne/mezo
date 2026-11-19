package io.mrkuhne.mezo.feature.penz.service.money;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;

/**
 * An amount of money in one currency (L4 brief §Money value type). {@code minor} is 1/100 of the
 * major unit for EVERY currency — HUF included (ISO exponent 2: 15 500 Ft = 1_550_000). The
 * currency is an upper-case ISO-4217 code from {@link #SUPPORTED}. Arithmetic is only defined
 * between amounts of the same currency; anything else is a {@code VALIDATION_INVALID_VALUE}
 * domain error on field {@code currency}.
 */
public record Money(long minor, String currency) {

    public static final String HUF = "HUF";
    public static final Set<String> SUPPORTED = Set.of(HUF, "EUR", "USD", "GBP", "CHF");
    private static final int MINOR_EXPONENT = 2;

    public Money {
        if (currency == null || !SUPPORTED.contains(currency)) {
            throw invalidCurrency();
        }
    }

    public static Money of(long minor, String currency) {
        return new Money(minor, currency);
    }

    public static Money huf(long minor) {
        return new Money(minor, HUF);
    }

    /** Major units to minor, rounded half away from zero to a whole minor unit. */
    public static Money ofMajor(BigDecimal major, String currency) {
        return new Money(
            major.movePointRight(MINOR_EXPONENT).setScale(0, RoundingMode.HALF_UP).longValueExact(), currency);
    }

    public BigDecimal major() {
        return BigDecimal.valueOf(minor, MINOR_EXPONENT);
    }

    public boolean isHuf() {
        return HUF.equals(currency);
    }

    public Money plus(Money other) {
        requireSameCurrency(other);
        return new Money(Math.addExact(minor, other.minor), currency);
    }

    public Money minus(Money other) {
        requireSameCurrency(other);
        return new Money(Math.subtractExact(minor, other.minor), currency);
    }

    public Money negate() {
        return new Money(Math.negateExact(minor), currency);
    }

    private void requireSameCurrency(Money other) {
        if (other == null || !currency.equals(other.currency)) {
            throw invalidCurrency();
        }
    }

    private static SystemRuntimeErrorException invalidCurrency() {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "currency").build());
    }
}
