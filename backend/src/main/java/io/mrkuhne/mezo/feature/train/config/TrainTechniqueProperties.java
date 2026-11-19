package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Set-technique tuning (mezo.train.technique, mezo-r36n9.80): the shape of each technique set. */
@Validated
@ConfigurationProperties(prefix = "mezo.train.technique")
public record TrainTechniqueProperties(
    @NotNull @Valid Drop restDrop,        // rest-pause drop: light leg after a short rest
    @NotNull @Valid Drop drop,            // straight drop set: lighter leg, no rest
    @NotNull @Valid Myo myo,
    @NotNull @Valid Partials partials,
    @NotNull @Positive Integer capWeight,  // what a technique/challenge row's technique set weighs against the caps (2)
    @NotNull @Valid Planner planner        // the default technique planner (mezo-r36n9.81)
) {
    /** A drop-style technique: reserve on the main part, drop percent, rest before the leg. */
    public record Drop(
        @NotNull @PositiveOrZero Integer mainReserve,
        @NotNull @Min(1) @Max(90) Integer dropPercent,
        @NotNull @Min(0) @Max(600) Integer restSec
    ) {}

    /** Myo-reps: an activation set then short mini-sets. */
    public record Myo(
        @NotNull @PositiveOrZero Integer mainReserve,
        @NotNull @Positive Integer miniReps,
        @NotNull @Positive Integer miniMinReps,
        @NotNull @Min(0) @Max(600) Integer miniRestSec,
        @NotNull @Positive Integer maxMinis
    ) {}

    /** Lengthened partials after the main set. */
    public record Partials(@NotNull @PositiveOrZero Integer mainReserve) {}

    /**
     * The default technique planner (mezo-r36n9.81, spec §6.5): the first week techniques appear, the per-day
     * allowance (normal / in a deficit or on a sport day), the per-muscle-group weekly limit, and the rep-range top
     * from which an isolation gets myo-reps.
     */
    public record Planner(
        @NotNull @Min(1) Integer startWeek,
        @NotNull @PositiveOrZero Integer maxPerDay,
        @NotNull @PositiveOrZero Integer maxPerDayReduced,
        @NotNull @PositiveOrZero Integer maxPerMuscleWeek,
        @NotNull @Positive Integer myoRepTop
    ) {}
}
