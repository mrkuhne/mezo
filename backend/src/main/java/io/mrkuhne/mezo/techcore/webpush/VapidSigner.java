package io.mrkuhne.mezo.techcore.webpush;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * VAPID (RFC 8292) request signing for Web Push, on plain JDK crypto only — no BouncyCastle, no
 * JOSE library.
 *
 * <p>The one trap this class exists to contain: {@code SHA256withECDSA} emits a <b>DER</b>
 * signature (SEQUENCE of two variable-length INTEGERs), while JOSE/ES256 requires the raw
 * fixed-width {@code r‖s} form — exactly 64 bytes. Sending DER makes every push fail with 401, so
 * {@link #derToJose(byte[])} / {@link #joseToDer(byte[])} are the load-bearing pieces here.
 *
 * <p>The static key codecs are also the project's single P-256 key encoding: uncompressed
 * {@code 0x04 ‖ X(32) ‖ Y(32)} points and 32-byte scalars, matching what the browser's
 * {@code PushSubscription} hands us and what RFC 8291 encryption consumes.
 *
 * <p><b>Failure mapping.</b> Anything rooted in server configuration or in our own signature
 * encoding raises {@code WEBPUSH_SIGN_FAILED} (500); {@code WEBPUSH_KEY_INVALID} (400) is reserved
 * for key material that genuinely arrived from a client (a subscription's {@code p256dh}). Key
 * validation is deliberately strict: a misconfigured {@code VAPID_PRIVATE} must fail loudly on the
 * first send rather than produce a well-formed-but-useless token that 401s forever in silence.
 */
@Component
@RequiredArgsConstructor
public class VapidSigner {

    /** JOSE/P-256 field width: r, s, X, Y and the private scalar are all 32 bytes. */
    private static final int FIELD_LEN = 32;

    private static final byte UNCOMPRESSED_POINT_TAG = 0x04;
    private static final byte DER_SEQUENCE = 0x30;
    private static final byte DER_INTEGER = 0x02;
    /** DER long-form length with a single following length byte — the longest form P-256 can hit. */
    private static final int DER_LONG_FORM_1 = 0x81;

    private static final String JWT_HEADER_JSON = "{\"typ\":\"JWT\",\"alg\":\"ES256\"}";
    /** RFC 8292 caps `exp` at 24h ahead; 12h leaves room for clock skew on both ends. */
    private static final Duration TOKEN_TTL = Duration.ofHours(12);

    /**
     * A push endpoint origin: scheme + host + optional port, nothing else. The value is spliced
     * into a signed JWT's `aud`, so it is <b>validated</b> rather than escaped — a quote in it
     * could otherwise inject a second `sub` claim ahead of the real one.
     */
    private static final Pattern PUSH_ORIGIN = Pattern.compile("^https?://[A-Za-z0-9.\\-]+(:\\d+)?$");

    private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64URL_DECODER = Base64.getUrlDecoder();

    private final WebPushProperties properties;

    /**
     * Builds the complete {@code Authorization} header value for one push request.
     *
     * @param pushOrigin scheme + host of the subscription endpoint (the JWT `aud`), e.g.
     *     {@code https://web.push.apple.com}
     * @param now signing instant — {@code exp} is {@code now + 12h}
     * @return {@code vapid t=<jwt>, k=<publicKeyBase64Url>}
     */
    public String authorizationHeader(String pushOrigin, Instant now) {
        if (!PUSH_ORIGIN.matcher(pushOrigin).matches()) {
            throw signFailed();
        }
        String claims = "{\"aud\":\"" + pushOrigin
            + "\",\"exp\":" + now.plus(TOKEN_TTL).getEpochSecond()
            + ",\"sub\":\"" + properties.subject() + "\"}";
        String signingInput = base64Url(JWT_HEADER_JSON) + "." + base64Url(claims);
        String signature = B64URL.encodeToString(derToJose(sign(signingInput)));
        return "vapid t=" + signingInput + "." + signature + ", k=" + properties.publicKey();
    }

    /** Signs the JWT signing input with the configured VAPID private key, returning DER. */
    private byte[] sign(String signingInput) {
        try {
            Signature signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign(decodePrivateKey(properties.privateKey()));
            signature.update(signingInput.getBytes(StandardCharsets.UTF_8));
            return signature.sign();
        } catch (GeneralSecurityException e) {
            throw signFailed();
        }
    }

    // === Key codecs =============================================================================

    /** Encodes a P-256 public key as the 65-byte uncompressed point {@code 0x04 ‖ X(32) ‖ Y(32)}. */
    public static byte[] encodePublicKey(ECPublicKey key) {
        ECPoint point = key.getW();
        byte[] encoded = new byte[1 + 2 * FIELD_LEN];
        encoded[0] = UNCOMPRESSED_POINT_TAG;
        writeFieldElement(point.getAffineX().toByteArray(), encoded, 1, VapidSigner::signFailed);
        writeFieldElement(point.getAffineY().toByteArray(), encoded, 1 + FIELD_LEN, VapidSigner::signFailed);
        return encoded;
    }

    /** Encodes a P-256 private key as its raw 32-byte big-endian scalar. */
    public static byte[] encodePrivateKey(ECPrivateKey key) {
        byte[] encoded = new byte[FIELD_LEN];
        writeFieldElement(key.getS().toByteArray(), encoded, 0, VapidSigner::signFailed);
        return encoded;
    }

    /**
     * Rebuilds a P-256 private key from its raw big-endian scalar. The scalar is server
     * configuration, so every rejection here is a 500: the width must be exactly 32 bytes and the
     * value must be a usable private key ({@code 0 < s < n}). Without those checks a missing
     * {@code VAPID_PRIVATE} would decode to some short garbage scalar and happily sign a token that
     * every push service rejects with 401 — a silent, self-inflicted outage.
     */
    public static ECPrivateKey decodePrivateKey(byte[] scalar) {
        if (scalar.length != FIELD_LEN) {
            throw signFailed();
        }
        BigInteger s = new BigInteger(1, scalar);
        try {
            ECParameterSpec parameters = p256Parameters();
            if (s.signum() == 0 || s.compareTo(parameters.getOrder()) >= 0) {
                throw signFailed();
            }
            return (ECPrivateKey) KeyFactory.getInstance("EC")
                .generatePrivate(new ECPrivateKeySpec(s, parameters));
        } catch (GeneralSecurityException e) {
            throw signFailed();
        }
    }

    /** Rebuilds a P-256 private key from its base64url-encoded raw scalar (server config → 500). */
    public static ECPrivateKey decodePrivateKey(String base64UrlScalar) {
        return decodePrivateKey(decodeBase64Url(base64UrlScalar, VapidSigner::signFailed));
    }

    /**
     * Rebuilds a P-256 public key from a 65-byte uncompressed point — the form both the VAPID
     * public key and a browser subscription's {@code p256dh} arrive in. Client-supplied material,
     * so a malformed point is a 400.
     */
    public static ECPublicKey decodePublicKey(byte[] uncompressedPoint) {
        if (uncompressedPoint.length != 1 + 2 * FIELD_LEN
            || uncompressedPoint[0] != UNCOMPRESSED_POINT_TAG) {
            throw keyInvalid();
        }
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(uncompressedPoint, 1, 1 + FIELD_LEN));
        BigInteger y =
            new BigInteger(1, Arrays.copyOfRange(uncompressedPoint, 1 + FIELD_LEN, uncompressedPoint.length));
        try {
            return (ECPublicKey) KeyFactory.getInstance("EC")
                .generatePublic(new ECPublicKeySpec(new ECPoint(x, y), p256Parameters()));
        } catch (GeneralSecurityException e) {
            throw keyInvalid();
        }
    }

    /** Rebuilds a P-256 public key from a base64url-encoded uncompressed point (client → 400). */
    public static ECPublicKey decodePublicKey(String base64UrlPoint) {
        return decodePublicKey(decodeBase64Url(base64UrlPoint, VapidSigner::keyInvalid));
    }

    // === DER <-> JOSE signature conversion ======================================================

    /**
     * Converts the JDK's DER ECDSA signature ({@code SEQUENCE { INTEGER r, INTEGER s }}) into the
     * JOSE/ES256 form: {@code r‖s}, each left-zero-padded to 32 bytes, exactly 64 bytes total.
     * DER INTEGERs are minimal-length and may carry a leading {@code 0x00} sign byte (33 bytes) or
     * be shorter than 32 — both are normalised here.
     */
    public static byte[] derToJose(byte[] der) {
        int index = 0;
        if (der.length < 8 || der[index++] != DER_SEQUENCE) {
            throw signFailed();
        }
        int sequenceLength = der[index++] & 0xFF;
        if (sequenceLength == DER_LONG_FORM_1) {
            sequenceLength = der[index++] & 0xFF;
        }
        if (index + sequenceLength != der.length) {
            throw signFailed();
        }

        byte[] jose = new byte[2 * FIELD_LEN];
        index = readDerInteger(der, index, jose, 0);
        index = readDerInteger(der, index, jose, FIELD_LEN);
        if (index != der.length) {
            throw signFailed();
        }
        return jose;
    }

    /**
     * Converts a 64-byte JOSE/ES256 {@code r‖s} signature back into DER so the JDK's
     * {@code SHA256withECDSA} verifier accepts it.
     */
    public static byte[] joseToDer(byte[] jose) {
        if (jose.length != 2 * FIELD_LEN) {
            throw signFailed();
        }
        byte[] r = derInteger(Arrays.copyOfRange(jose, 0, FIELD_LEN));
        byte[] s = derInteger(Arrays.copyOfRange(jose, FIELD_LEN, 2 * FIELD_LEN));
        // max 2 * (2 + 33) = 70 content bytes -> the short-form length byte always suffices
        byte[] der = new byte[2 + r.length + s.length];
        der[0] = DER_SEQUENCE;
        der[1] = (byte) (r.length + s.length);
        System.arraycopy(r, 0, der, 2, r.length);
        System.arraycopy(s, 0, der, 2 + r.length, s.length);
        return der;
    }

    /**
     * Reads one DER INTEGER at {@code index} and writes its 32-byte left-padded magnitude into
     * {@code target} at {@code targetOffset}.
     *
     * @return the index just past the INTEGER that was read
     */
    private static int readDerInteger(byte[] der, int index, byte[] target, int targetOffset) {
        if (index + 2 > der.length || der[index] != DER_INTEGER) {
            throw signFailed();
        }
        int length = der[index + 1] & 0xFF;
        int valueStart = index + 2;
        if (length == 0 || valueStart + length > der.length) {
            throw signFailed();
        }
        writeFieldElement(
            Arrays.copyOfRange(der, valueStart, valueStart + length), target, targetOffset,
            VapidSigner::signFailed);
        return valueStart + length;
    }

    /** TLV-encodes one raw 32-byte field element as a minimal-length, positive DER INTEGER. */
    private static byte[] derInteger(byte[] raw) {
        int start = stripLeadingZeros(raw);
        int length = raw.length - start;
        // a high bit set would read as negative in DER -> prepend a 0x00 sign byte
        boolean signByte = (raw[start] & 0x80) != 0;
        byte[] tlv = new byte[2 + (signByte ? 1 : 0) + length];
        tlv[0] = DER_INTEGER;
        tlv[1] = (byte) (length + (signByte ? 1 : 0));
        System.arraycopy(raw, start, tlv, signByte ? 3 : 2, length);  // tlv[2] stays 0x00
        return tlv;
    }

    // === Shared helpers =========================================================================

    /**
     * Writes a big-endian magnitude into {@code target} as a fixed 32-byte, left-zero-padded field
     * element — stripping the leading sign byte that {@code BigInteger.toByteArray()} and DER
     * INTEGERs may carry, and left-padding values shorter than 32 bytes. Every field element in
     * this class routes through here, hence the caller-supplied error: an over-wide DER INTEGER is
     * our own signature encoding failing (500), not a bad client key.
     */
    private static void writeFieldElement(
        byte[] magnitude, byte[] target, int targetOffset,
        Supplier<SystemRuntimeErrorException> onTooWide) {
        int start = stripLeadingZeros(magnitude);
        int length = magnitude.length - start;
        if (length > FIELD_LEN) {
            throw onTooWide.get();
        }
        System.arraycopy(magnitude, start, target, targetOffset + FIELD_LEN - length, length);
    }

    /** First index of the significant magnitude (keeps at least one byte, so 0 stays encodable). */
    private static int stripLeadingZeros(byte[] magnitude) {
        int start = 0;
        while (start < magnitude.length - 1 && magnitude[start] == 0) {
            start++;
        }
        return start;
    }

    /** The secp256r1 (P-256) domain parameters, straight from the platform EC provider. */
    private static ECParameterSpec p256Parameters() throws GeneralSecurityException {
        AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
        parameters.init(new ECGenParameterSpec("secp256r1"));
        return parameters.getParameterSpec(ECParameterSpec.class);
    }

    private static String base64Url(String json) {
        return B64URL.encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] decodeBase64Url(String value, Supplier<SystemRuntimeErrorException> onInvalid) {
        try {
            return B64URL_DECODER.decode(value);
        } catch (IllegalArgumentException e) {
            throw onInvalid.get();
        }
    }

    /** Client-supplied key material was malformed (a subscription's `p256dh`). */
    private static SystemRuntimeErrorException keyInvalid() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("WEBPUSH_KEY_INVALID").build(), HttpStatus.BAD_REQUEST);
    }

    /** Server configuration or our own signature encoding failed. */
    private static SystemRuntimeErrorException signFailed() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("WEBPUSH_SIGN_FAILED").build(), HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
