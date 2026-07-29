package io.mrkuhne.mezo.techcore.webpush;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigInteger;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * Deterministic, known-answer coverage for the fixed-width field-element padding that every P-256
 * value in {@link VapidSigner} routes through, plus the strictness and claim-injection guards.
 *
 * <p>Why this exists alongside {@link VapidSignerTest}: a real ECDSA signature has a short r or s
 * only ~0.27% of the time, so a sign-and-verify test passes ~99.7% of the time even with a
 * right-padding or fixed-offset bug intact — the output is still 64 bytes and still verifies for
 * almost every keypair. These vectors pin the padding contract instead of sampling it.
 *
 * <p>The DER inputs are built by this test's own encoder: {@code BigInteger.toByteArray()} already
 * emits exactly the content bytes of a DER INTEGER (minimal length, {@code 0x00} sign byte when the
 * high bit is set), so the expected values below are independent of the production padding code
 * rather than a re-derivation of it.
 */
class VapidSignerCodecTest {

    private static final HexFormat HEX = HexFormat.of();
    private static final Instant NOW = Instant.parse("2026-07-29T06:00:00Z");

    // === The padding contract, written out literally: expected 32-byte JOSE blocks ==============

    /** 32 significant bytes, high bit set — DER carries a 0x00 sign byte (33 content bytes). */
    private static final String HIGH_SET_32 = "ff112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    /** 32 significant bytes, high bit clear — DER content is exactly 32 bytes. */
    private static final String HIGH_CLEAR_32 = "7f112233445566778899aabbccddeeff00112233445566778899aabbccddee11";
    /** 31 significant bytes, high bit clear — DER content is 31 bytes, so JOSE left-pads one. */
    private static final String SHORT_31 = "007b2233445566778899aabbccddeeff00112233445566778899aabbccddee22";
    /** 31 significant bytes, high bit set — DER content is 32 bytes, but only 31 are magnitude. */
    private static final String SHORT_31_HIGH = "00ab2233445566778899aabbccddeeff00112233445566778899aabbccddee33";
    /** 1 significant byte — JOSE left-pads 31 zeros. */
    private static final String SHORT_1 = "000000000000000000000000000000000000000000000000000000000000002a";
    /** The zero edge — DER encodes it as the single content byte 0x00. */
    private static final String ZERO_32 = "0000000000000000000000000000000000000000000000000000000000000000";

    private static final String[] SHAPES = {HIGH_SET_32, HIGH_CLEAR_32, SHORT_31, SHORT_1, ZERO_32};

    @Test
    void testDerToJose_shouldLeftPadBothIntegersToFixedWidth_whenRAndSVaryInWidthAndSignBit() {
        for (String rBlock : SHAPES) {
            for (String sBlock : SHAPES) {
                byte[] expected = HEX.parseHex(rBlock + sBlock);
                assertThat(expected).as("vector width r=%s s=%s", rBlock, sBlock).hasSize(64);

                byte[] der = derSignature(magnitude(rBlock), magnitude(sBlock));

                assertThat(VapidSigner.derToJose(der))
                    .as("derToJose r=%s s=%s", rBlock, sBlock)
                    .isEqualTo(expected);
            }
        }
        // 31-byte magnitude whose high bit is set: DER content is 32 bytes yet one byte of padding
        // is still required, the shape most likely to be mishandled by a length-based shortcut.
        assertThat(VapidSigner.derToJose(derSignature(magnitude(SHORT_31_HIGH), magnitude(SHORT_1))))
            .isEqualTo(HEX.parseHex(SHORT_31_HIGH + SHORT_1));
    }

    @Test
    void testJoseToDer_shouldEmitCanonicalMinimalDer_whenRAndSVaryInWidthAndSignBit() {
        for (String rBlock : SHAPES) {
            for (String sBlock : SHAPES) {
                byte[] expectedDer = derSignature(magnitude(rBlock), magnitude(sBlock));

                assertThat(VapidSigner.joseToDer(HEX.parseHex(rBlock + sBlock)))
                    .as("joseToDer r=%s s=%s", rBlock, sBlock)
                    .isEqualTo(expectedDer);
            }
        }
        assertThat(VapidSigner.joseToDer(HEX.parseHex(SHORT_31_HIGH + SHORT_1)))
            .isEqualTo(derSignature(magnitude(SHORT_31_HIGH), magnitude(SHORT_1)));
    }

    @Test
    void testEncodePrivateKey_shouldLeftPadToFixedWidth_whenScalarIsTiny() {
        byte[] tinyScalar = HEX.parseHex(SHORT_1);

        byte[] encoded = VapidSigner.encodePrivateKey(VapidSigner.decodePrivateKey(tinyScalar));

        assertThat(encoded).hasSize(32).isEqualTo(tinyScalar);
    }

    @Test
    void testDecodePrivateKey_shouldFailWithSignError_whenScalarWidthIsNotThirtyTwo() {
        // exactly what the `dummy-vapid-private` placeholder decodes to: 14 bytes
        byte[] tooShort = Base64.getUrlDecoder().decode("dummy-vapid-private");
        assertThat(tooShort).hasSize(14);

        assertRejected(() -> VapidSigner.decodePrivateKey(tooShort));
        assertRejected(() -> VapidSigner.decodePrivateKey(new byte[33]));
    }

