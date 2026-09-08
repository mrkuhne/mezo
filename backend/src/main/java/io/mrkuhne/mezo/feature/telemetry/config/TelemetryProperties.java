package io.mrkuhne.mezo.feature.telemetry.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * {@code mezo.telemetry} — every tunable of the lean screen-event log (bd mezo-o5cz, spec
 * 2026-09-07 §5). Bound regardless of the feature switch: the switch gates BEANS, these are the
 * numbers those beans read, and binding them unconditionally keeps a
 * {@code mezo.telemetry.*} typo a startup failure rather than a silent default.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.telemetry")
public record TelemetryProperties(
        /** Rows older than this are hard-DELETEd by the retention job — no soft delete (spec §3). */
        @Min(1) @Max(3650) int retentionDays,
        /** Retention job schedule (Spring 6-field cron). */
        @NotBlank String retentionCron,
        /**
         * Largest accepted batch. A bigger one is a 400 TELEMETRY_BATCH_TOO_LARGE, never a
         * silent truncation: the client must learn its buffer is oversized.
         */
        @Min(1) @Max(1000) int batchMax,
        /**
         * Per-user ingest budget, in EVENTS (not requests) per rolling minute. Enforced by a tiny
         * in-memory token bucket — this is a single-replica deployment, so no distributed limiter.
         */
        @Min(1) @Max(100_000) int rateLimitPerMinute,
        /**
         * The client clock is trusted but clamped to {@code now ± this} (spec T4): a device with a
         * wrong date must not be able to write rows into next year or 1970.
         */
        @Min(1) @Max(720) int occurredAtClampHours) {}
