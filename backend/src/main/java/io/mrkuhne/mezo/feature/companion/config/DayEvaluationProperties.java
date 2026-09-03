package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Daily evaluation (mezo-jcpt.4) — the 6-dimension day-score engine's tuning knobs: dimension
 * weights, nutrition tolerance bands, and the training/sleep/rhythm/logging thresholds later
 * tasks' pure engine consumes. Feature-scoped record rather than another {@code
 * CompanionProperties} nested component (the {@code MeWeekProperties}/{@code
 * QuarterlyProperties} precedent). Picked up by {@code @ConfigurationPropertiesScan}.
 *
 * <p>{@code MeWeekProperties.sleepTargetH} stays for the legacy weekly-review day-score path;
 * this record carries its own {@code sleepTargetH} for the new engine.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.day-evaluation")
public record DayEvaluationProperties(
    @NotNull @Valid Weights weights,
    @NotNull @Valid NutritionBands nutrition,
    /** Edzésnapi kcal/CH sáv-tágítás (kcal). */
    @Min(0) @Max(600) int workoutDayKcalWiden,
    /** Alvás-cél óra (a MeWeekProperties.sleepTargetH marad a legacy útnak; itt a sajátunk). */
    @DecimalMin("4.0") @DecimalMax("12.0") double sleepTargetH,
    /** Ritmus-ablak napokban + a minimum értékelt nap benne. */
    @Min(3) @Max(14) int rhythmWindowDays,
    @Min(2) @Max(7) int rhythmMinDays,
    /** Étkezés „időben logolva": ennyi percen belül a loggedAt a slot-ablaktól. */
    @Min(30) @Max(720) int logTimelyMin
) {

    public record Weights(double nutrition, double quality, double training,
                          double sleep, double logging, double rhythm) {
        @AssertTrue(message = "mezo.companion.day-evaluation.weights must sum to 1.0")
        public boolean isNormalized() {
            return Math.abs(nutrition + quality + training + sleep + logging + rhythm - 1.0) < 1e-6;
        }
    }

    /** Aszimmetrikus toleranciasávok a napi célhoz képest (relatív arányok). */
    public record NutritionBands(
        /** kcal: sávon belül teljes pont — alul tágabb, felül szűkebb (cut-aszimmetria). */
        @DecimalMin("0.0") @DecimalMax("0.5") double kcalUnderBand,   // 0.10
        @DecimalMin("0.0") @DecimalMax("0.5") double kcalOverBand,    // 0.05
        /** sávon kívül lineáris lecsengés: pont/relatív-eltérés meredekség. */
        @DecimalMin("0.5") @DecimalMax("10.0") double kcalSlope,      // 3.0
        /** fehérje: hiány-sáv + meredekség; a többlet megbocsátva (fitness-policy). */
        @DecimalMin("0.0") @DecimalMax("0.5") double proteinUnderBand, // 0.05
        @DecimalMin("0.5") @DecimalMax("10.0") double proteinSlope,    // 2.5
        /** C+F együtt, szimmetrikus sáv + enyhébb meredekség. */
        @DecimalMin("0.0") @DecimalMax("0.5") double carbFatBand,      // 0.15
        @DecimalMin("0.5") @DecimalMax("10.0") double carbFatSlope     // 1.5
    ) { }
}
