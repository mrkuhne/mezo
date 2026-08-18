package io.mrkuhne.mezo.feature.notification.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * In-app notification feed tunables (bd mezo-gzhp.1, spec 2026-08-18 §4).
 *
 * @param limit max rows the feed read returns (newest first)
 * @param inboxMinAbsR the pattern_inbox strength gate's |r| floor — MUST equal the FE
 *     {@code STRONG_SIGNAL.minAbsR} ({@code frontend/src/data/insights/insights.ts}); both sides
 *     pin it by test so the bell can never disagree with the dashboard's decide bucket
 * @param inboxMaxP the same gate's p ceiling — mirrors {@code STRONG_SIGNAL.maxP}
 * @param bandPromising |r| band edge #1 (0.3) — mirrors the FE {@code strengthWord} bands
 *     ({@code features/insights/logic/findings.ts}); pattern_signal emits only on a band crossing
 * @param bandStrong |r| band edge #2 (0.6) — same mirror
 */
@Validated
@ConfigurationProperties(prefix = "mezo.notification.feed")
public record NotificationFeedProperties(
        @Min(1) @Max(200) int limit,
        @DecimalMin("0.0") @DecimalMax("1.0") double inboxMinAbsR,
        @DecimalMin("0.0") @DecimalMax("1.0") double inboxMaxP,
        @DecimalMin("0.0") @DecimalMax("1.0") double bandPromising,
        @DecimalMin("0.0") @DecimalMax("1.0") double bandStrong) {}
