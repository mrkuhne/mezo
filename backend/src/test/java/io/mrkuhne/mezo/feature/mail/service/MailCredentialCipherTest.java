package io.mrkuhne.mezo.feature.mail.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.service.MailCredentialCipher.Sealed;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class MailCredentialCipherTest {

    private static MailProperties props(String key) {
        return new MailProperties(key, "0 0 8,15 * * *", "Europe/Budapest", 0.15, 7, 8, 36, 3, 90, 8, 6000, 30, 10,
            "imap.gmail.com", 993);
    }

    private static String key32() {
        return Base64.getEncoder().encodeToString(new byte[32]);
    }

    private final MailCredentialCipher cipher = new MailCredentialCipher(props(key32()));

    @Test
    void roundTrip() {
        assertThat(cipher.open(cipher.seal("abcd efgh ijkl mnop"))).isEqualTo("abcd efgh ijkl mnop");
    }

    @Test
    void freshNoncePerSeal() {
        Sealed a = cipher.seal("same");
        Sealed b = cipher.seal("same");
        assertThat(a.nonce()).isNotEqualTo(b.nonce());
        assertThat(a.cipher()).isNotEqualTo(b.cipher());
    }

    @Test
    void tamperedCipherFails() {
        Sealed s = cipher.seal("secret-value");
        byte[] bad = s.cipher().clone();
        bad[0] ^= 1;
        assertThatThrownBy(() -> cipher.open(new Sealed(bad, s.nonce())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(e -> assertThat(((SystemRuntimeErrorException) e).getMessages().get(0).getCode())
                .isEqualTo("MAIL_SECRET_UNREADABLE"));
    }

    @Test
    void wrongLengthKeyRejectedAtStartup() {
        String short16 = Base64.getEncoder().encodeToString(new byte[16]);
        assertThatThrownBy(() -> new MailCredentialCipher(props(short16)))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void knownDummyKeyRefusedWhenStrict() {
        assertThatThrownBy(() -> new MailCredentialCipher(props(MailCredentialCipher.DEV_DUMMY_KEY), true))
            .isInstanceOf(SystemRuntimeErrorException.class);
        // non-strict (dev/test) still accepts it
        assertThat(new MailCredentialCipher(props(MailCredentialCipher.DEV_DUMMY_KEY), false)).isNotNull();
    }

    @Test
    void blankKeyRejected() {
        assertThatThrownBy(() -> new MailCredentialCipher(props("")))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void toStringNeverLeaks() {
        Sealed s = cipher.seal("hunter2-secret");
        assertThat(s.toString()).doesNotContain("hunter2").doesNotContain("secret");
        assertThat(props(key32()).toString()).doesNotContain(key32());
    }
}
