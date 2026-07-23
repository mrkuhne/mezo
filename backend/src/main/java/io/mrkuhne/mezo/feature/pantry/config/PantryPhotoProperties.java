package io.mrkuhne.mezo.feature.pantry.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.pantry-photo.*} — the label-photo import (mezo-d8tr): upload limits + the
 * confidence threshold at/below which a draft is flagged needs-review (boundary-inclusive,
 * same IEEE-754-motivated semantics as the scrape — see PantryScrapeService).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.pantry-photo")
public record PantryPhotoProperties(

    /** Hard cap per uploaded photo, in bytes (service-level, message-bearing check). */
    @Min(10_000) int maxPhotoBytes,

    /** Accepted photo MIME types (iOS converts HEIC to JPEG on file inputs). */
    @NotEmpty List<String> allowedMimeTypes,

    /** At/below this extraction confidence the draft lands as needs-review. */
    @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold
) {
}
