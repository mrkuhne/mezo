package io.mrkuhne.mezo.feature.fuel.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Fuel-settings ghost defaults (mezo.fuel-settings) — served before the user saves (never 404). */
@Validated
@ConfigurationProperties(prefix = "mezo.fuel-settings")
public record FuelSettingsProperties(

    /** Eating occasions per day before the user saves a setting. */
    @Min(3) @Max(6)
    int defaultMealsPerDay,

    /** Caffeine cutoff ghost, HH:mm — equals the old mezo.habit.caffeine-cutoff so behavior is unchanged. */
    @NotBlank
    String defaultCaffeineCutoff
) {}
