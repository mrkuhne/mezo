package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.constraints.*;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "mezo.character.council")
public record CharacterCouncilProperties(
        @NotBlank String cron, @NotBlank String zone, @NotBlank String readyAt,
        @Min(1) @Max(7) int catchUpDays,
        @Min(1) @Max(6) int maxTopics,
        @Min(5) @Max(180) int leaseMinutes,
        @Min(1) @Max(5) int maxAttempts) {}
