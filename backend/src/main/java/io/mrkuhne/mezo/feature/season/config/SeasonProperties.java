package io.mrkuhne.mezo.feature.season.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Boop B6 Évad tunables (mezo-r36n9.16).
 *
 * @param mesocycleGate the "no training block without a season" gate (spec §5.12-5)
 * @param menuJob       the scheduled weekly-menu generation (Évad S3)
 */
@Validated
@ConfigurationProperties(prefix = "mezo.season")
public record SeasonProperties(@DefaultValue @Valid MesocycleGate mesocycleGate, @DefaultValue MenuJob menuJob) {

    /**
     * @param enabled          production true; the test profile turns it off so the many block-starting ITs need
     *                         no season, and {@code MesocycleGateIT} turns it back on
     * @param plannedLeadDays  a planned season opens the gate when it starts at most this many days after the block
     */
    public record MesocycleGate(@DefaultValue("true") boolean enabled,
                                @DefaultValue("7") @Min(0) @Max(60) int plannedLeadDays) {
    }

    /** @param enabled the per-minute check that generates next week's menu on the season's menu day and time */
    public record MenuJob(@DefaultValue("true") boolean enabled) {
    }
}
