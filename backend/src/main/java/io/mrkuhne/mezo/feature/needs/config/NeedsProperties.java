package io.mrkuhne.mezo.feature.needs.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Életjel day-close award tuning (mezo.needs), never code (configuration_conventions.md). */
@Validated
@ConfigurationProperties(prefix = "mezo.needs")
public record NeedsProperties(
    @Min(1) @Max(100) int greenThreshold,
    @PositiveOrZero int perRingXp,
    @PositiveOrZero int allGreenBonusXp) {}
