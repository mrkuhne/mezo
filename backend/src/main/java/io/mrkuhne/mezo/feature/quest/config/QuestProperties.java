package io.mrkuhne.mezo.feature.quest.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Quest tuning (mezo.quest): reroll cap + the two cron schedules (ADR 0010 — config, not code). */
@Validated
@ConfigurationProperties(prefix = "mezo.quest")
public record QuestProperties(
    @Min(0) int rerollPerDay,        // 1
    @NotBlank String generateCron,   // "0 35 6 * * *"
    @NotBlank String finalizeCron,   // "0 5 0 * * *"
    @NotNull @Valid Adaptive adaptive
) {
    /** Adaptive difficulty banding (E3, spec §4): per-slot completion-ratio → allowed tiers. */
    public record Adaptive(
        @Min(1) int windowDays,                            // 28
        @Min(1) int minSample,                             // 5
        @DecimalMin("0.0") @DecimalMax("1.0") double highRatio,  // 0.85
        @DecimalMin("0.0") @DecimalMax("1.0") double lowRatio    // 0.50
    ) {}
}
