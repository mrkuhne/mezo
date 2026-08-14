package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;

/**
 * The three CALENDAR periods every usage read is cut on (mezo-uakh) — start of today, of this ISO
 * week (Monday) and of this month, in the configured report zone. They NEST: everything in DAY is
 * also in WEEK and MONTH.
 *
 * <p>Parsing lives here rather than on a generated enum because the contract carries {@code period}
 * as a pattern-validated string: a bad enum query parameter would otherwise reach Spring's type
 * conversion, which this app has no handler for and would answer with 500 (bd mezo-x0nb).
 */
public enum UsagePeriod {

    DAY,
    WEEK,
    MONTH;

    /** The first day the period covers, in {@code zone}. */
    public LocalDate startDate(ZoneId zone) {
        LocalDate today = LocalDate.now(zone);
        return switch (this) {
            case DAY -> today;
            case WEEK -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> today.withDayOfMonth(1);
        };
    }

    /** Case-sensitive by contract; anything else is a client error, not a server one. */
    public static UsagePeriod parse(String raw) {
        for (UsagePeriod period : values()) {
            if (period.name().equals(raw)) {
                return period;
            }
        }
        throw new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "period").build());
    }
}
