package io.mrkuhne.mezo.feature.dayclose.config;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Boop B3 day-close tunables (mezo-r36n9.13, spec §7.4). "Today" itself is the owner zone
 * {@code mezo.wearable.zone}, read through biometrics' {@code OwnerZoneProperties} (dayclose → biometrics
 * is cycle-safe).
 *
 * @param maxPastDays  oldest closable day: today − this, in the owner zone (future is always a 400).
 * @param maxRangeDays widest {@code from … to} range the list answers (a wider one is a 400).
 * @param lineMaxChars Boop's one-liner is cut to this many characters (a model that rambles).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.dayclose")
public record DayCloseProperties(
        @DefaultValue("7") @Min(0) int maxPastDays,
        @DefaultValue("92") @Min(1) int maxRangeDays,
        @DefaultValue("300") @Min(20) int lineMaxChars) {
}
