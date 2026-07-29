package io.mrkuhne.mezo.techcore.webpush;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Web Push (RFC 8030/8291/8292) tunables. The private key is a k8s SealedSecret in production and
 * an untracked local env var in development — never a committed literal.
 *
 * @param subject VAPID `sub` claim — a mailto: or https: contact for the push service operator
 * @param publicKey  VAPID public key, base64url, uncompressed P-256 point (65 bytes, 0x04-prefixed)
 * @param privateKey VAPID private key, base64url, 32-byte P-256 scalar
 */
@Validated
@ConfigurationProperties(prefix = "mezo.webpush")
public record WebPushProperties(
    @NotBlank String subject,
    @NotBlank String publicKey,
    @NotBlank String privateKey,
    @Min(0) @Max(2419200) int defaultTtlSeconds) {}
