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
 * @param yahooBaseUrl                the quote source (Yahoo chart endpoint, L6 mezo-r36n9.104); WireMock in ITs.
 * @param yahooAllowedHost            the one host the quote fetch may reach (the fetcher's allow-list).
 * @param quoteRefetchMinutes         a cached quote older than today is fetched again at most this often.
 * @param fetchTimeoutMs              connect and read timeout of every guarded outbound fetch (quotes, news).
 * @param fetchUserAgent              the user-agent of the guarded fetch (Yahoo answers bots with 429).
 * @param allowLoopbackForTests       TEST ONLY: lets the guarded fetch reach a loopback WireMock (any port).
 *                                    Never set outside an IT property source; production keeps false.
 * @param fetchDeadlineMs             the overall budget of one guarded fetch, body included: a slow drip is cut
 *                                    off here, so it cannot hold the single news thread (security review #12).
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
        @DefaultValue("500") @Min(1) @Max(100_000) int smsPerDay,
        @DefaultValue("https://query1.finance.yahoo.com") @NotBlank String yahooBaseUrl,
        @DefaultValue("query1.finance.yahoo.com") @NotBlank String yahooAllowedHost,
        @DefaultValue("60") @Min(1) @Max(1_440) int quoteRefetchMinutes,
        @DefaultValue("8000") @Min(100) @Max(30_000) int fetchTimeoutMs,
        @DefaultValue("Mozilla/5.0") @NotBlank String fetchUserAgent,
        @DefaultValue("false") boolean allowLoopbackForTests,
        @DefaultValue("20000") @Min(500) @Max(120_000) int fetchDeadlineMs) {
}
