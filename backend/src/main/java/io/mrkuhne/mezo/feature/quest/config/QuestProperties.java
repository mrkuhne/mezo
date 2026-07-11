package io.mrkuhne.mezo.feature.quest.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Quest tuning (mezo.quest): reroll cap + the two cron schedules (ADR 0010 — config, not code). */
@Validated
@ConfigurationProperties(prefix = "mezo.quest")
public record QuestProperties(
    @Min(0) int rerollPerDay,        // 1
    @NotBlank String generateCron,   // "0 35 6 * * *"
    @NotBlank String finalizeCron    // "0 5 0 * * *"
) {}
