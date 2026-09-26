package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Train-domain tunables ({@code mezo.train}). {@code energy.met} is the net activity-energy
 * model's MET table (mezo-32m82), mirrored on the frontend and bound by shared golden vectors
 * in {@code api/fixtures/activity-energy-vectors.json}.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.train")
public record TrainProperties(
    @NotNull @Valid Energy energy,
    @NotNull @Positive Integer gymDefaultMinutes,   // gym slots carry no duration → default 60 (FE DEFAULT_BLOCK_MIN)
    @NotNull @Positive Integer runDefaultMinutes,    // run with no duration → 45 (FE activityEnergy DEFAULT_RUN_MIN)
    @NotNull @Positive Integer sportSessionMaxSpanDays // widest from..to window GET /api/train/sport-sessions accepts
) {
    /** The net activity-energy model's MET table (mezo-32m82): kind → band → MET, Compendium 2024. */
    public record Energy(@NotNull Map<String, @Valid MetBand> met) {}

    /** One kind's MET at the three felt-effort bands (RPE 1–4 / 5–7 / 8–10). */
    public record MetBand(@NotNull @Positive Double light, @NotNull @Positive Double moderate,
                          @NotNull @Positive Double hard) {}
}
