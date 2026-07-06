package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Proactive-layer tuning (mezo.proactive). B1.1: briefing gather window; B1.2 adds cron + regen. */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive")
public record ProactiveProperties(
        @NotNull @Valid Briefing briefing,
        @NotNull @Valid Weekly weekly,
        @NotNull @Valid Memoir memoir) {

    public record Briefing(
        /** How many finished days of narrative memory (daily_summary) the gather reads;
         *  doubles as the emptiness gate: zero summaries in the window -> no briefing (404). */
        @Min(1) @Max(14) int pastDays,
        /** Dawn pre-generation schedule (server zone) — before the typical wake. */
        @NotBlank String cron,
        /** Max staleness regenerations per user+day (the GET path's cap). */
        @Min(0) @Max(5) int regenCapPerDay
    ) {}

    /** W1 weekly plan-suggestion generation. */
    public record Weekly(
        /** Monday-dawn schedule (server zone) — the suggestion is FOR the week just starting. */
        @NotBlank String cron
    ) {}

    /** W2 Sunday-evening weekly memoir generation. */
    public record Memoir(
        /** Sunday-evening schedule (server zone) — the memoir is FOR the week ending that Sunday. */
        @NotBlank String cron
    ) {}
}
