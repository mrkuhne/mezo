package io.mrkuhne.mezo.feature.activity.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Activity-log tuning (mezo.activity): deterministic XP guardrails + the AI confidence gate
 * (ADR 0010 — the LLM proposes, the server disposes; amounts are config, never code). */
@Validated
@ConfigurationProperties(prefix = "mezo.activity")
public record ActivityProperties(
    @Min(1) int xpMin,                                        // 5
    @Min(1) int xpMax,                                        // 25
    @Min(0) int perSkillDailyCap,                             // 40
    @Min(0) int dailyCap,                                     // 100
    @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold, // 0.6
    @Min(0) int defaultXp                                     // 10 — classifier absent/off
) {}
