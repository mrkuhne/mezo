package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Diagnosis (mezo-hqfi, spec 2026-08-31 §3.2/§5) — every constant the collector and the quota
 * depend on, in one documented home (the {@code QuarterlyProperties} precedent). Picked up by
 * {@code @ConfigurationPropertiesScan}.
 *
 * @param windowDays      the diagnosed window, ending today (inclusive).
 * @param baselineDays    the comparison window immediately preceding {@code windowDays}.
 * @param minCoverageDays how many measured days a metric needs inside the window before it may
 *                        become an evidence candidate at all — below this it is dropped, because
 *                        a two-day average is not a finding.
 * @param minDomains      how many distinct {@code MetricDomain}s must survive coverage before a
 *                        diagnosis is attempted; below this the request is an honest 409.
 * @param maxPerDay       generations allowed per user per calendar day (soft-deleted rows count,
 *                        so regenerate-spam counts).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive.diagnosis")
public record DiagnosisProperties(
    @Min(7) @Max(90) int windowDays,
    @Min(7) @Max(180) int baselineDays,
    @Min(1) @Max(30) int minCoverageDays,
    @Min(1) @Max(6) int minDomains,
    @Min(1) @Max(50) int maxPerDay
) {
}
