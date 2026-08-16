package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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
    @NotNull @Size(min = 1) Map<String, @Valid Baseline> baselines
) {
    /** RP intermediate weekly-set landmarks for one coarse muscle group. */
    public record Baseline(
        @NotNull @Positive Integer mev,
        @NotNull @Positive Integer mav,
        @NotNull @Positive Integer mrv
    ) {}
}
