package io.mrkuhne.mezo.techcore.webpush;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * Known-answer coverage for {@link Aes128GcmEncryptor}, anchored on the official RFC 8291 §5 /
 * Appendix A test vector.
 *
 * <p>The vector is the whole point of this test class: RFC 8291's derivation is a chain of four
 * HMAC calls over five byte-exact {@code info} strings, and every plausible mistake in it — a
 * salt/ikm swap, a typo in an {@code info} label, a {@code 0x01} instead of the {@code 0x02}
 * last-record delimiter, a little-endian record size, a 96-bit GCM tag — still produces a
 * well-formed 144-byte body that only the receiving browser would reject, silently, in production.
 * The published vector is the only local oracle that catches all of those, so the expected values
 * below are transcribed from the RFC text (see the class comment on the constants) and must never
 * be relaxed or replaced with whatever the implementation happens to emit.
 *
 * <p>Around the vector, three deliberately independent angles keep single-point mutations from
 * slipping through:
 *
 * <ul>
 *   <li><b>Isolation</b> — {@link #testEncrypt_shouldDeriveTheRfcCekAndNonce_whenSaltIsPinned()}
 *       decrypts our ciphertext with the CEK and nonce that the RFC itself publishes, separating
 *       "the HKDF chain is right" from "the RFC 8188 framing is right" so a failure points at one
 *       of the two rather than at 144 opaque bytes.
 *   <li><b>Round-trip</b> — {@link #decryptToPaddedPlaintext} is the receive path, written from the
 *       RFC and validated against the RFC's own published body before it is trusted. It is the only
 *       way to check the <i>production</i> overload, whose salt and ephemeral key are random and so
 *       can never be compared against a fixed vector.
 *   <li><b>Deterministic size matrix</b> — the body length is asserted exactly
 *       ({@code 86 + n + 1 + 16}) across plaintext lengths including both edges of the record-size
 *       limit, which pins the delimiter octet and the tag width independently of any key material.
 * </ul>
 */
class Aes128GcmEncryptorTest {

    private static final Base64.Decoder D = Base64.getUrlDecoder();
    private static final Base64.Encoder E = Base64.getUrlEncoder().withoutPadding();

    // === RFC 8291 — transcribed from https://www.rfc-editor.org/rfc/rfc8291.txt, not from memory ==
    // §5 "Push Message Encryption Example" supplies the body and the four keys; Appendix A
    // "Intermediate Values for Encryption" supplies the salt and every intermediate. The RFC prints
    // these blobs line-wrapped ("The base64url values in these examples include whitespace that can
    // be removed"); the whitespace is stripped here and nothing else was changed.

    private static final String PLAINTEXT = "When I grow up, I want to be a watermelon";
    /** Appendix A "Plaintext" — the base64url of the §5 ASCII string, kept as a cross-check. */
    private static final String PLAINTEXT_B64 = "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24";

    /** §5 / Appendix A "User agent public key (ua_public)" — the subscription's `p256dh`. */
    private static final String UA_PUBLIC =
        "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
    /** §5 / Appendix A "User agent private key (ua_private)" — used only by the receive path here. */
    private static final String UA_PRIVATE = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94";
    /** §5 "Authentication Secret" / Appendix A "auth_secret" — the subscription's `auth`. */
    private static final String AUTH_SECRET = "BTBZMqHH6r4Tts7J_aSIgg";
    /** §5 / Appendix A "Application server public key (as_public)". */
    private static final String AS_PUBLIC =
        "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    /** §5 / Appendix A "Application server private key (as_private)". */
    private static final String AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
    /** Appendix A "Salt". */
    private static final String SALT = "DGv6ra1nlYgDCS1FRnbzlw";

    /** §5 request body, the three wrapped lines joined — 144 octets. */
    private static final String EXPECTED_BODY =
        "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml"
            + "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT"
            + "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

    /** Appendix A "The salt, record size of 4096, and application server public key produce an
     * 86-octet header of:" */
    private static final String EXPECTED_HEADER =
        "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml"
            + "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    /** Appendix A "The push message plaintext has the padding delimiter octet (0x02) appended". */
    private static final String EXPECTED_PADDED_PLAINTEXT =
        "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24C";
    /** Appendix A "The plaintext is then encrypted with AES-GCM, which emits ciphertext of:" */
    private static final String EXPECTED_CIPHERTEXT =
        "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ";
    /** Appendix A "Content encryption key (CEK)" — 16 octets. */
    private static final String EXPECTED_CEK = "oIhVW04MRdy2XN9CiKLxTg";
    /** Appendix A "Nonce (NONCE)" — 12 octets. */
    private static final String EXPECTED_NONCE = "4h_95klXJ5E_qnoN";

    // === RFC 8188 / 8291 framing constants, spelled out so the assertions read as the spec ========

    private static final int SALT_LENGTH = 16;
    private static final int PUBLIC_KEY_LENGTH = 65;
    private static final int HEADER_LENGTH = SALT_LENGTH + 4 + 1 + PUBLIC_KEY_LENGTH; // 86
    private static final int GCM_TAG_LENGTH = 16;
    private static final int DELIMITER_LENGTH = 1;
    private static final int DEFAULT_RECORD_SIZE = 4096;
    private static final byte LAST_RECORD_DELIMITER = 0x02;

    private final Aes128GcmEncryptor encryptor = new Aes128GcmEncryptor();

    // === The vector ==============================================================================

    @Test
    void testEncrypt_shouldMatchRfc8291Vector_whenSaltAndEphemeralKeyArePinned() {
        // guard the transcription itself: the §5 ASCII string and the Appendix A base64 must agree
        assertThat(D.decode(PLAINTEXT_B64)).isEqualTo(PLAINTEXT.getBytes(StandardCharsets.UTF_8));

        byte[] body = encryptor.encrypt(
            D.decode(UA_PUBLIC),
            D.decode(AUTH_SECRET),
            PLAINTEXT.getBytes(StandardCharsets.UTF_8),
            D.decode(SALT),
            D.decode(AS_PUBLIC),
            D.decode(AS_PRIVATE),
            DEFAULT_RECORD_SIZE);

        assertThat(E.encodeToString(body)).isEqualTo(EXPECTED_BODY);
    }

    @Test
    void testEncrypt_shouldProduceDistinctBodies_whenCalledTwiceWithRandomSalt() {
        byte[] a = encryptor.encrypt(UA_PUBLIC, AUTH_SECRET, PLAINTEXT.getBytes(StandardCharsets.UTF_8));
        byte[] b = encryptor.encrypt(UA_PUBLIC, AUTH_SECRET, PLAINTEXT.getBytes(StandardCharsets.UTF_8));

        assertThat(a).isNotEqualTo(b); // fresh salt + ephemeral key per call
        // exact, not `greaterThan`: a 96-bit tag or a dropped delimiter would still clear a bound
        assertThat(a).hasSize(HEADER_LENGTH + PLAINTEXT.length() + DELIMITER_LENGTH + GCM_TAG_LENGTH);
        assertThat(b).hasSize(a.length);
        // the salt is the part that must differ even if the ephemeral key generator were broken
        assertThat(Arrays.copyOf(a, SALT_LENGTH)).isNotEqualTo(Arrays.copyOf(b, SALT_LENGTH));
    }

    // === Isolation: derivation vs. framing =======================================================

    /**
     * Splits the vector in half. If the four-HMAC derivation chain is right, the CEK and nonce we
     * computed internally are exactly the ones the RFC publishes, so the RFC's own CEK and nonce
     * must open our ciphertext — and what falls out must be the plaintext with {@code 0x02}
     * appended. A failure here means the derivation is wrong; a passing here with a failing vector
     * test means the RFC 8188 framing is wrong.
     */
    @Test
    void testEncrypt_shouldDeriveTheRfcCekAndNonce_whenSaltIsPinned() throws Exception {
        byte[] body = encryptor.encrypt(
            D.decode(UA_PUBLIC), D.decode(AUTH_SECRET), PLAINTEXT.getBytes(StandardCharsets.UTF_8),
            D.decode(SALT), D.decode(AS_PUBLIC), D.decode(AS_PRIVATE), DEFAULT_RECORD_SIZE);
        byte[] ciphertext = Arrays.copyOfRange(body, HEADER_LENGTH, body.length);

        byte[] padded = aesGcm(
            Cipher.DECRYPT_MODE, D.decode(EXPECTED_CEK), D.decode(EXPECTED_NONCE), ciphertext);

        assertThat(E.encodeToString(padded)).isEqualTo(EXPECTED_PADDED_PLAINTEXT);
        assertThat(padded[padded.length - 1]).isEqualTo(LAST_RECORD_DELIMITER);
        assertThat(E.encodeToString(ciphertext)).isEqualTo(EXPECTED_CIPHERTEXT);
    }

    @Test
    void testEncrypt_shouldEmitTheRfc8188Header_whenSaltAndRecordSizeArePinned() {
        byte[] body = encryptor.encrypt(
            D.decode(UA_PUBLIC), D.decode(AUTH_SECRET), PLAINTEXT.getBytes(StandardCharsets.UTF_8),
            D.decode(SALT), D.decode(AS_PUBLIC), D.decode(AS_PRIVATE), DEFAULT_RECORD_SIZE);

        assertThat(E.encodeToString(Arrays.copyOf(body, HEADER_LENGTH))).isEqualTo(EXPECTED_HEADER);
        // field by field, so a byte-order or offset slip names itself instead of hiding in the blob
        assertThat(Arrays.copyOf(body, SALT_LENGTH)).isEqualTo(D.decode(SALT));
        assertThat(Arrays.copyOfRange(body, 16, 20))
            .as("record size, 4096 big-endian")
            .isEqualTo(new byte[] {0x00, 0x00, 0x10, 0x00});
        assertThat(body[20]).as("keyid length").isEqualTo((byte) PUBLIC_KEY_LENGTH);
        assertThat(Arrays.copyOfRange(body, 21, HEADER_LENGTH)).isEqualTo(D.decode(AS_PUBLIC));
    }

    /**
     * The production overload's own framing: the vector test cannot reach it (it injects nothing),
     * yet this is the path Task 5 calls, so the record size default and the header shape are pinned
     * here directly.
     */
    @Test
    void testEncrypt_shouldUseTheDefaultRecordSizeAndItsOwnEphemeralKey_whenCalledOnTheProductionOverload() {
        byte[] body = encryptor.encrypt(UA_PUBLIC, AUTH_SECRET, PLAINTEXT.getBytes(StandardCharsets.UTF_8));

        assertThat(Arrays.copyOfRange(body, 16, 20)).isEqualTo(new byte[] {0x00, 0x00, 0x10, 0x00});
        assertThat(body[20]).isEqualTo((byte) PUBLIC_KEY_LENGTH);
        // a fresh ephemeral key, never the subscription's key and never the vector's sender key
        byte[] asPublic = Arrays.copyOfRange(body, 21, HEADER_LENGTH);
        assertThat(asPublic).hasSize(PUBLIC_KEY_LENGTH);
        assertThat(asPublic[0]).as("uncompressed point tag").isEqualTo((byte) 0x04);
        assertThat(asPublic).isNotEqualTo(D.decode(UA_PUBLIC)).isNotEqualTo(D.decode(AS_PUBLIC));
    }

    // === Round-trip through an RFC-anchored receiver ==============================================

    /**
     * Drives the production overload — random salt, random ephemeral key — and decrypts the result
     * the way a browser would, using the RFC's user-agent private key as the subscription.
     * {@link #decryptToPaddedPlaintext} is checked against the RFC's published body first, so it is
     * an externally anchored oracle rather than a re-derivation of the code under test.
     */
    @Test
    void testEncrypt_shouldRoundTripToTheReceiver_whenSaltAndEphemeralKeyAreRandom() throws Exception {
        // positive control: the receive path below reproduces the RFC's own plaintext
        assertThat(decryptToPaddedPlaintext(D.decode(EXPECTED_BODY)))
            .isEqualTo(D.decode(EXPECTED_PADDED_PLAINTEXT));

        for (int attempt = 0; attempt < 5; attempt++) {
            byte[] body = encryptor.encrypt(
                UA_PUBLIC, AUTH_SECRET, PLAINTEXT.getBytes(StandardCharsets.UTF_8));

            byte[] padded = decryptToPaddedPlaintext(body);

            assertThat(padded).as("attempt %d", attempt).isEqualTo(D.decode(EXPECTED_PADDED_PLAINTEXT));
            assertThat(padded[padded.length - 1]).isEqualTo(LAST_RECORD_DELIMITER);
        }
    }

    /**
     * Deterministic size matrix, both edges of the record-size limit included. The exact length
     * pins the {@code 0x02} delimiter and the 128-bit tag with no key material involved, and the
     * round-trip proves the padding survives at every size, including the empty payload.
     */
    @Test
    void testEncrypt_shouldSizeTheBodyExactlyAndStayDecryptable_whenPlaintextLengthVaries() throws Exception {
        int maxPlaintext = DEFAULT_RECORD_SIZE - GCM_TAG_LENGTH - DELIMITER_LENGTH; // 4079
        for (int length : new int[] {0, 1, 17, 41, 1000, maxPlaintext}) {
            byte[] plaintext = new byte[length];
            Arrays.fill(plaintext, (byte) 'x');

            byte[] body = encryptor.encrypt(
                D.decode(UA_PUBLIC), D.decode(AUTH_SECRET), plaintext,
                D.decode(SALT), D.decode(AS_PUBLIC), D.decode(AS_PRIVATE), DEFAULT_RECORD_SIZE);

            assertThat(body).as("body length for %d-byte plaintext", length)
                .hasSize(HEADER_LENGTH + length + DELIMITER_LENGTH + GCM_TAG_LENGTH);

            byte[] padded = decryptToPaddedPlaintext(body);
            assertThat(padded).as("round trip for %d-byte plaintext", length)
                .isEqualTo(concat(plaintext, new byte[] {LAST_RECORD_DELIMITER}));
        }
    }

    // === Failure mapping =========================================================================

    @Test
    void testEncrypt_shouldFailWithKeyInvalid_whenTheSubscriptionKeyMaterialIsMalformed() {
        // p256dh and auth arrive from a client, so every rejection here must stay a 400
        assertKeyInvalid(() -> encryptor.encrypt("not base64 !!", AUTH_SECRET, new byte[1]));
        assertKeyInvalid(() -> encryptor.encrypt(UA_PUBLIC, "not base64 !!", new byte[1]));
        assertKeyInvalid(() -> encryptor.encrypt(E.encodeToString(new byte[64]), AUTH_SECRET, new byte[1]));
        assertKeyInvalid(() -> encryptor.encrypt(UA_PUBLIC, E.encodeToString(new byte[15]), new byte[1]));
        assertKeyInvalid(() -> encryptor.encrypt(UA_PUBLIC, E.encodeToString(new byte[17]), new byte[1]));
        // a 65-byte point that is not on P-256 (the tag is right, the coordinates are not)
        byte[] offCurve = new byte[PUBLIC_KEY_LENGTH];
        offCurve[0] = 0x04;
        offCurve[1] = 0x01;
        assertKeyInvalid(() -> encryptor.encrypt(E.encodeToString(offCurve), AUTH_SECRET, new byte[1]));
    }

    @Test
    void testEncrypt_shouldFailWithEncryptFailed_whenOurOwnEncodingInputsAreMalformed() {
        byte[] uaPublic = D.decode(UA_PUBLIC);
        byte[] auth = D.decode(AUTH_SECRET);
        byte[] asPublic = D.decode(AS_PUBLIC);
        byte[] asPrivate = D.decode(AS_PRIVATE);
        byte[] salt = D.decode(SALT);
        byte[] plaintext = PLAINTEXT.getBytes(StandardCharsets.UTF_8);

        // positive control: with every input well formed this exact call succeeds
        assertThat(encryptor.encrypt(uaPublic, auth, plaintext, salt, asPublic, asPrivate, DEFAULT_RECORD_SIZE))
            .hasSize(HEADER_LENGTH + plaintext.length + DELIMITER_LENGTH + GCM_TAG_LENGTH);

        assertEncryptFailed(() -> encryptor.encrypt(
            uaPublic, auth, plaintext, new byte[15], asPublic, asPrivate, DEFAULT_RECORD_SIZE));
        assertEncryptFailed(() -> encryptor.encrypt(
            uaPublic, auth, plaintext, salt, new byte[64], asPrivate, DEFAULT_RECORD_SIZE));
        assertEncryptFailed(() -> encryptor.encrypt(
            uaPublic, auth, plaintext, salt, asPublic, new byte[31], DEFAULT_RECORD_SIZE));
        // rs below the RFC 8188 floor, and a payload one octet too long for a single record
        assertEncryptFailed(() -> encryptor.encrypt(
            uaPublic, auth, plaintext, salt, asPublic, asPrivate, 17));
        assertEncryptFailed(() -> encryptor.encrypt(
            uaPublic, auth, new byte[DEFAULT_RECORD_SIZE - GCM_TAG_LENGTH], salt, asPublic, asPrivate,
            DEFAULT_RECORD_SIZE));
    }

    // === The receive path (RFC 8291 §3.4 read backwards) =========================================

    /**
     * The user-agent half of RFC 8291, written straight from the RFC: read the salt and the sender
     * public key out of the RFC 8188 header, run ECDH with the receiver's private key (which yields
     * the same shared secret as the sender's side), derive the CEK and nonce, and open the record.
     * Returns the plaintext with its delimiter octet still attached so callers can assert it.
     */
    private static byte[] decryptToPaddedPlaintext(byte[] body) throws Exception {
        byte[] salt = Arrays.copyOf(body, SALT_LENGTH);
        int keyIdLength = body[20] & 0xFF;
        byte[] asPublic = Arrays.copyOfRange(body, 21, 21 + keyIdLength);
        byte[] ciphertext = Arrays.copyOfRange(body, 21 + keyIdLength, body.length);
        byte[] uaPublic = D.decode(UA_PUBLIC);

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(VapidSigner.decodePrivateKey(D.decode(UA_PRIVATE)));
        agreement.doPhase(VapidSigner.decodePublicKey(asPublic), true);
        byte[] ecdhSecret = agreement.generateSecret();

        byte[] keyInfo = concat(
            concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[] {0x00}, uaPublic),
            asPublic);
        byte[] ikm = hkdf(D.decode(AUTH_SECRET), ecdhSecret, keyInfo, 32);
        byte[] cek = hkdf(salt, ikm, asciiZ("Content-Encoding: aes128gcm"), 16);
        byte[] nonce = hkdf(salt, ikm, asciiZ("Content-Encoding: nonce"), 12);

        return aesGcm(Cipher.DECRYPT_MODE, cek, nonce, ciphertext);
    }

    private static byte[] aesGcm(int mode, byte[] key, byte[] nonce, byte[] input) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
        return cipher.doFinal(input);
    }

    private static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }

    private static byte[] asciiZ(String label) {
        return concat(label.getBytes(StandardCharsets.US_ASCII), new byte[] {0x00});
    }

    private static byte[] concat(byte[]... parts) {
        int total = 0;
        for (byte[] part : parts) {
            total += part.length;
        }
        byte[] joined = new byte[total];
        int offset = 0;
        for (byte[] part : parts) {
            System.arraycopy(part, 0, joined, offset, part.length);
            offset += part.length;
        }
        return joined;
    }

    private static void assertKeyInvalid(ThrowingCallable call) {
        assertFails(call, "WEBPUSH_KEY_INVALID", HttpStatus.BAD_REQUEST);
    }

    private static void assertEncryptFailed(ThrowingCallable call) {
        assertFails(call, "WEBPUSH_ENCRYPT_FAILED", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private static void assertFails(ThrowingCallable call, String code, HttpStatus status) {
        assertThatExceptionOfType(SystemRuntimeErrorException.class)
            .isThrownBy(call)
            .satisfies(e -> {
                assertThat(e.getMessages()).hasSize(1);
                assertThat(e.getMessages().get(0).getCode()).isEqualTo(code);
                assertThat(e.getStatus()).isEqualTo(status);
            });
    }
}
