package io.mrkuhne.mezo.feature.mail.service.google;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.containing;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.service.google.GoogleOAuthClient.AccessToken;
import io.mrkuhne.mezo.feature.mail.service.google.GoogleOAuthClient.Tokens;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The Google token/revoke adapter against a local stub; every token, code and address is invented. */
class GoogleOAuthClientTest {

    private static final String CLIENT_ID = "123456-abcdef.apps.googleusercontent.com";
    private static final Instant NOW = Instant.parse("2026-11-25T10:00:00Z");
    private static final WireMockServer GOOGLE = new WireMockServer(wireMockConfig().dynamicPort());

    private GoogleOAuthClient client;

    @BeforeAll
    static void start() {
        GOOGLE.start();
    }

    @AfterAll
    static void stop() {
        GOOGLE.stop();
    }

    @BeforeEach
    void setUp() {
        GOOGLE.resetAll();
        MailProperties.Google google = new MailProperties.Google(CLIENT_ID, null, GOOGLE.baseUrl() + "/token",
            GOOGLE.baseUrl() + "/revoke", GOOGLE.baseUrl() + "/gmail/v1");
        client = new GoogleOAuthClient(google, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    static String idToken(String json) {
        Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
        return enc.encodeToString("{\"alg\":\"RS256\"}".getBytes(StandardCharsets.UTF_8)) + "."
            + enc.encodeToString(json.getBytes(StandardCharsets.UTF_8)) + ".sig";
    }

    private static String goodIdToken() {
        return idToken("{\"iss\":\"https://accounts.google.com\",\"aud\":\"" + CLIENT_ID
            + "\",\"email\":\"owner@gmail.example\",\"email_verified\":true}");
    }

    private void stubToken(String idToken) {
        GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withHeader("Content-Type",
            "application/json").withBody("{\"access_token\":\"at-1\",\"refresh_token\":\"rt-1\","
            + "\"expires_in\":3600,\"token_type\":\"Bearer\",\"id_token\":\"" + idToken + "\"}")));
    }

    @Test
    void exchangeReturnsTokensAndTheEmailFromTheIdToken() {
        stubToken(goodIdToken());

        Tokens t = client.exchange("auth-code", "verifier-1", "com.googleusercontent.apps.123456-abcdef:/oauth2redirect");

        assertThat(t.refreshToken()).isEqualTo("rt-1");
        assertThat(t.accessToken()).isEqualTo("at-1");
        assertThat(t.expiresAt()).isEqualTo(NOW.plusSeconds(3600));
        assertThat(t.email()).isEqualTo("owner@gmail.example");
        assertThat(t.toString()).doesNotContain("rt-1").doesNotContain("at-1");
        GOOGLE.verify(postRequestedFor(urlPathEqualTo("/token"))
            .withRequestBody(containing("grant_type=authorization_code"))
            .withRequestBody(containing("client_id=" + CLIENT_ID))
            .withRequestBody(containing("code_verifier=verifier-1"))
            .withRequestBody(containing("code=auth-code"))
            .withRequestBody(containing("redirect_uri=")));
        assertThat(GOOGLE.getAllServeEvents().get(0).getRequest().getBodyAsString()).doesNotContain("client_secret");
    }

    @Test
    void anAudienceMismatchIsRefused() {
        stubToken(idToken("{\"iss\":\"accounts.google.com\",\"aud\":\"someone-else.apps.googleusercontent.com\","
            + "\"email\":\"owner@gmail.example\",\"email_verified\":true}"));
        assertThatThrownBy(() -> client.exchange("c", "v", "r"))
            .isInstanceOf(SystemRuntimeErrorException.class).hasMessageContaining("MAIL_AUTH_FAILED");
    }

