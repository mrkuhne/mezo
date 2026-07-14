package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Fix zárás (closing block) config — the exercises ensured at the END of every template gym day
 * of the active mesocycle (mezo-z2ul). Each entry references a master exercise-catalog row by
 * {@code slug} (content/exercise-catalog.json) and carries the recipe the appended template
 * exercise gets. Consumed by {@code ClosingBlockService}; the whole feature is gated by
 * {@code mezo.feature.closing-block.enabled} ({@code ClosingBlockGate}).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.closing-block")
public record ClosingBlockProperties(
    @NotNull @Size(min = 1) @Valid List<ClosingExercise> exercises
) {

    /** One closing exercise: catalog slug + the recipe of the appended template row. */
    public record ClosingExercise(
        /** Master catalog slug — source of the appended row's name/muscle/type + catalog link. */
        @NotBlank String slug,
        /** Working sets appended (warmup is always 0 on a closing exercise). */
        @NotNull @Positive Integer workingSets,
        /** Rep-range floor; for a timed hang the reps are seconds. */
        @NotNull @Positive Integer repMin,
        /** Rep-range ceiling. */
        @NotNull @Positive Integer repMax,
        /** Target RIR of the working sets (0 = to failure). */
        @NotNull @PositiveOrZero Integer targetRir
    ) {}
}
