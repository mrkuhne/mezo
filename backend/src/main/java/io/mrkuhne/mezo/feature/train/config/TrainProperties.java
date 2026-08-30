package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Train-domain tunables ({@code mezo.train}). The MET table mirrors the frontend
 * {@code fuelConfig.MET_BY_KIND} (a drift-guard test binds them); kcal = MET × kg × (min/60).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.train")
public record TrainProperties(
    @NotNull @Valid Met met,
    @NotNull @Positive Integer gymDefaultMinutes,   // gym slots carry no duration → default 60 (FE DEFAULT_BLOCK_MIN)
    @NotNull @Positive Integer runDefaultMinutes,    // interval runs have no single duration → default 45 (FE DEFAULT_RUN_MIN)
    @NotNull @Positive Integer sportSessionMaxSpanDays // widest from..to window GET /api/train/sport-sessions accepts
) {
    /** MET by training-block kind — mirror of FE fuelConfig.MET_BY_KIND. */
    public record Met(
        @NotNull @Positive Double gym,       // 6.0
        @NotNull @Positive Double sport,     // 4.5
        @NotNull @Positive Double run,       // 9.5
        @NotNull @Positive Double defaultKind // 5.0
    ) {}
}
