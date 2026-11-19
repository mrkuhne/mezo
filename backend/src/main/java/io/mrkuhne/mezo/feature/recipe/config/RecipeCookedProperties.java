package io.mrkuhne.mezo.feature.recipe.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Tunables of „Ezt főztem" (mezo-r36n9.63). Values live in application.yml. The per-photo size cap and
 * the accepted picture types are the recipe import's ({@link RecipeImportProperties}) — one rule for
 * every recipe photo.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.recipe-cooked")
public record RecipeCookedProperties(

    /** How many photos one capture may carry. */
    @Min(1) @Max(6) int maxPhotos,

    /** Hard cap on the photos of one capture together, in bytes (must fit the servlet multipart request cap). */
    @Min(100_000) long maxTotalBytes,

    /** Candidates offered to the AI per ingredient line. */
    @Min(1) @Max(20) int shortlistSize,

    /** Characters of typed/dictated text accepted (the contract's own ceiling is 4000). */
    @Min(100) @Max(4000) int maxTextChars
) {
}
