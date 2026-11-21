package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Seals the mailbox app password at rest: AES-256-GCM, a fresh 12-byte nonce per seal, 128-bit tag. */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailCredentialCipher {

    public static final String UNREADABLE = "MAIL_SECRET_UNREADABLE";

    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final int KEY_BYTES = 32;

    /** The stored form; {@code toString} never shows content. */
    public record Sealed(byte[] cipher, byte[] nonce) {
        @Override
        public String toString() {
            return "Sealed[" + cipher.length + " bytes]";
        }
    }

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    /** The well-known dev/test key; refused outright when {@code mezo.auth.strict} (production). */
    public static final String DEV_DUMMY_KEY = "Ym9vcC1kZXYtb25seS1tYWlsLWtleS0zMmJ5dGVzISE=";

    public MailCredentialCipher(MailProperties properties) {
        this(properties, false);
    }

    @Autowired
    public MailCredentialCipher(MailProperties properties, @Value("${mezo.auth.strict:false}") boolean strict) {
        if (properties.secretKey() == null || properties.secretKey().isBlank()
            || (strict && DEV_DUMMY_KEY.equals(properties.secretKey()))) {
            throw unreadable();
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(properties.secretKey());
        } catch (IllegalArgumentException e) {
            throw unreadable();
        }
        if (raw.length != KEY_BYTES) {
            throw unreadable();
        }
        this.key = new SecretKeySpec(raw, "AES");
    }

    public Sealed seal(String secret) {
        byte[] nonce = new byte[NONCE_BYTES];
        random.nextBytes(nonce);
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
            return new Sealed(c.doFinal(secret.getBytes(StandardCharsets.UTF_8)), nonce);
        } catch (GeneralSecurityException e) {
            throw unreadable();
        }
    }

    public String open(Sealed sealed) {
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, sealed.nonce()));
            return new String(c.doFinal(sealed.cipher()), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | RuntimeException e) {
            throw unreadable();
        }
    }

    private static SystemRuntimeErrorException unreadable() {
        return new SystemRuntimeErrorException(SystemMessage.error(UNREADABLE).build(),
            HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
