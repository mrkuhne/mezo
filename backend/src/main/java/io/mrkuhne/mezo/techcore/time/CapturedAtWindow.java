package io.mrkuhne.mezo.techcore.time;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;

/**
 * The accepted window of a phone-supplied {@code capturedAt} (Boop B4, mezo-r36n9.14; same limits as B3's
 * check-in / day close): not more than {@link #MAX_AHEAD} in the future (a phone clock may run slightly ahead)
 * and not older than today - {@link #MAX_PAST_DAYS} in the OWNER zone. Anything else is the 400 field error on
 * {@code capturedAt}.
 */
public final class CapturedAtWindow {

    public static final int MAX_PAST_DAYS = 7;
    public static final Duration MAX_AHEAD = Duration.ofMinutes(5);

    private CapturedAtWindow() {
    }

    /** Validates {@code capturedAt} and returns it for chaining; {@code ownerZone} dates "today" for the lower bound. */
    public static OffsetDateTime require(OffsetDateTime capturedAt, ZoneId ownerZone, Clock clock) {
        Instant now = clock.instant();
        LocalDate oldestDay = LocalDate.now(clock.withZone(ownerZone)).minusDays(MAX_PAST_DAYS);
        if (capturedAt.toInstant().isAfter(now.plus(MAX_AHEAD))
            || capturedAt.toInstant().atZone(ownerZone).toLocalDate().isBefore(oldestDay)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "capturedAt").build(), HttpStatus.BAD_REQUEST);
        }
        return capturedAt;
    }
}
