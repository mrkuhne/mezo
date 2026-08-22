package io.mrkuhne.mezo.feature.companion.feedback.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * W4.2 nightly rollup job tuning (bd mezo-b3pp.16, spec §8.2) — the {@code JournalProperties}
 * precedent: a small, feature-scoped {@code @ConfigurationProperties} record rather than another
 * field on the already-large shared {@code CompanionProperties}.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.feedback-learning")
public record FeedbackLearningProperties(

    @NotBlank String cron,

    /** Trailing window (days) the effectiveness + style rollups are computed over. */
    @Min(1) @Max(365) int windowDays
) {
}
