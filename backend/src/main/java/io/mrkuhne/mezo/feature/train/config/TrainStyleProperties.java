package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Training-style tuning (mezo.train.style, mezo-r36n9.79): the per-style prescription table, the
 * all-out fallback on free exercises, the same-range reference window, stall length and effort ramp. */
@Validated
@ConfigurationProperties(prefix = "mezo.train.style")
public record TrainStyleProperties(
    // Keyed by the lowercase wire value: balanced | volume | heavy | allout.
    @NotNull @Size(min = 4) Map<String, @Valid Style> styles,
    @NotNull @PositiveOrZero Integer alloutFreeReserve,   // reserve of an all-out request on a free exercise (1)
    @NotNull @Positive Integer sameRangeMaxAgeDays,       // reference window for the same rep range (56)
    @NotNull @Positive Integer stallWeeks,                // weeks without progress that count as a stall (2)
    @NotNull @Valid Ramp ramp
) {
    /** One style row. Null {@code workingSets} = keep the plan's; null {@code legReserve} = {@code reserve}. */
    public record Style(
        @NotNull @Positive Integer compoundRepMin,
        @NotNull @Positive Integer compoundRepMax,
        @NotNull @Positive Integer isolationRepMin,
        @NotNull @Positive Integer isolationRepMax,
        @Positive Integer workingSets,
        @NotNull @PositiveOrZero Integer reserve,
        @PositiveOrZero Integer legReserve,
        @NotNull @Min(30) @Max(600) Integer compoundRestSec,
        @NotNull @Min(30) @Max(600) Integer isolationRestSec,
        @NotNull @PositiveOrZero Integer repOverflow
    ) {}

    /** Effort ramp across a block's loading weeks. */
    public record Ramp(
        @NotNull @Min(0) Integer middleDelta,     // reserve drop in the middle third (1)
        @NotNull @Min(0) Integer lastWeekDelta,   // reserve drop in the last loading week (2)
        @NotNull @Min(0) Integer deloadDelta,     // reserve rise in a deload week (2)
        @NotNull @Min(0) Integer freeFloor        // lowest reserve on a free exercise (1)
    ) {}
}
