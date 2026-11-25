package io.mrkuhne.mezo.feature.mail.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MailGoogleConnectRequest;
import io.mrkuhne.mezo.api.dto.MailMailboxResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** Without a Google client id the button is off: the mailbox shows no id and the connect is 409 (spec §12). */
@TestPropertySource(properties = "mezo.mail.enabled=true")
class MailGoogleUnconfiguredIT extends ApiIntegrationTest {

    @Test
    void connectIs409AndTheMailboxShowsNoClientId() {
        RegisteredUser u = registerUser("mail google off");

        String body = exchangeForBody(HttpMethod.POST, "/api/mail/mailbox/google",
            new MailGoogleConnectRequest().code("c").codeVerifier("v".repeat(43)).redirectUri("x:/oauth2redirect"),
            u.headers(), HttpStatus.CONFLICT, String.class);
        assertThat(body).contains("MAIL_GOOGLE_NOT_CONFIGURED");

        MailMailboxResponse r = getForBody("/api/mail/mailbox", u.headers(), HttpStatus.OK, MailMailboxResponse.class);
        assertThat(r.getGoogleClientId()).isNull();
        assertThat(r.getState()).isEqualTo("none");
    }
}
