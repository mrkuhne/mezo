package io.mrkuhne.mezo.feature.notification.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Push notification content tunables (bd mezo-h4wp.6.1). N2 extends this same record rather than
 * inventing a second one.
 *
 * @param bodyMaxChars notification body is truncated to this many chars before {@link
 *     io.mrkuhne.mezo.feature.notification.service.PushSender} encrypts and sends it
 */
@Validated
@ConfigurationProperties(prefix = "mezo.notification")
public record NotificationProperties(@Min(20) @Max(2000) int bodyMaxChars) {}
