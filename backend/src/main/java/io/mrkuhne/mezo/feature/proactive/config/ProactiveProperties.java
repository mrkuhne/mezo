package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Proactive-layer tuning (mezo.proactive). B1.1: briefing gather window; B1.2 adds cron + regen. */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive")
public record ProactiveProperties(@NotNull @Valid Briefing briefing) {

    public record Briefing(
        /** How many finished days of narrative memory (daily_summary) the gather reads;
         *  doubles as the emptiness gate: zero summaries in the window -> no briefing (404). */
        @Min(1) @Max(14) int pastDays
    ) {}
}
