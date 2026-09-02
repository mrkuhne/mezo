package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Workout-timing tuning (mezo.train.timing) — the measurement clips (slice 1) and the profile
 * learner (slice 2). The seed values are the backend's copy of the frontend's static pacing
 * constants (SESSION_TIME + restSecondsFor): a brand-new profile therefore returns today's
 * numbers, and only moves as real observations arrive.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.train.timing")
public record TimingProperties(
    @NotNull @Positive Integer gapCapSeconds,      // 300 — inter-set interval clip
    @NotNull @Positive Integer leadInCapSeconds,   // 900 — start-to-first-set clip
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double maxClippedRatio, // 0.25
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double alpha,  // 0.125 — RFC 6298 1/8
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double beta,   // 0.25  — RFC 6298 1/4
    @NotNull @Positive Double outlierK,            // 4 — gate width in deviations
    @NotNull @Min(1) Integer minSamples,           // 3 — gate stays open below this
    @NotNull @Positive Double minDeviationSeconds, // 20 — RFC 6298 granularity floor for the gate
    @NotNull @Positive Double seedSetCycleCompound,  // 180 — 150s rest + ~8 reps x 3.5s
    @NotNull @Positive Double seedSetCycleIsolation, // 125 — 90s rest + ~10 reps x 3.5s
    @NotNull @Positive Double seedTransition,        // 240 — rest + 90s changeover + first set
    @NotNull @Positive Double seedLeadIn             // 480 — the 8-minute warm-up block
) {}