    @Test
    void testDecodePrivateKey_shouldFailWithSignError_whenScalarIsOutsideTheCurveOrder() {
        assertRejected(() -> VapidSigner.decodePrivateKey(new byte[32]));                 // s == 0
        assertRejected(() -> VapidSigner.decodePrivateKey(fixedWidth(curveOrder())));     // s == n
    }

    @Test
    void testAuthorizationHeader_shouldFailWithSignError_whenTheDummyPrivateKeyIsConfigured() {
        // A missing VAPID_PRIVATE must fail loudly on the first send, not sign a well-formed but
        // useless token that every push service silently rejects with 401.
        VapidSigner signer = new VapidSigner(
            new WebPushProperties("mailto:a@b.c", "dummy-vapid-public", "dummy-vapid-private", 3600));

        assertRejected(() -> signer.authorizationHeader("https://web.push.apple.com", NOW));
    }

    @Test
    void testAuthorizationHeader_shouldFailWithSignError_whenPushOriginAttemptsClaimInjection() {
        VapidSigner signer = signerWithRealKeypair();
        // positive control: with a real key the only possible reason to reject below is the origin
        assertThat(signer.authorizationHeader("https://web.push.apple.com:443", NOW)).startsWith("vapid t=");

        assertRejected(
            () -> signer.authorizationHeader("https://x\",\"sub\":\"mailto:attacker@evil.com", NOW));
        assertRejected(() -> signer.authorizationHeader("https://host/path", NOW));
        assertRejected(() -> signer.authorizationHeader("not-an-origin", NOW));
    }

    @Test
    void testDecodePublicKey_shouldFailWithKeyInvalid_whenTheClientPointIsMalformed() {
        // the other half of the split: client-supplied material stays a 400
        assertThatExceptionOfType(SystemRuntimeErrorException.class)
            .isThrownBy(() -> VapidSigner.decodePublicKey(new byte[64]))
            .satisfies(e -> {
                assertThat(e.getMessages()).hasSize(1);
                assertThat(e.getMessages().get(0).getCode()).isEqualTo("WEBPUSH_KEY_INVALID");
                assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
            });
    }

    // === helpers ================================================================================

    /** Asserts a server-side failure: WEBPUSH_SIGN_FAILED / 500. */
    private static void assertRejected(ThrowingCallable call) {
        assertThatExceptionOfType(SystemRuntimeErrorException.class)
            .isThrownBy(call)
            .satisfies(e -> {
                assertThat(e.getMessages()).hasSize(1);
                assertThat(e.getMessages().get(0).getCode()).isEqualTo("WEBPUSH_SIGN_FAILED");
                assertThat(e.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            });
    }

    private static BigInteger magnitude(String expectedBlock) {
        return new BigInteger(1, HEX.parseHex(expectedBlock));
    }

    /** Independent DER encoder — see the class javadoc for why this is not a re-derivation. */
    private static byte[] derSignature(BigInteger r, BigInteger s) {
        byte[] rInteger = derInteger(r);
        byte[] sInteger = derInteger(s);
        byte[] der = new byte[2 + rInteger.length + sInteger.length];
        der[0] = 0x30;
        der[1] = (byte) (rInteger.length + sInteger.length);
        System.arraycopy(rInteger, 0, der, 2, rInteger.length);
        System.arraycopy(sInteger, 0, der, 2 + rInteger.length, sInteger.length);
        return der;
    }

    private static byte[] derInteger(BigInteger value) {
        byte[] content = value.toByteArray();
        byte[] tlv = new byte[2 + content.length];
        tlv[0] = 0x02;
        tlv[1] = (byte) content.length;
        System.arraycopy(content, 0, tlv, 2, content.length);
        return tlv;
    }

    /** The curve order n, read off a real key rather than pasted from memory. */
    private static BigInteger curveOrder() {
        return ((ECPrivateKey) generateKeypair().getPrivate()).getParams().getOrder();
    }

    /** Right-aligns a 32-byte value into 32 bytes (n's high bit is set, so toByteArray gives 33). */
    private static byte[] fixedWidth(BigInteger value) {
        byte[] magnitude = value.toByteArray();
        return magnitude.length == 32
            ? magnitude
            : Arrays.copyOfRange(magnitude, magnitude.length - 32, magnitude.length);
    }

    private static VapidSigner signerWithRealKeypair() {
        KeyPair keyPair = generateKeypair();
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        return new VapidSigner(new WebPushProperties(
            "mailto:a@b.c",
            encoder.encodeToString(VapidSigner.encodePublicKey((ECPublicKey) keyPair.getPublic())),
            encoder.encodeToString(VapidSigner.encodePrivateKey((ECPrivateKey) keyPair.getPrivate())),
            3600));
    }

    private static KeyPair generateKeypair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"));
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
