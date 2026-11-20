package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Tunables of the hypertrophy plan generator (mezo-meso-plan). Bound from {@code mezo.meso-plan}.
 * Every trained group ≥2×/week and ≤8 sets/session hold by construction of the split table
 * ({@link io.mrkuhne.mezo.feature.train.service.MesoPlanSkeleton}, asserted in
 * {@code MesoPlanSkeletonTest}), not by a tunable here.
 *
 * <p>{@code defaultTrainingStyle} (mezo-r36n9.115): the training style a generated block carries, whose
 * style row then stamps every exercise (rep range, reserve, rest) instead of the rep / RIR frames here;
 * blank or absent = the unstyled block of before.
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
    @Min(0) @Max(5) int isolationWarmup,
    @Pattern(regexp = "^\\s*(balanced|volume|heavy|allout)?\\s*$") String defaultTrainingStyle) {

    /** The configured default style's wire value, or null when blank / absent (unstyled). */
    public String defaultTrainingStyleOrNull() {
        return defaultTrainingStyle == null || defaultTrainingStyle.isBlank() ? null : defaultTrainingStyle.strip();
    }
}
