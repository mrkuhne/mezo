package io.mrkuhne.mezo.support;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.dto.LoginRequest;
import io.mrkuhne.mezo.feature.auth.dto.TokenResponse;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Base class for HTTP-level (controller) integration tests — see
 * docs/references/integration_test_framework.md.
 *
 * <p>Runs the app on a random port with the {@code demodata} profile (so the owner
 * exists for login) and exposes:
 * <ul>
 *   <li>{@link #ownerAuthHeaders()} — Bearer headers for the seeded owner</li>
 *   <li>HTTP verb helpers that ALWAYS assert the expected status and deserialize
 *       the body, with the response body included in the failure message</li>
 *   <li>{@code assertHasFieldError} / {@code assertHasRequestError} — asserts on the
 *       {@code SystemMessage} error contract of {@code GlobalExceptionHandler}</li>
 * </ul>
 *
 * <p>NOT {@code @Transactional}: requests run in the server's own transactions, so
 * cleanup relies on the inherited per-test {@code ResetDatabase} instead of rollback.
 */
@ActiveProfiles("demodata")
@AutoConfigureTestRestTemplate
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class ApiIntegrationTest extends AbstractIntegrationTest {

    @Autowired protected TestRestTemplate rest;
    @Autowired protected DatabasePopulator databasePopulator;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired private OwnerProperties ownerProperties;

    /** Logs in as the demodata owner and returns ready-to-use Bearer headers. */
    protected HttpHeaders ownerAuthHeaders() {
        TokenResponse token = postForBody("/api/auth/login",
            new LoginRequest(ownerProperties.ownerEmail(), ownerProperties.ownerPassword()),
            null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.token());
        return headers;
    }

    // ==== HTTP verb helpers — expected status is ALWAYS asserted ====

    protected <T> T getForBody(String uri, HttpHeaders headers, HttpStatus expectedStatus, Class<T> bodyType) {
        return exchangeForBody(HttpMethod.GET, uri, null, headers, expectedStatus, bodyType);
    }

    protected <T> List<T> getForList(String uri, HttpHeaders headers, HttpStatus expectedStatus, Class<T> elementType) {
        String body = exchangeForBody(HttpMethod.GET, uri, null, headers, expectedStatus, String.class);
        try {
            return objectMapper.readValue(body,
                objectMapper.getTypeFactory().constructCollectionType(List.class, elementType));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to deserialize list of " + elementType.getName() + ": " + body, e);
        }
    }

    protected <T> T postForBody(String uri, Object request, HttpHeaders headers, HttpStatus expectedStatus, Class<T> bodyType) {
        return exchangeForBody(HttpMethod.POST, uri, request, headers, expectedStatus, bodyType);
    }

    protected <T> T putForBody(String uri, Object request, HttpHeaders headers, HttpStatus expectedStatus, Class<T> bodyType) {
        return exchangeForBody(HttpMethod.PUT, uri, request, headers, expectedStatus, bodyType);
    }

    protected void deleteAndExpect(String uri, HttpHeaders headers, HttpStatus expectedStatus) {
        exchangeForBody(HttpMethod.DELETE, uri, null, headers, expectedStatus, String.class);
    }

    protected <T> T exchangeForBody(
        HttpMethod method, String uri, Object request, HttpHeaders headers, HttpStatus expectedStatus, Class<T> bodyType
    ) {
        ResponseEntity<String> response = rest.exchange(uri, method, new HttpEntity<>(request, headers), String.class);
        assertThat(response.getStatusCode())
            .withFailMessage("%s %s -> expected %s but got %s; body: %s",
                method, uri, expectedStatus, response.getStatusCode(), response.getBody())
            .isEqualTo(expectedStatus);
        return deserialize(response.getBody(), bodyType);
    }

    @SuppressWarnings("unchecked")
    private <T> T deserialize(String body, Class<T> bodyType) {
        if (bodyType == Void.class || body == null || body.isEmpty()) {
            return null;
        }
        if (bodyType == String.class) {
            return (T) body;
        }
        try {
            return objectMapper.readValue(body, bodyType);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to deserialize response to " + bodyType.getName() + ": " + body, e);
        }
    }

    // ==== SystemMessage error-contract assertions ====

    /** Asserts the error body contains a FIELD-type SystemMessage with the given field and code. */
    protected void assertHasFieldError(String responseBody, String fieldName, String code) {
        assertThat(hasError(responseBody, "FIELD", code, fieldName))
            .withFailMessage("FIELD error not found: fieldName=%s, code=%s in body: %s", fieldName, code, responseBody)
            .isTrue();
    }

    /** Asserts the error body contains a REQUEST-type SystemMessage with the given code. */
    protected void assertHasRequestError(String responseBody, String code) {
        assertThat(hasError(responseBody, "REQUEST", code, null))
            .withFailMessage("REQUEST error not found: code=%s in body: %s", code, responseBody)
            .isTrue();
    }

    private boolean hasError(String responseBody, String type, String code, String fieldName) {
        JsonNode messages;
        try {
            messages = objectMapper.readTree(responseBody);
        } catch (Exception e) {
            throw new IllegalStateException("Error body is not valid JSON: " + responseBody, e);
        }
        if (!messages.isArray()) {
            return false;
        }
        for (JsonNode m : messages) {
            boolean matches = type.equals(m.path("type").asString())
                && code.equals(m.path("code").asString())
                && (fieldName == null || fieldName.equals(m.path("fieldName").asString()));
            if (matches) {
                return true;
            }
        }
        return false;
    }
}
