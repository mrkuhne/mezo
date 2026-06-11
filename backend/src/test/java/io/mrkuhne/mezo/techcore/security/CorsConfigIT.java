package io.mrkuhne.mezo.techcore.security;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Verifies CORS is configured for the browser real-mode frontend origin — see mezo-6eo.
 *
 * <p>Server-to-server callers (curl, the other ITs) never send an {@code Origin}, so they were
 * unaffected by the missing config; these tests deliberately send the Vite dev origin to pin the
 * browser-observable behavior.
 */
class CorsConfigIT extends ApiIntegrationTest {

    private static final String ALLOWED_ORIGIN = "http://localhost:5180";
    private static final String DISALLOWED_ORIGIN = "http://evil.example";

    @Test
    void testPreflight_shouldAllowConfiguredOrigin_whenOriginIsViteDev() {
        HttpHeaders headers = new HttpHeaders();
        headers.setOrigin(ALLOWED_ORIGIN);
        headers.setAccessControlRequestMethod(HttpMethod.POST);

        ResponseEntity<String> response =
            exchangeForResponse(HttpMethod.OPTIONS, "/api/auth/login", null, headers);

        assertThat(response.getHeaders().getAccessControlAllowOrigin())
            .withFailMessage("expected ACAO header for allowed origin, got headers: %s", response.getHeaders())
            .isEqualTo(ALLOWED_ORIGIN);
    }

    @Test
    void testActualRequest_shouldCarryAllowOriginHeaderAnd200_whenAuthenticatedFromViteDev() {
        HttpHeaders headers = ownerAuthHeaders();
        headers.setOrigin(ALLOWED_ORIGIN);

        ResponseEntity<String> response =
            exchangeForResponse(HttpMethod.GET, "/api/train/mesocycles", null, headers);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getAccessControlAllowOrigin()).isEqualTo(ALLOWED_ORIGIN);
    }

    @Test
    void testPreflight_shouldNotAllowOrigin_whenOriginIsNotConfigured() {
        HttpHeaders headers = new HttpHeaders();
        headers.setOrigin(DISALLOWED_ORIGIN);
        headers.setAccessControlRequestMethod(HttpMethod.POST);

        ResponseEntity<String> response =
            exchangeForResponse(HttpMethod.OPTIONS, "/api/auth/login", null, headers);

        // Spring rejects a disallowed preflight origin with 403 and emits no ACAO echo.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getHeaders().getAccessControlAllowOrigin()).isNotEqualTo(DISALLOWED_ORIGIN);
    }
}
