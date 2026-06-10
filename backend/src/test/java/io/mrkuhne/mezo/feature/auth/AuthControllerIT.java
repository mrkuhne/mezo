package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.dto.LoginRequest;
import io.mrkuhne.mezo.feature.auth.dto.TokenResponse;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("demodata")
@AutoConfigureTestRestTemplate
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthControllerIT extends AbstractIntegrationTest {

    @Autowired private TestRestTemplate rest;

    @Test
    void testLogin_shouldReturnToken_whenCredentialsValid() {
        var resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("owner@mezo.local", "owner"), TokenResponse.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().token()).isNotBlank();
    }

    @Test
    void testLogin_shouldReturn401_whenPasswordWrong() {
        var resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("owner@mezo.local", "wrong"), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void testLogin_shouldReturn400FieldErrors_whenEmailMalformed() {
        var resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("not-an-email", ""), String.class);
        // proves Fix A: @Valid -> 400, not 500
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testProtectedPath_shouldReturn401_whenNoToken() {
        var resp = rest.getForEntity("/api/biometrics/weight", String.class);
        // security filter precedes routing — 401 even though the endpoint doesn't exist yet
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
