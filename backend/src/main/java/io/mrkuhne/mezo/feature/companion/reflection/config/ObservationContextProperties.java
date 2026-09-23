package io.mrkuhne.mezo.feature.companion.reflection.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Bounds on original, dated source records supplied to observation generation. */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.observation-context")
public record ObservationContextProperties(
        /** Inclusive number of days ending on the requested day. */
        @Min(1) @Max(90) int lookbackDays,
        /** Maximum accepted records from any one source. */
        @Min(1) @Max(100) int maxRecordsPerSource,
        /** Maximum examined rows per source, including excluded assistant turns. */
        @Min(1) @Max(1000) int scanRecordsPerSource,
        /** Maximum characters in each original source excerpt. */
        @Min(100) @Max(4000) int excerptMaxChars,
        /** Maximum characters in the entire rendered evidence block. */
        @Min(1000) @Max(100000) int maxChars) {}
