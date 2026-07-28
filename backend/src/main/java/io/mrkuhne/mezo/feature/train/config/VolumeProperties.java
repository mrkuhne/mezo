package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Volume-progression tuning (mezo.volume): weekly set increment, deload fraction, grind RIR gap. */
@Validated
@ConfigurationProperties(prefix = "mezo.volume")
public record VolumeProperties(
    @NotNull @Positive Integer step,                 // sets added per productive week (2)
    @NotNull @Positive BigDecimal deloadFraction,    // deload target = round(prevSets * this) (0.5)
    @NotNull @PositiveOrZero Integer grindRirGap      // RIR-below-target gap that counts as a grind (2)
) {}
