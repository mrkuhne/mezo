package io.mrkuhne.mezo.feature.penz.service.money;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * An amount as booked: the original-currency {@link Money} plus its HUF twin, computed ONCE at
 * write time with the booking rate and stored (never re-derived). For a HUF amount the twin
 * equals the amount and {@code rate}/{@code rateDate} are null (the fx columns stay null); for a
 * foreign amount both are present. Build it through {@link FxConversion}.
 */
public record BookedAmount(Money amount, long hufMinor, LocalDate rateDate, BigDecimal rate) {

    public BookedAmount {
        if (amount == null) {
            throw invalid("amount");
        }
        if (amount.isHuf()) {
            if (hufMinor != amount.minor() || rate != null || rateDate != null) {
                throw invalid("amountHufMinor");
            }
        } else if (rate == null || rateDate == null || rate.signum() <= 0) {
            throw invalid("fxRate");
        }
    }

    /** True when a currency conversion happened (the fx columns are filled). */
    public boolean converted() {
        return rate != null;
    }

    private static SystemRuntimeErrorException invalid(String field) {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", field).build());
    }
}
