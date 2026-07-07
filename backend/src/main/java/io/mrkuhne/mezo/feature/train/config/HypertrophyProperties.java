package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
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
 * type, the warmup ramp, and the default warmup-set count for new exercises. */
@Validated
@ConfigurationProperties(prefix = "mezo.hypertrophy")
public record HypertrophyProperties(
    @NotNull @Positive BigDecimal plateStep,          // 2.5 — rounding granularity for computed kg
    @NotNull @Positive BigDecimal defaultIncrement,   // 2.5 — fallback increment (e.g. plyo/unknown type)
    @NotNull Map<String, @Positive BigDecimal> increment, // per type: compound 5.0, isolation 2.5
    @NotNull @Size(min = 1) @Valid List<Ramp> warmupRamp,
    @NotNull @PositiveOrZero Integer defaultWarmupSets   // 2
) {
    /** One warmup step as a fraction of the working weight + a rep factor of repMax. */
    public record Ramp(
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double pct,        // 0.50, 0.75
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double repsFactor  // 1.0, 0.5
    ) {}
}
