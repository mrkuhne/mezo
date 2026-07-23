package io.mrkuhne.mezo.feature.biometrics.sleep.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Sleep-goal tuning (mezo.sleep): ghost defaults + regularity band are config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.sleep")
public record SleepGoalProperties(

    /** Asleep target served before the user saves a goal (minutes). */
    @Min(1) @Max(1440)
    int defaultTargetMin,

    /** Which end the ghost goal fixes. */
    @Pattern(regexp = "WAKE|BED")
    String defaultAnchor,

    /** Ghost wake anchor, HH:mm (used when default-anchor is WAKE). */
    @NotBlank
    String defaultWake,

    /** Ghost bed anchor, HH:mm (used when default-anchor is BED). */
    @NotBlank
    String defaultBed,

    /** Default ± regularity band in minutes (Walker ±15). */
    @Min(1)
    int regularityBandMin
) {}
