package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.dto.LoginRequest;
import io.mrkuhne.mezo.feature.auth.dto.TokenResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AuthControllerIT extends ApiIntegrationTest {

    @Test
    void testLogin_shouldReturnToken_whenCredentialsValid() {
        TokenResponse token = postForBody("/api/auth/login",
            new LoginRequest("owner@mezo.local", "owner"), null, HttpStatus.OK, TokenResponse.class);
        assertThat(token.token()).isNotBlank();
    }

    @Test
    void testLogin_shouldReturn401_whenPasswordWrong() {
        String body = postForBody("/api/auth/login",
            new LoginRequest("owner@mezo.local", "wrong"), null, HttpStatus.UNAUTHORIZED, String.class);
        assertHasRequestError(body, "AUTH_LOGIN_INVALID_CREDENTIALS");
    }

    @Test
    void testLogin_shouldReturn400FieldErrors_whenEmailMalformed() {
        String body = postForBody("/api/auth/login",
            new LoginRequest("not-an-email", ""), null, HttpStatus.BAD_REQUEST, String.class);
        // proves Fix A: @Valid -> 400 FIELD messages, not 500
        assertHasFieldError(body, "email", "VALIDATION_INVALID_EMAIL");
        assertHasFieldError(body, "password", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testProtectedPath_shouldReturn401_whenNoToken() {
        // security filter precedes routing — 401 even without a matching endpoint
        getForBody("/api/biometrics/weight", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testOwnerAuthHeaders_shouldAuthorizeProtectedCall_whenUsed() {
        getForBody("/api/biometrics/weight", ownerAuthHeaders(), HttpStatus.OK, String.class);
    }
}