    @Test
    void anUnverifiedEmailOrForeignIssuerIsRefused() {
        stubToken(idToken("{\"iss\":\"accounts.google.com\",\"aud\":\"" + CLIENT_ID
            + "\",\"email\":\"o@gmail.example\",\"email_verified\":false}"));
        assertThatThrownBy(() -> client.exchange("c", "v", "r")).hasMessageContaining("MAIL_AUTH_FAILED");
        stubToken(idToken("{\"iss\":\"https://evil.example\",\"aud\":\"" + CLIENT_ID
            + "\",\"email\":\"o@gmail.example\",\"email_verified\":true}"));
        assertThatThrownBy(() -> client.exchange("c", "v", "r")).hasMessageContaining("MAIL_AUTH_FAILED");
    }

    @Test
    void invalidGrantIsAuthFailed() {
        GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withStatus(400)
            .withBody("{\"error\":\"invalid_grant\",\"error_description\":\"Bad code\"}")));
        assertThatThrownBy(() -> client.exchange("bad-code-1", "v", "r"))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("MAIL_AUTH_FAILED").hasMessageNotContaining("bad-code-1");
    }

    @Test
    void aServerErrorIsUnreachable() {
        GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withStatus(503)));
        assertThatThrownBy(() -> client.refresh("rt-1")).hasMessageContaining("MAIL_UNREACHABLE");
    }

    @Test
    void refreshReturnsAFreshAccessToken() {
        GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withHeader("Content-Type",
            "application/json").withBody("{\"access_token\":\"at-2\",\"expires_in\":1800,\"token_type\":\"Bearer\"}")));

        AccessToken a = client.refresh("rt-1");

        assertThat(a.token()).isEqualTo("at-2");
        assertThat(a.expiresAt()).isEqualTo(NOW.plusSeconds(1800));
        GOOGLE.verify(postRequestedFor(urlPathEqualTo("/token"))
            .withRequestBody(containing("grant_type=refresh_token"))
            .withRequestBody(containing("refresh_token=rt-1"))
            .withRequestBody(containing("client_id=" + CLIENT_ID)));
    }

    @Test
    void refreshInvalidGrantIsAuthFailed() {
        GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withStatus(400)
            .withBody("{\"error\":\"invalid_grant\"}")));
        assertThatThrownBy(() -> client.refresh("rt-1")).hasMessageContaining("MAIL_AUTH_FAILED");
    }

    @Test
    void revokePostsTheToken() {
        GOOGLE.stubFor(post(urlPathEqualTo("/revoke")).willReturn(aResponse().withStatus(200)));

        client.revoke("rt-1");

        GOOGLE.verify(postRequestedFor(urlPathEqualTo("/revoke"))
            .withHeader("Content-Type", containing("application/x-www-form-urlencoded"))
            .withRequestBody(equalTo("token=rt-1")));
    }

    @Test
    void aClientIdWithTrailingWhitespaceStillMatchesTheAudience() {
        MailProperties.Google google = new MailProperties.Google(CLIENT_ID + "\n", null, GOOGLE.baseUrl() + "/token",
            GOOGLE.baseUrl() + "/revoke", GOOGLE.baseUrl() + "/gmail/v1");
        GoogleOAuthClient padded = new GoogleOAuthClient(google, Clock.fixed(NOW, ZoneOffset.UTC));
        stubToken(goodIdToken());
        assertThat(padded.exchange("c", "v", "r").email()).isEqualTo("owner@gmail.example");
    }

    @Test
    void configurationErrorsAreUnreachableNotASignInAgain() {
        for (String error : new String[] {"invalid_client", "unauthorized_client", "invalid_request"}) {
            GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withStatus(400)
                .withBody("{\"error\":\"" + error + "\"}")));
            assertThatThrownBy(() -> client.refresh("rt-1")).as(error).hasMessageContaining("MAIL_UNREACHABLE");
            assertThatThrownBy(() -> client.exchange("c", "v", "r")).as(error)
                .hasMessageContaining("MAIL_UNREACHABLE");
        }
    }
}
