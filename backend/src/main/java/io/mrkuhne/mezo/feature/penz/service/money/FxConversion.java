package io.mrkuhne.mezo.feature.penz.service.money;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * The ONE FX policy, pure half (L4 brief §booking rate): HUF twin = amount × the {@code <CUR>→HUF}
 * reference rate of the transaction's own date, rounded HALF_UP (half away from zero) to a whole
 * minor unit. Finding the rate (frankfurter.dev, the cache, the 7-day fallback) is the caller's
 * job; this class only applies it. HUF→HUF is rate 1 with no fx data.
 */
public final class FxConversion {

    private FxConversion() {
    }

    /** A HUF amount booked as itself — no rate, no rate date. */
    public static BookedAmount huf(Money amount) {
        if (amount == null || !amount.isHuf()) {
            throw invalid("currency");
        }
        return new BookedAmount(amount, amount.minor(), null, null);
    }

    /**
     * Books {@code amount} at {@code hufPerUnit} published for {@code rateDate}. For a HUF amount
     * the rate must be 1 (or null) and the result carries no fx data.
     */
    public static BookedAmount book(Money amount, BigDecimal hufPerUnit, LocalDate rateDate) {
        if (amount == null) {
            throw invalid("amount");
        }
        if (amount.isHuf()) {
            if (hufPerUnit != null && hufPerUnit.compareTo(BigDecimal.ONE) != 0) {
                throw invalid("fxRate");
            }
            return huf(amount);
        }
        if (hufPerUnit == null || hufPerUnit.signum() <= 0) {
            throw invalid("fxRate");
        }
        if (rateDate == null) {
            throw invalid("fxRateDate");
        }
        return new BookedAmount(amount, toHufMinor(amount.minor(), hufPerUnit), rateDate, hufPerUnit);
    }

    /** Minor units of a foreign currency to HUF minor units, rounded half away from zero. */
    public static long toHufMinor(long amountMinor, BigDecimal hufPerUnit) {
        return BigDecimal.valueOf(amountMinor).multiply(hufPerUnit)
            .setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    private static SystemRuntimeErrorException invalid(String field) {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", field).build());
    }
}
