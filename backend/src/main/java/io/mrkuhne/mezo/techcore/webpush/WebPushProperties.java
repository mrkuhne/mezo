package io.mrkuhne.mezo.techcore.webpush;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Web Push (RFC 8030/8291/8292) tunables. The private key is a k8s SealedSecret in production and
 * an untracked local env var in development — never a committed literal.
 *
 * @param subject VAPID `sub` claim — a {@code mailto:} or {@code https:} contact for the push
 *     service operator, the only two forms RFC 8292 §2.1 allows. Validated rather than trusted: the
 *     value is spliced unescaped into the signed JWT's claims, and a malformed one would otherwise
 *     produce well-formed tokens that every push service rejects with 401, silently and forever.
 * @param publicKey  VAPID public key, base64url, uncompressed P-256 point (65 bytes, 0x04-prefixed)
 * @param privateKey VAPID private key, base64url, 32-byte P-256 scalar
 * @param timeoutMs connect + read timeout for the outbound push POST ({@link WebPushClient}) — a
 *     hung push service must not hold a caller's thread
 */
@Validated
@ConfigurationProperties(prefix = "mezo.webpush")
public record WebPushProperties(
    @NotBlank @Pattern(regexp = "^(mailto:|https://).+") String subject,
    @NotBlank String publicKey,
    @NotBlank String privateKey,
    @Min(0) @Max(2419200) int defaultTtlSeconds,
    @Min(100) @Max(30_000) int timeoutMs) {

    /** The {@code application.yml} defaults for the two keys that have no real default. */
    static final String ABSENT_PUBLIC_KEY = "dummy-vapid-public";
    static final String ABSENT_PRIVATE_KEY = "dummy-vapid-private";

    /**
     * Treats a blank VAPID key as an <b>absent</b> one.
     *
     * <p>{@code ${VAPID_PRIVATE:dummy-vapid-private}} substitutes its default only when the
     * variable is missing, not when it is present-but-empty. An empty SealedSecret value therefore
     * binds as {@code ""} and trips {@code @NotBlank}, which aborts context startup for the
     * <i>whole application</i> — every unrelated feature down with it — even when the notification
     * feature is switched off. That is a strictly worse outcome than the one the constraint exists
     * to prevent, so a blank value normalises to the same placeholder the yml default uses.
     *
     * <p>Nothing is silently tolerated by doing so: the placeholder is not a valid P-256 scalar, so
     * the loud failure simply moves from "no application at all" to "the send that used it" —
     * {@code VapidSigner.decodePrivateKey} rejects its non-32-byte width with
     * {@code WEBPUSH_SIGN_FAILED}, which {@link WebPushClient} maps to {@code FAILED} and therefore
     * prunes nothing. {@code @NotBlank} still guards a genuinely {@code null} binding.
     */
    public WebPushProperties {
        if (publicKey != null && publicKey.isBlank()) {
            publicKey = ABSENT_PUBLIC_KEY;
        }
        if (privateKey != null && privateKey.isBlank()) {
            privateKey = ABSENT_PRIVATE_KEY;
        }
    }
}
