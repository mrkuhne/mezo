package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Nightly day-review pre-warm (A napom S1) — schedule + finished-day catch-up window. */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.day-review-warmup")
public record DayReviewWarmupProperties(
    @NotBlank String cron,
    @Min(1) @Max(14) int catchUpDays
) { }
