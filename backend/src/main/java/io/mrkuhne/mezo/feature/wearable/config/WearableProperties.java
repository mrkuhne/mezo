package io.mrkuhne.mezo.feature.wearable.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * {@code mezo.wearable} — Boop's Apple Health + calendar ingestion (mezo-r36n9.2). A batch above its
 * cap is a 400 WEARABLE_BATCH_TOO_LARGE, never a silent truncation: the client must learn to split.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.wearable")
public record WearableProperties(
        @Min(1) @Max(1000) int maxSleepNights,
        @Min(1) @Max(1000) int maxDays,
        @Min(1) @Max(2000) int maxWorkouts,
        /** Health samples per POST /samples (and ids per POST /deletions). */
        @Min(1) @Max(1000) int maxSamples,
        @Min(1) @Max(31) int maxCalendarDays,
        @Min(1) @Max(1000) int maxEventsPerDay,
        /** Calendar zone that decides "today" for the one-sleep-event rule and workout days. */
        @NotBlank String zone) {
}
