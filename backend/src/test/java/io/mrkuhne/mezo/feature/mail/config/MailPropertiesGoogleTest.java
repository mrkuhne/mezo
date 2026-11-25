package io.mrkuhne.mezo.feature.mail.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.mail.config.MailProperties.Google;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

/** The Google settings: the host allow-list and the normalised client id (spec §12.2). */
class MailPropertiesGoogleTest {

    private static Google urls(String token, String revoke, String api) {
        return new Google("1-a.apps.googleusercontent.com", null, token, revoke, api);
    }

    private static boolean valid(Google g) {
        return Validation.buildDefaultValidatorFactory().getValidator().validate(g).isEmpty();
    }

    @Test
    void theProductionEndpointsAreAllowed() {
        assertThat(valid(Google.of("1-a.apps.googleusercontent.com"))).isTrue();
    }

    @Test
    void loopbackStubsAreAllowedForTests() {
        assertThat(valid(urls("http://127.0.0.1:8080/token", "http://localhost:8080/revoke",
            "http://127.0.0.1:8080/gmail/v1"))).isTrue();
    }

    @Test
    void aForeignHostOrPlainHttpIsRefused() {
        String t = "https://oauth2.googleapis.com/token";
        String r = "https://oauth2.googleapis.com/revoke";
        String a = "https://gmail.googleapis.com/gmail/v1";
        assertThat(valid(urls("https://evil.example/token", r, a))).isFalse();
        assertThat(valid(urls(t, "http://oauth2.googleapis.com/revoke", a))).isFalse();
        assertThat(valid(urls(t, r, "https://oauth2.googleapis.com/gmail/v1"))).isFalse();
        assertThat(valid(urls(t, r, "https://gmail.googleapis.com.evil.example/gmail/v1"))).isFalse();
        assertThat(valid(urls(t, r, "https://user@gmail.googleapis.com/gmail/v1"))).isFalse();
    }

    @Test
    void theClientIdIsTrimmedOnce() {
        Google g = Google.of("  123456-abcdef.apps.googleusercontent.com\n");
        assertThat(g.clientId()).isEqualTo("123456-abcdef.apps.googleusercontent.com");
        assertThat(g.expectedRedirectUri()).isEqualTo("com.googleusercontent.apps.123456-abcdef:/oauth2redirect");
        assertThat(Google.of(" \n").configured()).isFalse();
    }
}
