package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "mezo.character.reply")
public record CharacterReplyProperties(
        @Min(60) @Max(3600) int leaseSeconds, @Min(1) @Max(50) int historyLimit) {}
