package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.service.InviteService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import tools.jackson.databind.JsonNode;

class LanguageIT extends ApiIntegrationTest {

    @Autowired private AppUserRepository users;
    @Autowired private InviteService inviteService;

    private static String bundleText(String bundle, String key) throws IOException {
        Properties p = new Properties();
        try (InputStream in = LanguageIT.class.getResourceAsStream("/" + bundle);
             InputStreamReader reader = new InputStreamReader(in, StandardCharsets.UTF_8)) {
            p.load(reader);
        }
        return p.getProperty(key);
    }

    private MeResponse me(HttpHeaders headers) {
        return getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class);
    }

    private String firstMessage(String errorBody) {
        JsonNode list = objectMapper.readTree(errorBody);
        return list.get(0).path("message").asString();
    }

    @Test
    void me_returns_hu_for_an_existing_account() {
        var user = registerUser("lang-me");
        assertThat(me(user.headers()).getLanguage().getValue()).isEqualTo("hu");
        assertThat(me(ownerAuthHeaders()).getLanguage().getValue()).isEqualTo("hu");
    }

    @Test
    void put_language_switches_and_me_reflects_it() {
        var user = registerUser("lang-switch");
        var switched = putForBody("/api/auth/me/language", Map.of("language", "en"),
            user.headers(), HttpStatus.OK, MeResponse.class);
        assertThat(switched.getLanguage().getValue()).isEqualTo("en");
        assertThat(me(user.headers()).getLanguage().getValue()).isEqualTo("en");
        var back = putForBody("/api/auth/me/language", Map.of("language", "hu"),
            user.headers(), HttpStatus.OK, MeResponse.class);
        assertThat(back.getLanguage().getValue()).isEqualTo("hu");
    }

    @Test
    void put_language_rejects_an_unsupported_value() {
        var user = registerUser("lang-bad");
        String body = putForBody("/api/auth/me/language", Map.of("language", "de"),
            user.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "language", "VALIDATION_INVALID_VALUE");
        assertThat(me(user.headers()).getLanguage().getValue()).isEqualTo("hu");
    }

    @Test
    void put_language_leaves_name_email_role_untouched() {
        var user = registerUser("lang-keep");
        var before = me(user.headers());
        var after = putForBody("/api/auth/me/language", Map.of("language", "en"),
            user.headers(), HttpStatus.OK, MeResponse.class);
        assertThat(after.getId()).isEqualTo(before.getId());
        assertThat(after.getName()).isEqualTo(before.getName());
        assertThat(after.getEmail()).isEqualTo(before.getEmail());
        assertThat(after.getRole()).isEqualTo(before.getRole());
        assertThat(after.getTimezone()).isEqualTo(before.getTimezone());
        assertThat(after.getOnboarded()).isEqualTo(before.getOnboarded());
        assertThat(users.findById(user.id()).orElseThrow().getStatus().name()).isEqualTo("ACTIVE");
    }

    @Test
    void put_language_requires_authentication() {
        putForBody("/api/auth/me/language", Map.of("language", "en"), null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void register_with_language_en_creates_an_english_account() {
        UUID ownerId = users.findByEmail(ownerEmail()).orElseThrow().getId();
        String code = inviteService.create(ownerId, "lang-en", null).getCode();
        RegisterRequest request = new RegisterRequest(code, "lang-en-" + UUID.randomUUID() + "@test.local",
            "teszt-jelszo-1", "Lang En", io.mrkuhne.mezo.api.dto.Language.EN);
        TokenResponse token = postForBody("/api/auth/register", request, null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.getToken());
        assertThat(me(headers).getLanguage().getValue()).isEqualTo("en");
    }

    @Test
    void register_without_language_defaults_to_hu() {
        var user = registerUser("lang-default");
        assertThat(me(user.headers()).getLanguage().getValue()).isEqualTo("hu");
    }

    @Test
    void error_message_follows_the_account_language() throws IOException {
        var user = registerUser("lang-error");
        Map<String, String> wrong = Map.of("currentPassword", "nem-ez-a-jelszo", "newPassword", "uj-jelszo-12345");

        String hu = postForBody("/api/auth/change-password", wrong, user.headers(), HttpStatus.UNAUTHORIZED, String.class);
        assertThat(firstMessage(hu)).isEqualTo(bundleText("messages_hu.properties", "AUTH_LOGIN_INVALID_CREDENTIALS"));

        putForBody("/api/auth/me/language", Map.of("language", "en"), user.headers(), HttpStatus.OK, MeResponse.class);
        String en = postForBody("/api/auth/change-password", wrong, user.headers(), HttpStatus.UNAUTHORIZED, String.class);
        assertThat(firstMessage(en)).isEqualTo(bundleText("messages_en.properties", "AUTH_LOGIN_INVALID_CREDENTIALS"));
        assertThat(firstMessage(en)).isNotEqualTo(firstMessage(hu));
    }

    @Test
    void unauthenticated_error_follows_accept_language() throws IOException {
        LoginRequest bad = new LoginRequest("nobody@test.local", "rossz-jelszo");

        assertThat(firstMessage(loginFailure(bad, "en-GB,en;q=0.9")))
            .isEqualTo(bundleText("messages_en.properties", "AUTH_LOGIN_INVALID_CREDENTIALS"));
        assertThat(firstMessage(loginFailure(bad, "hu-HU")))
            .isEqualTo(bundleText("messages_hu.properties", "AUTH_LOGIN_INVALID_CREDENTIALS"));
        assertThat(firstMessage(loginFailure(bad, null)))
            .isEqualTo(bundleText("messages_hu.properties", "AUTH_LOGIN_INVALID_CREDENTIALS"));
        assertThat(firstMessage(loginFailure(bad, "de")))
            .isEqualTo(bundleText("messages_hu.properties", "AUTH_LOGIN_INVALID_CREDENTIALS"));
    }

    private String loginFailure(LoginRequest bad, String acceptLanguage) {
        HttpHeaders headers = new HttpHeaders();
        if (acceptLanguage != null) {
            headers.set(HttpHeaders.ACCEPT_LANGUAGE, acceptLanguage);
        }
        ResponseEntity<String> response = rest.exchange("/api/auth/login", HttpMethod.POST,
            new HttpEntity<>(bad, headers), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        return response.getBody();
    }

    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    private String ownerEmail() {
        return ownerProperties.ownerEmail();
    }
}
