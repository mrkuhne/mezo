package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Tunables of the hypertrophy plan generator (mezo-meso-plan). Bound from {@code mezo.meso-plan}.
 * Every trained group ≥2×/week and ≤8 sets/session hold by construction of the split table
 * ({@link io.mrkuhne.mezo.feature.train.service.MesoPlanSkeleton}, asserted in
 * {@code MesoPlanSkeletonTest}), not by a tunable here.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.meso-plan")
public record MesoPlanProperties(
    @Min(1) @Max(4) int maxExercisesPerGroupPerDay,
    @Min(1) @Max(30) int compoundRepMin,
    @Min(1) @Max(30) int compoundRepMax,
    @Min(1) @Max(30) int isolationRepMin,
    @Min(1) @Max(30) int isolationRepMax,
    @Min(0) @Max(5) int targetRir,
    @Min(0) @Max(5) int compoundWarmup,
    @Min(0) @Max(5) int isolationWarmup) {}
