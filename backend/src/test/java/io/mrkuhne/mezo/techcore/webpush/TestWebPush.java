package io.mrkuhne.mezo.techcore.webpush;

import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import org.springframework.web.client.RestClient;

/**
 * Plain (no Spring context) helper that assembles a real {@link WebPushClient} — real
 * {@link VapidSigner}, real {@link Aes128GcmEncryptor}, a plain {@code RestClient} — for
 * WireMock-backed unit tests. {@link #UA_PUBLIC} / {@link #AUTH} are one generated "browser
 * subscription" keypair + auth secret, shared by every test in {@link WebPushClientIT}; each call
 * to {@link #clientWithGeneratedKeys()} gets its own fresh VAPID keypair.
 */
final class TestWebPush {

    private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();
    private static final SecureRandom RANDOM = new SecureRandom();

    /** The "browser subscription" public key (p256dh) — base64url uncompressed P-256 point. */
    static final String UA_PUBLIC;

    /** The "browser subscription" 16-byte auth secret — base64url. */
    static final String AUTH;

    static {
        KeyPair uaKeyPair = generateKeyPair();
        UA_PUBLIC = B64URL.encodeToString(VapidSigner.encodePublicKey((ECPublicKey) uaKeyPair.getPublic()));
        byte[] auth = new byte[16];
        RANDOM.nextBytes(auth);
        AUTH = B64URL.encodeToString(auth);
    }

    private TestWebPush() {
    }

    /** Builds a real {@link WebPushClient} over a freshly generated VAPID keypair. */
    static WebPushClient clientWithGeneratedKeys() {
        KeyPair vapidKeyPair = generateKeyPair();
        String vapidPublic =
            B64URL.encodeToString(VapidSigner.encodePublicKey((ECPublicKey) vapidKeyPair.getPublic()));
        String vapidPrivate =
            B64URL.encodeToString(VapidSigner.encodePrivateKey((ECPrivateKey) vapidKeyPair.getPrivate()));

        WebPushProperties properties =
            new WebPushProperties("mailto:test@example.com", vapidPublic, vapidPrivate, 3600, 5000);
        VapidSigner signer = new VapidSigner(properties);
        Aes128GcmEncryptor encryptor = new Aes128GcmEncryptor();

        return new WebPushClient(signer, encryptor, properties, RestClient.builder());
    }

    private static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"));
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
