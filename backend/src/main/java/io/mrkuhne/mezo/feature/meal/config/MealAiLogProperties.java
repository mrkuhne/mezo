package io.mrkuhne.mezo.feature.meal.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Tunables of the AI meal-draft endpoint (mezo-78rn). All values live in application.yml. */
@Validated
@ConfigurationProperties(prefix = "mezo.meal-ai-log")
public record MealAiLogProperties(
        @Min(10_000) @Max(20_000_000) int maxPhotoBytes,
        @NotEmpty List<@NotBlank String> allowedMimeTypes,
        @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold,
        @Min(1) @Max(50) int maxItems) {
}
