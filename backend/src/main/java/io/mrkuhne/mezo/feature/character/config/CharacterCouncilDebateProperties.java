package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Bounded domain discussion, separate from the reserved closing calls. */
@Validated
@ConfigurationProperties(prefix = "mezo.character.council-debate")
public record CharacterCouncilDebateProperties(
        /** Maximum discussion rounds. */ @Min(1) @Max(3) int maxRounds,
        /** Maximum invited domain experts including the author. */ @Min(2) @Max(4) int maxParticipants,
        /** Maximum domain completion calls per run. */ @Min(1) @Max(12) int maxCalls,
        /** Shared read budget across all participants. */ @Min(1) @Max(8) int maxToolCalls,
        /** Maximum references retained by the read audit. */ @Min(1) @Max(100) int maxRefs,
        /** Maximum calendar days per comparison window. */ @Min(1) @Max(366) int maxComparisonDays) {}
