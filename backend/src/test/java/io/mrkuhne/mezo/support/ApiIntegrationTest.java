package io.mrkuhne.mezo.support;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
        headers.setBearerAuth(token.getToken());
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

    protected <T> T patchForBody(String uri, Object request, HttpHeaders headers, HttpStatus expectedStatus, Class<T> bodyType) {
        return exchangeForBody(HttpMethod.PATCH, uri, request, headers, expectedStatus, bodyType);
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

    /**
     * Raw exchange that returns the full {@link ResponseEntity} (status + headers + body) without
     * asserting the status. Use when the test needs to inspect response headers (e.g. CORS
     * {@code Access-Control-Allow-Origin}) or a CORS preflight OPTIONS, which the body-only verb
     * helpers above deliberately hide.
     */
    protected ResponseEntity<String> exchangeForResponse(
        HttpMethod method, String uri, Object request, HttpHeaders headers
    ) {
        return rest.exchange(uri, method, new HttpEntity<>(request, headers), String.class);
    }

    // ==== multipart/form-data helpers (mezo-78rn — meal ai-draft; reusable for future multipart ITs) ====

    /**
     * POSTs a {@code multipart/form-data} body as the seeded owner and returns the full
     * {@link ResponseEntity} WITHOUT asserting the status (the caller inspects status + body).
     * Plain form fields go in as raw values; a file part is an {@link HttpEntity} wrapping a
     * {@link #photoPart(byte[], String)} resource with its own {@code Content-Type} part header.
     */
    protected <T> ResponseEntity<T> postMultipartForResponse(
        String path, org.springframework.util.MultiValueMap<String, Object> parts, Class<T> responseType
    ) {
        HttpHeaders headers = ownerAuthHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        return rest.exchange(path, HttpMethod.POST, new HttpEntity<>(parts, headers), responseType);
    }

    /**
     * A named byte[] file part for {@code multipart/form-data} — the anonymous subclass supplies the
     * filename so {@code FormHttpMessageConverter} emits a real file part (a bare
     * {@code ByteArrayResource} has no filename and is rejected as a field). Wrap the result in an
     * {@code HttpEntity} carrying a {@code Content-Type} header to drive the part's declared MIME type.
     */
    protected static org.springframework.core.io.ByteArrayResource photoPart(byte[] bytes, String filename) {
        return new org.springframework.core.io.ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
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
