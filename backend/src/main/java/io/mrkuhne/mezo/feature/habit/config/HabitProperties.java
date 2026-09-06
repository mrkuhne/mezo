package io.mrkuhne.mezo.feature.habit.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Habit tuning (mezo.habit): every target window/cutoff is config, never code (ADR 0010). */
@Validated
@ConfigurationProperties(prefix = "mezo.habit")
public record HabitProperties(
    @NotBlank String closeCron,
    @Min(0) int wakeWindowMin,
    @Min(1) int proteinTargetG,
    @Min(0) int bedGraceMin,
    @Min(0) int kitchenCloseOffsetMin,
    @Min(1) int strengthWindowDays,
    @Min(1) int minSample,
    @Min(1) int summaryDays,
    @NotNull @Valid Formation formation) {

    /**
     * Formation-curve tunables (mezo-08zl, spec §The estimator). Every one of these shapes the
     * number a user reads as "how formed is this habit", so they are config a calibration round
     * can move without a code change — see {@code HabitFormationEstimator} for the formulas.
     */
    public record Formation(
        @DecimalMin("0.0") double kBase,                        // 0.03
        @Min(1) @Max(99) int thresholdPct,                      // 90
        @Min(1) int minReps,                                    // 5
        @DecimalMin("0.0") @DecimalMax("0.99") double kBand,    // 0.30
        @DecimalMin("0.0") @DecimalMax("1.0") double consistencyRise,   // 0.12
        @DecimalMin("0.0") @DecimalMax("1.0") double consistencyDecay   // 0.09
    ) {}
}
