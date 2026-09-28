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
 * type (now only the weight memory's near-swap threshold), the count-keyed warmup ladders, the
 * default warmup-set count for new exercises, the near-swap threshold of the per-machine weight
 * memory, and the proportional progression step. */
@Validated
@ConfigurationProperties(prefix = "mezo.hypertrophy")
public record HypertrophyProperties(
    @NotNull @Positive BigDecimal plateStep,          // 2.5 — rounding granularity for computed kg
    @NotNull @Positive BigDecimal defaultIncrement,   // 2.5 — fallback increment (e.g. plyo/unknown type)
    @NotNull Map<String, @Positive BigDecimal> increment, // per type: compound 5.0, isolation 2.5
    // keyed by warmupSets count (1, 2, 3 — counts above 3 reuse the 3-ladder, see
    // SetRecommendationService); each ladder entry is a %working-weight rung with absolute reps.
    @NotNull @Size(min = 1) Map<Integer, @Valid List<@Valid Ramp>> warmupLadders,
    @NotNull @PositiveOrZero Integer defaultWarmupSets,  // 2
    // Per-machine weight memory (mezo-bk7l2): a logged weight within max(increment, this share of
    // the prescription) of the prescribed one marks the prescribed weight as missing on the machine.
    @NotNull @Positive @DecimalMax("0.5") BigDecimal gapNearFraction,  // 0.10
    // Proportional progression step (mezo-bk7sn): the wanted jump as a share of the load per type,
    // the largest single jump (normal / big RIR reserve), the RIR surplus that counts as a big
    // reserve, and how many reps past the range top are built before a too-big jump is forced.
    @NotNull Map<String, @Positive @DecimalMax("0.5") BigDecimal> stepPercent, // compound 0.025, isolation 0.05
    @NotNull @Positive @DecimalMax("0.5") BigDecimal defaultStepPercent,       // 0.05
    @NotNull @Positive @DecimalMax("0.5") BigDecimal maxJump,                  // 0.10
    @NotNull @Positive @DecimalMax("0.5") BigDecimal maxJumpReserve,           // 0.15
    @NotNull @Min(1) Integer reserveSlack,                                     // 2
    @NotNull @PositiveOrZero Integer repOverflow                               // 3
) {
    /** One warmup rung: a fraction of the working weight and an absolute rep count. */
    public record Ramp(
        @DecimalMin("0.1") @DecimalMax("1.0") double pct,  // 0.50, 0.70, 0.90
        @Min(1) int reps                                   // 8, 4, 2 — absolute, not a factor
    ) {}
}
