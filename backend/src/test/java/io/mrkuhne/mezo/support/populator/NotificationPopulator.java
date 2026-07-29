package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class NotificationPopulator {

    /**
     * A <b>genuinely valid</b> subscription {@code p256dh}: the RFC 8291 §5 "User agent public key"
     * — 65 base64url-decoded bytes on the P-256 curve. It has to be real key material, not merely
     * valid-looking: {@code Aes128GcmEncryptor} rejects a wrong-width or off-curve point with
     * {@code WEBPUSH_KEY_INVALID}, which {@code WebPushClient} now classifies as {@code GONE}, so a
     * fake key would make every fixture device prune itself and quietly turn "the push failed"
     * tests into "the device was deleted" tests.
     */
    public static final String VALID_P256DH =
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";

    /** The matching RFC 8291 §5 "Authentication Secret" — exactly 16 base64url-decoded bytes. */
    public static final String VALID_AUTH = "BTBZMqHH6r4Tts7J_aSIgg";

    /** Deliberately the wrong width (not 65 bytes) — a row that can never deliver. */
    public static final String MALFORMED_P256DH = "BOr1a2b3";

    private final PushSubscriptionRepository pushSubscriptionRepository;

    /** A live subscription whose key material is real enough to reach the encrypt+sign path. */
    public PushSubscriptionEntity subscription(UUID owner, String endpoint) {
        return subscription(owner, endpoint, VALID_P256DH);
    }

    /** Same, with caller-chosen {@code p256dh} — for the malformed-key pruning path. */
    public PushSubscriptionEntity subscription(UUID owner, String endpoint, String p256dh) {
        PushSubscriptionEntity e = new PushSubscriptionEntity();
        e.setCreatedBy(owner);
        e.setEndpoint(endpoint);
        e.setP256dh(p256dh);
        e.setAuth(VALID_AUTH);
        e.setUserAgent("iPhone");
        return pushSubscriptionRepository.saveAndFlush(e);
    }
}
