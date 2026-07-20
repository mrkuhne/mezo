package io.mrkuhne.mezo.feature.intention.config;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Intention tuning (mezo.intention) — cap + text limits, never code (configuration_conventions.md). */
@Validated
@ConfigurationProperties(prefix = "mezo.intention")
public record IntentionProperties(
    @Min(1) int focusCap,
    @Min(1) int creedMaxLen,
    @Min(1) int focusMaxLen) {}
