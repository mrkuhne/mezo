package io.mrkuhne.mezo.techcore.webpush;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.InvalidKeyException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * RFC 8291 Web Push payload encryption — the {@code aes128gcm} content coding of RFC 8188 — on plain
 * JDK crypto only, no BouncyCastle.
 *
 * <p>Produces the complete HTTP request body for one push message: a single encrypted record whose
 * RFC 8188 header carries the salt, the record size and the ephemeral sender public key, so the
 * receiving browser can re-derive the key without any out-of-band state.
 *
 * <p><b>Why this is written out by hand.</b> The derivation is a chain of four HMAC-SHA256 calls
 * over five byte-exact {@code info} labels, and nothing about it fails loudly: a salt/ikm swap, a
 * typo in a label, a {@code 0x01} instead of the {@code 0x02} last-record delimiter or a
 * little-endian record size all still yield a well-formed body that only the browser rejects —
 * silently, on the user's device, with no server-side signal. The
 * {@link Aes128GcmEncryptorTest RFC 8291 §5 test vector} is therefore the load-bearing part of this
 * class: it is the only local oracle that proves the chain, which is why the test-seam overload
 * exists at all.
 *
 * <p><b>Why the sender public key is passed in rather than derived.</b> Plain JDK APIs expose no EC
 * point multiplication, so a public key cannot be recomputed from a private scalar. Both halves are
 * therefore carried together everywhere: the production overload generates a {@link KeyPair} and
 * hands both encodings down, and the test seam takes both from the RFC vector.
 *
 * <p><b>Failure mapping</b> (as established by {@link VapidSigner}): {@code WEBPUSH_KEY_INVALID}
 * (400) is reserved for material that arrived from a client — a subscription's {@code p256dh} and
 * {@code auth}. Everything rooted in our own key generation, encoding or record framing raises
 * {@code WEBPUSH_ENCRYPT_FAILED} (500).
 *
 * <p>HKDF is not in Java 21's public API (the {@code KDF} API landed in JDK 24), hence the
 * eight-line {@link #hkdf} below. Every output here is at most 32 bytes, so a single expand block
 * always suffices and the block counter is a constant {@code 0x01}.
 */
@Component
public class Aes128GcmEncryptor {

    /** RFC 8188 header salt, and RFC 8291's fixed width for the subscription's auth secret. */
    private static final int SALT_LENGTH = 16;
    private static final int AUTH_SECRET_LENGTH = 16;
    /** Uncompressed P-256 point — the {@code keyid} that RFC 8291 puts in the RFC 8188 header. */
    private static final int PUBLIC_KEY_LENGTH = 65;
    private static final int PRIVATE_KEY_LENGTH = 32;
    private static final int RECORD_SIZE_LENGTH = 4;
    private static final int KEY_ID_LENGTH_LENGTH = 1;
    /** salt(16) ‖ rs(4) ‖ idlen(1) ‖ keyid(65) — 86 octets. */
    private static final int HEADER_LENGTH =
        SALT_LENGTH + RECORD_SIZE_LENGTH + KEY_ID_LENGTH_LENGTH + PUBLIC_KEY_LENGTH;

    private static final int PRK_LENGTH = 32;
    private static final int CEK_LENGTH = 16;
    private static final int NONCE_LENGTH = 12;
    /** RFC 8188 mandates the full 128-bit GCM tag; a truncated tag weakens the record silently. */
    private static final int GCM_TAG_BITS = 128;
    private static final int GCM_TAG_LENGTH = GCM_TAG_BITS / Byte.SIZE;

    /** RFC 8291 §4: 4096 is what every push service accepts and what the RFC's example uses. */
    private static final int DEFAULT_RECORD_SIZE = 4096;
    /** RFC 8188 §2: {@code rs} must leave room for one content octet, the delimiter and the tag. */
    private static final int MIN_RECORD_SIZE = GCM_TAG_LENGTH + 2;

    /**
     * RFC 8188 §2 record delimiter. We always emit exactly one record, so it is always the
     * <i>last</i> record: {@code 0x02}, never the {@code 0x01} that marks a record with more to
     * follow.
     */
    private static final byte LAST_RECORD_DELIMITER = 0x02;

    /** RFC 8291 §3.4 key-combining label; the two public keys are appended per call. */
    private static final byte[] KEY_INFO_PREFIX = labelWithTerminator("WebPush: info");
    private static final byte[] CEK_INFO = labelWithTerminator("Content-Encoding: aes128gcm");
    private static final byte[] NONCE_INFO = labelWithTerminator("Content-Encoding: nonce");

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String CIPHER_ALGORITHM = "AES/GCM/NoPadding";

    private static final Base64.Decoder B64URL_DECODER = Base64.getUrlDecoder();

    /** Shared by the per-message salt and the per-message ephemeral keypair; thread-safe. */
    private final SecureRandom random = new SecureRandom();

    /**
     * Encrypts one push payload for a browser subscription, generating a fresh salt and a fresh
     * ephemeral P-256 keypair for this message — both are single-use by RFC 8291 §3.1.
     *
     * @param p256dhBase64Url the subscription's {@code p256dh}: a base64url uncompressed P-256 point
     * @param authBase64Url the subscription's {@code auth}: a base64url 16-byte shared secret
     * @param plaintext the message body to encrypt, at most {@code 4079} bytes
     * @return the complete {@code Content-Encoding: aes128gcm} request body
     * @throws SystemRuntimeErrorException {@code WEBPUSH_KEY_INVALID} (400) if the subscription's
     *     key material is malformed, {@code WEBPUSH_ENCRYPT_FAILED} (500) on any of our own failures
     */
    public byte[] encrypt(String p256dhBase64Url, String authBase64Url, byte[] plaintext) {
        byte[] uaPublicKey = decodeClientValue(p256dhBase64Url);
        byte[] authSecret = decodeClientValue(authBase64Url);

        byte[] salt = new byte[SALT_LENGTH];
        random.nextBytes(salt);
        KeyPair ephemeral = generateEphemeralKeyPair();

        return encrypt(
            uaPublicKey,
            authSecret,
            plaintext,
            salt,
            VapidSigner.encodePublicKey((ECPublicKey) ephemeral.getPublic()),
            VapidSigner.encodePrivateKey((ECPrivateKey) ephemeral.getPrivate()),
            DEFAULT_RECORD_SIZE);
    }

    /**
     * The full derivation with every random input injected — the seam the RFC 8291 §5 vector test
     * drives, and the implementation the production overload delegates to.
     *
     * <p>{@code asPublicKey} is the sender public key matching {@code asPrivateKey}; it is <b>not</b>
     * verified against the scalar (no EC point multiplication in plain JDK), it is taken on trust
     * from the caller that generated the pair.
     *
     * @param uaPublicKey receiver public key, 65-byte uncompressed point (client-supplied)
     * @param authSecret receiver auth secret, 16 bytes (client-supplied)
     * @param plaintext the message body; {@code plaintext.length + 17} must fit in {@code recordSize}
     * @param salt 16 single-use bytes, echoed into the header
     * @param asPublicKey sender public key, 65-byte uncompressed point, echoed into the header
     * @param asPrivateKey sender private key, raw 32-byte scalar
     * @param recordSize the RFC 8188 {@code rs} field; at least 18
     * @return the complete {@code Content-Encoding: aes128gcm} request body
     */
    public byte[] encrypt(
        byte[] uaPublicKey,
        byte[] authSecret,
        byte[] plaintext,
        byte[] salt,
        byte[] asPublicKey,
        byte[] asPrivateKey,
        int recordSize) {

        if (authSecret.length != AUTH_SECRET_LENGTH) {
            throw keyInvalid();
        }
        if (salt.length != SALT_LENGTH
            || asPublicKey.length != PUBLIC_KEY_LENGTH
            || asPrivateKey.length != PRIVATE_KEY_LENGTH) {
            throw encryptFailed();
        }
        // One record only, so the whole payload has to fit in it — a longer payload would need the
        // 0x01 delimiter and further records, which this encoder deliberately does not emit.
        byte[] paddedPlaintext = Arrays.copyOf(plaintext, plaintext.length + 1);
        paddedPlaintext[plaintext.length] = LAST_RECORD_DELIMITER;
        if (recordSize < MIN_RECORD_SIZE || paddedPlaintext.length + GCM_TAG_LENGTH > recordSize) {
            throw encryptFailed();
        }

        try {
            byte[] ecdhSecret = ecdhSecret(asPrivateKey, uaPublicKey);
            byte[] prkKey = hkdf(authSecret, ecdhSecret, keyInfo(uaPublicKey, asPublicKey), PRK_LENGTH);
            byte[] cek = hkdf(salt, prkKey, CEK_INFO, CEK_LENGTH);
            byte[] nonce = hkdf(salt, prkKey, NONCE_INFO, NONCE_LENGTH);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
            cipher.init(
                Cipher.ENCRYPT_MODE,
                new SecretKeySpec(cek, "AES"),
                new GCMParameterSpec(GCM_TAG_BITS, nonce));
            byte[] ciphertext = cipher.doFinal(paddedPlaintext);

            // ByteBuffer is big-endian by contract, which is exactly the RFC 8188 header's order.
            return ByteBuffer.allocate(HEADER_LENGTH + ciphertext.length)
                .put(salt)
                .putInt(recordSize)
                .put((byte) PUBLIC_KEY_LENGTH)
                .put(asPublicKey)
                .put(ciphertext)
                .array();
        } catch (GeneralSecurityException e) {
            throw encryptFailed();
        }
    }

    /**
     * The ECDH shared secret Z, i.e. the x-coordinate of {@code asPrivate · uaPublic}. The receiver
     * reaches the same value from the other side ({@code uaPrivate · asPublic}).
     *
     * <p>This is where RFC 8291 §7's "the application MUST verify that the public key they receive
     * is on the P-256 curve" actually bites: {@code KeyFactory} happily builds an {@link ECPublicKey}
     * from coordinates that do not satisfy the curve equation, and only {@link KeyAgreement#doPhase}
     * rejects them. That rejection is therefore attributed to the client's {@code p256dh} (400) —
     * our own scalar was already validated by {@link VapidSigner#decodePrivateKey}, which raises its
     * own 500 before we get here.
     */
    private static byte[] ecdhSecret(byte[] asPrivateKey, byte[] uaPublicKey)
        throws GeneralSecurityException {
        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(VapidSigner.decodePrivateKey(asPrivateKey));
        ECPublicKey uaPublic = VapidSigner.decodePublicKey(uaPublicKey);
        try {
            agreement.doPhase(uaPublic, true);
        } catch (InvalidKeyException e) {
            throw keyInvalid();
        }
        return agreement.generateSecret();
    }

    /**
     * RFC 8291 §3.4 {@code key_info}: {@code "WebPush: info" ‖ 0x00 ‖ ua_public ‖ as_public}. The
     * order is receiver-then-sender on both sides of the exchange, so it must not be swapped.
     */
    private static byte[] keyInfo(byte[] uaPublicKey, byte[] asPublicKey) {
        return ByteBuffer.allocate(KEY_INFO_PREFIX.length + uaPublicKey.length + asPublicKey.length)
            .put(KEY_INFO_PREFIX)
            .put(uaPublicKey)
            .put(asPublicKey)
            .array();
    }

    /**
     * HKDF-SHA256 (RFC 5869): extract with {@code salt}, then a single expand block. Valid only for
     * {@code length <= 32}, which holds for every derivation in RFC 8291.
     */
    private static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length)
        throws GeneralSecurityException {
        Mac mac = Mac.getInstance(HMAC_ALGORITHM);
        mac.init(new SecretKeySpec(salt.length == 0 ? new byte[PRK_LENGTH] : salt, HMAC_ALGORITHM));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, HMAC_ALGORITHM));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }

    /** A single-use P-256 keypair for one message, seeded from this bean's {@link SecureRandom}. */
    private KeyPair generateEphemeralKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"), random);
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw encryptFailed();
        }
    }

    /** Decodes a base64url value that came from a client subscription — malformed input is a 400. */
    private static byte[] decodeClientValue(String base64Url) {
        try {
            return B64URL_DECODER.decode(base64Url);
        } catch (IllegalArgumentException e) {
            throw keyInvalid();
        }
    }

    /** {@code label ‖ 0x00} — RFC 8188/8291 terminate every {@code info} label with a NUL. */
    private static byte[] labelWithTerminator(String label) {
        byte[] ascii = label.getBytes(StandardCharsets.US_ASCII);
        return Arrays.copyOf(ascii, ascii.length + 1);
    }

    /** The subscription's own key material was malformed (its `p256dh` or `auth`). */
    private static SystemRuntimeErrorException keyInvalid() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("WEBPUSH_KEY_INVALID").build(), HttpStatus.BAD_REQUEST);
    }

    /** Our own key generation, encoding or record framing failed. */
    private static SystemRuntimeErrorException encryptFailed() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("WEBPUSH_ENCRYPT_FAILED").build(), HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
