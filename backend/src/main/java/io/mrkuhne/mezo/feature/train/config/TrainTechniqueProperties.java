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
    @NotNull @PositiveOrZero Integer capWeight   // extra set-equivalents a technique/challenge row costs (2)
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
}
