package io.mrkuhne.mezo.feature.companion.reflection.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Reflexió (bd mezo-eq85) configuration — text signals, quick notices, the nightly reflection
 * pass. Picked up by {@code MezoApplication}'s {@code @ConfigurationPropertiesScan}, exactly like
 * {@code MemoryPlatformProperties}.
 *
 * <p>S1 (this slice) uses {@code enabled} and {@code catchUpDays}; {@code cron}, {@code notice},
 * {@code propose} and {@code lifecycle} are bound and validated here so the whole epic's config
 * surface lands in one reviewed place — slices 2–6 consume them.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.reflection")
public record ReflectionProperties(
        /** Master switch for every Reflexió bean (REFLECTION_SWITCH). */
        boolean enabled,
        /** Nightly reflection pass schedule, server zone. */
        @NotBlank String cron,
        /** Finished days the nightly catch-up re-checks for missing/stale signals. */
        @Min(1) @Max(30) int catchUpDays,
        /** Quick-notice rate limits and quiet hours. */
        @NotNull @Valid Notice notice,
        /** Nightly pattern-proposal cap. */
        @NotNull @Valid Propose propose,
        /** Pattern lifecycle thresholds. */
        @NotNull @Valid Lifecycle lifecycle) {

    public record Notice(
            /**
             * Whether a surfaced observation also PUSHES ({@code OBSERVATION_NEW}). False until the
             * Észrevételek tab ships (mezo-eq85.5) — observations are still collected and still
             * marked {@code surfaced}; only the notification is held back.
             */
            boolean pushEnabled,
            /** Hard cap on quick notices per day; 0 = notices off. */
            @Min(0) @Max(10) int maxPerDay,
            /** Minimum hours between two notices. */
            @Min(0) @Max(24) int minGapHours,
            /** Quiet window start (inclusive) — no notice is emitted inside it. */
            @NotNull LocalTime quietFrom,
            /** Quiet window end (exclusive). */
            @NotNull LocalTime quietTo) {}

    public record Propose(
            /** Hard cap on newly proposed patterns per nightly run. */
            @Min(0) @Max(5) int maxPerNight) {}

    public record Lifecycle(
            /** Consecutive confirming nights before a pattern is believed. */
            @Min(1) @Max(10) int confirmStreak,
            /** Consecutive refuting nights before a pattern is dropped. */
            @Min(1) @Max(10) int refuteStreak,
            /** Days without fresh evidence before a pattern goes dormant. */
            @Min(7) @Max(180) int dormantAfterDays,
            /** |r| at or above which the correlation counts as strong. */
            @DecimalMin("0.05") @DecimalMax("0.9") double strongR,
            /** p at or below which the correlation counts as strong. */
            @DecimalMin("0.01") @DecimalMax("0.5") double strongP) {}
}
