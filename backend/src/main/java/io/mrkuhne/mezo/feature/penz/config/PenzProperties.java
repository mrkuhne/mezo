package io.mrkuhne.mezo.feature.penz.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Boop Pénz tunables (L4, mezo-r36n9.102, spec §7 / §10.1.2).
 *
 * @param frankfurterBaseUrl          the ECB reference-rate API ({@code /v1}); overridden to WireMock in ITs.
 * @param connectTimeoutMs            connect timeout of the rate fetch.
 * @param readTimeoutMs               read timeout of the rate fetch.
 * @param userAgent                   identifies the app to frankfurter.
 * @param fxFallbackDays              provider down: the newest cached rate at most this many days BEFORE the
 *                                    asked date is used; none → {@code PENZ_FX_UNAVAILABLE} (503).
 * @param practiceMonthlyDefaultMinor the Gyakorlás monthly cap a new settings row starts with, HUF minor units
 *                                    (2 000 000 = 20 000 Ft).
 * @param smsPerMinute                SMS-ingest calls one API key may make in any rolling minute; the next one
 *                                    answers 429 {@code PENZ_SMS_RATE_LIMITED} with Retry-After.
 * @param smsPerDay                   SMS-ingest calls one API key may make per UTC day.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.penz")
public record PenzProperties(
        @DefaultValue("https://api.frankfurter.dev/v1") @NotBlank String frankfurterBaseUrl,
        @DefaultValue("3000") @Min(100) @Max(30_000) int connectTimeoutMs,
        @DefaultValue("5000") @Min(100) @Max(30_000) int readTimeoutMs,
        @DefaultValue("mezo/1.0 (boop-penz)") @NotBlank String userAgent,
        @DefaultValue("7") @Min(0) @Max(31) int fxFallbackDays,
        @DefaultValue("2000000") @Min(0) long practiceMonthlyDefaultMinor,
        @DefaultValue("20") @Min(1) @Max(10_000) int smsPerMinute,
        @DefaultValue("500") @Min(1) @Max(100_000) int smsPerDay) {
}
