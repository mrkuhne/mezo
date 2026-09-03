package io.mrkuhne.mezo.feature.nutrition.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Diet-settings ghost defaults (mezo.diet-settings) — served before the user saves (never 404). */
@Validated
@ConfigurationProperties(prefix = "mezo.diet-settings")
public record DietSettingsProperties(

    /** Split preset ghost — balanced reproduces the pre-slice-1 hardcoded 27.5% fat share. */
    @NotBlank
    String defaultSplitPreset,

    /** Protein tier ghost — moderate = the engine's existing 2.0 g/kg default path. */
    @NotBlank
    String defaultProteinTier,

    /** Water target ghost (ml) — equals the old mezo.nutrition.water so behavior is unchanged. */
    @Min(500) @Max(8000)
    int defaultWaterMl,

    /** Fiber target ghost (g) — equals the old FE FIBER_TARGET_G so behavior is unchanged. */
    @Min(10) @Max(80)
    int defaultFiberG,

    /** Day-type kcal shift ghost — 0 = uniform days until the user opts in. */
    @Min(0) @Max(500)
    int defaultDayTypeShiftKcal
) {}
