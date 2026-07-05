package io.mrkuhne.mezo.feature.pantry.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.pantry-suggestion.*} — the deterministic Kamra swap heuristics
 * (Fuel P6, mezo-bka): cheaper-alternative + low-NOVA within a category the user owns.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.pantry-suggestion")
public record PantrySuggestionProperties(

    /** Max suggestions surfaced in PantryResponse.suggestions. */
    @Min(1) @Max(10) int maxItems,

    /**
     * Cheaper-alternative trigger: the cheapest same-category item must cost at most this
     * fraction of the priciest one (0.8 = at least 20% cheaper).
     */
    @NotNull @DecimalMin("0.1") @DecimalMax("1.0") BigDecimal cheaperRatio
) {
}
