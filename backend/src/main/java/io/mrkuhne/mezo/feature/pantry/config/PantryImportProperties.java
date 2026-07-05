package io.mrkuhne.mezo.feature.pantry.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.pantry-import.*} — the OpenFoodFacts lookup client (Fuel P6, mezo-bka).
 * Deterministic HTTP, not AI: OFF carries {@code nova_group}, so NOVA is a passthrough.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.pantry-import")
public record PantryImportProperties(

    /** OpenFoodFacts base URL (overridden to WireMock in ITs). */
    @NotBlank String baseUrl,

    /** Connect + read timeout for OFF calls, in milliseconds. */
    @Min(100) @Max(30_000) int timeoutMs,

    /** OFF etiquette requires an identifying User-Agent ("app/version (contact)"). */
    @NotBlank String userAgent,

    /** Max results requested from the OFF text search (and returned by /api/pantry/lookup). */
    @Min(1) @Max(50) int searchPageSize,

    /** How many recent import-feed rows PantryResponse.imports carries. */
    @Min(1) @Max(50) int feedSize
) {
}
