package io.mrkuhne.mezo.feature.progression.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Progression tuning (mezo.progression). P1 ships the level curve; P2+ adds signal weights. */
@Validated
@ConfigurationProperties(prefix = "mezo.progression")
public record ProgressionProperties(
    @NotNull @Valid Curve curve
) {
    /** Level threshold curve: xpThreshold(n) = round(base * (n-1)^exp), xpThreshold(1)=0. */
    public record Curve(
        @NotNull @Positive Integer base,  // 100
        @NotNull @Positive Double exp     // 1.6
    ) {}
}
