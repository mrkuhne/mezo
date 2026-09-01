package io.mrkuhne.mezo.feature.recipe.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Tunables of the Receptműhely turn endpoint (mezo-92pb). Values live in application.yml. */
@Validated
@ConfigurationProperties(prefix = "mezo.recipe-workshop")
public record RecipeWorkshopProperties(
        @Min(1) @Max(30) int maxLines,
        @Min(1) @Max(20) int maxSteps,
        @Min(1) @Max(20) int maxHistoryTurns) {
}
