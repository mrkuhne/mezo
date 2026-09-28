package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Check-in 2.0 training readiness ({@code mezo.train.readiness}, mezo-ck2, spec 2026-09-27 §3.3):
 * the thresholds that turn this morning's check-in into a "lighter day" suggestion, and the slot
 * that counts as the morning check-in. All scales are 1..10; soreness is "10 = worse".
 */
@Validated
@ConfigurationProperties(prefix = "mezo.train.readiness")
public record ReadinessProperties(
    /** Suggest a lighter day when rested is at most this (default 4). */
    @NotNull @Min(1) @Max(10) Integer restedMax,
    /** Suggest a lighter day when soreness is at least this (default 7). */
    @NotNull @Min(1) @Max(10) Integer sorenessMin,
    /** Suggest a lighter day when motivation is at most this (default 3). */
    @NotNull @Min(1) @Max(10) Integer motivationMax,
    /** The morning slot preferred as the source (default 06:30). */
    @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$") String morningSlot
) {}
