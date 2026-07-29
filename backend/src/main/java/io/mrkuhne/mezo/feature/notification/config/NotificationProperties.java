package io.mrkuhne.mezo.feature.notification.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Push notification content tunables (bd mezo-h4wp.6.1). N2 extends this same record rather than
 * inventing a second one.
 *
 * @param bodyMaxChars notification body is truncated to this many chars before {@link
 *     io.mrkuhne.mezo.feature.notification.service.PushSender} encrypts and sends it
 * @param medicationTime the fixed HH:mm the {@code medication} category anchors on — medication
 *     has no per-day time column, only {@code MedicationCycleService}'s derived cycle day (spec §6)
 * @param proseExcerptChars how much of an already-generated prose row (briefing/heartbeat/weekly/
 *     memoir) {@code AnchorResolver} excerpts into a push body — cut at a word boundary, never a
 *     new LLM call on the push path (spec §6)
 */
@Validated
@ConfigurationProperties(prefix = "mezo.notification")
public record NotificationProperties(
        @Min(20) @Max(2000) int bodyMaxChars,
        @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d") String medicationTime,
        @Min(20) @Max(2000) int proseExcerptChars) {}
