package io.mrkuhne.mezo.feature.companion.reflection.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Audit-history limits and bounded, owner-only recovery previews; unanswered cards do not expire. */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.observation-inbox")
public record ObservationInboxProperties(
        @Min(28) @Max(365) int lookbackDays,
        @Min(1) @Max(120) int recoveryTtlMinutes,
        @Min(1) @Max(100) int recoveryMaxLogs,
        @Min(1) @Max(10) int recoveryMaxCandidates,
        @Min(1000) @Max(100000) int recoveryMaxChars) {}
