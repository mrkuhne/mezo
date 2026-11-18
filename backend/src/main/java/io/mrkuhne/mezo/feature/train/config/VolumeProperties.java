package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Volume-progression tuning (mezo.volume): weekly set increment, deload fraction, grind RIR gap,
 * and the fixed per-muscle-group RP baseline landmarks seeded at mesocycle create/activate. */
@Validated
@ConfigurationProperties(prefix = "mezo.volume")
public record VolumeProperties(
    @NotNull @Positive Integer step,                 // sets added per productive week (2)
    @NotNull @Positive BigDecimal deloadFraction,    // deload target = round(prevSets * this) (0.5)
    @NotNull @PositiveOrZero Integer grindRirGap,     // RIR-below-target gap that counts as a grind (2)
    // Keyed by the coarse MuscleGroup token (chest/back/…); a group with no entry (core, sport
    // rows) is never seeded — the DA5 skip-don't-fabricate rule holds on the create path too.
    @NotNull @Size(min = 1) Map<String, @Valid Baseline> baselines,
    @NotNull @Valid Bands bands,                      // tier band formulas + caps
    @NotNull @Valid WeeklyReview weeklyReview,        // proposal mode
    @NotNull @Positive Integer stepEmphasize,         // weekly step, emphasize tier (2)
    @NotNull @Positive Integer stepGrow,              // weekly step, grow tier (1)
    @NotNull @Positive Integer stepDeficit,           // weekly step, both tiers in a deficit (1)
    @NotNull @Valid Signals signals                   // last-week signal thresholds
) {
    /**
     * Thresholds that turn last week's feedback into the decider's flags. Scales: workload 1–3
     * (Kevés volt / Pont jó / Sok volt), joint pain 1–3 (Nincs / Enyhe / Erős) — higher = worse;
     * check-in soreness 1–10, 10 = worse.
     */
    public record Signals(
        @NotNull @Min(1) @Max(3) Integer workloadTooMuch, // workload answer meaning "too much" (3)
        @NotNull @Min(1) @Max(3) Integer jointPainHold,   // joint-pain answer at or above which a group holds (2)
        @NotNull @Min(1) @Max(10) Integer sorenessHigh    // check-in soreness at or above which it is high (7)
    ) {}

    /** Tier band formulas and per-day caps. */
    public record Bands(
        @NotNull @Positive Integer maintainLowDivisor,   // maintain low = ceil(mev / this) (3)
        @NotNull @PositiveOrZero Integer emphasizeLowOffset, // emphasize low = mav - this (2)
        @NotNull @Positive Integer exerciseCap,          // working sets per exercise (5)
        @NotNull @Positive Integer sessionCap            // working sets per muscle group per day (8)
    ) {}

    /** Weekly review proposal mode. */
    public record WeeklyReview(
        @NotNull @Pattern(regexp = "auto|manual") String mode
    ) {}

    /** RP intermediate weekly-set landmarks for one coarse muscle group. */
    public record Baseline(
        @NotNull @Positive Integer mev,
        @NotNull @Positive Integer mav,
        @NotNull @Positive Integer mrv
    ) {}
}
