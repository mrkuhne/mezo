package io.mrkuhne.mezo.feature.recipe.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Tunables of the recipe import (Boop B4). Values live in application.yml. */
@Validated
@ConfigurationProperties(prefix = "mezo.recipe-import")
public record RecipeImportProperties(

    /** Hard cap per uploaded photo, in bytes. */
    @Min(10_000) int maxPhotoBytes,

    /** Accepted photo MIME types — the photo only goes to the AI, never to a decoder or the store. */
    @NotEmpty List<String> allowedMimeTypes,

    /** Characters of page text handed to the AI. */
    @Min(1_000) @Max(100_000) int maxPromptChars,

    /** At/below this match confidence an ingredient row is flagged for review. */
    @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold
) {
}
