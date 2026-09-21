package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.constraints.*;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "mezo.character.council-budget")
public record CharacterCouncilBudgetProperties(
        /** All tagged calls plus conservative tool continuations per cycle. */ @Min(3) @Max(100) int cycleCalls,
        /** Stronger model calls per cycle. */ @Min(0) @Max(20) int cycleSmartCalls,
        /** Autonomous allocation; replies cannot consume a separate autonomous quota. */ @Min(1) int autonomousDailyCalls,
        /** All calls per owner/day; the difference is reserved for user replies. */ @Min(1) int totalDailyCalls,
        /** Retain operational counters for this many days. */ @Min(2) @Max(365) int retentionDays) {
    @AssertTrue(message = "autonomous quota must fit total quota")
    public boolean isAllocationValid() { return autonomousDailyCalls <= totalDailyCalls; }
}
