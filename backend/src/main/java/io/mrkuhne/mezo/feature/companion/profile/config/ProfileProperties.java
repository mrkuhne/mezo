package io.mrkuhne.mezo.feature.companion.profile.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * W4.3 (mezo-b3pp.17, spec §8.3) — the pragmatic-profile knobs.
 *
 * <p>Feature-scoped record rather than another {@code CompanionProperties} nested component: the
 * {@code FeedbackLearningProperties} precedent (that class's javadoc carries the argument —
 * {@code CompanionProperties} is already 17 components deep and every new one widens a file every
 * companion session must read). Picked up by {@code @ConfigurationPropertiesScan}.
 *
 * @param cron           weekly run, AFTER the Monday 03:30 consolidation rung and the 03:10
 *                       feedback rollups — the profile reads both, so it must run last.
 * @param renderMaxTokens hard cap on the injected {@code [Rólad tanultam]} block, header included
 *                       (spec §8.3: the WHOLE block ≤400 tokens). Also applied at STORE time to
 *                       the prose alone (no header there), so the stored summary can be marginally
 *                       longer than what a turn actually renders — Tudástár may show a little more
 *                       than the model was given, never less.
 * @param maxDecisions   how many reviewed decisions (newest first) enter the LLM payload.
 * @param maxGraphNodes  how many active PATTERN/PREFERENCE node titles enter the payload.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.profile")
public record ProfileProperties(
        @NotBlank String cron,
        @Min(50) @Max(2000) int renderMaxTokens,
        @Min(0) @Max(100) int maxDecisions,
        @Min(0) @Max(100) int maxGraphNodes) {
}
