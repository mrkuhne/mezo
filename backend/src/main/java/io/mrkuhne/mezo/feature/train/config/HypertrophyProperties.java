package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Hypertrophy Drive tuning (mezo.hypertrophy): plate rounding, load increments per exercise
 * type, the count-keyed warmup ladders, and the default warmup-set count for new exercises. */
@Validated
@ConfigurationProperties(prefix = "mezo.hypertrophy")
public record HypertrophyProperties(
    @NotNull @Positive BigDecimal plateStep,          // 2.5 — rounding granularity for computed kg
    @NotNull @Positive BigDecimal defaultIncrement,   // 2.5 — fallback increment (e.g. plyo/unknown type)
    @NotNull Map<String, @Positive BigDecimal> increment, // per type: compound 5.0, isolation 2.5
    // keyed by warmupSets count (1, 2, 3 — counts above 3 reuse the 3-ladder, see
    // SetRecommendationService); each ladder entry is a %working-weight rung with absolute reps.
    @NotNull @Size(min = 1) Map<Integer, @Valid List<@Valid Ramp>> warmupLadders,
    @NotNull @PositiveOrZero Integer defaultWarmupSets   // 2
) {
    /** One warmup rung: a fraction of the working weight and an absolute rep count. */
    public record Ramp(
        @DecimalMin("0.1") @DecimalMax("1.0") double pct,  // 0.50, 0.70, 0.90
        @Min(1) int reps                                   // 8, 4, 2 — absolute, not a factor
    ) {}
}
