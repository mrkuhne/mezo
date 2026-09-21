package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.constraints.*;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "mezo.character.followup")
public record CharacterFollowupProperties(
        /** Due items examined in one daily cycle. */ @Min(1) @Max(20) int maxDue,
        /** Recheck interval when no decisive new evidence exists. */ @Min(1) @Max(30) int recheckDays,
        /** Maximum model-specified initial horizon. */ @Min(1) @Max(90) int maxHorizonDays) {}
