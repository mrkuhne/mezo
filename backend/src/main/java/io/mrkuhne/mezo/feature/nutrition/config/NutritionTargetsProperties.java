package io.mrkuhne.mezo.feature.nutrition.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.nutrition.*} — the owner-wide daily macro targets that feed the Fuel-day
 * MacroHero (targets vs consumed). See docs/references/configuration_conventions.md. First
 * config-driven domain value feeding a UI hero; replaces the hardcoded mock {@code 2500}/{@code 3100}.
 *
 * <p>Since mezo-najo these are the FALLBACK: {@code FuelDayService} prefers the active goal's
 * prescribed recept (kcal + protein from the date's goal-week segment) and only falls back here
 * when no active/evaluated goal covers the date. Carbs/fat/water are never prescribed, so those
 * three always come from this config.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.nutrition")
public record NutritionTargetsProperties(
    @NotNull @Positive Integer kcal,  // 3100
    @NotNull @Positive Integer p,     // 220 g protein
    @NotNull @Positive Integer c,     // 380 g carbs
    @NotNull @Positive Integer f,     // 95 g fat
    @NotNull @Positive Integer water  // 4000 ml
) {
}
