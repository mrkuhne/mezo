package io.mrkuhne.mezo.feature.penz.service.sms;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SMS-ingest API keys, the pure half (Boop Pénz L4, mezo-r36n9.102, spec §10.1.7) — port of the old
 * {@code src/data/apiKeys.ts} {@code generateApiKey} and the ingest's {@code extractApiKey}, with the prefix
 * {@code mzp_} instead of {@code ft_}. Only {@link #hash} of a key and its last four characters are ever stored.
 */
public final class PenzSmsKeys {

    public static final String PREFIX = "mzp_";
    public static final String HEADER = "X-Api-Key";

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern BEARER = Pattern.compile("^Bearer\\s+(.+)$", Pattern.CASE_INSENSITIVE);

    private PenzSmsKeys() {
    }

    /** A fresh key: plaintext {@code mzp_<base64url of 32 random bytes, no padding>} (43 chars), hash, last4. */
    public record Generated(String plaintext, String hash, String last4) {

        @Override
        public String toString() {
            return "Generated[last4=" + last4 + "]"; // never the key itself
        }
    }

    public static Generated generate() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String key = PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        return new Generated(key, hash(key), key.substring(key.length() - 4));
    }

    /** The stored form of a key: lower-case hex SHA-256. */
    public static String hash(String key) {
        return SmsIngestLogic.sha256Hex(key);
    }

    /**
     * Port of {@code extractApiKey}: {@code X-Api-Key} (trimmed, non-empty) wins; else an
     * {@code Authorization: Bearer} token, but only one starting with {@value #PREFIX} — a JWT is never a key.
     */
    public static String extract(String xApiKey, String authorization) {
        String direct = xApiKey == null ? null : xApiKey.strip();
        if (direct != null && !direct.isEmpty()) {
            return direct;
        }
        Matcher m = BEARER.matcher(authorization == null ? "" : authorization.strip());
        if (!m.matches()) {
            return null;
        }
        String token = m.group(1).strip();
        return !token.isEmpty() && token.startsWith(PREFIX) ? token : null;
    }
}
