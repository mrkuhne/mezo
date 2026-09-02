package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Tunables of the hypertrophy plan generator (mezo-meso-plan). Bound from {@code mezo.meso-plan}.
 * sessionCap = max productive sets per muscle per session (RP ~8); minFrequency = every trained
 * group appears at least this many times a week (guaranteed by the split table, asserted in tests).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.meso-plan")
public record MesoPlanProperties(
    @Min(4) @Max(12) int sessionCap,
    @Min(1) @Max(3) int minFrequency,
    @Min(1) @Max(4) int maxExercisesPerGroupPerDay,
    @Min(1) @Max(30) int compoundRepMin,
    @Min(1) @Max(30) int compoundRepMax,
    @Min(1) @Max(30) int isolationRepMin,
    @Min(1) @Max(30) int isolationRepMax,
    @Min(0) @Max(5) int targetRir,
    @Min(0) @Max(5) int compoundWarmup,
    @Min(0) @Max(5) int isolationWarmup) {}
