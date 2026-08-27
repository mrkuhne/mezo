package io.mrkuhne.mezo.feature.companion.quarterly.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * W5.3 (bd mezo-b3pp.20, spec §9.3) — the quarterly deep pass's knobs.
 *
 * <p>Feature-scoped record rather than another {@code CompanionProperties} nested component: the
 * {@code ProfileProperties}/{@code FeedbackLearningProperties} precedent ({@code
 * CompanionProperties} is already 18 components deep and every new one widens a file every
 * companion session must read). Picked up by {@code @ConfigurationPropertiesScan}.
 *
 * @param cron            the quarterly run (server zone) — the 1st of Jan/Apr/Jul/Oct, AFTER that
 *                        dawn's 03:50 monthly consolidation rung, which is this job's input.
 * @param maxCandidates   how many SEASON candidates ONE run may propose (the model is told the
 *                        same number; anything beyond it is dropped, never merged).
 * @param maxPeriodLines  how many month rungs per side enter the prompt — a quarter has 3, the
 *                        cap is the guard against a mis-set window flooding the payload.
 * @param renderMaxChars  per-rung character cap in the {@code compare_periods} tool output (the
 *                        {@code recall.render-max-chars} idiom: a tool result is a prompt budget).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.quarterly")
public record QuarterlyProperties(
        @NotBlank String cron,
        @Min(0) @Max(10) int maxCandidates,
        @Min(1) @Max(24) int maxPeriodLines,
        @Min(50) @Max(4000) int renderMaxChars) {
}
