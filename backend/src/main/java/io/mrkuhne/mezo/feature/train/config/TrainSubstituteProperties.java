package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Tunables of the reasoned exercise swap ({@code mezo.train.substitute}, mezo-r36n9.66). Picked up by
 * {@code @ConfigurationPropertiesScan}.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.train.substitute")
public record TrainSubstituteProperties(
    /** How many of an exercise's newest feedback answers count towards its discomfort level. */
    @NotNull @Positive Integer feedbackWindow,
    /** How many days a swap-time "nem esik jól" record counts. */
    @NotNull @Positive Integer recordWindowDays
) {}
