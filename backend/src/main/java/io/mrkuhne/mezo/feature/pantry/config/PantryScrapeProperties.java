package io.mrkuhne.mezo.feature.pantry.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.pantry-scrape.*} — the URL-scrape import (mezo-8vum): outbound page fetch
 * limits + the confidence threshold below which a confirmed import lands as manual-review.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.pantry-scrape")
public record PantryScrapeProperties(

    /** Connect + read timeout for the product-page fetch, in milliseconds. */
    @Min(100) @Max(30_000) int timeoutMs,

    /** Hard cap on the downloaded HTML size, in bytes (oversize -> fetch-failed). */
    @Min(10_000) @Max(10_000_000) int maxBodyBytes,

    /** Browser-like User-Agent (some shops 403 obvious bots). */
    @NotBlank String userAgent,

    /** Accept-Language header — Hungarian shops render HU nutrition tables. */
    @NotBlank String acceptLanguage,

    /** Below this extraction confidence the confirmed import's feed status is manual-review. */
    @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold,

    /** SSRF guard escape hatch for ITs (WireMock is loopback). NEVER true outside tests. */
    boolean allowPrivateHosts
) {
}
